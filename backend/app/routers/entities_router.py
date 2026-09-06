from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_investigator
from ..graph_store import store
from ..database import get_db
from ..trust_chain import append_event
from sqlalchemy.orm import Session
from ..entity_resolution import find_candidates
from ..schemas import ManualEntity, ManualRelationship

router = APIRouter(prefix="/entities", tags=["entities"])

REL_CATEGORY = {
    "called": "communication", "communicated_with": "communication",
    "transferred_money_to": "financial", "paid": "financial", "sent_money_to": "financial",
    "owns": "asset", "uses": "asset", "registered_to": "asset",
    "associated_with": "association", "employed_by": "association", "member_of": "association",
    "visited": "location", "resides_at": "location",
    "possible_match": "resolution",
}


@router.get("")
def list_entities(type: str = Query(None), current=Depends(get_current_investigator)):
    return {"entities": store.all_entities(entity_type=type)}


@router.post("")
def create_entity(payload: ManualEntity, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    entity_id = store.add_entity(payload.type, payload.name, payload.attributes,
                                  source=f"manual:{current.username}")
    store.save()
    append_event(db, event_type="ENTITY_CREATED", record_type="entity", record_id=entity_id,
                 data={"entity_type": payload.type, "name": payload.name, "attributes": payload.attributes},
                 actor=current.username, source="entities")
    db.commit()
    return store.get_entity(entity_id)


@router.get("/{entity_id}")
def get_entity(entity_id: str, current=Depends(get_current_investigator)):
    entity = store.get_entity(entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    return entity


@router.get("/{entity_id}/profile")
def entity_profile(entity_id: str, current=Depends(get_current_investigator)):
    entity = store.get_entity(entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    rels = store.get_relationships(entity_id)
    grouped = {"communication": [], "financial": [], "asset": [], "association": [],
               "location": [], "resolution": [], "other": []}
    connected_ids = set()
    for r in rels:
        other_id = r["target"] if r["source"] == entity_id else r["source"]
        connected_ids.add(other_id)
        other = store.get_entity(other_id) or {}
        if r.get("type") == "owns" and other.get("type") == "Account":
            cat = "financial"
        else:
            cat = REL_CATEGORY.get(r.get("type"), "other")
        grouped[cat].append({
            **r,
            "direction": "outgoing" if r["source"] == entity_id else "incoming",
            "other_entity": {"id": other_id, "name": other.get("name"), "type": other.get("type")},
        })
    connected_entities = [store.get_entity(cid) for cid in connected_ids]
    return {
        "entity": entity,
        "connections_summary": {k: len(v) for k, v in grouped.items()},
        "relationships": grouped,
        "connected_entities": connected_entities,
        "connection_count": len(connected_ids),
    }


@router.get("/{entity_id}/connections")
def entity_connections(entity_id: str, depth: int = 1, current=Depends(get_current_investigator)):
    if not store.get_entity(entity_id):
        raise HTTPException(404, "Entity not found")
    return store.neighborhood(entity_id, depth=depth)


@router.get("/{entity_id}/resolution-candidates")
def resolution_candidates(entity_id: str, current=Depends(get_current_investigator)):
    target = store.get_entity(entity_id)
    if not target:
        raise HTTPException(404, "Entity not found")
    pool = store.all_entities(entity_type=target.get("type"))
    return {"candidates": find_candidates(target, pool)}


@router.post("/relationships")
def create_relationship(payload: ManualRelationship, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    try:
        edge_id = store.add_relationship(
            payload.source_id, payload.target_id, payload.type,
            attributes=payload.attributes, confidence=payload.confidence,
            evidence=[f"Manually added by {current.username}"],
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    store.save()
    append_event(db, event_type="RELATIONSHIP_CREATED", record_type="relationship", record_id=edge_id,
                 data={"source_id": payload.source_id, "target_id": payload.target_id,
                       "relationship_type": payload.type, "attributes": payload.attributes},
                 actor=current.username, source="entities")
    db.commit()
    return {"relationship_id": edge_id}

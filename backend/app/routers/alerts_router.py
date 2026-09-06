import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_investigator
from ..database import get_db, Alert
from ..trust_chain import append_event
from ..anomaly_detection import run_all_detectors
from ..graph_store import store

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("/run-detection")
def run_detection(db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    existing_keys = {(a.entity_id, a.alert_type) for a in db.query(Alert).all()}
    new_alerts = run_all_detectors()
    created = 0
    for a in new_alerts:
        key = (a["entity_id"], a["alert_type"])
        if key in existing_keys:
            continue
        db.add(Alert(
            id=a["id"], entity_id=a["entity_id"], entity_name=a["entity_name"],
            alert_type=a["alert_type"], score=a["score"],
            reasons_json=json.dumps(a["reasons"]),
            related_entities_json=json.dumps(a["related_entities"]),
        ))
        append_event(db, event_type="ALERT_CREATED", record_type="alert", record_id=a["id"],
                     data={"alert_type": a["alert_type"], "score": a["score"],
                           "reasons": a["reasons"], "detector": a.get("detector", "rule")},
                     actor=current.username, source="alerts")
        existing_keys.add(key)
        created += 1
    db.commit()
    return {"detected": len(new_alerts), "new_alerts_created": created}


def _serialize(a: Alert):
    return {
        "id": a.id, "entity_id": a.entity_id, "entity_name": a.entity_name,
        "alert_type": a.alert_type, "score": a.score, "status": a.status,
        "reasons": json.loads(a.reasons_json or "[]"),
        "related_entities": json.loads(a.related_entities_json or "[]"),
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("")
def list_alerts(status: str = None, min_score: float = 0, db: Session = Depends(get_db),
                 current=Depends(get_current_investigator)):
    q = db.query(Alert)
    if status:
        q = q.filter(Alert.status == status)
    q = q.filter(Alert.score >= min_score)
    alerts = q.order_by(Alert.score.desc()).all()
    return {"alerts": [_serialize(a) for a in alerts]}


@router.get("/{alert_id}")
def get_alert(alert_id: str, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    data = _serialize(a)
    related_entities = [store.get_entity(rid) for rid in data["related_entities"]]
    data["related_entity_details"] = [r for r in related_entities if r]
    entity = store.get_entity(a.entity_id)
    data["entity_detail"] = entity
    return data


@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = "reviewed"
    append_event(db, event_type="ALERT_REVIEWED", record_type="alert", record_id=a.id,
                 data={"status": "reviewed"}, actor=current.username, source="alerts")
    db.commit()
    return {"status": "reviewed"}


@router.post("/{alert_id}/dismiss")
def dismiss_alert(alert_id: str, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    a.status = "dismissed"
    append_event(db, event_type="ALERT_DISMISSED", record_type="alert", record_id=a.id,
                 data={"status": "dismissed"}, actor=current.username, source="alerts")
    db.commit()
    return {"status": "dismissed"}

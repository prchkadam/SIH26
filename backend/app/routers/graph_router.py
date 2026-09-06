from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_investigator
from ..graph_store import store

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("")
def get_graph(limit: int = Query(1500, le=5000), current=Depends(get_current_investigator)):
    return store.full_graph(limit_nodes=limit)


@router.get("/stats")
def graph_stats(current=Depends(get_current_investigator)):
    return store.stats()


@router.get("/expand/{entity_id}")
def expand(entity_id: str, depth: int = 1, current=Depends(get_current_investigator)):
    if not store.get_entity(entity_id):
        raise HTTPException(404, "Entity not found")
    return store.neighborhood(entity_id, depth=depth)


@router.get("/path")
def path(source: str, target: str, current=Depends(get_current_investigator)):
    if not store.get_entity(source) or not store.get_entity(target):
        raise HTTPException(404, "Source or target entity not found")
    result = store.shortest_path(source, target)
    if not result:
        return {"found": False, "nodes": [], "edges": [], "path_order": []}
    return {"found": True, **result}

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_investigator
from ..database import get_db, Case
from ..graph_store import store

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(q: str = Query(..., min_length=1), db: Session = Depends(get_db),
           current=Depends(get_current_investigator)):
    entity_results = store.search(q, limit=25)
    case_results = []
    like = f"%{q}%"
    cases = db.query(Case).filter((Case.title.ilike(like)) | (Case.id.ilike(like))).limit(10).all()
    for c in cases:
        case_results.append({"id": c.id, "title": c.title, "status": c.status, "priority": c.priority})
    return {"entities": entity_results, "cases": case_results, "query": q}

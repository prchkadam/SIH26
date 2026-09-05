"""
API endpoints for the similarity search engine.

Wire this into your main FastAPI app with:
    from .routes_similarity import router as similarity_router
    app.include_router(similarity_router)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db, Case
from .similarity_search import find_similar_cases, search_by_text, index_case, reindex_all_cases

router = APIRouter(prefix="/similarity", tags=["similarity"])


@router.get("/cases/{case_id}/similar")
def get_similar_cases(
    case_id: str,
    k: int = Query(5, ge=1, le=50, description="Number of similar cases to return"),
    db: Session = Depends(get_db),
):
    """Find past cases similar to the given case - surfaces precedent or a
    matching MO for an investigator already working a case."""
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case_id": case_id, "results": find_similar_cases(db, case_id, k=k)}


@router.get("/search")
def search_similar(
    q: str = Query(..., min_length=3, description="Free-text description of an incident"),
    k: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Free-text search - useful when a new incident is reported and there's
    no case record yet to compare against."""
    return {"query": q, "results": search_by_text(db, q, k=k)}


@router.post("/cases/{case_id}/reindex")
def reindex_case(case_id: str, db: Session = Depends(get_db)):
    """Force-refresh the embedding for one case (e.g. after a bulk edit)."""
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    embedding = index_case(db, case, force=True)
    return {"case_id": case_id, "status": "reindexed", "embedding_model": embedding.embedding_model}


@router.post("/reindex-all")
def reindex_all(db: Session = Depends(get_db)):
    """Backfill embeddings for every case. Run once after deployment, and
    periodically afterwards (or trigger from a background job)."""
    count = reindex_all_cases(db)
    return {"status": "completed", "cases_processed": count}

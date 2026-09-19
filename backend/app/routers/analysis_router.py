from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_investigator
from .. import network_analysis as na
from ..temporal_analysis import summarize_window

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/overview")
def overview(current=Depends(get_current_investigator)):
    return na.overview_stats()


@router.get("/hubs")
def hubs(limit: int = 15, current=Depends(get_current_investigator)):
    return {"hubs": na.top_connected(limit)}


@router.get("/intermediaries")
def intermediaries(limit: int = 15, current=Depends(get_current_investigator)):
    return {"intermediaries": na.important_intermediaries(limit)}


@router.get("/communities")
def communities(min_size: int = 3, limit: int = 20, current=Depends(get_current_investigator)):
    return {"communities": na.communities(min_size, limit)}


@router.get("/frequent-interactions")
def frequent(limit: int = 15, current=Depends(get_current_investigator)):
    return {"interactions": na.frequent_interactions(limit)}


@router.get("/unusual-structures")
def unusual(limit: int = 15, current=Depends(get_current_investigator)):
    return {"unusual_structures": na.unusual_structures(limit)}


@router.get("/temporal")
def temporal(start: str = None, end: str = None, current=Depends(get_current_investigator)):
    try:
        start_date = datetime.fromisoformat(start) if start else None
        end_date = datetime.fromisoformat(end) if end else None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="start and end must be ISO-8601 dates") from exc
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="start must not be after end")
    return summarize_window(start_date, end_date)

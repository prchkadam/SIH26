import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_investigator
from ..database import AuditEvent, Evidence, get_db
from ..trust_chain import serialize_event, verify_chain


router = APIRouter(prefix="/blockchain", tags=["Blockchain"])


def _events(db: Session):
    return db.query(AuditEvent).order_by(AuditEvent.index.asc()).all()


def _evidence_event(evidence: Evidence, db: Session):
    if evidence.block_index is not None:
        event = db.query(AuditEvent).filter(AuditEvent.index == evidence.block_index).first()
        if event and (not evidence.block_hash or event.hash == evidence.block_hash):
            return event
    return (
        db.query(AuditEvent)
        .filter(AuditEvent.record_type == "evidence", AuditEvent.record_id == evidence.id)
        .order_by(AuditEvent.index.asc())
        .first()
    )


@router.get("/chain")
def get_blockchain(db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    chain = [serialize_event(event) for event in _events(db)]
    return {"chain": chain, "length": len(chain)}


@router.get("/verify")
def verify_blockchain(db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    valid, message = verify_chain(db)
    return {"valid": valid, "blocks": db.query(AuditEvent).count(), "message": message}


@router.get("/block/{block_index}")
def get_block(block_index: int, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    event = db.query(AuditEvent).filter(AuditEvent.index == block_index).first()
    if not event:
        raise HTTPException(status_code=404, detail="Audit event not found")
    return serialize_event(event)


@router.get("/evidence/{evidence_id}")
def get_evidence(evidence_id: str, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    event = _evidence_event(evidence, db)
    return {
        "id": evidence.id,
        "case_id": evidence.case_id,
        "evidence_type": evidence.evidence_type,
        "description": evidence.description,
        "source": evidence.source,
        "content": evidence.content,
        "content_hash": evidence.content_hash,
        "block_index": event.index if event else evidence.block_index,
        "block_hash": event.hash if event else evidence.block_hash,
        "created_by": evidence.created_by,
        "created_at": evidence.created_at.isoformat() if evidence.created_at else None,
    }


@router.get("/evidence/{evidence_id}/verify")
def verify_evidence(evidence_id: str, db: Session = Depends(get_db), current=Depends(get_current_investigator)):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    current_hash = hashlib.sha256((evidence.content or "").encode("utf-8")).hexdigest()
    content_valid = current_hash == evidence.content_hash
    event = _evidence_event(evidence, db)
    chain_valid, chain_message = verify_chain(db)
    event_valid = bool(event and (not evidence.block_hash or event.hash == evidence.block_hash))
    valid = content_valid and event_valid and chain_valid
    return {
        "evidence_id": evidence.id,
        "valid": valid,
        "content_valid": content_valid,
        "block_found": event is not None,
        "block_hash_valid": event_valid,
        "blockchain_valid": chain_valid,
        "stored_hash": evidence.content_hash,
        "current_hash": current_hash,
        "block_index": event.index if event else evidence.block_index,
        "block_hash": event.hash if event else evidence.block_hash,
        "message": "Evidence integrity verified" if valid else f"Evidence integrity check failed: {chain_message}",
    }

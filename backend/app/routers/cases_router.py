import uuid
import hashlib
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session

from ..auth import get_current_investigator

from ..database import (
    get_db,
    Case,
    CaseEntityLink,
    CaseNote,
    Evidence,
)

from ..schemas import (
    CaseCreate,
    CaseLinkRequest,
    CaseNoteRequest,
    EvidenceCreate,
)

from ..graph_store import store
from ..trust_chain import append_event, verify_chain


router = APIRouter(
    prefix="/cases",
    tags=["cases"]
)


# ============================================================
# HELPER: SHA-256 HASH
# ============================================================

def calculate_hash(content: str) -> str:
    """
    Generate a SHA-256 hash for evidence content.
    """
    return hashlib.sha256(
        content.encode("utf-8")
    ).hexdigest()


# ============================================================
# SERIALIZE CASE
# ============================================================

def _serialize_case(c: Case, db: Session):

    links = (
        db.query(CaseEntityLink)
        .filter(CaseEntityLink.case_id == c.id)
        .all()
    )

    notes = (
        db.query(CaseNote)
        .filter(CaseNote.case_id == c.id)
        .order_by(CaseNote.created_at.desc())
        .all()
    )

    evidence = (
        db.query(Evidence)
        .filter(Evidence.case_id == c.id)
        .order_by(Evidence.created_at.desc())
        .all()
    )

    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "status": c.status,
        "priority": c.priority,
        "created_by": c.created_by,

        "created_at": (
            c.created_at.isoformat()
            if c.created_at
            else None
        ),

        # ----------------------------------------------------
        # Linked entities
        # ----------------------------------------------------

        "linked_entities": [
            {
                "link_id": l.id,
                "entity_id": l.entity_id,
                "entity_type": l.entity_type,
                "linked_kind": l.linked_kind,
                "ref_id": l.ref_id,

                "entity": (
                    store.get_entity(l.entity_id)
                    if l.entity_id
                    else None
                ),
            }
            for l in links
        ],

        # ----------------------------------------------------
        # Case notes
        # ----------------------------------------------------

        "notes": [
            {
                "id": n.id,
                "author": n.author,
                "text": n.text,

                "created_at": (
                    n.created_at.isoformat()
                    if n.created_at
                    else None
                ),
            }
            for n in notes
        ],

        # ----------------------------------------------------
        # Blockchain-backed evidence
        # ----------------------------------------------------

        "evidence": [
            {
                "id": e.id,
                "evidence_type": e.evidence_type,
                "description": e.description,
                "source": e.source,

                "content_hash": e.content_hash,

                "block_index": e.block_index,
                "block_hash": e.block_hash,

                "created_by": e.created_by,

                # Evidence revision information
                "version": getattr(e, "version", 1),

                "status": getattr(
                    e,
                    "status",
                    "active"
                ),

                "previous_version_id": getattr(
                    e,
                    "previous_version_id",
                    None
                ),

                "verified_by": getattr(
                    e,
                    "verified_by",
                    None
                ),

                "verified_at": (
                    e.verified_at.isoformat()
                    if getattr(
                        e,
                        "verified_at",
                        None
                    )
                    else None
                ),

                "created_at": (
                    e.created_at.isoformat()
                    if e.created_at
                    else None
                ),
            }
            for e in evidence
        ],
    }


# ============================================================
# LIST CASES
# ============================================================

@router.get("")
def list_cases(
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    cases = (
        db.query(Case)
        .order_by(Case.created_at.desc())
        .all()
    )

    return {
        "cases": [
            _serialize_case(c, db)
            for c in cases
        ]
    }


# ============================================================
# CREATE CASE
# ============================================================

@router.post("")
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    case_id = (
        f"CASE-{uuid.uuid4().hex[:6].upper()}"
    )

    c = Case(
        id=case_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        created_by=current.username,
    )

    db.add(c)
    append_event(db, event_type="CASE_CREATED", record_type="case", record_id=case_id,
                 data={"title": payload.title, "priority": payload.priority},
                 actor=current.username, source="cases")
    db.commit()
    db.refresh(c)

    return _serialize_case(c, db)


# ============================================================
# GET SINGLE CASE
# ============================================================

@router.get("/{case_id}")
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    c = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    return _serialize_case(c, db)


# ============================================================
# DELETE CASE
# ============================================================

@router.delete("/{case_id}")
def delete_case(
    case_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    # --------------------------------------------------------
    # 1. Find case
    # --------------------------------------------------------

    c = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    # --------------------------------------------------------
    # 2. Delete linked entities
    # --------------------------------------------------------

    db.query(CaseEntityLink).filter(
        CaseEntityLink.case_id == case_id
    ).delete(
        synchronize_session=False
    )

    # --------------------------------------------------------
    # 3. Delete case notes
    # --------------------------------------------------------

    db.query(CaseNote).filter(
        CaseNote.case_id == case_id
    ).delete(
        synchronize_session=False
    )

    # --------------------------------------------------------
    # 4. Delete evidence from database
    #
    # IMPORTANT:
    # Blockchain blocks are NOT deleted.
    # --------------------------------------------------------

    db.query(Evidence).filter(
        Evidence.case_id == case_id
    ).delete(
        synchronize_session=False
    )

    # --------------------------------------------------------
    # 5. Delete case
    # --------------------------------------------------------

    db.delete(c)
    append_event(db, event_type="CASE_DELETED", record_type="case", record_id=case_id,
                 data={}, actor=current.username, source="cases")
    db.commit()

    return {
        "message": "Case deleted successfully",
        "case_id": case_id,
    }


# ============================================================
# LINK ENTITY TO CASE
# ============================================================

@router.post("/{case_id}/link")
def link_to_case(
    case_id: str,
    payload: CaseLinkRequest,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    c = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    link = CaseEntityLink(
        case_id=case_id,
        entity_id=payload.entity_id,
        entity_type=payload.entity_type,
        linked_kind=payload.linked_kind,
        ref_id=payload.ref_id,
        added_by=current.username,
    )

    db.add(link)
    db.flush()
    append_event(db, event_type="CASE_LINK_CREATED", record_type="case_link", record_id=str(link.id),
                 data={"case_id": case_id, "entity_id": payload.entity_id, "linked_kind": payload.linked_kind},
                 actor=current.username, source="cases")
    db.commit()

    return _serialize_case(c, db)


# ============================================================
# ADD NOTE TO CASE
# ============================================================

@router.post("/{case_id}/notes")
def add_note(
    case_id: str,
    payload: CaseNoteRequest,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    c = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    note = CaseNote(
        case_id=case_id,
        author=current.username,
        text=payload.text,
    )

    db.add(note)
    db.flush()
    append_event(db, event_type="CASE_NOTE_CREATED", record_type="case_note", record_id=str(note.id),
                 data={"case_id": case_id, "text_hash": calculate_hash(payload.text)},
                 actor=current.username, source="cases")
    db.commit()

    return _serialize_case(c, db)


# ============================================================
# ADD EVIDENCE TO CASE
# ============================================================

@router.post("/{case_id}/evidence")
def add_evidence(
    case_id: str,
    payload: EvidenceCreate,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    c = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    # --------------------------------------------------------
    # Generate unique evidence ID
    # --------------------------------------------------------

    evidence_id = (
        f"EVD-{uuid.uuid4().hex[:8].upper()}"
    )

    # --------------------------------------------------------
    # Calculate SHA-256
    # --------------------------------------------------------

    content_hash = calculate_hash(
        payload.content
    )

    # --------------------------------------------------------
    # Blockchain block
    # --------------------------------------------------------

    block_data = {
        "evidence_id": evidence_id,
        "case_id": case_id,
        "evidence_type": payload.evidence_type,
        "content_hash": content_hash,
        "created_by": current.username,
        "version": 1,
        "action": "EVIDENCE_CREATED",
    }

    block = append_event(
        db,
        event_type="EVIDENCE_CREATED",
        record_type="evidence",
        record_id=evidence_id,
        data=block_data,
        actor=current.username,
        source="cases",
    )

    # --------------------------------------------------------
    # Database record
    # --------------------------------------------------------

    evidence = Evidence(
        id=evidence_id,
        case_id=case_id,
        evidence_type=payload.evidence_type,
        description=payload.description,
        source=payload.source,
        content=payload.content,
        content_hash=content_hash,

        block_index=block.index,
        block_hash=block.hash,

        created_by=current.username,

        version=1,
        status="active",
        previous_version_id=None,
        verified_by=None,
        verified_at=None,
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "message": "Evidence successfully recorded",
        "evidence_id": evidence_id,
        "content_hash": content_hash,
        "block_index": block.index,
        "block_hash": block.hash,
        "version": 1,
        "status": "active",
        "timestamp": block.timestamp,
    }


# ============================================================
# GET CASE EVIDENCE
# ============================================================

@router.get("/{case_id}/evidence")
def get_case_evidence(
    case_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    c = (
        db.query(Case)
        .filter(Case.id == case_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    evidence = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id)
        .order_by(Evidence.created_at.desc())
        .all()
    )

    return {
        "case_id": case_id,

        "evidence": [
            {
                "id": e.id,
                "evidence_type": e.evidence_type,
                "description": e.description,
                "source": e.source,

                "content_hash": e.content_hash,

                "block_index": e.block_index,
                "block_hash": e.block_hash,

                "created_by": e.created_by,

                "version": getattr(
                    e,
                    "version",
                    1
                ),

                "status": getattr(
                    e,
                    "status",
                    "active"
                ),

                "previous_version_id": getattr(
                    e,
                    "previous_version_id",
                    None
                ),

                "verified_by": getattr(
                    e,
                    "verified_by",
                    None
                ),

                "verified_at": (
                    e.verified_at.isoformat()
                    if getattr(
                        e,
                        "verified_at",
                        None
                    )
                    else None
                ),

                "created_at": (
                    e.created_at.isoformat()
                    if e.created_at
                    else None
                ),
            }
            for e in evidence
        ],

        "count": len(evidence),
    }


# ============================================================
# EDIT / CORRECT EVIDENCE
# ============================================================

@router.put("/{case_id}/evidence/{evidence_id}")
def edit_evidence(
    case_id: str,
    evidence_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    # --------------------------------------------------------
    # Find original evidence
    # --------------------------------------------------------

    original = (
        db.query(Evidence)
        .filter(
            Evidence.id == evidence_id,
            Evidence.case_id == case_id
        )
        .first()
    )

    if not original:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    # --------------------------------------------------------
    # Validate content
    # --------------------------------------------------------

    new_content = payload.get("content")

    if new_content is None:
        raise HTTPException(
            status_code=400,
            detail="Evidence content is required"
        )

    new_content = str(new_content)

    if not new_content.strip():
        raise HTTPException(
            status_code=400,
            detail="Evidence content cannot be empty"
        )

    # --------------------------------------------------------
    # Do not allow editing an already superseded version
    # --------------------------------------------------------

    if getattr(
        original,
        "status",
        "active"
    ) == "superseded":

        raise HTTPException(
            status_code=400,
            detail="This evidence version has already been superseded"
        )

    # --------------------------------------------------------
    # Mark original as superseded
    #
    # IMPORTANT:
    # The original database record remains.
    # --------------------------------------------------------

    original.status = "superseded"

    # --------------------------------------------------------
    # Calculate new SHA-256 hash
    # --------------------------------------------------------

    new_hash = calculate_hash(
        new_content
    )

    # --------------------------------------------------------
    # Generate new evidence ID
    # --------------------------------------------------------

    new_evidence_id = (
        f"EVD-{uuid.uuid4().hex[:8].upper()}"
    )

    # --------------------------------------------------------
    # Determine new version number
    # --------------------------------------------------------

    new_version = (
        getattr(
            original,
            "version",
            1
        ) + 1
    )

    # --------------------------------------------------------
    # Blockchain record
    # --------------------------------------------------------

    block_data = {
        "evidence_id": new_evidence_id,
        "case_id": case_id,

        "previous_evidence_id": original.id,

        "evidence_type": payload.get(
            "evidence_type",
            original.evidence_type
        ),

        "content_hash": new_hash,

        "created_by": current.username,

        "version": new_version,

        "action": "EVIDENCE_CORRECTED",
    }

    block = append_event(
        db,
        event_type="EVIDENCE_CORRECTED",
        record_type="evidence",
        record_id=new_evidence_id,
        data=block_data,
        actor=current.username,
        source="cases",
    )

    # --------------------------------------------------------
    # Create corrected evidence version
    # --------------------------------------------------------

    corrected = Evidence(
        id=new_evidence_id,
        case_id=case_id,

        evidence_type=payload.get(
            "evidence_type",
            original.evidence_type
        ),

        description=payload.get(
            "description",
            original.description
        ),

        source=payload.get(
            "source",
            original.source
        ),

        content=new_content,

        content_hash=new_hash,

        block_index=block.index,

        block_hash=block.hash,

        created_by=current.username,

        version=new_version,

        status="active",

        previous_version_id=original.id,

        verified_by=None,

        verified_at=None,
    )

    db.add(corrected)

    db.commit()

    db.refresh(corrected)

    return {
        "message": "Evidence corrected successfully",

        "evidence_id": corrected.id,

        "previous_version_id": original.id,

        "version": corrected.version,

        "status": corrected.status,

        "content_hash": corrected.content_hash,

        "block_index": corrected.block_index,

        "block_hash": corrected.block_hash,

        "timestamp": block.timestamp,
    }


# ============================================================
# MANUALLY VERIFY EVIDENCE
# ============================================================

@router.post("/{case_id}/evidence/{evidence_id}/verify")
def set_evidence_verified(
    case_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == evidence_id,
            Evidence.case_id == case_id
        )
        .first()
    )

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    # --------------------------------------------------------
    # Only active evidence can be verified
    # --------------------------------------------------------

    if getattr(
        evidence,
        "status",
        "active"
    ) == "superseded":

        raise HTTPException(
            status_code=400,
            detail="Superseded evidence cannot be verified"
        )

    # --------------------------------------------------------
    # Check actual content against stored SHA-256
    # --------------------------------------------------------

    current_hash = calculate_hash(
        evidence.content or ""
    )

    if current_hash != evidence.content_hash:
        raise HTTPException(
            status_code=400,
            detail=(
                "Evidence content has been modified "
                "and failed the integrity check"
            )
        )

    # --------------------------------------------------------
    # Check blockchain
    # --------------------------------------------------------

    chain_valid, _ = verify_chain(db)
    if not chain_valid:
        raise HTTPException(
            status_code=400,
            detail="Blockchain integrity check failed"
        )

    # --------------------------------------------------------
    # Mark as verified
    # --------------------------------------------------------

    evidence.status = "verified"

    evidence.verified_by = (
        current.username
    )

    evidence.verified_at = (
        datetime.utcnow()
    )

    append_event(db, event_type="EVIDENCE_VERIFIED", record_type="evidence", record_id=evidence.id,
                 data={"content_hash": evidence.content_hash, "version": evidence.version},
                 actor=current.username, source="cases")

    db.commit()

    db.refresh(evidence)

    return {
        "message": "Evidence marked as verified",

        "evidence_id": evidence.id,

        "status": evidence.status,

        "verified_by": evidence.verified_by,

        "verified_at": (
            evidence.verified_at.isoformat()
            if evidence.verified_at
            else None
        ),

        "content_hash": evidence.content_hash,

        "block_index": evidence.block_index,

        "block_hash": evidence.block_hash,
    }


# ============================================================
# GET EVIDENCE VERSION HISTORY
# ============================================================

@router.get("/{case_id}/evidence/{evidence_id}/history")
def get_evidence_history(
    case_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_investigator),
):

    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == evidence_id,
            Evidence.case_id == case_id
        )
        .first()
    )

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not found"
        )

    # --------------------------------------------------------
    # Walk backwards through evidence revisions
    # --------------------------------------------------------

    history = []

    current_evidence = evidence

    while current_evidence:

        history.append({
            "id": current_evidence.id,

            "version": getattr(
                current_evidence,
                "version",
                1
            ),

            "status": getattr(
                current_evidence,
                "status",
                "active"
            ),

            "evidence_type": (
                current_evidence.evidence_type
            ),

            "description": (
                current_evidence.description
            ),

            "source": (
                current_evidence.source
            ),

            "content": (
                current_evidence.content
            ),

            "content_hash": (
                current_evidence.content_hash
            ),

            "block_index": (
                current_evidence.block_index
            ),

            "block_hash": (
                current_evidence.block_hash
            ),

            "created_by": (
                current_evidence.created_by
            ),

            "verified_by": getattr(
                current_evidence,
                "verified_by",
                None
            ),

            "verified_at": (
                current_evidence.verified_at.isoformat()
                if getattr(
                    current_evidence,
                    "verified_at",
                    None
                )
                else None
            ),

            "previous_version_id": getattr(
                current_evidence,
                "previous_version_id",
                None
            ),

            "created_at": (
                current_evidence.created_at.isoformat()
                if current_evidence.created_at
                else None
            ),
        })

        previous_id = getattr(
            current_evidence,
            "previous_version_id",
            None
        )

        if not previous_id:
            break

        current_evidence = (
            db.query(Evidence)
            .filter(
                Evidence.id == previous_id
            )
            .first()
        )

    return {
        "case_id": case_id,

        "evidence_id": evidence_id,

        "history": history,

        "count": len(history),
    }
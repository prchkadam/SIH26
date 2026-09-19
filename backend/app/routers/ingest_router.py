import csv
import io
import json
import uuid
import hashlib

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..auth import get_current_investigator
from ..database import get_db, Dataset
from ..graph_store import store
from ..schemas import TextExtractRequest
from ..entity_extraction import (
    extract_entities,
    extract_relationships_from_text,
)
from ..entity_resolution import find_candidates
from ..trust_chain import append_event


router = APIRouter(
    prefix="/ingest",
    tags=["ingest"]
)


# ============================================================
# SUPPORTED DATASET TYPES
# ============================================================

SUPPORTED_TYPES = [
    "people",
    "calls",
    "transactions",
    "vehicles",
    "locations",
    "organizations",
]


# ============================================================
# SHA-256 HASH
# ============================================================

def calculate_file_hash(content: bytes) -> str:
    """
    Generate a SHA-256 fingerprint for an uploaded file.
    """

    return hashlib.sha256(content).hexdigest()


# ============================================================
# FIND OR CREATE ENTITY
# ============================================================

def _find_or_create(
    entity_type: str,
    name: str,
    attributes: dict = None,
    source="csv-import",
):

    name = (name or "").strip()

    if not name:
        return None

    existing = store.search(
        name,
        limit=5
    )

    for e in existing:

        if (
            e.get("type") == entity_type
            and
            e.get("name", "").strip().lower() == name.lower()
        ):

            if attributes:

                store.add_entity(
                    entity_type,
                    name,
                    attributes,
                    entity_id=e["id"],
                    source=source,
                )

            return e["id"]

    candidates = find_candidates(
        {"type": entity_type, "name": name, "attributes": attributes or {}},
        store.all_entities(entity_type=entity_type),
    )
    if candidates and candidates[0].get("auto_mergeable"):
        candidate = candidates[0]["entity"]
        if attributes:
            store.add_entity(entity_type, name, attributes, entity_id=candidate["id"], source=source)
        return candidate["id"]

    return store.add_entity(
        entity_type,
        name,
        attributes or {},
        source=source,
    )


# ============================================================
# INGEST ROWS
# ============================================================

def _ingest_rows(
    dataset_type: str,
    rows: list,
    db: Session = None,
    actor: str = None,
):

    created_entities = 0
    created_rels = 0

    for row in rows:

        row = {
            k.strip(): (
                v.strip()
                if isinstance(v, str)
                else v
            )
            for k, v in row.items()
            if k
        }

        # ----------------------------------------------------
        # PEOPLE
        # ----------------------------------------------------

        if dataset_type == "people":

            attrs = {
                k: v
                for k, v in row.items()
                if k not in ("name",) and v
            }

            _find_or_create(
                "Person",
                row.get("name"),
                attrs
            )

            created_entities += 1

        # ----------------------------------------------------
        # CALLS
        # ----------------------------------------------------

        elif dataset_type == "calls":

            a = _find_or_create(
                "Person",
                row.get("caller") or row.get("from")
            )

            b = _find_or_create(
                "Person",
                row.get("callee") or row.get("to")
            )

            if a and b:

                freq = (
                    row.get("frequency")
                    or row.get("count")
                    or 1
                )

                edge_id = store.add_relationship(
                    a,
                    b,
                    "called",

                    attributes={
                        "frequency": freq,
                        "date": row.get("date", "")
                    },

                    weight=(
                        float(freq)
                        if str(freq).replace(".", "", 1).isdigit()
                        else 1
                    ),

                    evidence=[
                        f"Call record import ({freq} contacts)"
                    ],
                )
                if db:
                    append_event(db, event_type="RELATIONSHIP_IMPORTED", record_type="relationship", record_id=edge_id,
                                 data={"source_id": a, "target_id": b, "relationship_type": "called", "row": row},
                                 actor=actor, source="ingest")

                created_rels += 1

        # ----------------------------------------------------
        # TRANSACTIONS
        # ----------------------------------------------------

        elif dataset_type == "transactions":

            a = _find_or_create(
                "Person",
                row.get("sender") or row.get("from")
            )

            b = _find_or_create(
                "Person",
                row.get("receiver") or row.get("to")
            )

            if a and b:

                amount = row.get(
                    "amount",
                    0
                )

                edge_id = store.add_relationship(
                    a,
                    b,
                    "transferred_money_to",

                    attributes={
                        "amount": amount,
                        "date": row.get("date", "")
                    },

                    evidence=[
                        f"Transaction record import (Rs {amount})"
                    ],
                )
                if db:
                    append_event(db, event_type="RELATIONSHIP_IMPORTED", record_type="relationship", record_id=edge_id,
                                 data={"source_id": a, "target_id": b, "relationship_type": "transferred_money_to", "row": row},
                                 actor=actor, source="ingest")

                created_rels += 1

        # ----------------------------------------------------
        # VEHICLES
        # ----------------------------------------------------

        elif dataset_type == "vehicles":

            owner = _find_or_create(
                "Person",
                row.get("owner")
            )

            vid = (
                row.get("vehicle_id")
                or row.get("plate")
            )

            v = _find_or_create(
                "Vehicle",
                vid,
                {
                    "vehicle_type":
                    row.get("vehicle_type", "")
                }
            )

            if owner and v:

                edge_id = store.add_relationship(
                    owner,
                    v,
                    "owns",

                    evidence=[
                        "Vehicle registration import"
                    ],
                )
                if db:
                    append_event(db, event_type="RELATIONSHIP_IMPORTED", record_type="relationship", record_id=edge_id,
                                 data={"source_id": owner, "target_id": v, "relationship_type": "owns", "row": row},
                                 actor=actor, source="ingest")

                created_rels += 1

            created_entities += 1

        # ----------------------------------------------------
        # LOCATIONS
        # ----------------------------------------------------

        elif dataset_type == "locations":

            person = _find_or_create(
                "Person",
                row.get("entity")
                or row.get("name")
            )

            loc = _find_or_create(
                "Location",
                row.get("location")
            )

            if person and loc:

                edge_id = store.add_relationship(
                    person,
                    loc,
                    "visited",

                    attributes={
                        "date": row.get("date", "")
                    },

                    evidence=[
                        "Location record import"
                    ],
                )
                if db:
                    append_event(db, event_type="RELATIONSHIP_IMPORTED", record_type="relationship", record_id=edge_id,
                                 data={"source_id": person, "target_id": loc, "relationship_type": "visited", "row": row},
                                 actor=actor, source="ingest")

                created_rels += 1

            created_entities += 1

        # ----------------------------------------------------
        # ORGANIZATIONS
        # ----------------------------------------------------

        elif dataset_type == "organizations":

            person = _find_or_create(
                "Person",
                row.get("person")
                or row.get("name")
            )

            org = _find_or_create(
                "Organization",
                row.get("organization"),
                {
                    "role":
                    row.get("role", "")
                }
            )

            if person and org:

                edge_id = store.add_relationship(
                    person,
                    org,
                    "associated_with",

                    attributes={
                        "role":
                        row.get("role", "")
                    },

                    evidence=[
                        "Organization record import"
                    ],
                )
                if db:
                    append_event(db, event_type="RELATIONSHIP_IMPORTED", record_type="relationship", record_id=edge_id,
                                 data={"source_id": person, "target_id": org, "relationship_type": "associated_with", "row": row},
                                 actor=actor, source="ingest")

                created_rels += 1

            created_entities += 1

    store.save()

    return created_entities, created_rels


# ============================================================
# INGEST SCHEMA
# ============================================================

@router.get("/schema")
def ingest_schema(
    current=Depends(get_current_investigator)
):

    return {
        "supported_types": SUPPORTED_TYPES,

        "columns": {

            "people": [
                "name",
                "phone",
                "address",
                "national_id",
                "dob",
            ],

            "calls": [
                "caller",
                "callee",
                "frequency",
                "date",
            ],

            "transactions": [
                "sender",
                "receiver",
                "receiver_type",
                "amount",
                "date",
            ],

            "vehicles": [
                "owner",
                "vehicle_id",
                "vehicle_type",
            ],

            "locations": [
                "entity",
                "location",
                "date",
            ],

            "organizations": [
                "person",
                "organization",
                "role",
            ],
        },
    }


# ============================================================
# CSV INGESTION
# ============================================================

@router.post("/csv")
async def ingest_csv(
    dataset_type: str = Form(...),
    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current=Depends(
        get_current_investigator
    ),
):

    # --------------------------------------------------------
    # 1. Validate dataset type
    # --------------------------------------------------------

    if dataset_type not in SUPPORTED_TYPES:

        raise HTTPException(
            status_code=400,
            detail=f"dataset_type must be one of {SUPPORTED_TYPES}"
        )

    # --------------------------------------------------------
    # 2. Read ORIGINAL file bytes
    # --------------------------------------------------------

    raw_content = await file.read()

    # --------------------------------------------------------
    # 3. Generate SHA-256 fingerprint
    # --------------------------------------------------------

    content_hash = calculate_file_hash(
        raw_content
    )

    # --------------------------------------------------------
    # 4. Decode CSV
    # --------------------------------------------------------

    try:

        content = raw_content.decode(
            "utf-8-sig"
        )

    except UnicodeDecodeError:

        raise HTTPException(
            status_code=400,
            detail="CSV file must be UTF-8 encoded"
        )

    reader = csv.DictReader(
        io.StringIO(content)
    )

    rows = list(reader)

    # --------------------------------------------------------
    # 5. Create dataset ID
    # --------------------------------------------------------

    dataset_id = (
        f"ds-{uuid.uuid4().hex[:8]}"
    )

    # --------------------------------------------------------
    # 6. Record dataset on blockchain
    # --------------------------------------------------------

    block_data = {

        "dataset_id": dataset_id,

        "filename": file.filename,

        "dataset_type": dataset_type,

        "content_hash": content_hash,

        "record_count": len(rows),

        "uploaded_by": current.username,
    }

    try:

        block = append_event(
            db,
            event_type="DATASET_IMPORTED",
            record_type="dataset",
            record_id=dataset_id,
            data=block_data,
            actor=current.username,
            source="ingest",
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Blockchain error: {str(exc)}"
        )

    # --------------------------------------------------------
    # 7. Existing ingestion logic
    # --------------------------------------------------------

    entities, rels = _ingest_rows(
        dataset_type, rows, db=db, actor=current.username
    )

    # --------------------------------------------------------
    # 8. Save dataset + blockchain information
    # --------------------------------------------------------

    ds = Dataset(

        id=dataset_id,

        filename=file.filename,

        dataset_type=dataset_type,

        record_count=len(rows),

        uploaded_by=current.username,

        # Blockchain information
        content_hash=content_hash,

        # FIXED: Block is an object
        block_index=block.index,

        block_hash=block.hash,
    )

    db.add(ds)

    try:

        db.commit()
        db.refresh(ds)

    except Exception as exc:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(exc)}"
        )

    # --------------------------------------------------------
    # 9. Return result
    # --------------------------------------------------------

    return {

        "message": "CSV dataset imported successfully",

        "rows_processed": len(rows),

        "entities_touched": entities,

        "relationships_created": rels,

        "dataset": {

            "id": dataset_id,

            "filename": file.filename,

            "content_hash": content_hash,

            "block_index": block.index,

            "block_hash": block.hash,
        },
    }


# ============================================================
# JSON INGESTION
# ============================================================

@router.post("/json")
async def ingest_json(
    dataset_type: str = Form(...),
    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current=Depends(
        get_current_investigator
    ),
):

    # --------------------------------------------------------
    # 1. Validate dataset type
    # --------------------------------------------------------

    if dataset_type not in SUPPORTED_TYPES:

        raise HTTPException(
            status_code=400,
            detail=f"dataset_type must be one of {SUPPORTED_TYPES}"
        )

    # --------------------------------------------------------
    # 2. Read ORIGINAL JSON bytes
    # --------------------------------------------------------

    raw_content = await file.read()

    # --------------------------------------------------------
    # 3. Generate SHA-256 hash
    # --------------------------------------------------------

    content_hash = calculate_file_hash(
        raw_content
    )

    # --------------------------------------------------------
    # 4. Parse JSON
    # --------------------------------------------------------

    try:

        rows = json.loads(
            raw_content
        )

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=400,
            detail="Invalid JSON file"
        )

    if not isinstance(rows, list):

        raise HTTPException(
            status_code=400,
            detail="JSON file must contain a list of records"
        )

    # --------------------------------------------------------
    # 5. Create dataset ID
    # --------------------------------------------------------

    dataset_id = (
        f"ds-{uuid.uuid4().hex[:8]}"
    )

    # --------------------------------------------------------
    # 6. Record dataset on blockchain
    # --------------------------------------------------------

    block_data = {

        "dataset_id": dataset_id,

        "filename": file.filename,

        "dataset_type": dataset_type,

        "content_hash": content_hash,

        "record_count": len(rows),

        "uploaded_by": current.username,
    }

    try:

        block = append_event(
            db,
            event_type="DATASET_IMPORTED",
            record_type="dataset",
            record_id=dataset_id,
            data=block_data,
            actor=current.username,
            source="ingest",
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=f"Blockchain error: {str(exc)}"
        )

    # --------------------------------------------------------
    # 7. Existing ingestion logic
    # --------------------------------------------------------

    entities, rels = _ingest_rows(
        dataset_type, rows, db=db, actor=current.username
    )

    # --------------------------------------------------------
    # 8. Save dataset + blockchain information
    # --------------------------------------------------------

    ds = Dataset(

        id=dataset_id,

        filename=file.filename,

        dataset_type=dataset_type,

        record_count=len(rows),

        uploaded_by=current.username,

        content_hash=content_hash,

        # FIXED: Block is an object
        block_index=block.index,

        block_hash=block.hash,
    )

    db.add(ds)

    try:

        db.commit()
        db.refresh(ds)

    except Exception as exc:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(exc)}"
        )

    # --------------------------------------------------------
    # 9. Return result
    # --------------------------------------------------------

    return {

        "message": "JSON dataset imported successfully",

        "rows_processed": len(rows),

        "entities_touched": entities,

        "relationships_created": rels,

        "dataset": {

            "id": dataset_id,

            "filename": file.filename,

            "content_hash": content_hash,

            "block_index": block.index,

            "block_hash": block.hash,
        },
    }


# ============================================================
# TEXT INGESTION
# ============================================================

@router.post("/text")
def ingest_text(
    payload: TextExtractRequest,
    current=Depends(get_current_investigator)
):

    extracted = extract_entities(
        payload.text
    )

    relationships = extract_relationships_from_text(
        payload.text,
        extracted
    )

    if not payload.commit:

        return {
            "extracted": extracted,
            "relationships": relationships,
            "committed": False,
        }

    name_to_id = {}

    for name in extracted["people"]:

        name_to_id[name] = _find_or_create(
            "Person",
            name,
            source="text-extraction"
        )

    for name in extracted["organizations"]:

        name_to_id[name] = _find_or_create(
            "Organization",
            name,
            source="text-extraction"
        )

    for name in extracted["locations"]:

        name_to_id[name] = _find_or_create(
            "Location",
            name,
            source="text-extraction"
        )

    for name in extracted["places"]:

        name_to_id[name] = _find_or_create(
            "Location",
            name,
            source="text-extraction"
        )

    for phone in extracted["phone_numbers"]:

        name_to_id[phone] = _find_or_create(
            "Phone",
            phone,
            source="text-extraction"
        )

    for acc in extracted["bank_accounts"]:

        name_to_id[acc] = _find_or_create(
            "Account",
            acc,
            source="text-extraction"
        )

    for veh in extracted["vehicles"]:

        name_to_id[veh] = _find_or_create(
            "Vehicle",
            veh,
            source="text-extraction"
        )

    created_rels = 0

    for r in relationships:

        sid = name_to_id.get(
            r["source"]
        )

        tid = name_to_id.get(
            r["target"]
        )

        if sid and tid:

            store.add_relationship(
                sid,
                tid,
                r["type"],
                confidence=0.7,

                evidence=[
                    r["explanation"],
                    f'Source text: "{payload.text[:200]}"'
                ],
            )

            created_rels += 1

    store.save()

    return {

        "extracted": extracted,

        "relationships": relationships,

        "committed": True,

        "entities_created": len(
            [
                v
                for v in name_to_id.values()
                if v
            ]
        ),

        "relationships_created": created_rels,
    }
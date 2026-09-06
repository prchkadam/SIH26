import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from .database import AuditEvent


GENESIS_HASH = "0"


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def calculate_event_hash(
    index: int,
    timestamp: str,
    event_type: str,
    actor: str | None,
    source: str | None,
    record_type: str,
    record_id: str | None,
    data: dict,
    previous_hash: str,
) -> str:
    payload = {
        "index": index,
        "timestamp": timestamp,
        "event_type": event_type,
        "actor": actor,
        "source": source,
        "record_type": record_type,
        "record_id": record_id,
        "data": data,
        "previous_hash": previous_hash,
    }
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def _timestamp() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def append_event(
    db: Session,
    *,
    event_type: str,
    record_type: str,
    data: dict,
    actor: str | None = None,
    source: str | None = None,
    record_id: str | None = None,
) -> AuditEvent:
    last = db.query(AuditEvent).order_by(AuditEvent.index.desc()).first()
    index = (last.index + 1) if last else 0
    previous_hash = last.hash if last else GENESIS_HASH
    timestamp = _timestamp()
    timestamp_text = timestamp.isoformat()
    event_hash = calculate_event_hash(
        index, timestamp_text, event_type, actor, source,
        record_type, record_id, data, previous_hash,
    )
    event = AuditEvent(
        id=f"audit-{uuid.uuid4().hex[:12]}",
        index=index,
        timestamp=timestamp,
        event_type=event_type,
        actor=actor,
        source=source,
        record_type=record_type,
        record_id=record_id,
        data_json=_canonical(data),
        hash=event_hash,
        previous_hash=previous_hash,
    )
    db.add(event)
    db.flush()
    return event


def event_data(event: AuditEvent) -> dict:
    payload = json.loads(event.data_json or "{}")
    return {
        **payload,
        "event_type": event.event_type,
        "actor": event.actor,
        "source": event.source,
        "record_type": event.record_type,
        "record_id": event.record_id,
        "description": describe_event(event),
    }


def describe_event(event: AuditEvent) -> str:
    subject = f"{event.record_type} {event.record_id}" if event.record_id else event.record_type
    actor = f" by {event.actor}" if event.actor else ""
    return f"{event.event_type.replace('_', ' ').title()} for {subject}{actor}"


def serialize_event(event: AuditEvent) -> dict:
    return {
        "index": event.index,
        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
        "data": event_data(event),
        "hash": event.hash,
        "previous_hash": event.previous_hash,
    }


def verify_chain(db: Session) -> tuple[bool, str]:
    events = db.query(AuditEvent).order_by(AuditEvent.index.asc()).all()
    previous_hash = GENESIS_HASH
    for expected_index, event in enumerate(events):
        if event.index != expected_index or event.previous_hash != previous_hash:
            return False, f"Chain link invalid at index {event.index}"
        timestamp = event.timestamp.isoformat()
        expected_hash = calculate_event_hash(
            event.index, timestamp, event.event_type, event.actor,
            event.source, event.record_type, event.record_id,
            json.loads(event.data_json or "{}"), event.previous_hash,
        )
        if event.hash != expected_hash:
            return False, f"Event hash invalid at index {event.index}"
        previous_hash = event.hash
    return True, "Audit chain integrity verified"
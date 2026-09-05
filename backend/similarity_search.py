"""
Similarity search engine for cases.

Pipeline:
  1. build_case_document()  -> turns a Case (+ its notes + metadata) into one
     plain-text document.
  2. index_case()           -> embeds that document and stores the vector in
     CaseEmbedding, skipping re-embedding if nothing changed.
  3. find_similar_cases() / search_by_text()
                             -> nearest-neighbor lookup: given a case (or free
     text describing a new incident), rank all indexed cases by cosine
     similarity and return the closest matches - this is what surfaces
     "past cases with a similar MO" even when no keywords overlap.

Search itself is brute-force (numpy dot product against every stored
vector). That's the right choice at hackathon/demo scale - it's exact, has
zero extra infrastructure, and is fast up to tens of thousands of cases.
See the note in database.py for the pgvector/HNSW upgrade path if the
dataset grows well beyond that.
"""

import hashlib
import json
from typing import List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from .database import Case, CaseNote, CaseEmbedding
from .embeddings import embed_text

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
NOTES_LIMIT = 20  # how many recent notes to fold into the embedding


def build_case_document(db: Session, case: Case) -> str:
    """Combine everything that describes what a case is *about* into one
    document. This is the raw material the embedding is built from, so it's
    the main lever for search quality - add fields here (e.g. linked entity
    names/types) if matches feel too shallow."""
    parts = [
        case.title or "",
        case.description or "",
        f"priority: {case.priority}" if case.priority else "",
        f"status: {case.status}" if case.status else "",
    ]

    notes = (
        db.query(CaseNote)
        .filter(CaseNote.case_id == case.id)
        .order_by(CaseNote.created_at.desc())
        .limit(NOTES_LIMIT)
        .all()
    )
    for note in notes:
        if note.text:
            parts.append(note.text)

    return "\n".join(p for p in parts if p)


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def index_case(db: Session, case: Case, force: bool = False) -> CaseEmbedding:
    """Generate or refresh the embedding for one case. If the underlying
    text hasn't changed since the last index, this is a no-op (cheap to call
    often, e.g. right after a case is created or a note is added)."""
    document = build_case_document(db, case)
    text_hash = _hash_text(document)

    existing = db.get(CaseEmbedding, case.id)
    if existing and existing.source_text_hash == text_hash and not force:
        return existing

    vector = embed_text(document)
    payload = json.dumps(vector)

    if existing:
        existing.embedding_json = payload
        existing.source_text_hash = text_hash
        existing.embedding_model = EMBEDDING_MODEL_NAME
    else:
        existing = CaseEmbedding(
            case_id=case.id,
            embedding_json=payload,
            embedding_model=EMBEDDING_MODEL_NAME,
            source_text_hash=text_hash,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing


def reindex_all_cases(db: Session) -> int:
    """Backfill embeddings for every case in the system. Call this once
    after deploying the feature, and periodically (or via a cron/background
    task) afterwards to catch anything missed."""
    count = 0
    for case in db.query(Case).all():
        index_case(db, case)
        count += 1
    return count


def _load_all_embeddings(db: Session) -> Tuple[List[str], np.ndarray]:
    rows = db.query(CaseEmbedding.case_id, CaseEmbedding.embedding_json).all()
    ids: List[str] = []
    vectors: List[List[float]] = []
    for case_id, embedding_json in rows:
        if embedding_json:
            ids.append(case_id)
            vectors.append(json.loads(embedding_json))
    if not vectors:
        return [], np.zeros((0, 0), dtype=np.float32)
    return ids, np.array(vectors, dtype=np.float32)


def _top_k(
    query_vec: List[float],
    ids: List[str],
    matrix: np.ndarray,
    k: int,
    exclude_id: Optional[str] = None,
) -> List[Tuple[str, float]]:
    if matrix.shape[0] == 0:
        return []
    q = np.array(query_vec, dtype=np.float32)
    scores = matrix @ q  # vectors are pre-normalized -> dot product = cosine similarity
    order = np.argsort(-scores)

    results: List[Tuple[str, float]] = []
    for idx in order:
        cid = ids[idx]
        if exclude_id and cid == exclude_id:
            continue
        results.append((cid, float(scores[idx])))
        if len(results) >= k:
            break
    return results


def find_similar_cases(db: Session, case_id: str, k: int = 5, exclude_self: bool = True) -> List[dict]:
    """Given an existing case, find the k most similar other cases -
    'show me past cases that resemble this one.'"""
    target = db.get(CaseEmbedding, case_id)
    if target is None:
        case = db.get(Case, case_id)
        if case is None:
            return []
        target = index_case(db, case)  # index on the fly if it was never indexed

    ids, matrix = _load_all_embeddings(db)
    query_vec = json.loads(target.embedding_json)
    top = _top_k(query_vec, ids, matrix, k, exclude_id=case_id if exclude_self else None)

    results = []
    for cid, score in top:
        case = db.get(Case, cid)
        results.append({
            "case_id": cid,
            "title": case.title if case else None,
            "status": case.status if case else None,
            "priority": case.priority if case else None,
            "similarity": round(max(0, min(1, score)) * 100),
        })
    return results


def search_by_text(db: Session, query_text: str, k: int = 5) -> List[dict]:
    """Free-text nearest-neighbor search - e.g. an investigator types a
    short description of a new incident and gets back matching past cases,
    even with no shared keywords ('MO' matching by meaning)."""
    query_vec = embed_text(query_text)
    ids, matrix = _load_all_embeddings(db)
    top = _top_k(query_vec, ids, matrix, k)

    results = []
    for cid, score in top:
        case = db.get(Case, cid)
        description = case.description if case else None
        if description and len(description) > 200:
            description = description[:200] + "..."
        results.append({
            "case_id": cid,
            "title": case.title if case else None,
            "description": description,
            "similarity": round(max(0, min(1, score)) * 100),
        })
    return results

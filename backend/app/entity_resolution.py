from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .config import (
    AUTO_MERGE_CONFIDENCE,
    POSSIBLE_MATCH_CONFIDENCE,
    SEMANTIC_MATCHING_ENABLED,
    SEMANTIC_MATCHING_MIN_POOL,
    SEMANTIC_MATCHING_MODEL,
)


def _char_ngram_similarity(a: str, b: str) -> float:
    try:
        vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4))
        tfidf = vec.fit_transform([a, b])
        sim = cosine_similarity(tfidf[0], tfidf[1])[0][0]
        return float(sim)
    except ValueError:
        return 0.0


def compare_entities(a: dict, b: dict) -> dict:
    reasons = []
    if a.get("type") != b.get("type"):
        return {"confidence": 0.0, "reasons": ["Different entity types"]}

    name_a, name_b = str(a.get("name", "")), str(b.get("name", ""))
    token_ratio = fuzz.token_sort_ratio(name_a, name_b) / 100.0
    partial_ratio = fuzz.partial_ratio(name_a, name_b) / 100.0
    ngram_sim = _char_ngram_similarity(name_a.lower(), name_b.lower())

    name_score = max(token_ratio, 0.5 * partial_ratio + 0.5 * ngram_sim)
    if name_score >= 0.85:
        reasons.append(f"Names highly similar ('{name_a}' vs '{name_b}', {name_score:.0%} match)")
    elif name_score >= 0.6:
        reasons.append(f"Names moderately similar ('{name_a}' vs '{name_b}', {name_score:.0%} match)")

    attrs_a = a.get("attributes", {}) or {}
    attrs_b = b.get("attributes", {}) or {}
    shared_keys = ["phone", "phone_number", "vehicle_id", "account_number", "address",
                   "email", "date_of_birth", "national_id"]
    shared_hits = 0
    for k in shared_keys:
        va, vb = attrs_a.get(k), attrs_b.get(k)
        if va and vb and str(va).strip().lower() == str(vb).strip().lower():
            shared_hits += 1
            reasons.append(f"Shared attribute '{k}' = '{va}'")

    confidence = 0.55 * name_score + min(0.15 * shared_hits, 0.45)
    confidence = min(confidence, 0.99)

    if shared_hits >= 2 and name_score >= 0.4:
        confidence = max(confidence, 0.9)
        reasons.append("Multiple corroborating shared attributes strongly suggest same entity")

    if confidence < POSSIBLE_MATCH_CONFIDENCE:
        reasons = reasons or ["Insufficient similarity"]

    return {
        "confidence": round(confidence, 3),
        "reasons": reasons,
        "auto_mergeable": confidence >= AUTO_MERGE_CONFIDENCE,
        "matching_method": "rapidfuzz_tfidf",
    }


def find_candidates(target: dict, pool: list, min_confidence: float = POSSIBLE_MATCH_CONFIDENCE):
    if SEMANTIC_MATCHING_ENABLED and len(pool) >= SEMANTIC_MATCHING_MIN_POOL:
        semantic = _find_semantic_candidates(target, pool, min_confidence)
        if semantic is not None:
            return semantic
    out = []
    for cand in pool:
        if cand.get("id") == target.get("id"):
            continue
        cmp = compare_entities(target, cand)
        if cmp["confidence"] >= min_confidence:
            out.append({"entity": cand, **cmp})
    out.sort(key=lambda x: -x["confidence"])
    return out


def _find_semantic_candidates(target: dict, pool: list, min_confidence: float):
    try:
        import faiss
        from sentence_transformers import SentenceTransformer
    except ImportError:
        return None

    candidates = [item for item in pool if item.get("id") != target.get("id")]
    if not candidates:
        return []
    model = SentenceTransformer(SEMANTIC_MATCHING_MODEL)
    target_text = _entity_text(target)
    candidate_text = [_entity_text(item) for item in candidates]
    vectors = model.encode([target_text, *candidate_text], normalize_embeddings=True)
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors[1:].astype("float32"))
    scores, positions = index.search(vectors[:1].astype("float32"), min(25, len(candidates)))
    out = []
    for score, position in zip(scores[0], positions[0]):
        confidence = float(max(0.0, min(0.99, score)))
        if confidence < min_confidence:
            continue
        entity = candidates[int(position)]
        out.append({
            "entity": entity,
            "confidence": round(confidence, 3),
            "reasons": ["Semantic embedding similarity via FAISS index"],
            "auto_mergeable": confidence >= AUTO_MERGE_CONFIDENCE,
            "matching_method": "semantic_faiss",
        })
    return out


def _entity_text(entity: dict) -> str:
    attrs = entity.get("attributes", {}) or {}
    values = " ".join(f"{key} {value}" for key, value in sorted(attrs.items()))
    return f"{entity.get('type', '')} {entity.get('name', '')} {values}".strip()

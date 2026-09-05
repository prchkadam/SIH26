"""
Embedding generation for the similarity search engine.

Uses a local sentence-transformers model (all-MiniLM-L6-v2, 384 dimensions)
so there's no API key, no external cost, and no network dependency at query
time - important for a hackathon demo environment. Swap MODEL_NAME below for
a larger/multilingual model later if case notes are in multiple Indian
languages and quality matters more than latency.
"""

import threading
from typing import List

from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

_model = None
_model_lock = threading.Lock()


def get_model() -> SentenceTransformer:
    """Lazily load the model once per process (loading it is slow; reuse it)."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_text(text: str) -> List[float]:
    """Embed a single piece of text. Vector is L2-normalized so a plain dot
    product between two embeddings equals cosine similarity."""
    model = get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Batch version - use this when reindexing many cases at once, it's
    much faster than calling embed_text() in a loop."""
    model = get_model()
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
    return [v.tolist() for v in vectors]

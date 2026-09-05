# Similarity Search Engine — Setup

## 1. Install dependencies

Add to your `requirements.txt`:

```
sentence-transformers
numpy
```

(`torch` will come in as a dependency of sentence-transformers — the first
run downloads the `all-MiniLM-L6-v2` model, ~80MB, then it's cached locally.)

## 2. Files added

| File | Purpose |
|---|---|
| `database.py` | Adds a `CaseEmbedding` table (updated version of your existing file) |
| `embeddings.py` | Loads the embedding model, turns text into vectors |
| `similarity_search.py` | Indexing + nearest-neighbor search logic |
| `routes_similarity.py` | FastAPI endpoints exposing the above |

## 3. Wire it into your app

```python
# main.py
from .database import init_db
from .routes_similarity import router as similarity_router

init_db()  # creates case_embeddings table alongside your existing tables
app.include_router(similarity_router)
```

## 4. First-time indexing

After deploying, backfill embeddings for any cases that already exist:

```
POST /similarity/reindex-all
```

New cases get embedded automatically the first time they're queried
(`find_similar_cases` indexes on the fly if a case has no embedding yet),
but it's cleaner to reindex right after a case is created/updated — call
`index_case(db, case)` from your existing case-creation/note-creation
endpoints so search results stay current without a manual step.

## 5. Using it

```
GET /similarity/cases/CASE123/similar?k=5
```
Returns the 5 most similar past cases to `CASE123` — this is the "matching
MO" lookup for an investigator already on a case.

```
GET /similarity/search?q=stolen vehicle abandoned near border checkpoint&k=5
```
Free-text search — useful the moment a new incident is reported, before a
formal case record exists, to check "have we seen this pattern before."

## 6. Scaling beyond a hackathon demo

The current design does brute-force nearest-neighbor search in Python
(numpy dot product against every stored vector). That's the right tool at
this scale — exact results, zero extra infrastructure, fast up to tens of
thousands of cases.

If case volume grows well beyond that:

1. Migrate to Postgres if not already there.
2. `CREATE EXTENSION vector;`
3. Change `CaseEmbedding.embedding_json` (Text) to `embedding` (`Vector(384)`
   from `pgvector.sqlalchemy`).
4. Add an HNSW index: `CREATE INDEX ON case_embeddings USING hnsw (embedding vector_cosine_ops);`
5. Replace the numpy comparison in `similarity_search.py` with a SQL query
   using the `<=>` cosine-distance operator.

None of the calling code (`routes_similarity.py`, or wherever you call
`find_similar_cases`) needs to change — only the storage/query internals of
`similarity_search.py`.

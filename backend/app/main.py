from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import init_db
from .routers import (
    auth_router, entities_router, graph_router, analysis_router,
    alerts_router, cases_router, search_router, ingest_router, blockchain_router
)

app = FastAPI(
    title="AI-Powered Criminal Network Analysis System",
    description="SIH26189: prototype investigative intelligence platform (synthetic/demo data only).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {"status": "ok", "system": "AI-Powered Criminal Network Analysis System (SIH26189)"}


@app.get("/health")
def health():
    return {"status": "healthy"}


app.include_router(auth_router.router)
app.include_router(entities_router.router)
app.include_router(graph_router.router)
app.include_router(analysis_router.router)
app.include_router(alerts_router.router)
app.include_router(cases_router.router)
app.include_router(search_router.router)
app.include_router(ingest_router.router)
app.include_router(blockchain_router.router)

import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.getenv("DATA_DIR", os.path.join(BASE_DIR, "storage"))
os.makedirs(DATA_DIR, exist_ok=True)

SQLITE_PATH = os.path.join(DATA_DIR, "app.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{SQLITE_PATH}")
GRAPH_PATH = os.path.join(DATA_DIR, "graph.json")
SECRET_KEY = os.getenv("SECRET_KEY", "demo-only-change-this-secret-before-public-deployment")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

# The frontend and API share one domain in the Docker demo deployment.  Keep
# localhost available for local Vite development, and configure the public
# domain through CORS_ORIGINS when the frontend is hosted elsewhere.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

AUTO_MERGE_CONFIDENCE = 0.92
POSSIBLE_MATCH_CONFIDENCE = 0.55
SEMANTIC_MATCHING_ENABLED = os.getenv("SEMANTIC_MATCHING_ENABLED", "false").lower() == "true"
SEMANTIC_MATCHING_MIN_POOL = int(os.getenv("SEMANTIC_MATCHING_MIN_POOL", "500"))
SEMANTIC_MATCHING_MODEL = os.getenv(
	"SEMANTIC_MATCHING_MODEL",
	"sentence-transformers/all-MiniLM-L6-v2",
)

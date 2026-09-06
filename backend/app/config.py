import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "storage")
os.makedirs(DATA_DIR, exist_ok=True)

SQLITE_PATH = os.path.join(DATA_DIR, "app.db")
DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
GRAPH_PATH = os.path.join(DATA_DIR, "graph.json")
SECRET_KEY = "sih26189-demo-secret-key-do-not-use-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

AUTO_MERGE_CONFIDENCE = 0.92
POSSIBLE_MATCH_CONFIDENCE = 0.55
SEMANTIC_MATCHING_ENABLED = os.getenv("SEMANTIC_MATCHING_ENABLED", "false").lower() == "true"
SEMANTIC_MATCHING_MIN_POOL = int(os.getenv("SEMANTIC_MATCHING_MIN_POOL", "500"))
SEMANTIC_MATCHING_MODEL = os.getenv(
	"SEMANTIC_MATCHING_MODEL",
	"sentence-transformers/all-MiniLM-L6-v2",
)

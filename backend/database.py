from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Investigator(Base):
    __tablename__ = "investigators"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    badge_id = Column(String)
    role = Column(String, default="Investigator")
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Case(Base):
    __tablename__ = "cases"
    id = Column(String, primary_key=True)
    title = Column(String)
    description = Column(Text)
    status = Column(String, default="open")
    priority = Column(String, default="medium")
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    links = relationship("CaseEntityLink", back_populates="case", cascade="all, delete-orphan")
    notes = relationship("CaseNote", back_populates="case", cascade="all, delete-orphan")
    embedding = relationship("CaseEmbedding", back_populates="case", uselist=False, cascade="all, delete-orphan")


class CaseEntityLink(Base):
    __tablename__ = "case_entity_links"
    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"))
    entity_id = Column(String, index=True)
    entity_type = Column(String, nullable=True)
    linked_kind = Column(String, default="entity")
    ref_id = Column(String, nullable=True)
    added_by = Column(String)
    added_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="links")


class CaseNote(Base):
    __tablename__ = "case_notes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"))
    author = Column(String)
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="notes")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True)
    entity_id = Column(String, index=True)
    entity_name = Column(String)
    alert_type = Column(String)
    score = Column(Float)
    status = Column(String, default="open")
    reasons_json = Column(Text)
    evidence_json = Column(Text, nullable=True)
    related_entities_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ResolutionCandidate(Base):
    __tablename__ = "resolution_candidates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_a = Column(String, index=True)
    entity_b = Column(String, index=True)
    confidence = Column(Float)
    reasons_json = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True)
    filename = Column(String)
    dataset_type = Column(String)
    record_count = Column(Integer, default=0)
    uploaded_by = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class CaseEmbedding(Base):
    """
    Stores the vector representation of a case (title + description + notes +
    key metadata) so similar past cases can be surfaced by meaning, not just
    keyword overlap ("find cases with a similar MO").

    embedding_json holds a JSON-encoded list of floats. This keeps it portable
    across SQLite (dev) and Postgres (prod) with zero schema changes -
    consistent with how reasons_json / evidence_json are already stored
    elsewhere in this file.

    SCALING NOTE: once case volume grows large enough that brute-force
    (numpy) comparison gets slow (rough guideline: hundreds of thousands of
    cases), migrate this column to pgvector's native `Vector` type on
    Postgres and add an HNSW index - the rest of the app code
    (similarity_search.py) barely has to change, since it only calls into
    this table.
    """
    __tablename__ = "case_embeddings"
    case_id = Column(String, ForeignKey("cases.id"), primary_key=True)
    embedding_json = Column(Text)
    embedding_model = Column(String, default="all-MiniLM-L6-v2")
    source_text_hash = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="embedding")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

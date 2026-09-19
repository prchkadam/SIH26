from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    Float,
    DateTime,
    Text,
    Boolean,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
from .config import DATABASE_URL


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# ============================================================
# INVESTIGATOR
# ============================================================

class Investigator(Base):
    __tablename__ = "investigators"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    badge_id = Column(String)
    role = Column(String, default="Investigator")
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================
# CASE
# ============================================================

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

    links = relationship(
        "CaseEntityLink",
        back_populates="case",
        cascade="all, delete-orphan"
    )

    notes = relationship(
        "CaseNote",
        back_populates="case",
        cascade="all, delete-orphan"
    )

    # Evidence associated with this case
    evidence = relationship(
        "Evidence",
        back_populates="case",
        cascade="all, delete-orphan"
    )


# ============================================================
# CASE ENTITY LINK
# ============================================================

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

    case = relationship(
        "Case",
        back_populates="links"
    )


# ============================================================
# CASE NOTE
# ============================================================

class CaseNote(Base):
    __tablename__ = "case_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, ForeignKey("cases.id"))
    author = Column(String)
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship(
        "Case",
        back_populates="notes"
    )


# ============================================================
# EVIDENCE
# ============================================================
# Stores evidence metadata in SQLite.
#
# IMPORTANT:
# The actual sensitive evidence is NOT stored on the blockchain.
# We store a SHA-256 hash on the blockchain to prove integrity.
#
# Evidence corrections NEVER overwrite the original evidence.
# Instead, a new version is created and linked to the previous
# version through previous_version_id.
# ============================================================

class Evidence(Base):
    __tablename__ = "evidence"

    # --------------------------------------------------------
    # Identity
    # --------------------------------------------------------

    id = Column(
        String,
        primary_key=True
    )

    # Case this evidence belongs to
    case_id = Column(
        String,
        ForeignKey("cases.id"),
        index=True
    )

    # --------------------------------------------------------
    # Basic evidence information
    # --------------------------------------------------------

    evidence_type = Column(
        String
    )

    description = Column(
        Text
    )

    source = Column(
        String,
        nullable=True
    )

    # Optional actual content/reference.
    #
    # For sensitive production deployments, this should point
    # to secure storage rather than storing raw evidence here.
    content = Column(
        Text,
        nullable=True
    )

    # --------------------------------------------------------
    # SHA-256 integrity fingerprint
    # --------------------------------------------------------

    content_hash = Column(
        String,
        nullable=False,
        index=True
    )

    # --------------------------------------------------------
    # Blockchain information
    # --------------------------------------------------------

    block_index = Column(
        Integer,
        nullable=True
    )

    block_hash = Column(
        String,
        nullable=True,
        index=True
    )

    # --------------------------------------------------------
    # Investigator who originally submitted this version
    # --------------------------------------------------------

    created_by = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # ========================================================
    # EVIDENCE VERSIONING
    # ========================================================
    #
    # Example:
    #
    # V1
    #   status = "superseded"
    #
    # V2
    #   status = "active"
    #   previous_version_id = V1.id
    #
    # V3
    #   status = "active"
    #   previous_version_id = V2.id
    #
    # The previous evidence is NEVER deleted.
    # ========================================================

    # Version number
    #
    # Original evidence:
    #   version = 1
    #
    # First correction:
    #   version = 2
    #
    # Second correction:
    #   version = 3
    version = Column(
        Integer,
        default=1,
        nullable=False
    )

    # Current state of this evidence version.
    #
    # Possible values:
    #   active
    #   verified
    #   superseded
    status = Column(
        String,
        default="active",
        nullable=False,
        index=True
    )

    # ID of the previous evidence version.
    #
    # For original evidence:
    #   NULL
    #
    # For V2:
    #   V1.id
    #
    # For V3:
    #   V2.id
    previous_version_id = Column(
        String,
        nullable=True,
        index=True
    )

    # ========================================================
    # INVESTIGATOR VERIFICATION
    # ========================================================

    # Username of investigator who manually verified
    # this particular evidence version.
    verified_by = Column(
        String,
        nullable=True
    )

    # Timestamp when this evidence version was manually verified.
    verified_at = Column(
        DateTime,
        nullable=True
    )

    # --------------------------------------------------------
    # Relationship back to Case
    # --------------------------------------------------------

    case = relationship(
        "Case",
        back_populates="evidence"
    )


# ============================================================
# ALERT
# ============================================================

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


# ============================================================
# RESOLUTION CANDIDATE
# ============================================================

class ResolutionCandidate(Base):
    __tablename__ = "resolution_candidates"

    id = Column(
        Integer,
        primary_key=True,
        autoincrement=True
    )

    entity_a = Column(
        String,
        index=True
    )

    entity_b = Column(
        String,
        index=True
    )

    confidence = Column(
        Float
    )

    reasons_json = Column(
        Text
    )

    status = Column(
        String,
        default="pending"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# ============================================================
# DATASET
# ============================================================

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(
        String,
        primary_key=True
    )

    filename = Column(
        String
    )

    dataset_type = Column(
        String
    )

    record_count = Column(
        Integer,
        default=0
    )

    uploaded_by = Column(
        String
    )

    uploaded_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # --------------------------------------------------------
    # Blockchain integrity information
    # --------------------------------------------------------

    # SHA-256 hash of the original uploaded dataset
    content_hash = Column(
        String,
        nullable=True,
        index=True
    )

    # Blockchain block containing the dataset hash
    block_index = Column(
        Integer,
        nullable=True
    )

    # Hash of that blockchain block
    block_hash = Column(
        String,
        nullable=True,
        index=True
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True)
    index = Column(Integer, unique=True, nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    event_type = Column(String, nullable=False, index=True)
    actor = Column(String, nullable=True, index=True)
    source = Column(String, nullable=True)
    record_type = Column(String, nullable=False, index=True)
    record_id = Column(String, nullable=True, index=True)
    data_json = Column(Text, nullable=False)
    hash = Column(String, nullable=False, unique=True, index=True)
    previous_hash = Column(String, nullable=False)


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

def init_db():
    Base.metadata.create_all(
        bind=engine
    )


# ============================================================
# DATABASE SESSION
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
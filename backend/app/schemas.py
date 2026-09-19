from typing import Optional, List, Dict, Any

from pydantic import BaseModel


class LoginRequest(BaseModel):

    username: str

    password: str


class TextExtractRequest(BaseModel):

    text: str

    commit: bool = False


class ManualEntity(BaseModel):

    type: str

    name: str

    attributes: Dict[str, Any] = {}


class ManualRelationship(BaseModel):

    source_id: str

    target_id: str

    type: str

    attributes: Dict[str, Any] = {}

    confidence: float = 1.0


class CaseCreate(BaseModel):

    title: str

    description: str = ""

    priority: str = "medium"


class CaseLinkRequest(BaseModel):

    entity_id: Optional[str] = None

    linked_kind: str = "entity"

    ref_id: Optional[str] = None

    entity_type: Optional[str] = None


class CaseNoteRequest(BaseModel):

    text: str


class ResolutionDecision(BaseModel):

    decision: str


class EvidenceCreate(BaseModel):

    evidence_type: str

    description: str

    content: str

    source: Optional[str] = None


class EvidenceVerify(BaseModel):

    evidence_id: str
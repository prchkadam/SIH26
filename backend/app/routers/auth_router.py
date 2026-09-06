from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db, Investigator
from ..schemas import LoginRequest
from ..auth import verify_password, create_access_token, get_current_investigator

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Investigator).filter(Investigator.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token({"sub": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "investigator": {
            "username": user.username, "full_name": user.full_name,
            "badge_id": user.badge_id, "role": user.role,
        },
    }


@router.get("/me")
def me(current=Depends(get_current_investigator)):
    return {
        "username": current.username, "full_name": current.full_name,
        "badge_id": current.badge_id, "role": current.role,
    }

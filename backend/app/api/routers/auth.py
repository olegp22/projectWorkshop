from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas import UserCreate, UserResponse, UserEntrance,GroupCreate,GroupResponse,\
    MemberResponse
from app.db.session import get_db
import crud
from app.models.group import Group, GroupMember
from app.core.auth import create_access_token
from app.api.deps import get_current_user



auth_router  = APIRouter(prefix="/auth", tags=["Authentication"])
#----------ручка для входа----------
@auth_router.post("/login")
def login(user_data: UserEntrance, db: Session = Depends(get_db)):

    user_in_db = crud.get_user_by_email(db, email=user_data.email)

    if not user_in_db:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    is_password_correct = crud.verify_password(
        user_data.password.get_secret_value(),
        user_in_db.password
    )

    if not is_password_correct:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    access_token = create_access_token({"user_id": user_in_db.id})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
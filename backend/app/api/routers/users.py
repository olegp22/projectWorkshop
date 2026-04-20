from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas import UserCreate, UserResponse, UserEntrance,GroupCreate,GroupResponse,\
    MemberResponse
from app.db.session import get_db
import crud
from app.models.group import Group, GroupMember
from app.core.auth import create_access_token
from app.api.deps import get_current_user


users_router  = APIRouter(prefix="/users", tags=["Users"])
#----------ручка для регистрации----------
@users_router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(crud.User).filter_by(email=user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )
    new_user = crud.create_user(db, user)
    return new_user
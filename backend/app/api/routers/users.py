from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas import UserCreate, UserResponse, UserEntrance,GroupCreate,GroupResponse,\
    MemberResponse, UserUpdate
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

#--------------ручка для изменнения почты и ФИО------------------
@users_router.put("/me", response_model=UserResponse)
async def update_profile(
    userChang: UserUpdate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Если пользователь меняет почту, проверяем, свободна ли она
    if userChang.email != current_user.email:
        existing_user = crud.get_user_by_email(db, userChang.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Этот email уже занят другим пользователем"
            )
    
    # Обновляем данные, передавая ID прямо из токена
    updated_user = crud.update_user(db, current_user.id, userChang)
    return updated_user
    


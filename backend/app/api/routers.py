from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas import UserCreate, UserResponse, UserEntrance
from app.db import get_db
from app import crud


users_router  = APIRouter(prefix="/users", tags=["Users"])
#ручка для регистрации
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



auth_router  = APIRouter(prefix="/auth", tags=["Authentication"])

@auth_router.post("/login")
def login(user_data: UserEntrance, db: Session = Depends(get_db)):

    user_in_db = crud.get_user_by_email(db, email=user_data.email)
    
    if not user_in_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверная почта или пароль"
        )


    is_password_correct = crud.verify_password(
        plain_password=user_data.password.get_secret_value(), 
        hashed_password=user_in_db.password
    )
    
    if not is_password_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверная почта или пароль"
        )

    return {"message": "Вы успешно вошли!", "user_id": user_in_db.id}

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.users import UserEntrance, Token
from app.db.session import get_db
from app.crud import get_user_by_email, verify_password
from app.core.auth import create_access_token


auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
#----------ручка для входа----------
@auth_router.post("/login", response_model=Token)
def login(user_data: UserEntrance, db: Session = Depends(get_db)):

    user_in_db = get_user_by_email(db, email=user_data.email)

    if not user_in_db:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    is_password_correct = verify_password(
        user_data.password.get_secret_value(),
        user_in_db.password,
    )

    if not is_password_correct:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    access_token = create_access_token({"user_id": user_in_db.id})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


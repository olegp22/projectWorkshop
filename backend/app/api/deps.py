from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError
from crud import get_user_by_id
from app.db.session import get_db
from app.core.auth import decode_token


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    try:
        payload = decode_token(token)
        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(status_code=401, detail="Неверный токен")

    except JWTError:
        raise HTTPException(status_code=401, detail="Неверный токен")

    user = get_user_by_id(db, user_id=user_id)

    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    return user
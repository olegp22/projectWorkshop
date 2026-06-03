from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas import NotificationResponse
from app.db.session import get_db
from app.api.deps import get_current_user
from app.crud import get_notifications_for_user

notifications_router = APIRouter(prefix="/notification", tags=["Notifications"])


# Получает уведомления текущего пользователя
@notifications_router.get("/my", response_model=list[NotificationResponse])
async def get_my_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_notifications_for_user(db, user_id=current_user.id)
     
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas import NotificationResponse
from app.db.session import get_db
from app.api.deps import get_current_user
from app.crud import get_notifications_for_user, get_notification_anread, notification_isread

notifications_router = APIRouter(prefix="/notification", tags=["Notifications"])


# Получает уведомления текущего пользователя и делает их прочитанными
@notifications_router.get("/my", response_model=list[NotificationResponse])
async def get_my_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ansver = get_notifications_for_user(db, user_id=current_user.id)
    notification_isread(db, ansver)
    return ansver


# Получает непрочитанные уведомления и помечает их прочитанными
@notifications_router.get("/my/unread", response_model=list[NotificationResponse])
async def get_my_unread_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ansver = get_notification_anread(db, current_user.id)
    notification_isread(db, ansver)
    return ansver
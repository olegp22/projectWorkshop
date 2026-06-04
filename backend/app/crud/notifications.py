from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.schemas.notifications import TypeMassege, NotificationResponse


def create_notification(db: Session, user_id: int, text: str, type_massege: TypeMassege):
    db_notification = Notification(
        user_id=user_id,
        text=text,
        type_massege=type_massege,
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification


def get_notifications_for_user(db: Session, user_id: int):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .all()
    )

def get_notification_anread(db: Session, user_id: int):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read == False)
        .order_by(Notification.created_at.desc())
        .all()
    )


def notification_isread(db: Session, notifications: list[Notification]):
    if not notifications:
        return

    notification_ids = [notification.id for notification in notifications]
    db.query(Notification).filter(Notification.id.in_(notification_ids)).update(
        {"is_read": True}, synchronize_session="fetch"
    )
    db.commit()

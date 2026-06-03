from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.schemas.notifications import TypeMassege


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

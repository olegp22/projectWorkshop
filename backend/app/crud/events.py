from app.models.events import Events
from sqlalchemy.orm import Session
from app.schemas import EventsResponse, CreateEventsToUser, UserRole


def create_event(db: Session, events: CreateEventsToUser, from_user_id: int):
    db_events = Events(
        to_user_id = events.to_user_id,
        from_user_id = from_user_id,
        date = events.date,
        locaition = events.locaition,
        description = events.description
    )

    db.add(db_events)
    db.commit()
    return db_events

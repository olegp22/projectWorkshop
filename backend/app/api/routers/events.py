from fastapi import APIRouter, Depends, HTTPException
from app.schemas import EventsResponse, CreateEventsToUser, UserRole
from app.db.session import get_db
from app.api.deps import get_current_user
from sqlalchemy.orm import Session
from app.models.group import GroupMember, Group
from app.models.events import Events
from app.crud import create_event

events_roters = APIRouter(prefix="/events", tags = ["Events"])

@events_roters.post("/", response_model = EventsResponse)
async def CreateEvents(
    events: CreateEventsToUser,
    group_id: int,
    from_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    checking_the_creator=db.query(GroupMember).filter(GroupMember.group_id==group_id,
                GroupMember.user_id==from_user.id).first()
    
    if not checking_the_creator:
        raise HTTPException(status_code= 401, detail="Вы не состоите в этой группе")
    
    if checking_the_creator.role != UserRole.CREATOR and checking_the_creator.role != UserRole.REVIEWER:
        raise HTTPException(status_code=403, 
                            detail= "Вы не можете создавать событие, так как не являетесь организатором или проверяющим")
    
    checking_the_recipient = (db.query(GroupMember)
        .filter(GroupMember.group_id==group_id,
                GroupMember.user_id==events.to_user_id)
        .first())
    
    if not checking_the_recipient:
        raise HTTPException(status_code=401, detail="Выбрынный Вами участник не состоит в этой группе")
    
    if checking_the_recipient.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, 
                            detail="Выбранный Вами участник не является студентом")
    
    return create_event(db, events, from_user.id)

@events_roters.get("/", response_model=list[EventsResponse])
async def GetEvents(
    from_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Вернуть события, которые создал пользователь и которые ему пришли
    items = db.query(Events).filter(
        (Events.to_user_id == from_user.id) | (Events.from_user_id == from_user.id)
    ).all()

    return items


@events_roters.delete("/{event_id}")
async def DeleteEvent(
    event_id: int,
    from_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Events).filter(Events.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    if event.from_user_id != from_user.id:
        raise HTTPException(status_code=403, detail="Только создатель может удалять событие")

    db.delete(event)
    db.commit()
    return {"detail": "deleted"}


@events_roters.put("/{event_id}", response_model=EventsResponse)
async def UpdateEvent(
    event_id: int,
    events: CreateEventsToUser,
    from_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.query(Events).filter(Events.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")

    if event.from_user_id != from_user.id:
        raise HTTPException(status_code=403, detail="Только создатель может изменять событие")

    # Обновляем поля (игнорируем to_user_id из body при апдейте)
    event.date = events.date
    event.locaition = events.locaition
    event.description = events.description

    db.add(event)
    db.commit()
    db.refresh(event)
    return event
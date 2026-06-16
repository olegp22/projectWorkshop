from datetime import datetime
from pydantic import BaseModel

class EventsResponse(BaseModel):
    id: int
    to_user_id: int
    from_user_id: int
    date: datetime
    locaition: str
    description: str 

class CreateEventsToUser(BaseModel):
    to_user_id: int
    date: datetime
    locaition: str
    description: str
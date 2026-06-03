from pydantic import BaseModel
import enum


class TypeMassege(str, enum.Enum):
    NEW_ASSESSMENT = "new_assessment"
    CHANGED_ASSESSMENT = "change_assessment"
    NEW_WORK = "new_work"
    NEW_MEMBER = "new_member"
    REMOVAL_FROM_THE_GROUP = "removal_from_the_group"


class CreateNotification(BaseModel):
    user_id: int
    text: str
    type_massege: TypeMassege


class NotificationResponse(BaseModel):
    id: int
    text: str
    type_massege: TypeMassege
    is_read: bool

    class Config:
        from_attributes = True

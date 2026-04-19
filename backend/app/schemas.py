from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, SecretStr
import uuid
from pydantic import BaseModel
#валидация данных 


class UserCreate(BaseModel):
    name: Annotated[str, Field(pattern="^[A-Za-zА-Яа-яЁё]+$")]
    surname: Annotated[str, Field(pattern="^[A-Za-zА-Яа-яЁё]+$")]
    patronymic: Annotated[str, Field(pattern="^[A-Za-zА-Яа-яЁё]+$")]
    email: EmailStr
    password: Annotated[SecretStr, Field(min_length=8)]

class UserEntrance(BaseModel):
    email: EmailStr
    password: SecretStr

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    surname: str
    patronymic: str

    class Config:
        from_attributes = True



class GroupCreate(BaseModel):
    name: str

class GroupResponse(BaseModel):
    id: int
    name: str
    creator_id: int
    reviewer_invite_token: str
    student_invite_token: str

    class Config:
        from_attributes = True
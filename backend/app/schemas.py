from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, SecretStr
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
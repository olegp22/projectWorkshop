from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, SecretStr


class UserCreate(BaseModel):
    name: Annotated[str, Field(pattern="^[A-Za-zА-Яа-яЁё]+$")]
    surname: Annotated[str, Field(pattern="^[A-Za-zА-Яа-яЁё]+$")]
    patronymic: Annotated[str, Field(pattern="^[A-Za-zА-Яа-яЁё]+$")]
    email: EmailStr
    password: Annotated[SecretStr, Field(min_length=8)]


class UserEntrance(BaseModel):
    email: EmailStr
    password: SecretStr


class UserLog(BaseModel):
    access_token: str
    token_type: str
    name: str
    surname: str
    patronymic: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    surname: str
    patronymic: str
    access_token: str
    token_type: str

    class Config:
        from_attributes = True


class UserToChange(BaseModel):
    id: int
    email: EmailStr
    name: str
    surname: str
    patronymic: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class UserGroupResponse(BaseModel):
    id: int
    name: str
    role: str
    group_mode: str

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    email: EmailStr
    name: str
    surname: str
    patronymic: str

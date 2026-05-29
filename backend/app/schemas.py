from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, SecretStr
import uuid
import enum
#валидация данных
 
class GroupMode(str, enum.Enum):
    CLASSIC = "classic"
    P2P = "p2p"

#валидация для пользователь
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
    role: str  # "creator", "reviewer" или "student"
    group_mode: GroupMode
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    email: EmailStr
    name: str
    surname: str
    patronymic: str



#валидация для групп
class GroupCreate(BaseModel):
    name: str
    group_mode: GroupMode
    count_of_inspectors: int = Field(default=1)


#данные, которые возвращаются при создании шруппы 
class GroupResponse(BaseModel):
    id: int
    name: str
    creator_id: int
    group_mode: GroupMode 
    count_of_inspectors: int = Field(default=1)
    reviewer_invite_token: str
    student_invite_token: str

    class Config:
        from_attributes = True

class MemberResponse(BaseModel):
    user_id: int
    name: str
    surname: str
    role: str

    class Config:
        from_attributes = True


# Схема для создания критерия
class CriterionCreate(BaseModel):
    name: str
    description: str | None = None

# Схема для ответа
class CriterionResponse(BaseModel):
    id: int
    name: str
    description: str | None
    max_score: int
    group_id: int

    class Config:
        from_attributes = True

# Схема для загрузки работы студентом
class SubmissionCreate(BaseModel):
    link: str  # Ссылка на Google Docs / Диск
    group_id: int


# Схема для выставления оценки
class GradeCreate(BaseModel):
    criterion_id: int
    score: int = Field(ge=0, le=10) # Оценка строго от 0 до 10

# Схема для завершения проверки (комментарий + оценки)
class ReviewCreate(BaseModel):
    comment: str | None = None
    grades: list[GradeCreate]

# Схема для ответа 
class SubmissionResponse(BaseModel):
    id: int
    link: str
    student_id: int
    status: str
    reviewers_count: int | None = None
    comment: str 

    class Config:
        from_attributes = True

class UbdateSubmissionResponse(BaseModel):
    submission_id: int
    link: str
    student_id: int
    status: str
    comment: str 

    class Config:
        from_attributes = True

class GradeDetailResponse(BaseModel):
    criterion_name: str
    score: int

# Полный отчет о проверке для студента
class SubmissionFullDetails(BaseModel):
    id_submission: int
    id_submission_reviewer: int
    student_id: int
    reviewer_id: int
    link: str
    status: str
    reviewer_comment: str | None
    grades: list[GradeDetailResponse]

    class Config:
        from_attributes = True

# Схема для обновления ссылки (для студента)
class SubmissionLinkUpdate(BaseModel):
    link: str

# Схема для обновления комментария (для преподавателя)
class SubmissionCommentUpdate(BaseModel):
    comment: str

class ReviewerSubmissionResponse(BaseModel):
    submission_id: int
    link: str
    student_id: int
    group_id: int
    status: str

    class Config:
        from_attributes = True


class ReviewDetails(BaseModel):
    reviewer_id: int
    comment: str | None
    status: str
    grades: list[GradeDetailResponse]


class SubmissionReviewersResponse(BaseModel):
    submission_id: int
    link: str
    status: str
    student_id: int
    reviewrs: list[ReviewDetails]

    class Config:
        from_attributes = True

        
import enum
from pydantic import BaseModel, Field


class GroupMode(str, enum.Enum):
    CLASSIC = "classic"
    P2P = "p2p"


class GroupCreate(BaseModel):
    name: str
    group_mode: GroupMode
    count_of_inspectors: int = Field(default=1)


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


class CriterionCreate(BaseModel):
    name: str
    description: str | None = None
    max_score: int


class CriterionResponse(BaseModel):
    id: int
    name: str
    description: str | None
    max_score: int
    group_id: int

    class Config:
        from_attributes = True

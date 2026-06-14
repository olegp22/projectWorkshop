from pydantic import BaseModel, Field


class SubmissionCreate(BaseModel):
    link: str
    group_id: int


class GradeCreate(BaseModel):
    criterion_id: int
    score: int = Field(ge=0)


class ReviewCreate(BaseModel):
    comment: str | None = None
    grades: list[GradeCreate]


class SubmissionResponse(BaseModel):
    id: int
    link: str
    student_id: int
    status: str
    reviewers_count: int | None = None

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
    criterion_id: int
    criterion_name: str
    score: int
    max_score: int


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


class SubmissionLinkUpdate(BaseModel):
    link: str


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
    reviewers: list[ReviewDetails] | None

    class Config:
        from_attributes = True

class SubmissionMyScoreResponse(BaseModel):
    id: int
    link: str
    score: float
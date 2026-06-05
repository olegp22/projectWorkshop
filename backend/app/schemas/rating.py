from pydantic import BaseModel

class RatingResponse(BaseModel):
    name: str
    surname: str
    patronymic: str
    total_score: int
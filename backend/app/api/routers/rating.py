from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.schemas import RatingResponse, GroupMode
from app.models.group import Group
from app.db.session import get_db
from app.crud import create_rating


rating_router = APIRouter(prefix = "/rating", tags = ["Rating"])

@rating_router.get("/", response_model = list[RatingResponse])
async def get_rating(
    group_id: int,
    db: Session = Depends(get_db)
):
    group = db.query(Group).filter(Group.id == group_id).first()

    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    if group.group_mode != GroupMode.CONTEST:
        raise HTTPException(status_code= 400, detail = "В вашей группе не может быть рейтинга")
    rating = create_rating(db, group_id)

    return rating
    
    
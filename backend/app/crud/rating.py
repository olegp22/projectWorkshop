from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.schemas import RatingResponse, GroupMode
from app.models.group import Group
from app.models.submission import Submission, Grade
from app.models.user import User
from app.models.group import Criterion
from sqlalchemy import func

def create_rating(db: Session, group_id: int):
    submissions = db.query(Submission).filter(Submission.group_id == group_id).all()
    if not submissions:
        raise HTTPException(status_code= 401, detail= "В группе нету работ")

    rating=[]
    for sub in submissions:
        student = db.query(User).filter(User.id == sub.student_id).first()
        score = get_score(db, sub.id)
        rating.append(
            {
            "name": student.name,
            "surname": student.surname,
            "patronymic": student.patronymic,
            "total_score": score
            }
        )

    return sorted(rating, key = lambda r: r["total_score"], reverse = True)

def get_score(db: Session, submission_id: int):
    # Для каждого критерия считаем средний балл по всем проверкам, затем
    # сумма средних / сумма max_score
    rows = (
        db.query(Grade.criterion_id, func.avg(Grade.score).label("avg_score"), Criterion.max_score)
        .join(Criterion, Grade.criterion_id == Criterion.id)
        .filter(Grade.submission_id == submission_id)
        .group_by(Grade.criterion_id, Criterion.max_score)
        .all()
    )

    if not rows:
        return 0

    numerator = sum(r.avg_score for r in rows)
    denominator = sum(r.max_score for r in rows)
    if denominator == 0:
        return 0

    return numerator / denominator
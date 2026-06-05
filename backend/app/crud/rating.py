from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.schemas import RatingResponse, GroupMode
from app.models.group import Group
from app.models.submission import Submission, Grade
from app.models.user import User

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
    all_score = db.query(Grade).filter(Grade.submission_id == submission_id).all()
    total_score=0

    if len(all_score) == 0:
        return 0
    
    for score in all_score:
        total_score+=score.score

    return total_score/len(all_score)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas import (
    SubmissionCreate,
    SubmissionResponse,
    ReviewCreate,
    SubmissionFullDetails,
    SubmissionReviewersResponse,
    SubmissionLinkUpdate,
    SubmissionCommentUpdate,
    UbdateSubmissionResponse,
    ReviewerSubmissionResponse,
    SubmissionMyScoreResponse
)
from app.db.session import get_db
from app.crud import (
    create_submission_classic,
    create_submission_p2p,
    submit_review,
    get_submission_details,
    update_submission_link,
    update_submission_comment,
    get_reviewer_submissions,
    create_submission_contest,
    get_score_work
)
from app.models.group import Group, GroupMember, GroupMode
from app.models.submission import Submission, SubmissionReviewer
from app.api.deps import get_current_user

submissions_router = APIRouter(prefix="/groups", tags=["Submissions"])


# Загружает работу студентом на проверку
@submissions_router.post("/submit", response_model=SubmissionResponse)
async def upload_work(
    submission: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sub_current = (db.query(Submission).
                   filter(Submission.group_id==submission.group_id,
                          Submission.student_id==current_user.id).first())
    if sub_current:
        raise HTTPException(status_code=403, detail="Вы уже загрузили работу")

    is_member = db.query(GroupMember).filter_by(
        group_id=submission.group_id,
        user_id=current_user.id,
        role="student",
    ).first()

    if not is_member:
        raise HTTPException(status_code=403, detail="Вы не являетесь студентом этой группы")

    group = db.query(Group).filter(Group.id == submission.group_id).first()

    if not group:
        raise HTTPException(status_code=400, detail="Группа не найдена")

    if group.group_mode == GroupMode.CLASSIC:
        new_submission = create_submission_classic(db, submission, student_id=current_user.id)
    elif group.group_mode == GroupMode.P2P:
        new_submission = create_submission_p2p(db, submission, student_id=current_user.id)
    else:
        new_submission = create_submission_contest(db, submission, student_id=current_user.id)

    if not new_submission:
        raise HTTPException(status_code=400, detail="В группе пока нет проверяющих")
    return new_submission

#упрощенный показ оценивания 
@submissions_router.get("/submissions/my-work", response_model=SubmissionMyScoreResponse)
async def get_my_work(
    group_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.group_id == group_id, 
                                            Submission.student_id == current_user.id).order_by(Submission.id.desc()).first()
    if not submission:
        raise HTTPException(status_code = 404, detail="Вы еще не загрузили работу")
    
    return get_score_work(db, submission)

# Отправляет оценки и комментарий к работе
@submissions_router.post("/submissions/{submission_id}/review", response_model=SubmissionFullDetails)
async def review_work(
    submission_id: int,
    review: ReviewCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    review_link = db.query(SubmissionReviewer).filter(
        SubmissionReviewer.submission_id == submission_id,
        SubmissionReviewer.reviewer_id == current_user.id,
    ).first()
    if not review_link:
        raise HTTPException(status_code=403, detail="Эта работа не назначена вам")

    return submit_review(db, submission_id, current_user.id, review)


# Получает результаты проверки работы со всеми оценками
@submissions_router.get("/submissions/{submission_id}", response_model=SubmissionReviewersResponse)
async def read_submission_results(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    details = get_submission_details(db, submission_id)
    if not details:
        raise HTTPException(status_code=404, detail="Работа не найдена")

    raw_sub = db.query(Submission).filter(Submission.id == submission_id).first()
    group = db.query(Group).filter(Group.id == raw_sub.group_id).first()
    reviewers = db.query(SubmissionReviewer).filter(SubmissionReviewer.submission_id == raw_sub.id).all()
    reviewer_ids = [r.reviewer_id for r in reviewers]
    if raw_sub.student_id != current_user.id and group.creator_id != current_user.id and current_user.id not in reviewer_ids:
        raise HTTPException(status_code=403, detail="У вас нет доступа к результатам этой работы")

    return details


# Обновляет ссылку на работу студентом
@submissions_router.put("/submissions/{submission_id}/link", response_model=SubmissionResponse)
async def change_submission_link(
    submission_id: int,
    data: SubmissionLinkUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Работа не найдена")
    if submission.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Вы можете менять ссылку только в своей работе")
    if submission.status == "graded":
        raise HTTPException(status_code=400, detail="Нельзя менять ссылку, работа уже проверена")

    new_submission = update_submission_link(db, submission_id, data.link)
    # Посчитать фактическое количество назначенных проверяющих для этой работы
    reviewers_count = db.query(SubmissionReviewer).filter(SubmissionReviewer.submission_id == new_submission.id).count()

    return {
        "id": new_submission.id,
        "link": new_submission.link,
        "student_id": new_submission.student_id,
        "status": new_submission.status,
        "reviewers_count": reviewers_count,
    }


# Обновляет комментарий проверяющего к работе
@submissions_router.put("/submissions/{submission_id}/comment", response_model=UbdateSubmissionResponse)
async def change_reviewer_comment(
    submission_id: int,
    data: SubmissionCommentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Работа не найдена")

    reviewer = db.query(SubmissionReviewer).filter(SubmissionReviewer.submission_id == submission.id, SubmissionReviewer.reviewer_id == current_user.id).first()
    if not reviewer:
        raise HTTPException(status_code=403, detail="Вы не являетесь проверяющим этой работы")

    return update_submission_comment(db, submission_id, current_user.id, data.comment)


# Получает список работ для проверки текущим пользователем
@submissions_router.get("/my-reviews", response_model=list[ReviewerSubmissionResponse])
async def my_reviews(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_reviewer_submissions(db, reviewer_id=current_user.id)



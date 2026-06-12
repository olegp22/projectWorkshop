from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.group import Group, GroupMember, Criterion
from app.models.submission import Submission, SubmissionReviewer, Grade
from app.schemas.submissions import SubmissionCreate, ReviewCreate
from app.crud.notifications import create_notification
from app.schemas.notifications import TypeMessage


def create_submission_classic(db: Session, submission_data: SubmissionCreate, student_id: int):
    group = db.query(Group).filter(Group.id == submission_data.group_id).first()
    if not group:
        return None
    
    reviewers = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "reviewer",
        )
        .all()
    )

    if not reviewers:
        return None

    reviewer_counts = (
        db.query(GroupMember.user_id, func.count(SubmissionReviewer.id).label("total"))
        .outerjoin(SubmissionReviewer, GroupMember.user_id == SubmissionReviewer.reviewer_id)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "reviewer",
        )
        .group_by(GroupMember.user_id)
        .order_by("total")
        .limit(group.count_of_inspectors_expert)
        .all()
    )


    db_submission = Submission(
        link=submission_data.link,
        group_id=submission_data.group_id,
        student_id=student_id,
        status="pending",
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)

    for reviewer in reviewer_counts:
        db_reviewer = SubmissionReviewer(
            submission_id=db_submission.id,
            reviewer_id=reviewer.user_id,
            status="pending",
        )
        create_notification(
            db,
            db_reviewer.reviewer_id,
            f"Вам назначили работу на проверку в группе '{group.name}'",
            TypeMessage.NEW_WORK,
        )
        db.add(db_reviewer)

    db.commit()

    return {
        "id": db_submission.id,
        "link": db_submission.link,
        "group_id": db_submission.group_id,
        "student_id": db_submission.student_id,
        "status": db_submission.status,
        "reviewers_count": len(reviewer_counts),
    }


def create_submission_p2p(db: Session, submission_data: SubmissionCreate, student_id: int):
    group = db.query(Group).filter(Group.id == submission_data.group_id).first()
    if not group:
        return None

    students = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "student",
            GroupMember.user_id != student_id,
        )
        .all()
    )

    if not students:
        return None

    db_submission = Submission(
        link=submission_data.link,
        group_id=submission_data.group_id,
        student_id=student_id,
        status="pending",
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)

    reviewer_counts = (
        db.query(GroupMember.user_id, func.count(SubmissionReviewer.id).label("total"))
        .outerjoin(SubmissionReviewer, GroupMember.user_id == SubmissionReviewer.reviewer_id)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "student",
            GroupMember.user_id != student_id,
        )
        .group_by(GroupMember.user_id)
        .order_by("total")
        .limit(group.count_of_inspectors_student)
        .all()
    )

    for reviewer in reviewer_counts:
        db_reviewer = SubmissionReviewer(
            submission_id=db_submission.id,
            reviewer_id=reviewer.user_id,
            status="pending",
        )
        create_notification(
            db,
            db_reviewer.reviewer_id,
            f"Вам назначили работу на проверку в группе '{group.name}'",
            TypeMessage.NEW_WORK,
        )
        db.add(db_reviewer)

    db.commit()

    return {
        "id": db_submission.id,
        "link": db_submission.link,
        "group_id": db_submission.group_id,
        "student_id": db_submission.student_id,
        "status": db_submission.status,
        "reviewers_count": len(reviewer_counts),
    }


def create_submission_contest(db: Session, submission_data: SubmissionCreate, student_id: int):
    group = db.query(Group).filter(Group.id == submission_data.group_id).first()
    if not group:
        return None
    
    students = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "student",
            GroupMember.user_id != student_id,
        )
        .all()
    )

    if not students:
        return None

    db_submission = Submission(
        link=submission_data.link,
        group_id=submission_data.group_id,
        student_id=student_id,
        status="pending",
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)

    reviewer_counts_student = (
        db.query(GroupMember.user_id, func.count(SubmissionReviewer.id).label("total"))
        .outerjoin(SubmissionReviewer, GroupMember.user_id == SubmissionReviewer.reviewer_id)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "student",
            GroupMember.user_id != student_id,
        )
        .group_by(GroupMember.user_id)
        .order_by("total")
        .limit(group.count_of_inspectors_student)
        .all()
    )

    for reviewer in reviewer_counts_student:
        db_reviewer = SubmissionReviewer(
            submission_id=db_submission.id,
            reviewer_id=reviewer.user_id,
            status="pending",
        )
        create_notification(
            db,
            db_reviewer.reviewer_id,
            f"Вам назначили работу на проверку в группе '{group.name}'",
            TypeMessage.NEW_WORK,
        )
        db.add(db_reviewer)

    db.commit()

    reviewers = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "reviewer",
        )
        .all()
    )

    if not reviewers:
        return None

    reviewer_counts_expert = (
        db.query(GroupMember.user_id, func.count(SubmissionReviewer.id).label("total"))
        .outerjoin(SubmissionReviewer, GroupMember.user_id == SubmissionReviewer.reviewer_id)
        .filter(
            GroupMember.group_id == submission_data.group_id,
            GroupMember.role == "reviewer",
        )
        .group_by(GroupMember.user_id)
        .order_by("total")
        .limit(group.count_of_inspectors_expert)
        .all()
    )


    # Добавляем экспертов к уже созданной записи `db_submission`
    for reviewer in reviewer_counts_expert:
        db_reviewer = SubmissionReviewer(
            submission_id=db_submission.id,
            reviewer_id=reviewer.user_id,
            status="pending",
        )
        create_notification(
            db,
            db_reviewer.reviewer_id,
            f"Вам назначили работу на проверку в группе '{group.name}'",
            TypeMessage.NEW_WORK,
        )
        db.add(db_reviewer)

    db.commit()

    return {
        "id": db_submission.id,
        "link": db_submission.link,
        "group_id": db_submission.group_id,
        "student_id": db_submission.student_id,
        "status": db_submission.status,
        "reviewers_count": len(reviewer_counts_student)+len(reviewer_counts_expert),
    }

def submit_review(db: Session, submission_id: int, reviewer_id: int, review_data: ReviewCreate):
    db_submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not db_submission:
        return None

    review_link = (
        db.query(SubmissionReviewer)
        .filter(
            SubmissionReviewer.submission_id == submission_id,
            SubmissionReviewer.reviewer_id == reviewer_id,
        )
        .first()
    )
    if not review_link:
        return None

    review_link.status = "graded"
    review_link.comment = review_data.comment

    for grade_data in review_data.grades:
        criterion = db.query(Criterion).filter(Criterion.id == grade_data.criterion_id).first()
        if not criterion:
            raise ValueError(f"Критерий {grade_data.criterion_id} не существует")

        db_grade = Grade(
            submission_id=submission_id,
            reviewer_id=reviewer_id,
            criterion_id=grade_data.criterion_id,
            score=grade_data.score,
        )
        db.add(db_grade)

    all_reviews = (
        db.query(SubmissionReviewer)
        .filter(SubmissionReviewer.submission_id == submission_id)
        .all()
    )

    group = db.query(Group).filter(Group.id == db_submission.group_id).first()
    if all(r.status == "graded" for r in all_reviews):
        db_submission.status = "graded"
        create_notification(
            db,
            db_submission.student_id,
            f"Ваша работа в группе '{group.name}' проверена",
            TypeMessage.NEW_ASSESSMENT,
        )

    db.commit()
    db.refresh(db_submission)

    grade_detail = []
    for grade_data in review_data.grades:
        criterion = db.query(Criterion).filter(Criterion.id == grade_data.criterion_id).first()
        grade_detail.append({
            "criterion_id": criterion.id,
            "criterion_name": criterion.name,
            "score": grade_data.score,
            "max_score": criterion.max_score,
        })

    return {
        "id_submission": db_submission.id,
        "id_submission_reviewer": review_link.id,
        "student_id": db_submission.student_id,
        "reviewer_id": reviewer_id,
        "link": db_submission.link,
        "status": db_submission.status,
        "reviewer_comment": review_link.comment,
        "grades": grade_detail,
    }


def get_submission_details(db: Session, submission_id: int):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        return None

    reviews = (
        db.query(SubmissionReviewer)
        .filter(SubmissionReviewer.submission_id == submission_id)
        .all()
    )

    reviews_result = []
    for review in reviews:
        grades = (
            db.query(Criterion.id.label("criterion_id"), Criterion.max_score, Criterion.name.label("criterion_name"), Grade.score)
            .join(Criterion, Grade.criterion_id == Criterion.id)
            .filter(Grade.submission_id == submission_id, Grade.reviewer_id == review.reviewer_id)
            .all()
        )

        reviews_result.append(
            {
                "reviewer_id": review.reviewer_id,
                "comment": review.comment,
                "status": review.status,
                "grades": [
                    {"criterion_id": g.criterion_id, "criterion_name": g.criterion_name, "score": g.score, "max_score": g.max_score} for g in grades
                ],
            }
        )

    return {
        "submission_id": submission.id,
        "link": submission.link,
        "status": submission.status,
        "student_id": submission.student_id,
        "reviewers": reviews_result,
    }


def update_submission_link(db: Session, submission_id: int, new_link: str):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission:
        submission.link = new_link
        db.commit()
        db.refresh(submission)
    return submission


def update_submission_comment(db: Session, submission_id: int, reviewer_id: int, new_comment: str):
    # Найти связь SubmissionReviewer для конкретного ревьювера
    review = db.query(SubmissionReviewer).filter(
        SubmissionReviewer.submission_id == submission_id,
        SubmissionReviewer.reviewer_id == reviewer_id,
    ).first()
    if not review:
        return None

    review.comment = new_comment
    db.commit()
    db.refresh(review)

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        return None

    return {
        "submission_id": submission.id,
        "link": submission.link,
        "student_id": submission.student_id,
        "status": submission.status,
        "comment": new_comment,
    }


def get_reviewer_submissions(db: Session, reviewer_id: int):
    reviews = (
        db.query(Submission.id, Submission.link, Submission.student_id, Submission.group_id, Submission.status)
        .join(SubmissionReviewer, Submission.id == SubmissionReviewer.submission_id)
        .filter(SubmissionReviewer.reviewer_id == reviewer_id)
        .all()
    )

    return [
        {
            "submission_id": item.id,
            "link": item.link,
            "student_id": item.student_id,
            "group_id": item.group_id,
            "status": item.status,
        }
        for item in reviews
    ]

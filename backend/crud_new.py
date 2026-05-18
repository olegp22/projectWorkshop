"""
CRUD (Create, Read, Update, Delete) operations - Refactored Version.

This module will eventually be split into:
- crud/users.py
- crud/groups.py  
- crud/submissions.py
- crud/criteria.py

Currently kept as single module for refactoring phase.
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from uuid import uuid4

from app.models.user import User
from app.models.group import Group, GroupMember, Criterion, UserRole
from app.models.submission import Submission, Grade, SubmissionReviewer
from app.schemas.users import UserCreate, UserUpdate
from app.schemas.groups import GroupCreate, CriterionCreate
from app.schemas.submissions import ReviewCreate, SubmissionCreate
from app.core.security import hash_password, verify_password


# ============================================================================
# USER CRUD OPERATIONS
# ============================================================================

def create_user(db: Session, user: UserCreate) -> User:
    """Create a new user with hashed password."""
    hashed_password = hash_password(user.password.get_secret_value())
    db_user = User(
        email=user.email,
        password=hashed_password,
        name=user.name,
        surname=user.surname,
        patronymic=user.patronymic
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email address."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def update_user(db: Session, user_id: int, user_update: UserUpdate) -> Optional[User]:
    """Update user information."""
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db_user.email = user_update.email
        db_user.name = user_update.name
        db_user.surname = user_update.surname
        db_user.patronymic = user_update.patronymic
        db.commit()
        db.refresh(db_user)
    return db_user


# ============================================================================
# GROUP CRUD OPERATIONS
# ============================================================================

def create_group(db: Session, group_data: GroupCreate, creator_id: int) -> Group:
    """Create a new group with auto-generated invite tokens."""
    db_group = Group(
        name=group_data.name,
        creator_id=creator_id,
        group_mode=group_data.group_mode,
        count_of_inspectors=group_data.count_of_inspectors,
        reviewer_invite_token=uuid4().hex,
        student_invite_token=uuid4().hex
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_group_participants(db: Session, group_id: int) -> List[dict]:
    """
    Get all participants in a group (creator + members).
    
    Returns list with user info and their role.
    """
    # Get group creator
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        return []
    
    result = [{
        "user_id": group.creator_id,
        "name": group.creator.name if group.creator else "Unknown",
        "surname": group.creator.surname if group.creator else "",
        "role": "creator"
    }]
    
    # Get other members
    members = db.query(User, GroupMember).join(
        GroupMember, User.id == GroupMember.user_id
    ).filter(GroupMember.group_id == group_id).all()
    
    for user, member in members:
        result.append({
            "user_id": user.id,
            "name": user.name,
            "surname": user.surname,
            "role": member.role.value
        })
    
    return result


def remove_member_from_db(db: Session, group_id: int, user_id: int) -> bool:
    """Remove user from group. Returns True if removed, False if not found."""
    member = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id
    ).first()
    
    if member:
        db.delete(member)
        db.commit()
        return True
    return False


def get_user_groups(db: Session, user_id: int) -> List[dict]:
    """
    Get all groups user participates in.
    
    Returns groups where user is member or creator.
    """
    # Groups where user is member
    member_groups = db.query(
        Group.id,
        Group.name,
        Group.group_mode,
        GroupMember.role
    ).join(
        GroupMember, Group.id == GroupMember.group_id
    ).filter(GroupMember.user_id == user_id).all()
    
    # Groups where user is creator
    owned_groups = db.query(
        Group.id,
        Group.name,
        Group.group_mode
    ).filter(Group.creator_id == user_id).all()
    
    result = []
    seen_ids = set()
    
    # Add creator groups
    for g in owned_groups:
        result.append({
            "id": g.id,
            "name": g.name,
            "group_mode": g.group_mode.value,
            "role": "creator"
        })
        seen_ids.add(g.id)
    
    # Add member groups
    for g in member_groups:
        if g.id not in seen_ids:
            result.append({
                "id": g.id,
                "name": g.name,
                "group_mode": g.group_mode.value,
                "role": g.role.value
            })
    
    return result


# ============================================================================
# CRITERION CRUD OPERATIONS
# ============================================================================

def create_criterion(db: Session, criterion: CriterionCreate, group_id: int) -> Criterion:
    """Create evaluation criterion for group."""
    db_criterion = Criterion(
        name=criterion.name,
        description=criterion.description,
        max_score=10,
        group_id=group_id
    )
    db.add(db_criterion)
    db.commit()
    db.refresh(db_criterion)
    return db_criterion


def get_group_criteria(db: Session, group_id: int) -> List[Criterion]:
    """Get all criteria for a group."""
    return db.query(Criterion).filter(Criterion.group_id == group_id).all()


def update_criterion_in_db(db: Session, criterion_id: int, updated_data: CriterionCreate) -> Optional[Criterion]:
    """Update criterion information."""
    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id).first()
    if db_criterion:
        db_criterion.name = updated_data.name
        db_criterion.description = updated_data.description
        db.commit()
        db.refresh(db_criterion)
    return db_criterion


def delete_criterion_from_db(db: Session, criterion_id: int) -> bool:
    """Delete criterion. Returns True if deleted, False if not found."""
    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id).first()
    if db_criterion:
        db.delete(db_criterion)
        db.commit()
        return True
    return False


# ============================================================================
# SUBMISSION CRUD OPERATIONS
# ============================================================================

def create_submission_classic(
    db: Session,
    submission_data: SubmissionCreate,
    student_id: int
) -> Optional[dict]:
    """
    Create submission in CLASSIC mode (one assigned reviewer).
    
    Selects reviewer with least assigned submissions.
    """
    # Get all reviewers in group
    reviewers = db.query(GroupMember).filter(
        GroupMember.group_id == submission_data.group_id,
        GroupMember.role == UserRole.REVIEWER
    ).all()
    
    if not reviewers:
        return None
    
    # Find reviewer with least submissions
    reviewer_counts = db.query(
        GroupMember.user_id,
        func.count(SubmissionReviewer.id).label("total")
    ).outerjoin(
        SubmissionReviewer,
        GroupMember.user_id == SubmissionReviewer.reviewer_id
    ).filter(
        GroupMember.group_id == submission_data.group_id,
        GroupMember.role == UserRole.REVIEWER
    ).group_by(
        GroupMember.user_id
    ).order_by("total").first()
    
    assigned_reviewer_id = reviewer_counts.user_id if reviewer_counts else reviewers[0].user_id
    
    # Create submission
    db_submission = Submission(
        link=submission_data.link,
        group_id=submission_data.group_id,
        student_id=student_id,
        status="pending"
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    
    # Assign reviewer
    db_reviewer = SubmissionReviewer(
        submission_id=db_submission.id,
        reviewer_id=assigned_reviewer_id,
        status="pending"
    )
    db.add(db_reviewer)
    db.commit()
    
    return {
        "id": db_submission.id,
        "link": db_submission.link,
        "group_id": db_submission.group_id,
        "student_id": db_submission.student_id,
        "status": db_submission.status,
        "reviewers_count": 1
    }


def create_submission_p2p(
    db: Session,
    submission_data: SubmissionCreate,
    student_id: int
) -> Optional[dict]:
    """
    Create submission in P2P mode (multiple peer reviewers).
    
    Assigns count_of_inspectors students with least submissions.
    """
    group = db.query(Group).filter(Group.id == submission_data.group_id).first()
    if not group:
        return None
    
    # Get other students in group
    students = db.query(GroupMember).filter(
        GroupMember.group_id == submission_data.group_id,
        GroupMember.role == UserRole.STUDENT,
        GroupMember.user_id != student_id
    ).all()
    
    if not students:
        return None
    
    # Create submission
    db_submission = Submission(
        link=submission_data.link,
        group_id=submission_data.group_id,
        student_id=student_id,
        status="pending"
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    
    # Get count_of_inspectors reviewers with least submissions
    reviewer_counts = db.query(
        GroupMember.user_id,
        func.count(SubmissionReviewer.id).label("total")
    ).outerjoin(
        SubmissionReviewer,
        GroupMember.user_id == SubmissionReviewer.reviewer_id
    ).filter(
        GroupMember.group_id == submission_data.group_id,
        GroupMember.role == UserRole.STUDENT,
        GroupMember.user_id != student_id
    ).group_by(
        GroupMember.user_id
    ).order_by("total").limit(group.count_of_inspectors).all()
    
    # Assign reviewers
    for reviewer in reviewer_counts:
        db_reviewer = SubmissionReviewer(
            submission_id=db_submission.id,
            reviewer_id=reviewer.user_id,
            status="pending"
        )
        db.add(db_reviewer)
    
    db.commit()
    
    return {
        "id": db_submission.id,
        "link": db_submission.link,
        "student_id": db_submission.student_id,
        "status": db_submission.status,
        "reviewers_count": len(reviewer_counts)
    }


def submit_review(
    db: Session,
    submission_id: int,
    reviewer_id: int,
    review_data: ReviewCreate
) -> Optional[Submission]:
    """
    Submit review for submission.
    
    Updates submission status to 'graded' if all reviewers submitted.
    """
    db_submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not db_submission:
        return None
    
    # Get reviewer assignment
    review_link = db.query(SubmissionReviewer).filter(
        SubmissionReviewer.submission_id == submission_id,
        SubmissionReviewer.reviewer_id == reviewer_id
    ).first()
    
    if not review_link:
        return None
    
    # Update review status and comment
    review_link.status = "graded"
    review_link.comment = review_data.comment
    
    # Add grades
    for g in review_data.grades:
        criterion = db.query(Criterion).filter(Criterion.id == g.criterion_id).first()
        if not criterion:
            # CRUD should not raise HTTPException - return None/bool
            # Validation should happen in router
            db.rollback()
            return None
        
        db_grade = Grade(
            submission_id=submission_id,
            reviewer_id=reviewer_id,
            criterion_id=g.criterion_id,
            score=g.score
        )
        db.add(db_grade)
    
    # Check if all reviews are complete
    all_reviews = db.query(SubmissionReviewer).filter(
        SubmissionReviewer.submission_id == submission_id
    ).all()
    
    if all(r.status == "graded" for r in all_reviews):
        db_submission.status = "graded"
    
    db.commit()
    db.refresh(db_submission)
    return db_submission


def get_submission_details(db: Session, submission_id: int) -> Optional[dict]:
    """Get submission with all reviews and grades."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        return None
    
    # Get all reviews with grades (optimized query)
    reviews = db.query(SubmissionReviewer).filter(
        SubmissionReviewer.submission_id == submission_id
    ).all()
    
    reviews_result = []
    for review in reviews:
        grades = db.query(
            Grade.score,
            Criterion.name.label("criterion_name")
        ).join(
            Criterion,
            Grade.criterion_id == Criterion.id
        ).filter(
            Grade.submission_id == submission_id,
            Grade.reviewer_id == review.reviewer_id
        ).all()
        
        reviews_result.append({
            "reviewer_id": review.reviewer_id,
            "comment": review.comment,
            "status": review.status,
            "grades": [{"criterion_name": g.criterion_name, "score": g.score} for g in grades]
        })
    
    return {
        "id": submission.id,
        "link": submission.link,
        "status": submission.status,
        "reviews": reviews_result
    }


def update_submission_link(db: Session, submission_id: int, new_link: str) -> Optional[Submission]:
    """Update submission link."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission:
        submission.link = new_link
        db.commit()
        db.refresh(submission)
    return submission


def update_submission_comment(db: Session, submission_id: int, new_comment: str) -> Optional[Submission]:
    """Update reviewer comment on submission."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if submission:
        # Note: This function seems to update a field that doesn't exist in model
        # Should update via SubmissionReviewer instead
        db.commit()
        db.refresh(submission)
    return submission


def get_reviews_for_user(db: Session, reviewer_id: int) -> List[dict]:
    """Get all submissions assigned to reviewer."""
    reviews = db.query(
        Submission.id,
        Submission.link,
        Submission.status,
        Submission.student_id,
        Submission.group_id
    ).join(
        SubmissionReviewer,
        Submission.id == SubmissionReviewer.submission_id
    ).filter(
        SubmissionReviewer.reviewer_id == reviewer_id
    ).all()
    
    return reviews


def get_reviewer_submissions(db: Session, reviewer_id: int) -> List[dict]:
    """Get all submissions to review by reviewer with details."""
    reviews = db.query(
        Submission.id,
        Submission.link,
        Submission.student_id,
        Submission.group_id,
        Submission.status
    ).join(
        SubmissionReviewer,
        Submission.id == SubmissionReviewer.submission_id
    ).filter(
        SubmissionReviewer.reviewer_id == reviewer_id
    ).all()
    
    result = []
    for r in reviews:
        result.append({
            "submission_id": r.id,
            "link": r.link,
            "student_id": r.student_id,
            "group_id": r.group_id,
            "status": r.status
        })
    
    return result

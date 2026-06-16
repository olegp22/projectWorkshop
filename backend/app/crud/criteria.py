from sqlalchemy.orm import Session
from app.models.group import Criterion
from app.schemas.groups import CriterionCreate


def create_criterion(db: Session, criterion: CriterionCreate, group_id: int):
    db_criterion = Criterion(
        name=criterion.name,
        description=criterion.description,
        group_id=group_id,
        max_score=criterion.max_score,
    )
    db.add(db_criterion)
    db.commit()
    db.refresh(db_criterion)
    return db_criterion


def get_group_criteria(db: Session, group_id: int):
    return db.query(Criterion).filter(Criterion.group_id == group_id).all()


def update_criterion_in_db(db: Session, criterion_id: int, updated_data: CriterionCreate):
    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id).first()
    if db_criterion:
        db_criterion.name = updated_data.name
        db_criterion.description = updated_data.description
        db.commit()
        db.refresh(db_criterion)
    return db_criterion


def delete_criterion_from_db(db: Session, criterion_id: int):
    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id).first()
    if db_criterion:
        db.delete(db_criterion)
        db.commit()
        return True
    return False

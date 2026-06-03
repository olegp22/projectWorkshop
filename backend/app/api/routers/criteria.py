from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas import CriterionCreate, CriterionResponse
from app.db.session import get_db
from app.crud import create_criterion, get_group_criteria, update_criterion_in_db, delete_criterion_from_db
from app.models.group import Group, Criterion
from app.api.deps import get_current_user

criteria_router = APIRouter(prefix="/groups", tags=["Criteria"])


# Добавляет новый критерий оценивания в группу
@criteria_router.post("/{group_id}/criteria", response_model=CriterionResponse)
async def add_criterion(
    group_id: int,
    criterion: CriterionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только создатель группы может настраивать критерии")

    return create_criterion(db, criterion, group_id)


# Получает список критериев оценивания группы
@criteria_router.get("/{group_id}/criteria", response_model=list[CriterionResponse])
async def read_criteria(group_id: int, db: Session = Depends(get_db)):
    return get_group_criteria(db, group_id)


# Обновляет критерий оценивания по ID
@criteria_router.put("/{group_id}/criteria/{criterion_id}", response_model=CriterionResponse)
async def update_criterion(
    group_id: int,
    criterion_id: int,
    criterion_data: CriterionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group or group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования")

    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id, Criterion.group_id == group_id).first()
    if not db_criterion:
        raise HTTPException(status_code=404, detail="Критерий не найден в этой группе")

    return update_criterion_in_db(db, criterion_id, criterion_data)


# Удаляет критерий оценивания из группы
@criteria_router.delete("/{group_id}/criteria/{criterion_id}")
async def delete_criterion(
    group_id: int,
    criterion_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group or group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для удаления")

    success = delete_criterion_from_db(db, criterion_id)
    if not success:
        raise HTTPException(status_code=404, detail="Критерий не найден")

    return {"message": "Критерий успешно удален"}

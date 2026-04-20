from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas import GroupCreate,GroupResponse,CriterionResponse ,MemberResponse, CriterionCreate
from app.db.session import get_db
import crud
from app.models.group import Group, GroupMember, Criterion
from app.core.auth import create_access_token
from app.api.deps import get_current_user



groups_router = APIRouter(prefix="/groups", tags=["Groups"])

#----------ручка для создания группы----------
@groups_router.post("/", response_model=GroupResponse)
async def make_group(
    group: GroupCreate, 
    current_user = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # Проверка на уникальность имени
    existing_group = db.query(Group).filter(Group.name == group.name).first()
    if existing_group:
        raise HTTPException(status_code=400, detail="Группа с таким именем уже есть")

  
    new_group = crud.create_group(db, group, current_user.id)
    return new_group



#----------ручка для показа участников группы----------
@groups_router.get("/{group_id}/members", response_model=list[MemberResponse])
async def read_members(group_id: int, db: Session = Depends(get_db)):
    participants = crud.get_group_participants(db, group_id)
    if not participants:
        raise HTTPException(status_code=404, detail="Группа не найдена или пуста")
    return participants



#----------ручка на добавление в группу в зависимоти от инвайт-ссылки----------
@groups_router.get("/join/{token}")
async def join_by_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from sqlalchemy import or_

    group = db.query(Group).filter(
        or_(
            Group.student_invite_token == token,
            Group.reviewer_invite_token == token
        )
    ).first()

    if not group:
        raise HTTPException(status_code=404, detail="Ссылка недействительна")

    role = "student" if group.student_invite_token == token else "reviewer"

    existing = db.query(GroupMember).filter_by(
        user_id=current_user.id,
        group_id=group.id
    ).first()

    if existing:
        return {"message": "Вы уже участник группы"}

    new_member = GroupMember(
        user_id=current_user.id,
        group_id=group.id,
        role=role
    )

    db.add(new_member)
    db.commit()

    return {"message": f"Вы успешно присоединились к группе {group.name} как {role}"}


#----------ручка на удаление организатором других участникв из группы----------
@groups_router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: int, 
    user_id: int, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user)
):
    # 1. Проверяем, существует ли группа и кто её создатель
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    # 2. Проверка прав: только создатель группы может удалять участников
    if group.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="У вас нет прав для удаления участников из этой группы"
        )

    # 3. Не даем создателю удалить самого себя из списка участников (опционально)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Вы не можете удалить себя из группы")

    # 4. Вызываем удаление
    success = crud.remove_member_from_db(db, group_id, user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Пользователь не найден в этой группе")

    return {"message": "Участник успешно удален"}


#----------ручка на добавление организатором критериев оценивания ----------
@groups_router.post("/{group_id}/criteria", response_model=CriterionResponse)
async def add_criterion(
    group_id: int,
    criterion: CriterionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Проверяем, существует ли группа и является ли пользователь её создателем
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    
    if group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Только создатель группы может настраивать критерии")

    # 2. Создаем критерий
    return crud.create_criterion(db, criterion, group_id)

#----------ручка на показ организатором критериев оценивания ----------
@groups_router.get("/{group_id}/criteria", response_model=list[CriterionResponse])
async def read_criteria(group_id: int, db: Session = Depends(get_db)):
    return crud.get_group_criteria(db, group_id)


# Редактирование критерия
@groups_router.put("/{group_id}/criteria/{criterion_id}", response_model=CriterionResponse)
async def update_criterion(
    group_id: int,
    criterion_id: int,
    criterion_data: CriterionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Проверяем, что группа существует и пользователь — её создатель
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group or group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для редактирования")

    # Проверяем, что критерий принадлежит именно этой группе
    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id, Criterion.group_id == group_id).first()
    if not db_criterion:
        raise HTTPException(status_code=404, detail="Критерий не найден в этой группе")

    return crud.update_criterion_in_db(db, criterion_id, criterion_data)


# Удаление критерия
@groups_router.delete("/{group_id}/criteria/{criterion_id}")
async def delete_criterion(
    group_id: int,
    criterion_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group or group.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для удаления")

    success = crud.delete_criterion_from_db(db, criterion_id)
    if not success:
        raise HTTPException(status_code=404, detail="Критерий не найден")

    return {"message": "Критерий успешно удален"}
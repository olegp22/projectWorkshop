from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas import UserCreate, UserResponse, UserEntrance,GroupCreate,GroupResponse,\
    MemberResponse
from app.db.session import get_db
import crud
from app.models.group import Group, GroupMember
from app.core.auth import create_access_token
from app.api.deps import get_current_user


#----------ручка для создания группы----------
groups_router = APIRouter(prefix="/groups", tags=["Groups"])

@groups_router.post("/", response_model=GroupResponse)
async def make_group(
    group: GroupCreate, 
    creator_id: int, # Пока передаем вручную для теста!!!!!!
    db: Session = Depends(get_db)
):
    # Проверка на уникальность имени
    existing_group = db.query(Group).filter(Group.name == group.name).first()
    if existing_group:
        raise HTTPException(status_code=400, detail="Группа с таким именем уже есть")
        
    new_group = crud.create_group(db, group, creator_id)
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
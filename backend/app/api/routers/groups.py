from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.schemas import GroupCreate, GroupResponse, MemberResponse, UserGroupResponse
from app.db.session import get_db
from app.crud import create_group, get_group_participants, remove_member_from_db, get_user_groups, create_notification
from app.models.group import Group, GroupMember
from app.api.deps import get_current_user
from app.schemas.notifications import TypeMassege


groups_router = APIRouter(prefix="/groups", tags=["Groups"])


# Создает новую группу от имени текущего пользователя
@groups_router.post("/", response_model=GroupResponse)
async def make_group(
    group: GroupCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_group = db.query(Group).filter(Group.name == group.name).first()
    if existing_group:
        raise HTTPException(status_code=400, detail="Группа с таким именем уже есть")

    if group.count_of_inspectors <= 0:
        raise HTTPException(
            status_code=400,
            detail="Количество проверяющих должно быть больше 0",
        )

    return create_group(db, group, current_user.id)


# Возвращает список участников указанной группы
@groups_router.get("/{group_id}/members", response_model=list[MemberResponse])
async def read_members(group_id: int, db: Session = Depends(get_db)):
    participants = get_group_participants(db, group_id)
    if not participants:
        raise HTTPException(status_code=404, detail="Группа не найдена или пуста")
    return participants


# Вступление в группу через invite-token
@groups_router.get("/join/{token}")
async def join_by_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = (
        db.query(Group)
        .filter(
            or_(
                Group.student_invite_token == token,
                Group.reviewer_invite_token == token,
            )
        )
        .first()
    )

    if not group:
        raise HTTPException(status_code=404, detail="Ссылка недействительна")

    role = "student" if group.student_invite_token == token else "reviewer"

    existing = db.query(GroupMember).filter_by(
        user_id=current_user.id,
        group_id=group.id,
    ).first()

    if existing:
        return {"message": "Вы уже участник группы"}

    new_member = GroupMember(
        user_id=current_user.id,
        group_id=group.id,
        role=role,
    )

    create_notification(
        db,
        group.creator_id,
        f"В группу {group.name} вступил новый участник {current_user.name} {current_user.surname}. Его роль - {new_member.role}",
        TypeMassege.NEW_MEMBER,
    )

    db.add(new_member)
    db.commit()

    return {"message": f"Вы успешно присоединились к группе {group.name} как {role}"}


# Удаляет участника из группы по правам создателя
@groups_router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    if group.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав для удаления участников из этой группы",
        )

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Вы не можете удалить себя из группы")

    success = remove_member_from_db(db, group_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Пользователь не найден в этой группе")

    return {"message": "Участник успешно удален"}


# Показывает группы текущего пользователя
@groups_router.get("/my", response_model=list[UserGroupResponse])
async def read_my_groups(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_user_groups(db, user_id=current_user.id)

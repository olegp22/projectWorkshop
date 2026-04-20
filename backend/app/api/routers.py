from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas import UserCreate, UserResponse, UserEntrance,GroupCreate,GroupResponse,\
    MemberResponse
from app.db.session import get_db
import crud
from app.models.group import Group, GroupMember
from app.core.auth import create_access_token
from app.api.deps import get_current_user



users_router  = APIRouter(prefix="/users", tags=["Users"])
#----------ручка для регистрации----------
@users_router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(crud.User).filter_by(email=user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )
    new_user = crud.create_user(db, user)
    return new_user



auth_router  = APIRouter(prefix="/auth", tags=["Authentication"])
#----------ручка для входа----------
@auth_router.post("/login")
def login(user_data: UserEntrance, db: Session = Depends(get_db)):

    user_in_db = crud.get_user_by_email(db, email=user_data.email)

    if not user_in_db:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    is_password_correct = crud.verify_password(
        user_data.password.get_secret_value(),
        user_in_db.password
    )

    if not is_password_correct:
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    access_token = create_access_token({"user_id": user_in_db.id})

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


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
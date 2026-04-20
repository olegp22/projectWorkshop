from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas import UserCreate
from passlib.context import CryptContext
import uuid
from app.models.group import Group, GroupMember
from app.schemas import GroupCreate

#основые функции
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password.get_secret_value())
    db_user = User(email=user.email, password=hashed_password, name=user.name,\
                    surname=user.surname,patronymic=user.patronymic)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)



def create_group(db: Session, group_data: GroupCreate, creator_id: int):
    # Генерируем уникальные токены для ссылок
    rev_token = uuid.uuid4().hex
    stud_token = uuid.uuid4().hex
    
    db_group = Group(
        name=group_data.name,
        creator_id=creator_id,
        reviewer_invite_token=rev_token,
        student_invite_token=stud_token
    )
    
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_group_participants(db: Session, group_id: int):
    # 1. Получаем создателя (он главный организатор)
    creator = db.query(Group, User).join(User, Group.creator_id == User.id).filter(Group.id == group_id).first()
    
    # 2. Получаем всех остальных участников
    members = db.query(User.id, User.name, User.surname, GroupMember.role)\
        .join(GroupMember, User.id == GroupMember.user_id)\
        .filter(GroupMember.group_id == group_id).all()

    # Собираем всё в один список
    result = []
    if creator:
        result.append({"user_id": creator.User.id, "name": creator.User.name, "surname": creator.User.surname, "role": "creator"})
    
    for m in members:
        result.append({"user_id": m.id, "name": m.name, "surname": m.surname, "role": m.role})
        
    return result


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()
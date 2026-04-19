from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas import UserCreate
from passlib.context import CryptContext
import uuid
from app.models.group import Group
from app.schemas import GroupCreate

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
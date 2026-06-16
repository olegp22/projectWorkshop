from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.models.user import User
from app.schemas.users import UserCreate, UserUpdate

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password.get_secret_value())
    db_user = User(
        email=user.email,
        password=hashed_password,
        name=user.name,
        surname=user.surname,
        patronymic=user.patronymic,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def update_user(db: Session, user_id: int, user_data: UserUpdate):
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user:
        db_user.email = user_data.email
        db_user.name = user_data.name
        db_user.surname = user_data.surname
        db_user.patronymic = user_data.patronymic
        db.commit()
        db.refresh(db_user)
    return db_user

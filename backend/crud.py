from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas import UserCreate
from passlib.context import CryptContext
import uuid
from sqlalchemy import or_
from app.models.group import Group, GroupMember, Criterion
from app.schemas import GroupCreate, CriterionCreate

#основые функции
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

#создание пользователя
def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password.get_secret_value())
    db_user = User(email=user.email, password=hashed_password, name=user.name,\
                    surname=user.surname,patronymic=user.patronymic)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


#проверка email
def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


#проверка хэша пароля
def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)



#создание группы
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


#формирования списка участников группы
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


#получение id user
def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

#удаление пользователя
def remove_member_from_db(db: Session, group_id: int, user_id: int):
    member_record = db.query(GroupMember).filter(
        GroupMember.group_id == group_id, 
        GroupMember.user_id == user_id
    ).first()
    
    if member_record:
        db.delete(member_record)
        db.commit()
        return True
    return False


#добавляем критерии в бд
def create_criterion(db: Session, criterion: CriterionCreate, group_id: int):
    db_criterion = Criterion(
        **criterion.model_dump(),
        group_id=group_id,
        max_score=10 
    )
    db.add(db_criterion)
    db.commit()
    db.refresh(db_criterion)
    return db_criterion

#показать критерии оценивания 
def get_group_criteria(db: Session, group_id: int):
    return db.query(Criterion).filter(Criterion.group_id == group_id).all()


# Обновление критерия
def update_criterion_in_db(db: Session, criterion_id: int, updated_data: CriterionCreate):
    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id).first()
    if db_criterion:
        # Обновляем поля из пришедших данных
        db_criterion.name = updated_data.name
        db_criterion.description = updated_data.description
        
        db.commit()
        db.refresh(db_criterion)
    return db_criterion

# Удаление критерия
def delete_criterion_from_db(db: Session, criterion_id: int):
    db_criterion = db.query(Criterion).filter(Criterion.id == criterion_id).first()
    if db_criterion:
        db.delete(db_criterion)
        db.commit()
        return True
    return False



def get_user_groups(db: Session, user_id: int):
    # 1. Группы, где пользователь является участником (student/reviewer)
    member_groups = db.query(Group.id, Group.name, GroupMember.role).join(
        GroupMember, Group.id == GroupMember.group_id
    ).filter(GroupMember.user_id == user_id).all()

    # 2. Группы, где пользователь является создателем
    owned_groups = db.query(Group.id, Group.name).filter(
        Group.creator_id == user_id
    ).all()

    # Собираем всё в один список, избегая дубликатов
    result = []
    seen_ids = set()

    # Сначала добавляем те, где он владелец
    for g in owned_groups:
        result.append({"id": g.id, "name": g.name, "role": "creator"})
        seen_ids.add(g.id)

    # Затем добавляем остальные
    for g in member_groups:
        if g.id not in seen_ids:
            result.append({"id": g.id, "name": g.name, "role": g.role})
            
    return result
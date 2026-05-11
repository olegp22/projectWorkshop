import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, Enum, Text,UniqueConstraint,CheckConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum

class GroupMode(str, enum.Enum):
    CLASSIC = "classic"
    P2P = "p2p"

#запрос в бд для создание таблица с групой
class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_mode = Column(Enum(GroupMode),default=GroupMode.CLASSIC, nullable=False)
    count_of_inspectors= Column(Integer, default=1, nullable=False)

    # Токены для инвайт-ссылок
    reviewer_invite_token = Column(String, unique=True, nullable=False)
    student_invite_token = Column(String, unique=True, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "p2p_review_count > 0",
            name="check_p2p_review_count_positive"
        ),
    )

#enum  с выбором роли в групе(создательб проверяющий студент)
class UserRole(str, enum.Enum):
    CREATOR = "creator"
    REVIEWER = "reviewer"
    STUDENT = "student"

#запрос в бд для создания таблица с ролью участника в группе
class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(UserRole), nullable=False)

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="unique_user_in_group"),
    )

    group = relationship("Group")
    user = relationship("User")


#запрос в бд для создания таблица с критериями оценивания в группе
class Criterion(Base):
    __tablename__ = "criteria"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # Название (например, "Чистота кода")
    description = Column(Text, nullable=True) # Описание того, за что даются баллы
    max_score = Column(Integer, default=10) # Максимальный балл (у нас будет 10)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
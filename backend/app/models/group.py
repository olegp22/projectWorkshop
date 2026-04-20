import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, Enum
from sqlalchemy import Column, Integer, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum
#запрос в бд для создание таблица с групой
class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Токены для инвайт-ссылок
    reviewer_invite_token = Column(String, unique=True, nullable=False)
    student_invite_token = Column(String, unique=True, nullable=False)


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
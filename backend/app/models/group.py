import uuid
from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.base import Base
#запрос в бд для создание таблица с групой
class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Токены для инвайт-ссылок
    reviewer_invite_token = Column(String, unique=True, nullable=False)
    student_invite_token = Column(String, unique=True, nullable=False)
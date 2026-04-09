from sqlalchemy import Column, Integer, String
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False )
    surname = Column(String, nullable=False )
    patronymic = Column(String, nullable=False )
    password = Column(String, nullable=False)
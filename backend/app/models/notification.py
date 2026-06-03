from app.db.base import Base
from sqlalchemy import Column, Integer, DateTime, Text, String, Boolean
from sqlalchemy.sql import func

class Notification(Base):
    __tablename__ = "notification"

    id = Column(Integer, primary_key=True, index=True)
    user_id=Column(Integer, nullable=False)
    text=Column(Text, nullable=False)
    type_massege=Column(String)
    is_read=Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
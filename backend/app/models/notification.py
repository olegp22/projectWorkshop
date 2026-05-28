from app.db.base import Base
from sqlalchemy import Column, Integer, DateTime, Text, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
class Notification(Base):
    __tableneme__ = "notification"

    id = Column(Integer, primary_key=True, index=True)
    user_id=Column(Integer, nullable=False)
    text=Column(Text, nullable=False)
    type_massege=Column(String)
    is_read=Column(bool, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
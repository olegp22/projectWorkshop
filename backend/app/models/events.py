from app.db.base import Base
from sqlalchemy import( 
    Column,
    Integer, 
    String,
    ForeignKey, 
    Enum, 
    Text,
    UniqueConstraint,
    CheckConstraint,
    DateTime,
)


class Events(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    locaition = Column(String, nullable=False)
    description = Column(Text, nullable=True)
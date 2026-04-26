from app.db.base import Base
from sqlalchemy import Column, Integer, String, ForeignKey, Text

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    link = Column(String, nullable=False) 
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Кто сдал
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Кому назначили проверять
    
    # Сюда проверяющий напишет итоговый отзыв
    reviewer_comment = Column(Text, nullable=True) 
    
    # Статус работы (например: "pending" - ожидает проверки, "graded" - оценена)
    status = Column(String, default="pending")

# Таблица для оценок по каждому критерию
class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    criterion_id = Column(Integer, ForeignKey("criteria.id"), nullable=False) # За какой критерий
    score = Column(Integer, nullable=False) # Оценка от 0 до 10
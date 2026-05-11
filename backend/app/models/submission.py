from app.db.base import Base
from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    link = Column(String, nullable=False) 
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False) # Кто сдал
    
    
    # Статус работы (например: "pending" - ожидает проверки, "graded" - оценена)
    status = Column(String, default="pending")

# Таблица для оценок по каждому критерию
class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    criterion_id = Column(Integer, ForeignKey("criteria.id")) # За какой критерий
    score = Column(Integer)# Оценка от 0 до 10


class SubmissionReviewer(Base):
    __tablename__ = "submission_reviewers"

    id = Column(Integer, primary_key=True, index=True)

    submission_id = Column(
        Integer,
        ForeignKey("submissions.id"),
        nullable=False
    )

    reviewer_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    status = Column(String, default="pending")

    comment = Column(Text, nullable=True)# Сюда проверяющий напишет итоговый отзыв 

    submission = relationship("Submission")
    reviewer = relationship("User")# Кому назначили проверять
from app.db.base import Base
from app.db.session import engine
from app.models.user import User
from app.models.group import Group, GroupMember, Criterion
from app.models.submission import Submission, Grade, SubmissionReviewer

Base.metadata.create_all(bind=engine)

print("Таблицы созданы!")
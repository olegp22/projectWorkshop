"""Rename notification.type_massege to type_message

Revision ID: 9f1a2b3c4d5e
Revises: 382197607272
Create Date: 2026-06-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f1a2b3c4d5e'
down_revision: Union[str, Sequence[str], None] = '382197607272'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Переименовать столбец в PostgreSQL
    op.alter_column('notification', 'type_massege', new_column_name='type_message')


def downgrade() -> None:
    # Откат — вернуть старое имя
    op.alter_column('notification', 'type_message', new_column_name='type_massege')


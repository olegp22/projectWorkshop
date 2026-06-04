"""add_contest_mode

Revision ID: 60da4a9cdef0
Revises: 548917107aee
Create Date: 2026-06-04 17:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '60da4a9cdef0'
down_revision: Union[str, Sequence[str], None] = '548917107aee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE groupmode ADD VALUE 'CONTEST' AFTER 'P2P'")


def downgrade() -> None:
    """Downgrade schema."""
    # Note: PostgreSQL doesn't support removing enum values
    # This is a known limitation. In practice, downgrades are rarely needed.
    pass

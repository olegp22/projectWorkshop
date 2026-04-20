import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Добавляем путь к корню проекта в sys.path, чтобы работали импорты из папки app
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

# Теперь импортируем твои настройки и модели
from app.core.config import DATABASE_URL
from app.db.base import Base
from app.models.user import User
from app.models.group import Group, GroupMember, Criterion

# Объект конфигурации Alembic
config = context.config

# Динамически подставляем URL из твоего .env
if DATABASE_URL:
    config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Указываем метаданные для поддержки --autogenerate
target_metadata = Base.metadata

# Настройка логирования
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
    """Запуск миграций в 'offline' режиме."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Запуск миграций в 'online' режиме."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
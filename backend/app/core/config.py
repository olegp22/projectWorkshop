import os
from dotenv import load_dotenv

# Загружаем переменные из .env
load_dotenv()

# Получаем строку подключения
DATABASE_URL = os.getenv("DATABASE_URL")

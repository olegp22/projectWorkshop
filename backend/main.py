from fastapi import FastAPI
from app.api.routers.auth import auth_router
from app.api.routers.groups import groups_router
from app.api.routers.users import users_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Список адресов, с которых можно делать запросы (пока локально)
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
     "http://127.0.0.1:5500", # если использует Vite
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Разрешаем все методы (GET, POST, PUT, DELETE)
    allow_headers=["*"], # Разрешаем все заголовки (включая Authorization)
)

app.include_router(users_router)

app.include_router(auth_router)

app.include_router(groups_router)
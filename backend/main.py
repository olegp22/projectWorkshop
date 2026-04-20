from fastapi import FastAPI
from app.api.routers.auth import auth_router
from app.api.routers.groups import groups_router
from app.api.routers.users import users_router

app = FastAPI()

app.include_router(users_router)

app.include_router(auth_router)

app.include_router(groups_router)
from fastapi import FastAPI
from app.api.routers import users_router, auth_router, groups_router

app = FastAPI()

app.include_router(users_router)

app.include_router(auth_router)

app.include_router(groups_router)
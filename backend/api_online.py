import os

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from database_online import Base, engine, get_db
import models_online
from models_online import User
from auth_online import (
    authenticate_online_user,
    create_access_token,
    require_user,
)

app = FastAPI(title="JARVIS Online API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGIN", "").split(",")
    if origin.strip()
]

print("JARVIS CORS allowed origins:", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.on_event("startup")
def initialize_database():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def health_check():
    return {"status": "online", "assistant": "JARVIS"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    if not authenticate_online_user(
        db, form_data.username, form_data.password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(form_data.username),
        "token_type": "bearer",
    }


@app.get("/me")
def get_me(username: str = Depends(require_user)):
    return {"username": username, "authenticated": True}
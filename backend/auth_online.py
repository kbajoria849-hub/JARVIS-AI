import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy import select
from sqlalchemy.orm import Session

from models_online import User

SECRET_KEY = os.getenv("JARVIS_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JARVIS_SECRET_KEY is missing.")

ALGORITHM = "HS256"
TOKEN_MINUTES = 30

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


def create_access_token(username: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_MINUTES
    )
    return jwt.encode(
        {"sub": username, "exp": expires},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def require_user(
    token: Annotated[str, Depends(oauth2_scheme)]
) -> str:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please log in.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token, SECRET_KEY, algorithms=[ALGORITHM]
        )
        username = payload.get("sub")
        if not isinstance(username, str) or not username:
            raise unauthorized
        return username
    except (InvalidTokenError, ValueError):
        raise unauthorized

def authenticate_online_user(
    db: Session, username: str, password: str
) -> bool:
    user = db.scalar(
        select(User).where(User.username == username)
    )

    if user is None:
        return False

    try:
        return password_hash.verify(
            password, user.password_hash
        )
    except (ValueError, TypeError):
        return False
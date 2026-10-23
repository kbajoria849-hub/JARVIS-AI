from models import User
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer


SECRET_KEY = os.getenv("JARVIS_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "JARVIS_SECRET_KEY is missing. Set it before starting JARVIS."
    )

ALGORITHM = "HS256"
TOKEN_MINUTES = 30

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


def create_access_token(username: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_MINUTES
    )
    payload = {"sub": username, "exp": expires}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


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
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        username = payload.get("sub")
        if not isinstance(username, str) or not username:
            raise unauthorized
        return username
    except (InvalidTokenError, ValueError): raise unauthorized

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def authenticate_owner(db, username: str, password: str) -> bool:
     user = db.query(User).filter(
        User.username == username
    ).first()
     

     if user is None:
       return False
     
     return verify_password(password, user.password_hash)
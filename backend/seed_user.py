import os

from sqlalchemy import select

from auth import password_hash
from database import SessionLocal
from models import User


username = os.getenv("JARVIS_USERNAME")
stored_hash = os.getenv("JARVIS_PASSWORD_HASH")

if not username or not stored_hash:
    raise RuntimeError(
        "Set JARVIS_USERNAME and JARVIS_PASSWORD_HASH first."
    )

# Check that the configured hash is valid before saving it.
try:
    password_hash.verify(
        "temporary-check",
        stored_hash,
    )
except Exception as exc:
    raise RuntimeError(
        "JARVIS_PASSWORD_HASH is not a valid password hash."
    ) from exc

with SessionLocal() as db:
    existing_user = db.scalar(
        select(User).where(User.username == username)
    )

    if existing_user:
        print("User already exists. No changes made.")
    else:
        user = User(
            username=username,
            password_hash=stored_hash,
        )
        db.add(user)
        db.commit()
        print("Owner account created successfully.")
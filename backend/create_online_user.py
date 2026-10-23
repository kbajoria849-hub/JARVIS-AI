import os
from getpass import getpass

database_url = getpass("Paste the online PostgreSQL URL (input hidden): ").strip()
if not database_url:
    raise SystemExit("Database URL is required.")

os.environ["DATABASE_URL"] = database_url

from database_online import Base, engine, SessionLocal
import models_online
from models_online import User
from auth_online import password_hash
from sqlalchemy import select


def main():
    Base.metadata.create_all(bind=engine)

    username = input("New online username: ").strip()
    if not username:
        raise SystemExit("Username cannot be empty.")

    password = getpass("New online password (input hidden): ")
    if len(password) < 12:
        raise SystemExit("Use a password with at least 12 characters.")

    with SessionLocal() as db:
        existing = db.scalar(
            select(User).where(User.username == username)
        )
        if existing:
            raise SystemExit("That username already exists.")

        user = User(
            username=username,
            password_hash=password_hash.hash(password),
        )
        db.add(user)
        db.commit()

    print("Online user created successfully.")


if __name__ == "__main__":
    main()
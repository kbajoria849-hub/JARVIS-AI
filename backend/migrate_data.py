import json
from pathlib import Path

from sqlalchemy import select

from database import SessionLocal
from models import Note, Task, User

BASE_DIR = Path(__file__).resolve().parent


def read_json(filename):
    path = BASE_DIR / filename
    list_key = {
        "memory.json": "notes",
        "tasks.json": "tasks",
    }.get(filename)

    if not path.exists():
        print(f"{filename} not found; skipping.")
        return []

    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if isinstance(data, dict) and list_key:
        data = data.get(list_key)

    if not isinstance(data, list):
        expected = f"a JSON list or an object containing a '{list_key}' list"
        raise ValueError(f"{filename} must contain {expected}.")

    return data


notes_data = read_json("memory.json")
tasks_data = read_json("tasks.json")

with SessionLocal() as db:
    username = __import__("os").getenv("JARVIS_USERNAME")

    user = db.scalar(
        select(User).where(User.username == username)
    )

    if user is None:
        raise RuntimeError(
            "Owner account not found in database. Stop migration."
        )

    # Avoid duplicating records if this script is run again.
    if db.scalar(select(Note.id).limit(1)) is None:
        for item in notes_data:
            text = item.get("text", item.get("note", ""))
            if isinstance(text, str) and text.strip():
                db.add(Note(text=text.strip(), user_id=user.id))

    if db.scalar(select(Task.id).limit(1)) is None:
        for item in tasks_data:
            title = item.get("title", "")
            if isinstance(title, str) and title.strip():
                db.add(
                    Task(
                        title=title.strip()[:200],
                        completed=bool(item.get("completed", False)),
                        due_at=item.get("due_at"),
                        user_id=user.id,
                    )
                )

    db.commit()

print(f"Read {len(notes_data)} notes and {len(tasks_data)} tasks.")
print("Migration finished. Original JSON files were not modified.")
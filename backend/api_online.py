import os
from google import genai
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session
from pydantic import BaseModel,Field
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

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


@app.post("/chat")
def online_chat(
    request: ChatRequest,
    username: str = Depends(require_user),
):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured.",
        )

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=request.message,
            config={
                "system_instruction": (
                    "You are JARVIS, a helpful, clear and polite AI assistant."
                ),
                "max_output_tokens": 800,
            },
        )

        answer = response.text

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="The AI service returned an empty response.",
            )

        return {"reply": answer}

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="JARVIS could not get an AI response. Please try again.",
        )
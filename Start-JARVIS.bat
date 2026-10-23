@echo off
title JARVIS AI Assistant

cd /d D:\JarvisAI\backend

echo ========================================
echo        Starting JARVIS AI Assistant
echo ========================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Python virtual environment not found.
    echo Check D:\JarvisAI\backend\.venv
    pause
    exit /b 1
)

start "JARVIS API" cmd /k "cd /d D:\JarvisAI\backend && .venv\Scripts\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

start "" http://127.0.0.1:8000

exit
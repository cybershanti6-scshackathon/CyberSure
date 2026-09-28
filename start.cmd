@echo off
setlocal EnableExtensions
title CYBERSURE local launcher
cd /d "%~dp0"

echo ==============================================
echo  CYBERSURE - starting local development stack
echo ==============================================
echo.

rem ---- 1. Node.js present? ----------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found on PATH.
    echo         Install Node 18 or newer from https://nodejs.org, then run start.cmd again.
    pause
    exit /b 1
)

rem ---- 2. Frontend dependencies ------------------------------------------------
if not exist "node_modules" (
    echo Installing frontend dependencies with npm. First run only, this takes a minute...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Fix the error above, then run start.cmd again.
        pause
        exit /b 1
    )
)

rem ---- 3. Backend dependencies --------------------------------------------------
python -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    py -3 -c "import fastapi, uvicorn" >nul 2>&1
    if errorlevel 1 (
        echo Installing backend dependencies with pip. First run only...
        where python >nul 2>&1
        if errorlevel 1 (
            call py -3 -m pip install -r backend\requirements.txt
        ) else (
            call python -m pip install -r backend\requirements.txt
        )
        if errorlevel 1 (
            echo [ERROR] pip install failed. Install Python 3.11+ and run:
            echo     python -m pip install -r backend\requirements.txt
            pause
            exit /b 1
        )
    )
)

rem ---- 4. Launch both processes in their own windows ------------------------------
echo.
echo Backend   : http://localhost:8000   health at /api/v1/health, docs at /docs
echo Frontend  : http://localhost:5173
echo.
echo Two windows will open now. Keep them open while using the app;
echo close them, or press Ctrl+C inside each, to stop.
echo.

start "CYBERSURE backend  (FastAPI :8000)" cmd /k npm run dev:api
timeout /t 2 /nobreak >nul
start "CYBERSURE frontend (Vite    :5173)" cmd /k npm run dev

echo Started. Open http://localhost:5173 in your browser.
echo You can close this launcher window.
pause
exit /b 0

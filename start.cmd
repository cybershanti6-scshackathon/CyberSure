@echo off
setlocal EnableExtensions
rem ============================================================================
rem  CYBERSURE - start the whole stack locally on Windows.
rem
rem    start.cmd            check everything, install what is missing, then
rem                         start the backend in its own window (port 8000)
rem                         and the frontend in this window (port 5173)
rem    start.cmd --check    run every check, start nothing
rem
rem  First run only: npm install runs automatically and .env is copied from
rem  .env.example. pip install is offered, never forced.
rem ============================================================================

cd /d "%~dp0"
set "ROOT=%CD%"
set "CHECK="
if /i "%~1"=="--check" set "CHECK=1"

echo.
echo ============================================================
echo  CYBERSURE - local start
echo  root %ROOT%
echo ============================================================
echo.

rem ---- 1. node / npm ------------------------------------------------------------
where npm >nul 2>&1
if errorlevel 1 goto :no_node
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODEV=%%v"
echo [OK   ] node      %NODEV%

rem ---- 2. python ----------------------------------------------------------------
set "PY="
where python >nul 2>&1
if errorlevel 1 goto :probe_py
python -c "import sys" >nul 2>&1
if errorlevel 1 goto :probe_py
set "PY=python"
goto :python_found

:probe_py
where py >nul 2>&1
if errorlevel 1 goto :no_python
py -3 -c "import sys" >nul 2>&1
if errorlevel 1 goto :no_python
set "PY=py -3"

:python_found
for /f "delims=" %%v in ('%PY% --version 2^>nul') do set "PYV=%%v"
echo [OK   ] python    %PYV%  via %PY%

rem ---- 3. backend python packages -----------------------------------------------
%PY% -c "import uvicorn" >nul 2>&1
if errorlevel 1 goto :backend_deps_missing
echo [OK   ] backend python packages
goto :backend_deps_ok

:backend_deps_missing
echo [MISS ] backend packages fastapi/uvicorn are not installed for %PY%
set /p "ANS=Install them now? [Y/N] "
if /i "%ANS%"=="Y" goto :pip_install
echo [WARN ] skipped - the backend window will tell you what is missing
goto :backend_deps_ok

:pip_install
echo [.... ] installing backend dependencies
%PY% -m pip install -r backend\requirements.txt
if errorlevel 1 goto :pip_failed
echo [OK   ] backend python packages installed

:backend_deps_ok

rem ---- 4. .env -------------------------------------------------------------------
if exist ".env" goto :env_done
if not exist ".env.example" goto :env_done
copy /Y ".env.example" ".env" >nul
if errorlevel 1 goto :env_done
echo [OK   ] created .env from .env.example
:env_done

rem ---- 5. frontend packages ------------------------------------------------------
if exist "node_modules\.bin\vite.cmd" goto :npm_done
echo [.... ] installing frontend dependencies ^(first run only, this can take a minute^)
call npm install
if errorlevel 1 goto :npm_failed
:npm_done
echo [OK   ] frontend dependencies

if defined CHECK goto :check_done

rem ---- 6. backend ----------------------------------------------------------------
echo [.... ] starting the backend API on http://localhost:8000
start "CYBERSURE backend :8000" cmd /k call npm run dev:api

echo [.... ] waiting for the backend to answer
timeout /t 4 /nobreak >nul 2>&1 || ping -n 5 127.0.0.1 >nul 2>&1

set "CODE="
for /f %%c in ('curl -s -o nul -w "%%{http_code}" http://localhost:8000/api/v1/health 2^>nul') do set "CODE=%%c"
if "%CODE%"=="200" goto :backend_up
echo [WARN ] backend not answering yet ^(HTTP %CODE%^) - see the backend window
goto :backend_checked

:backend_up
echo [OK   ] backend health http://localhost:8000/api/v1/health  ^(docs /docs^)

:backend_checked
rem ---- 7. frontend ---------------------------------------------------------------
echo.
echo  Frontend  http://localhost:5173
echo  Backend   http://localhost:8000  ^(health /api/v1/health, docs /docs^)
echo  Stop      Ctrl+C here stops the frontend, close the backend window too
echo.
call npm run dev
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo [FAIL ] vite exited with code %RC% - is port 5173 already in use?
pause
exit /b %RC%

:check_done
echo.
echo [OK   ] all checks passed - run start.cmd to start both processes
echo.
exit /b 0

rem ---- failures ------------------------------------------------------------------
:no_node
echo [FAIL ] npm was not found on PATH
echo        Install Node.js LTS from https://nodejs.org and run start.cmd again
goto :die

:no_python
echo [FAIL ] no Python interpreter was found on PATH
echo        Install Python 3.11 or newer from https://www.python.org/downloads/
echo        and keep the option "Add python.exe to PATH" ticked
goto :die

:pip_failed
echo [FAIL ] pip install failed - read the output above
goto :die

:npm_failed
echo [FAIL ] npm install failed - read the output above
goto :die

:die
echo.
if defined CHECK exit /b 1
pause
exit /b 1

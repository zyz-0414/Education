@echo off
setlocal

set "ROOT=%~dp0"
set "APP_DIR=%ROOT%gaokao-volunteer-assistant"
set "PORT=3000"
set "DB_PORT=5432"
set "URL=http://localhost:%PORT%"

title Anhui Gaokao Volunteer Assistant Launcher

if not exist "%APP_DIR%\package.json" (
  echo Cannot find project package.json:
  echo %APP_DIR%\package.json
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  echo Please install Node.js first, then double-click this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not installed or not in PATH.
  pause
  exit /b 1
)

cd /d "%APP_DIR%"

if not exist "node_modules" (
  echo First startup: installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

call :ensure_database

powershell -NoProfile -ExecutionPolicy Bypass -Command "$conn = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if ($conn) { exit 0 } exit 1" >nul 2>nul
if errorlevel 1 (
  echo Starting local development server on %URL% ...
  start "Anhui Gaokao Assistant Server" cmd /k "cd /d ""%APP_DIR%"" && npm run dev -- -p %PORT%"
  call :wait_for_server
) else (
  echo Local server is already running on %URL%.
)

echo Opening %URL% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%URL%'" >nul 2>nul
exit /b 0

:ensure_database
powershell -NoProfile -ExecutionPolicy Bypass -Command "$conn = Get-NetTCPConnection -LocalPort %DB_PORT% -State Listen -ErrorAction SilentlyContinue; if ($conn) { exit 0 } exit 1" >nul 2>nul
if not errorlevel 1 (
  echo PostgreSQL is already available on localhost:%DB_PORT%.
  call :prepare_database
  exit /b 0
)

call :start_native_postgres
if not errorlevel 1 (
  call :wait_for_port %DB_PORT% 60
  if not errorlevel 1 (
    echo PostgreSQL service is available on localhost:%DB_PORT%.
    call :prepare_database
    exit /b 0
  )
)

call :find_docker
if errorlevel 1 (
  echo PostgreSQL is not running, no local PostgreSQL service could be started, and Docker was not found.
  echo The web app will open, but database-backed candidate queries will need PostgreSQL first.
  exit /b 0
)

call :ensure_docker_engine
if errorlevel 1 (
  echo Docker is installed, but the Docker engine did not become ready.
  echo The web app will open, but database-backed candidate queries may be unavailable.
  exit /b 0
)

echo Starting PostgreSQL with docker compose...
"%DOCKER_EXE%" compose up -d postgres
if errorlevel 1 (
  echo Failed to start PostgreSQL with docker compose.
  echo The web app will open, but database-backed candidate queries may be unavailable.
  exit /b 0
)

call :wait_for_port %DB_PORT% 90
if errorlevel 1 (
  echo PostgreSQL did not become ready on localhost:%DB_PORT% in time.
  echo The web app will open, but database-backed candidate queries may be unavailable.
  exit /b 0
)

call :prepare_database
exit /b 0

:start_native_postgres
powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1; if (-not $svc) { exit 1 }; if ($svc.Status -ne 'Running') { try { Start-Service -Name $svc.Name -ErrorAction Stop; $svc.WaitForStatus('Running', [TimeSpan]::FromSeconds(30)) } catch { exit 1 } }; exit 0" >nul 2>nul
exit /b %errorlevel%

:find_docker
set "DOCKER_EXE="
where docker >nul 2>nul
if not errorlevel 1 (
  set "DOCKER_EXE=docker"
  exit /b 0
)

if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
  set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
  exit /b 0
)

if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
  exit /b 0
)

exit /b 1

:ensure_docker_engine
"%DOCKER_EXE%" info >nul 2>nul
if not errorlevel 1 (
  exit /b 0
)

if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  echo Starting Docker Desktop...
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
)

for /l %%i in (1,1,120) do (
  "%DOCKER_EXE%" info >nul 2>nul
  if not errorlevel 1 (
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)

exit /b 1

:prepare_database
echo Preparing database schema and local data...
if not exist "node_modules\.prisma\client\index.js" (
  call npm run db:generate
  if errorlevel 1 (
    echo Prisma client generation failed.
    exit /b 1
  )
) else (
  echo Prisma client already exists.
)

call npx prisma migrate deploy
if errorlevel 1 (
  echo Prisma migration failed.
  exit /b 1
)

call npm run db:ensure-local
if errorlevel 1 (
  echo Local data check/import failed.
  exit /b 1
)

exit /b 0

:wait_for_port
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(%~2); do { $conn = Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue; if ($conn) { exit 0 }; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1" >nul 2>nul
exit /b %errorlevel%

:wait_for_server
for /l %%i in (1,1,60) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 1; if ($response.StatusCode -ge 200) { exit 0 } } catch { } exit 1" >nul 2>nul
  if not errorlevel 1 (
    exit /b 0
  )
  timeout /t 1 /nobreak >nul
)
echo The server is still starting. The browser will open now; refresh the page after a moment if needed.
exit /b 0

@echo off
echo ===================================================
echo   FSRMS - ONE CLICK INSTALL & DATABASE INITIALIZER
echo ===================================================
echo.

:: Check Node.js installation
echo [*] Checking Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js (v18+) and try again.
    pause
    exit /b 1
)
echo [SUCCESS] Node.js is ready.
echo.

:: 1. Backend installation
echo [*] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Backend npm install failed.
    pause
    exit /b 1
)
echo [SUCCESS] Backend dependencies installed.
echo.

:: Initialize Backend .env if it does not exist
if not exist .env (
    echo [*] Creating default backend .env file...
    (
        echo PORT=5000
        echo DATABASE_URL="file:./dev.db"
        echo JWT_SECRET="fsrms_super_jwt_secret_key_2026"
        echo JWT_REFRESH_SECRET="fsrms_super_jwt_refresh_secret_key_2026"
        echo JWT_EXPIRES_IN="15m"
        echo JWT_REFRESH_EXPIRES_IN="7d"
        echo USE_S3=false
        echo MOCK_WHATSAPP=true
        echo MOCK_EMAIL=true
    ) > .env
    echo [SUCCESS] Default backend .env created.
)
echo.

:: 2. Database generation
echo [*] Generating Prisma Client and pushing database schema...
call npx prisma generate
call npx prisma db push
if %errorlevel% neq 0 (
    echo [ERROR] Database setup failed.
    pause
    exit /b 1
)
echo [SUCCESS] Database push and generation completed.
echo.

:: Run seed script if demo jobs database is empty
if exist seed_demo_jobs.js (
    echo [*] Seeding demo repair tickets database...
    node seed_demo_jobs.js
    echo [SUCCESS] Seeding completed.
)
echo.

cd ..

:: 3. Frontend installation
echo [*] Installing frontend dependencies...
cd frontend
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)
echo [SUCCESS] Frontend dependencies installed.
echo.

:: Initialize Frontend .env if it does not exist
if not exist .env (
    echo [*] Creating default frontend .env file...
    (
        echo VITE_FIREBASE_API_KEY=""
        echo VITE_FIREBASE_AUTH_DOMAIN=""
        echo VITE_FIREBASE_PROJECT_ID=""
        echo VITE_FIREBASE_STORAGE_BUCKET=""
        echo VITE_FIREBASE_MESSAGING_SENDER_ID=""
        echo VITE_FIREBASE_APP_ID=""
    ) > .env
    echo [SUCCESS] Default frontend .env created.
)
echo.

cd ..

echo ===================================================
echo   [INSTALLATION SUCCESSFUL]
echo   To start both servers, run: start-project.bat
echo ===================================================
echo.
pause

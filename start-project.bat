@echo off
echo ===================================================
echo   FSRMS - STARTING FRONTEND & BACKEND SERVERS
echo ===================================================
echo.

echo [*] Launching Backend Server in a new window...
start "FSRMS Backend Server" cmd /k "cd backend && npm run dev"

echo [*] Launching Frontend Server in a new window...
start "FSRMS Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   [SUCCESS] Both servers are starting up!
echo   - Backend: http://localhost:5000
echo   - Frontend: http://localhost:5173
echo ===================================================
echo.

@echo off
echo ========================================
echo Starting Frontend and Backend
echo ========================================

REM Start Frontend in new window
start "Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"

REM Wait 3 seconds
timeout /t 3 /nobreak > nul

REM Start Backend in new window
start "Backend (Port 3001)" cmd /k "cd backend && gradlew bootRun"

echo.
echo ========================================
echo Services are starting...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo ========================================
echo.
echo Press any key to exit (this will NOT stop the services)
pause > nul

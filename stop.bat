@echo off
echo ========================================
echo Stopping all services
echo ========================================

REM Kill processes on port 3000 (Frontend)
echo Stopping Frontend (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /F /PID %%a 2>nul

REM Kill processes on port 3001 (Backend)
echo Stopping Backend (Port 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /F /PID %%a 2>nul

REM Kill Java processes (Gradle)
echo Stopping Gradle/Java processes...
taskkill /F /IM java.exe /FI "WINDOWTITLE eq Backend*" 2>nul

REM Kill Node processes
echo Stopping Node processes...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Frontend*" 2>nul

echo.
echo ========================================
echo All services stopped
echo ========================================
pause

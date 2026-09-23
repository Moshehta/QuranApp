@echo off
cd /d "%~dp0"
title Quran App

echo ====================================
echo    Starting Quran Circle App...
echo ====================================
echo.

echo [1/3] Starting Backend Server...
start "Quran - Backend" cmd /k "cd /d "%~dp0quran-backend" && node server.js"

ping 127.0.0.1 -n 3 > nul

echo [2/3] Starting Frontend Server...
start "Quran - Frontend" cmd /k "cd /d "%~dp0quran-app" && npm run dev"

ping 127.0.0.1 -n 3 > nul

echo [3/3] Opening Browser...
start http://localhost:5173

echo.
echo ====================================
echo  App started successfully!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:5000
echo ====================================
echo.
pause

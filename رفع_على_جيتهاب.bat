@echo off
cd /d "%~dp0"
title Push to GitHub

echo ====================================
echo    Pushing Quran App to GitHub...
echo ====================================
echo.

"C:\Program Files\Git\cmd\git.exe" branch -M main
"C:\Program Files\Git\cmd\git.exe" push -u origin main

echo.
echo ====================================
echo  Finished. Press any key to close.
echo ====================================
pause

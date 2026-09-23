@echo off
chcp 65001 > nul
cd /d "%~dp0"
title رفع المشروع على GitHub

echo ====================================
echo    رفع المشروع على GitHub
echo ====================================
echo.

echo جاري الاتصال بـ GitHub ورفع الكود...
echo.

"C:\Program Files\Git\cmd\git.exe" branch -M main
"C:\Program Files\Git\cmd\git.exe" push -u origin main

echo.
echo ====================================
echo  اكتمل الأمر. اضغط أي زر للإغلاق.
echo ====================================
pause

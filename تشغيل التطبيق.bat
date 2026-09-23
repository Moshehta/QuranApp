@echo off
chcp 65001 > nul
cd /d "%~dp0"
title مقرأة تحفيظ قرآن

echo ====================================
echo    تشغيل منظومة تحفيظ القرآن الكريم
echo ====================================
echo.

echo [1] جاري تشغيل الواجهة الخلفية (Backend)...
start "Quran - Backend" cmd /k "cd /d ""%~dp0quran-backend"" && node server.js"

timeout /t 2 /nobreak > nul

echo [2] جاري تشغيل الواجهة الأمامية (Frontend)...
start "Quran - Frontend" cmd /k "cd /d ""%~dp0quran-app"" && npm run dev"

timeout /t 3 /nobreak > nul

echo [3] فتح المتصفح على الموقع...
start http://localhost:5173

echo.
echo ====================================
echo  تم تشغيل المنظومة بنجاح!
echo  الموقع:   http://localhost:5173
echo  الباك إند: http://localhost:5000
echo ====================================
echo.
pause

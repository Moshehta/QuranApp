@echo off
title مقرأة تحفيظ قرآن
echo ====================================
echo    تشغيل مقرأة تحفيظ قرآن
echo ====================================
echo.

echo [1] تشغيل الـ Backend...
start "Backend - مقرأة" cmd /k "cd /d d:\Courses\الجمعيه\quran-backend && node server.js"

timeout /t 2 /nobreak > nul

echo [2] تشغيل الـ Frontend...
start "Frontend - مقرأة" cmd /k "cd /d d:\Courses\الجمعيه\quran-app && npm run dev"

timeout /t 3 /nobreak > nul

echo [3] فتح المتصفح...
start http://localhost:5173

echo.
echo ✅ تم تشغيل التطبيق!
echo    Backend:  http://localhost:5000
echo    Frontend: http://localhost:5173
echo.
pause

@echo off
chcp 65001 > nul
echo ========================================================
echo         تشغيل موقع مسابقات - خادم استلام المرفوعات
echo ========================================================
echo.
echo سيتم تشغيل الموقع الآن...
echo الملفات المرفوعة ستنزل مباشرة في:
echo C:\Users\redam\Downloads\مسابقات_المرفوعات
echo.
cd /d "%~dp0"
start http://localhost:3000
node server.js
pause

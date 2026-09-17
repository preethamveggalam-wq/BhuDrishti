@echo off
cd /d "%~dp0"
echo Starting BhuDrishti V50...
echo.
npm install
if errorlevel 1 pause & exit /b 1
npm run install:all
if errorlevel 1 pause & exit /b 1
npm run dev
pause

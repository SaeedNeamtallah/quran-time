@echo off
title Quranic Pomodoro Next
setlocal EnableExtensions

for %%I in ("%~dp0.") do set "APP_ROOT=%%~fI"

echo Starting Quranic Pomodoro Next workspace...
echo.
echo 1. Install Node.js 22+ if this machine does not have node available.
echo 2. Run npm install once if dependencies are missing.
echo.
cd /d "%APP_ROOT%"
npm run dev
pause

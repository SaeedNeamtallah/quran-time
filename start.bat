@echo off
setlocal EnableExtensions EnableDelayedExpansion

for %%I in ("%~dp0.") do set "APP_ROOT=%%~fI"
set "FRONTEND_ROOT=%APP_ROOT%\new q"
set "FRONTEND_URL=http://127.0.0.1:4000"
set "FRONTEND_LOG_DIR=%FRONTEND_ROOT%\output\dev-server"
set "FRONTEND_OUT=%FRONTEND_LOG_DIR%\next-dev.out.log"
set "FRONTEND_ERR=%FRONTEND_LOG_DIR%\next-dev.err.log"

title Quranic Pomodoro Launcher
color 0A

echo ==========================================
echo Quranic Pomodoro Launcher (Next.js only)
echo ==========================================
echo.

if not exist "!FRONTEND_ROOT!\package.json" (
  echo [ERROR] Could not find the Next.js app at:
  echo         !FRONTEND_ROOT!
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not available in PATH.
  exit /b 1
)

if not exist "!FRONTEND_LOG_DIR!" mkdir "!FRONTEND_LOG_DIR!" >nul 2>&1

echo [1/2] Checking frontend dependencies...
set "FRONTEND_DEPS_OK="
if exist "!FRONTEND_ROOT!\node_modules" (
  pushd "!FRONTEND_ROOT!" >nul
  call npm ls next react react-dom sass --depth=0 >nul 2>&1
  if not errorlevel 1 set "FRONTEND_DEPS_OK=1"
  popd >nul
)

if not defined FRONTEND_DEPS_OK (
  echo       Installing/updating frontend packages...
  pushd "!FRONTEND_ROOT!" >nul
  call npm install
  if errorlevel 1 (
    popd >nul
    echo [ERROR] Failed to install frontend dependencies.
    exit /b 1
  )
  popd >nul
) else (
  echo       Frontend packages already available.
)
echo.

echo [2/2] Launching frontend...
set "FRONTEND_PORT_STATE=none"
for /f "usebackq delims=" %%S in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=[IO.Path]::GetFullPath('!FRONTEND_ROOT!'); $conn=Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(-not $conn){'none'} else { $proc=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $conn.OwningProcess); if($proc -and $proc.CommandLine -and $proc.CommandLine.Contains($root) -and ($proc.CommandLine.Contains('run-next.mjs') -or $proc.CommandLine.Contains('next\\dist') -or $proc.CommandLine.Contains('start-server.js'))) { Stop-Process -Id $conn.OwningProcess -Force; 'restart' } else { 'keep' } }"`) do set "FRONTEND_PORT_STATE=%%S"

if /I "!FRONTEND_PORT_STATE!"=="keep" (
  echo       Frontend already appears to be running on port 4000.
) else (
  if /I "!FRONTEND_PORT_STATE!"=="restart" (
    echo       Restarting frontend on !FRONTEND_URL! to load the latest code...
    timeout /t 2 /nobreak >nul
  ) else (
    echo       Starting frontend on !FRONTEND_URL!
  )

  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath 'cmd.exe' -WorkingDirectory '!FRONTEND_ROOT!' -ArgumentList '/d','/c','call npm run dev -- --hostname 127.0.0.1 --port 4000' -RedirectStandardOutput '!FRONTEND_OUT!' -RedirectStandardError '!FRONTEND_ERR!' -WindowStyle Hidden | Out-Null"

  if errorlevel 1 (
    echo [ERROR] Failed to launch frontend process.
    exit /b 1
  )

  call :wait_for_port 4000 30
  if errorlevel 1 (
    echo [WARN] Frontend did not bind to port 4000 within 30 seconds.
    echo        Check logs: !FRONTEND_ERR!
  ) else (
    echo       Frontend is listening on port 4000.
  )
)

echo.
echo Frontend: %FRONTEND_URL%
echo.
echo Frontend logs:
echo   %FRONTEND_OUT%
echo   %FRONTEND_ERR%
echo.
echo Launcher finished. The server keeps running in the background.
goto :eof

:wait_for_port
setlocal EnableDelayedExpansion
set "TARGET_PORT=%~1"
set /a MAX_RETRIES=%~2
set "READY="

for /L %%I in (1,1,!MAX_RETRIES!) do (
  netstat -ano | findstr /R /C:":!TARGET_PORT! .*LISTENING" >nul 2>&1
  if not errorlevel 1 (
    set "READY=1"
    goto wait_for_port_done
  )
  timeout /t 1 /nobreak >nul
)

:wait_for_port_done
if defined READY (
  endlocal & exit /b 0
) else (
  endlocal & exit /b 1
)

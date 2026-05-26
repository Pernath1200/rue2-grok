@echo off
cd /d "%~dp0"
title Grammar Check - SERVER (keep this window open)
echo Starting Grammar Check app...
echo.
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080" ^| findstr "LISTENING"') do (
  echo Stopping existing process on port 8080 (PID %%a)...
  taskkill /PID %%a /F 2>nul
)
ping -n 2 127.0.0.1 >nul 2>&1
echo.
echo Serving from: %CD%
echo.
echo *** THIS WINDOW IS THE SERVER ***
echo - If you close this window, the site will stop working.
echo - Leave this window open, then in your browser open:
echo   http://localhost:8080
echo   (IMPORTANT: include :8080 - not just localhost)
echo.
echo URL copied to clipboard. Paste it in your browser.
echo http://localhost:8080 | clip
echo.
echo Opening browser in 4 seconds...
echo.
start cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:8080"
python -m http.server 8080 --bind 127.0.0.1

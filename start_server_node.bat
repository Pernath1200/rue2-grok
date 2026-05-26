@echo off
cd /d "%~dp0"
title Grammar Check - NODE SERVER (keep this window open)
echo Starting Grammar Check app (Node server)...
echo.
echo Serving from: %CD%
echo.
echo *** THIS WINDOW IS THE SERVER ***
echo - If you close this window, the site will stop working.
echo - Leave this window open, then in your browser open:
echo   http://127.0.0.1:5555
echo   (IMPORTANT: include :5555 - not just 127.0.0.1)
echo.
echo URL copied to clipboard. Paste it in your browser.
echo http://127.0.0.1:5555 | clip
echo.
echo Opening browser in 4 seconds...
echo.
start cmd /c "timeout /t 4 /nobreak >nul && start http://127.0.0.1:5555"
node server.js

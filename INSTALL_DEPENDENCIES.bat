@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not installed. Install the LTS version from the official Node.js website.
  pause
  exit /b 1
)
echo Installing dependencies from the public npm registry...
call npm install --registry=https://registry.npmjs.org/
if errorlevel 1 (
  echo.
  echo Installation failed.
  echo Check your internet connection, firewall, VPN, or proxy settings, then try again.
  pause
  exit /b 1
)
echo.
echo Done. Dependencies installed successfully.
pause

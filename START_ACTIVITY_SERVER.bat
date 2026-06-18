@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not installed. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  echo Dependencies not installed yet. Running npm install from public registry...
  call npm install --registry=https://registry.npmjs.org/
  if errorlevel 1 pause && exit /b 1
)
echo Starting Grandis Legacy Discord PvP Full Gameplay Alpha...
node server.js
pause

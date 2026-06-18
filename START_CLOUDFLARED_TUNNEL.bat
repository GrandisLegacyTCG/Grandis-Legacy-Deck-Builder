@echo off
setlocal
where cloudflared >nul 2>nul || (
  echo cloudflared is not installed or not available in PATH.
  echo Install it from:
  echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  pause
  exit /b 1
)
echo Starting temporary HTTPS tunnel for http://127.0.0.1:3000 ...
echo Keep this window open while testing.
cloudflared tunnel --url http://127.0.0.1:3000
pause

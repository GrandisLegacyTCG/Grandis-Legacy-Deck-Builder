@echo off
setlocal
cd /d "%~dp0"
echo Open two local browser tabs for the same PvP debug room.
echo Make sure START_ACTIVITY_SERVER.bat is already running.
start "" "http://127.0.0.1:3000/?debug=1&room=grandis-local-debug&name=Player%%201&client=debug-player-1"
start "" "http://127.0.0.1:3000/?debug=1&room=grandis-local-debug&name=Player%%202&client=debug-player-2"

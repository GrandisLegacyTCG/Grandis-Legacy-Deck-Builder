GRANDIS LEGACY DISCORD PVP v1.0.0 CLOSED ALPHA
Zero-cost Deployment Draft — Render Free Web Service

Goal
- Run Discord PvP from a stable HTTPS host without keeping a personal computer on.
- Keep this as Closed Alpha only, not production/public release.
- Tester access should remain limited until multi-room, disconnect, and logging behavior are proven stable.

Why Render Free for first zero-cost pass
- The current PvP package is a single Node server.
- The server serves frontend files and hosts the WebSocket endpoint at /ws.
- Because frontend and WebSocket use the same host, this avoids splitting frontend/backend too early.
- /health already exists and returns version + room count.

Known free-tier limitations
- The service can sleep after inactivity.
- First load after sleep can be slow.
- Free services can restart unexpectedly.
- No persistent local filesystem guarantee.
- This is acceptable for tiny closed alpha, but not for public release.

Required environment variables
- DISCORD_CLIENT_ID = Discord Application Client ID
- PORT = provided by host automatically; do not hardcode for Render
- NODE_ENV = production

Render deploy steps
1. Put this folder into a private GitHub repository.
2. In Render Dashboard, create New > Web Service.
3. Connect the repository.
4. Use these settings:
   - Runtime: Node
   - Build Command: npm install
   - Start Command: npm start
   - Instance Type: Free
   - Health Check Path: /health
5. Add environment variable:
   - DISCORD_CLIENT_ID = your Discord app client ID
6. Deploy.
7. Open /health on the Render URL and verify JSON response:
   - ok: true
   - version: 1.0.0
8. Use the Render hostname in Discord Developer Portal URL Mapping.

Discord Developer Portal mapping draft
- Activities > URL Mappings
- Prefix: /
- Target: <your-render-host>.onrender.com
- Do not include https://
- Do not add a trailing slash

Closed alpha tester rule
- Do not publish broadly yet.
- Start with a small trusted tester group.
- Ask testers to report build version, room id, players involved, deck/preset used, turn/phase, expected result, actual result, and screenshot/video if possible.

Minimum smoke test after deployment
1. Open Activity in Discord.
2. Player 1 loads Starter 01.
3. Player 2 loads Starter 02.
4. Both Ready.
5. Start match.
6. Verify connection state, setup modal, turn/phase, Mana, Racial Tokens, status effects, and opponent action sidecar.
7. Test disconnect/reconnect once.
8. Check /health before and after a match.

Do not claim production readiness from this pass.
This is only a zero-cost closed-alpha deployment prep.

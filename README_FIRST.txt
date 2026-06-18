Grandis Legacy Discord PvP v1.0.0 Closed Alpha Deployment Prep

Purpose:
- Prepare the Discord PvP runtime for limited tester access through Discord without relying on a personal computer as the server.
- This is a closed-alpha deployment prep package, not a public production release.

Run locally:
1. npm install
2. npm run qa
3. npm start
4. Open http://localhost:3000 or configure Discord local/hosted testing.

Deploy zero-cost draft:
- See DEPLOY_FREE_ALPHA_RENDER.md.
- render.yaml is included as a first-pass Render Free Web Service blueprint.
- The server already exposes /health and /ws.

Active gameplay baseline:
- Based on Discord PvP Alpha v0.10.5 RC behavior.
- No intentional gameplay/balance changes in this prep pass.

Key active rules:
- Chain Mail = Warrior / Archer / Thief.
- Poison Mist = 6 Mana.
- Nightshade Venom = Poison duration +1 and all Attack damage +10.
- Archer Rank II/III passive bonus applies only to Single Target Attack damage.
- Venom Sovereign is non-Ultimate; Venom Detonation remains Ultimate.

Closed alpha rule:
- Keep tester access limited.
- Require bug reports to include build version, room id, decks, turn/phase, expected result, and actual result.

# Verification — Deck Builder v1.28

Date: 2026-09-04

Automated verification completed successfully.

- `npm run verify`: PASS
- Canonical data build: PASS (198 cards)
- JavaScript syntax checks: PASS
- Deck save/export policy: PASS — Main Deck size is unrestricted for save/export
- Normal card copy limit: PASS — maximum 3 per card
- Ultimate copy limit: PASS — maximum 1 per card
- Style 2 workspace ceiling: PASS — 80 cards preserved
- Source Stack parity: PASS
- Starter/Favicon/HP/mobile/UI regression checks: PASS
- File manifest verification: PASS

Deck Builder intentionally does not enforce the 60-card match requirement. VS AI and PvP enforce match legality when a custom deck is imported/used.

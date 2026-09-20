# Grandis Legacy Deck Builder v1.31

Grandis Legacy Deck Builder v1.31 is synchronized to **Grandis Legacy Source Authority v1.9.1** and its current 200-card Season 1 registry (Runtime Data v0.16.0). The Deck Builder is a consumer of OSA data and does not redefine or execute gameplay effects.

## Active sources

- Style 1: `index.html`, `css/app.css`, `js/app.js`
- Style 2: `style-2/index.html`, `style-2/css/app-v1.31.css`, `style-2/js/app-v1.31.js`
- Generated card data: `js/data.js` and `style-2/js/data.js`, both built from `data/season1/cards.runtime.v0.16.0.json`
- Active source lock: `SOURCE_LOCK_v3.20.json`
- Active Deck Rule Lock: `release/DECK_RULE_LOCK_v1.31.json`

The current registry includes **S1-ITM-019 Warp Scroll** and **S1-ITM-020 Freeze Bomb**. Their runtime gameplay behavior remains owned by OSA/gameplay applications; Deck Builder preserves their identity and display/deck-building data.

Style 1 keeps its 250×350 enlarged preview and original per-hovered-row vertical placement; only X is shifted so the preview center aligns near the hovered row left edge without covering quantity controls. Style 2 keeps its approved Library-right / Deck-left 250×350 preview geometry. Direct card-to-card hover is immediate in either direction; no suppression/dead-zone can block the newly hovered card.

See `release/RELEASE_NOTE_v1.31.md` and `release/VERIFICATION_v1.31.md`. Historical v1.30 records and old source locks are preserved under `release/history/`.

Current starter authority: **v1.6.0**, exactly **5 active Starter Decks**, consumed from OSA v1.9.1. Application Runtime Sync reference: **v2.59**.

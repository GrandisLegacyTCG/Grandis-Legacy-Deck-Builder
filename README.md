# Grandis Legacy Deck Builder v1.31

Grandis Legacy Deck Builder v1.31 is synchronized to **Grandis Legacy Source Authority v1.9.0** and its current 200-card Season 1 registry (Runtime Data v0.16.0). The Deck Builder is a consumer of OSA data and does not redefine or execute gameplay effects.

## Active sources

- Style 1: `index.html`, `css/app.css`, `js/app.js`
- Style 2: `style-2/index.html`, `style-2/css/app-v1.31.css`, `style-2/js/app-v1.31.js`
- Generated card data: `js/data.js` and `style-2/js/data.js`, both built from `data/season1/cards.runtime.v0.16.0.json`
- Active source lock: `SOURCE_LOCK_v3.20.json`
- Active Deck Rule Lock: `release/DECK_RULE_LOCK_v1.31.json`

The current registry includes **S1-ITM-019 Warp Scroll** and **S1-ITM-020 Freeze Bomb**. Their runtime gameplay behavior remains owned by OSA/gameplay applications; Deck Builder preserves their identity and display/deck-building data.

Style 1 keeps its existing enlarged preview size but positions the preview farther left so quantity controls remain visible and usable. Style 2 now has the same-size desktop hover preview: Library cards preview to the right, Deck cards preview to the left, and the preview disappears immediately when the pointer leaves the source card.

See `release/RELEASE_NOTE_v1.31.md` and `release/VERIFICATION_v1.31.md`. Historical v1.30 records and old source locks are preserved under `release/history/`.

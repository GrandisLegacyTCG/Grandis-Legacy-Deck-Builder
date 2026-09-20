# Grandis Legacy Deck Builder v1.31

Date: 2026-09-21

## Final correction pass

- Synchronized current consumer metadata to **Grandis Legacy Source Authority v1.9.1**.
- Consumes **Starter Deck Authority v1.6.0** and **Application Runtime Sync v2.59**.
- Active player-facing Starter Deck set is exactly **5**, sourced from OSA v1.9.1; the retired 15-starter model is not part of any current selector/build path.
- All five current starters resolve against the 200-card registry and contain 60 Main Deck cards.
- Style 1 preview remains **250×350** and preserves the original per-hovered-row vertical placement. Only the X anchor changes: preview center X aligns near the hovered row left edge, with viewport clamping and usable +/- controls.
- Style 2 keeps approved placement (Library → RIGHT, Deck → LEFT) and **250×350** size. The former suppression/dead-zone logic was removed so direct adjacent card-to-card hover immediately transfers preview ownership.
- Preview overlays remain `pointer-events:none`; source-card mouseleave hides immediately; no hover bridge or delayed close is used.
- 200 canonical cards, Warp Scroll, Freeze Bomb, copy limits, import/export, filters, search, Hero selection, and mobile/touch behavior remain unchanged.
- No other Grandis Legacy repository was modified by this release.

Actual executable verification is recorded in `VERIFICATION_v1.31.md`.

# Grandis Legacy Deck Builder v1.31

Date: 2026-09-22

## Starter Authority v1.6.1 synchronization

- Public Deck Builder remains **v1.31**.
- Active Starter Deck Authority is now **v1.6.1**, imported from the current **Grandis Legacy Source Authority v1.9.5** package.
- Exactly **5** active Starter Decks remain. Starter 1 receives the authoritative v1.6.1 composition; Starters 2–5 remain semantically identical to the previous active set.
- `js/data.js` and `style-2/js/data.js` are regenerated from the five active authority JSON files.
- The Deck Builder intentionally retains its approved runtime/card/effect/UI stack: Runtime Data **v0.16.0**, Shared Runtime **v1.94.0**, Effect Recipe **v0.15.0**, Effect Checkpoint **v0.15.0**, UI Contract **v2.52**, and Application Runtime Sync **v2.59**.
- No gameplay runtime propagation was performed. The current OSA v1.9.5 package is the source/reference for Starter Authority v1.6.1, not a claim that every runtime component was migrated.
- Style 1 / Style 2 layout, preview behavior, hover behavior, navigation, mobile behavior, save/export policy, import flow, deck legality behavior, card copy limits, hero selection, artwork, and CSS are unchanged.
- The retired 15-starter model remains non-active and is not part of any current selector/build path.

Executable verification is recorded in `VERIFICATION_v1.31.md`.

# Deck Builder v1.25 Update Summary

## Scope
Only Deck Builder copy-count legality changed. No gameplay/card-effect authority was changed.

## New limits
- Normal Main Deck card: max 3 copies.
- Ultimate card: max 1 copy.
- Legal Main Deck size: exactly 60.
- Style 2 editing workspace: max 80.

## Implementation
- Generated builder data now writes `maxCopies: 3` for every non-Ultimate Main Deck card and `maxCopies: 1` for Ultimate cards.
- Style 1 and Style 2 active runtimes use 3 as the normal fallback copy limit.
- Import, validation, add-button state, drag-and-drop, and export quantities inherit the same `copyLimit()` authority.
- Style 2 active runtime advanced to `app-v1.20.js`; cache-busting updated.

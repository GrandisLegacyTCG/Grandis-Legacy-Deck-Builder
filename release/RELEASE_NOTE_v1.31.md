# Grandis Legacy Deck Builder v1.31

Date: 2026-09-20

## Summary

- Synchronized active Deck Builder data to Grandis Legacy Source Authority v1.9.0.
- Uses Runtime Data v0.16.0, Shared Runtime reference v1.94.0, Effect Recipe v0.15.0, Effect Checkpoint v0.15.0, Starter60 v1.5, UI Contract v2.52, and Application Runtime Sync v2.58.
- Maintains 200 canonical Season 1 cards with 200 unique IDs, including Warp Scroll and Freeze Bomb.
- Updated active source metadata and locks without changing historical v1.30 records.
- Regenerated Style 1 and Style 2 Deck Builder data from the same OSA-derived runtime source.
- Style 1 enlarged preview size is preserved and its desktop placement is shifted left so +/- quantity controls remain unobstructed.
- Style 1 preview exists only while the source deck row is hovered and is `pointer-events:none`.
- Style 2 now provides enlarged desktop hover preview using the Style 1 size. Library previews open to the right/toward center; Deck previews open to the left/toward center.
- Style 2 preview lifetime is source-card-only: source mouseleave hides immediately, including movement toward the preview. The preview itself is non-interactive and no hover bridge/delay is used.
- Warp Scroll and Freeze Bomb are represented as Deck Builder data only; gameplay runtime implementation remains in OSA/application runtime.
- Starter60 v1.5 active starter examples are synchronized from the approved OSA generated Starter60 set.

## Validation

Final verification results are recorded in `VERIFICATION_v1.31.md` after executable regression and browser geometry tests.

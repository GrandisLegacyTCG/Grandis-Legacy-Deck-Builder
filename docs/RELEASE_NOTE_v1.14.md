# Grandis Legacy Deck Builder v1.14

## Export rule — both styles
- Export is allowed only when the Main Deck contains exactly 60 cards.
- `0–59 / 60`: Export disabled and hard-blocked.
- `60 / 60`: Main Deck size requirement satisfied.
- Style 2 `61–80 / 60`: cutting workspace remains available, but Export is disabled and hard-blocked.
- Style 2 still rejects the 81st card.

## Preserved
- Style 2 Skill class hover tooltip remains hover/focus-only and capped at 3 classes.
- Style 2 temporary workspace limit remains 80.
- Style 1 card-add limit remains 60.
- Existing navigation and card legality behavior are unchanged.

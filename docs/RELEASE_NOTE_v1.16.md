# Grandis Legacy Deck Builder v1.16 — 2026-08-24

## 1. Source Stack adoption

- One Source Authority v1.6.1
- Runtime Foundation v1.85 / Runtime Core Template v0.53
- Season 1 Runtime Data v0.13.1
- Effect Recipe / Checkpoint v0.12.1
- Legality Map v0.11.9
- Application Runtime Sync v2.47
- Canonical registry: `b185307752fd523d6c1e4a450f8bdd82b96b4d4cbfbb884fca8a619e8c5c8057`
- Hero Component registry: `487aa2620b5be99480a81d462082f1a35ee637ec2cc38ebf42b1bcf1103d06c9`

## 2. Gameplay/card data

The 198 Card IDs, 30 revised Card IDs, Back Slash, Racial Traits, Class Abilities, and Hero compositions remain unchanged. Resurrection metadata is now consistently 3 Mana / 50 HP.

## 3. Bug fixes

Removed the stale Resurrection 4 Mana / 40 HP execution references inherited from the pre-hotfix registry.

## 4. UI changes

None. Style 1 and Style 2 UI assets are unchanged from v1.15.

## 5. Preserved behavior

- Export remains enabled only at exactly 60 Main Deck cards.
- Style 2 remains editable through 80 and rejects the 81st card.
- Style 2 desktop drag/drop and mobile +/- editing remain intact.
- Style 1 behavior remains intact.

## 6. QA results

Canonical registry, all card fields, Hero Component composition, starters, exact-60 export, 80-card workspace, desktop drag/drop, mobile controls, Style 1 preservation, syntax, and manifest tests pass.

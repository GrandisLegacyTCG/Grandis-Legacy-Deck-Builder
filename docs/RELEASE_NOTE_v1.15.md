# Grandis Legacy Deck Builder v1.15 — 2026-08-24

## 1. Source Stack adoption
- One Source Authority v1.6.0
- Runtime Foundation v1.84 / Runtime Core Template v0.52
- Season 1 Runtime Data v0.13.1
- Effect Recipe / Checkpoint v0.12.0
- Legality Map v0.11.8
- Application Runtime Sync v2.46
- Hero Component Authority v1.0.0
- Canonical registry: `f6560b21206a4f50670d9801442933d026768c3c704215f443d58a568980a3db`
- Hero component registry: `487aa2620b5be99480a81d462082f1a35ee637ec2cc38ebf42b1bcf1103d06c9`

## 2. Gameplay/card changes
- All 198 Card IDs and all 30 revised functional entries are sourced from canonical Runtime Data.
- `S1-THF-010` is now **Back Slash**; no other Card ID was renamed.
- Hero cards retain resolved compatibility fields while referencing shared Race Racial Trait and Class Ability authority.

## 3. Bug fixes
- Style 2 mobile Legacy cards, selectors, labels, swap controls, and Rank controls no longer overlap.
- Style 2 mobile no longer depends on desktop right-click or drag interactions.

## 4. UI changes
- Style 2 mobile Main Deck uses a vertical list grouped by Skills, Events, and Items.
- Style 2 desktop supports Library → Main Deck +1 and Main Deck → Card Library −1 drag-and-drop.
- Dropping a selected card elsewhere inside Main Deck does not reorder or change quantities.

## 5. Preserved behavior
- Style 1 UI and interactions are unchanged.
- Exactly 60 cards is the only legal/exportable Main Deck size.
- Style 2 retains the 80-card cutting workspace; the 81st card is rejected.
- Normal copy limit remains 2 and Ultimate copy limit remains 1.
- Existing navigation, filtering, Card Review, and desktop Style 2 sizing remain unchanged.

## 6. QA results
- Canonical count/hash and Hero Component composition tests added.
- Revised data, exact-60 export, 80/81 capacity, mobile controls, desktop drag/drop, no-reorder, and Style 1 preservation contracts added.

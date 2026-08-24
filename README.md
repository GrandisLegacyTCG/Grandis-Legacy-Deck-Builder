# Grandis Legacy Deck Builder v1.20

## v1.20 — Style 2 Deck View literal library reuse + mobile position alignment

- Main Deck **Deck View** now uses the exact same modal, scroll grid, and card-tile classes as **Legacy Deck Library** instead of a parallel layout implementation.
- Main Deck quantity badges (`×1` / `×2`) and enlarge/preview controls remain.
- Mobile Hero and Legacy frames now share the exact same three LEFT / CENTER / RIGHT columns and frame width.
- Existing 4-button mobile Deck Name row is preserved.
- Style 1, 60-card legality, Style 2 80-card workspace, export guard, drag/drop, card data, and Source Stack are unchanged.

## v1.17 — Style 2 minor mobile alignment + Main Deck view

- Mobile Deck Name controls now keep Load Starter, Import Deck, Export Deck, and Clear Deck in one compact row.
- Mobile Hero and Legacy slots now share the same LEFT / CENTER / RIGHT column centers.
- Added a view-only Main Deck visual overview on both mobile and desktop.
- Desktop `VIEW DECK` sits in the Main Deck header in the same pattern as `LEGACY DECK LIBRARY`.
- Main Deck view shows card artwork and quantities, supports card preview, and never edits deck state.
- Style 1, deck legality, 80-card Style 2 workspace, export rules, Source Stack data, and desktop drag/drop remain unchanged.


## v1.16 — Corrected Source Stack hotfix

- Adopted One Source Authority v1.6.1 and canonical registry `b185307752fd523d6c1e4a450f8bdd82b96b4d4cbfbb884fca8a619e8c5c8057`.
- Preserved the exact 198 Card IDs, all 30 revised entries, Back Slash, and Hero Component composition.
- Corrected the embedded Resurrection execution metadata to 3 Mana / 50 HP.
- Style 1 and Style 2 UI/interaction files are unchanged from v1.15.
- Exact-60 export, Style 2 workspace maximum 80, desktop drag/drop, and mobile +/- editing remain verified.

## v1.15 — Source Stack 2026-08-24 + Style 2 mobile/drag update
- Adopted all 198 canonical Season 1 Card IDs from Runtime Data v0.13.0, including `S1-THF-010` **Back Slash** and all 30 revised functional entries.
- Embedded Hero Component Authority v1.0.0: 6 reusable Racial Traits, 16 reusable Class Abilities, 10 Hero profiles, and 30 resolved Hero compositions.
- Style 2 mobile Main Deck now uses vertical Skills / Events / Items lists with thumbnail, name, type/subtype, Mana, minus, quantity, and plus controls.
- Style 2 mobile Legacy Deck was compacted into a collision-free three-position layout; swap and Rank controls remain accessible.
- Style 2 desktop keeps its existing layout and click behavior while adding validated +1 / −1 drag-and-drop without manual reordering.
- Style 1 presentation and interaction are unchanged.
- Main Deck legality remains exactly 60; Style 2 remains editable through 80 and rejects the 81st card.

## v1.14 — Exact-60 export lock
- Both Style 1 and Style 2 now require the Main Deck to contain exactly 60 cards before Export can run.
- Style 2 still supports the temporary 80-card cutting workspace; `61–80 / 60` remains invalid and non-exportable.
- Style 2 underfilled decks (`0–59 / 60`) are now also non-exportable.
- Style 1 receives the same hard exact-60 export guard in addition to its existing validation-based disabled state.
- Runtime references are cache-busted/versioned for v1.14.


## v1.13 — Style 2 workspace rebuild
- Rebuilt the Style 2 Main Deck capacity around explicit constants: 60-card legal limit and 80-card workspace limit.
- Counter remains `XX / 60`; 61–80 cards are allowed for cutting but remain invalid and cannot be exported.
- 81st card is rejected. Imports above 80 cards are rejected rather than silently trimmed.
- Skill class breakdown is hidden by default and appears only while hovering/focusing `Skills XX`, showing at most 3 classes.
- Style 2 behavior/CSS assets are versioned (`app-v1.13.js`, `app-v1.13.css`) to prevent stale cached v1.11/v1.12 behavior.

Built directly on v1.11.

## Changes
- Style 2 Main Deck now supports a temporary cutting workspace up to 80 cards.
- The visible counter remains `XX / 60` so players can immediately see how far above the legal 60-card limit they are.
- 61–80 cards is always shown as `Deck Invalid`.
- Export is disabled while the Main Deck contains more than 60 cards.
- Hovering/focusing the `Skills XX` summary in Style 2 shows Skill counts by Class, up to 3 Classes.
- All v1.11 navigation behavior is preserved, including same-tab public VS AI/PvP routes and clickable Grandis Legacy homepage logos.
- Style 1 gameplay/layout behavior is unchanged.

## v1.20 mobile navigation

- Mobile Deck Builder now uses a three-line application menu instead of the large VS AI / PvP buttons.
- Menu destinations: VS AI, PVP, and Deck Builder.
- Every mobile Deck Builder destination points to Style 2.
- Desktop cross-application navigation remains unchanged.
- Style 1 / Style 2 deck behavior, legality, export, drag-and-drop, and Deck View are unchanged.

# Grandis Legacy Deck Builder v1.13

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

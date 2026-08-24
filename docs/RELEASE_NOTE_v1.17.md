# Grandis Legacy Deck Builder v1.17 — 2026-08-24

## Scope

Targeted Style 2 presentation update only. Gameplay/card authority, Style 1, deck legality, and existing desktop editing behavior are preserved.

## UI changes

- Mobile Deck Name tools now render Load Starter, Import Deck, Export Deck, and Clear Deck in one compact row.
- Mobile Hero and Legacy slots now share the same LEFT / CENTER / RIGHT column centers; swap controls remain accessible between positions.
- Added `VIEW DECK` to the Style 2 Main Deck header on desktop, matching the placement pattern of `LEGACY DECK LIBRARY`.
- Added the same Main Deck visual overview for mobile, using an effectively full-screen dialog.
- The Deck View is display-only, shows quantities, scrolls independently, and reuses existing card preview behavior.

## Preserved behavior

- Style 1 is unchanged.
- Main Deck legal size remains exactly 60.
- Style 2 cutting workspace remains capped at 80.
- Export remains available only at exactly 60 Main Deck cards.
- Desktop left-click/right-click and drag/drop behavior remains unchanged.
- Mobile Main Deck +/- editing remains unchanged.
- Source Stack card data and Hero Component authority remain unchanged.

## QA

- Source Stack 198-card/Hero Component parity.
- Exact-60 export guard.
- Active Style 2 v1.17 asset contract.
- Mobile four-button tool row contract.
- Mobile Hero/Legacy shared column geometry contract.
- View-only Main Deck modal contract.
- Desktop drag/drop preservation.
- SHA256 manifest verification.

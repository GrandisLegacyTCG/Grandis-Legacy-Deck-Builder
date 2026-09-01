# Deck Builder v1.26 Verification — 2026-09-01

Result: **PASS**

Verified:
- Style 1 accepts/exports a Main Deck only at exactly 50 or 60 cards.
- Style 2 accepts/exports a Main Deck only at exactly 50 or 60 cards.
- Normal Main Deck cards are generated and enforced at maximum 3 copies.
- Ultimate cards remain maximum 1 copy.
- Style 1 editing maximum remains 60 cards.
- Style 2 80-card cutting workspace remains active.
- Starter60 v1.4 Starter 1/2 replacement authority remains passing.
- Source Stack v1.7.3 card/Hero HP authority remains passing.
- Navigation/mobile layout regressions remain passing.
- File manifest verification passes.

`npm run verify` completed successfully after the v1.26 rule change.

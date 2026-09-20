# Grandis Legacy Deck Builder v1.31 — Verification

Date: 2026-09-21
Status: PASS

## Authority / Data

- Deck Builder: **v1.31** (`package.json` 1.31.0) — PASS
- Consumed authority: **Grandis Legacy Source Authority v1.9.1** — PASS
- Starter Deck Authority: **v1.6.0** — PASS
- Application Runtime Sync: **v2.59** — PASS
- Runtime Data: **v0.16.0** — PASS
- Hero Components: **v1.1.0** — PASS
- Canonical registry hash: `85d25ebda9bb2bc260983a566e6d430dde97bfc7a32e8042ec2fddfeaff1b42f` — PASS
- Hero Component registry hash: `f36f1cc83eb9845743176c3af71f7823125353eae73e832588e9d8b42c6818be` — PASS
- Canonical cards: **200 / 200** — PASS
- Unique canonical IDs: **200 / 200** — PASS
- Active Starter Decks: **5 / 5** — PASS
- OSA starter semantic parity: **5 / 5** — PASS
- Every active Starter Main Deck: **60 cards** — PASS
- No slot 6–15 current starter and no 15-starter fallback/current build path — PASS
- Starter 4 uses current **Grand Ranger / Grand Arbalest / Renegade** composition — PASS
- `S1-ITM-019` Warp Scroll present — PASS
- `S1-ITM-020` Freeze Bomb present — PASS
- Normal-card copy limit **3** / Ultimate copy limit **1** — PASS

The five current starter sources live under `data/starter-decks/active/` and are checked-in consumer snapshots derived directly from OSA v1.9.1. The retired 15-starter examples are isolated under `release/history/` and are not enumerated by current generation or selection logic.

## Style 1 Preview

Executable Chromium verification at desktop viewport:

- Preview size remains **250×350 px** — PASS
- Original per-hovered-row vertical behavior is preserved — PASS
- Preview is positioned **above the current hovered row** where viewport space allows — PASS
- Preview center X aligns approximately to the **hovered row left edge**, calculated per row — PASS
- Y is not globally anchored to the Deck panel — PASS
- +/- controls remain unobstructed and usable — PASS
- `pointer-events:none` — PASS
- Source-row mouseleave hides immediately — PASS
- Moving toward preview does not keep preview alive — PASS

## Style 2 Preview

Executable Chromium verification:

- Approved geometry preserved: Library → **RIGHT**, Deck → **LEFT** — PASS
- Preview size **250×350 px** — PASS
- Former suppression/dead-zone logic removed — PASS
- No invisible former-preview blocking region — PASS
- Direct adjacent Library Card A → Card B updates immediately — PASS
- Reverse Library direction updates immediately — PASS
- Direct adjacent Deck Card right → left updates immediately — PASS
- Reverse Deck direction updates immediately — PASS
- Leaving a source into empty space hides immediately — PASS
- `pointer-events:none` — PASS
- Only one preview overlay exists — PASS
- Mobile/touch does not receive desktop hover preview — PASS

## Starter Load / Import / Export

Executable application verification:

- Exactly five choices are exposed in the Starter selector — PASS
- Each of the five loads into the actual application with 60 Main Deck cards — PASS
- Each starter survives application export-object → import-normalization/application roundtrip without semantic composition changes — PASS
- Real file export/import flow remains functional — PASS
- Warp Scroll and Freeze Bomb survive real file export/import with stable IDs — PASS
- Export metadata identifies OSA v1.9.1 — PASS

## Existing Deck Builder Regression

- Card Library / filters / search — PASS
- Tabs — PASS
- Hero selection — PASS
- Deck editing — PASS
- Style 1 — PASS
- Style 2 — PASS
- Import / export — PASS
- Mobile navigation and mobile quantity controls — PASS
- Current/history release organization — PASS
- Active source locks — PASS

## Automated Gates

- Data regeneration from current build source — PASS
- JavaScript syntax gate — PASS
- Static/regression scripts: **16 / 16 PASS**
- Executable Chromium browser suite: **1 / 1 PASS**
- Manifest verification suite: **1 / 1 PASS**
- Total verification suites: **18 / 18 PASS, 0 FAIL**

## Scope

- OSA v1.9.1 was treated as read-only input authority — PASS
- VS AI, Tutorial, PvP, Website, and Player Rulebooks were not modified — PASS
- Deck Builder version remains v1.31 / package 1.31.0 — PASS

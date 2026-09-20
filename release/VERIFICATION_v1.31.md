# Grandis Legacy Deck Builder v1.31 — Verification

Date: 2026-09-20
Status: PASS

## Authority / Data

- Deck Builder public version: **v1.31** (`package.json` 1.31.0) — PASS
- Consumed authority: **Grandis Legacy Source Authority v1.9.0** — PASS
- Runtime Data: **v0.16.0** — PASS
- Application Runtime Sync reference: **v2.58** — PASS
- Canonical registry hash: `85d25ebda9bb2bc260983a566e6d430dde97bfc7a32e8042ec2fddfeaff1b42f` — PASS
- Hero Component registry hash: `f36f1cc83eb9845743176c3af71f7823125353eae73e832588e9d8b42c6818be` — PASS
- Canonical cards: **200 / 200** — PASS
- Unique canonical IDs: **200 / 200** — PASS
- Active Starter60 examples: **15**, all resolve against the active registry — PASS
- Normal-card copy limit: **3** — PASS
- Ultimate copy limit: **1** — PASS
- `S1-ITM-019` Warp Scroll present in both generated Style 1 / Style 2 data — PASS
- `S1-ITM-020` Freeze Bomb present in both generated Style 1 / Style 2 data — PASS
- Warp Scroll + Freeze Bomb survive real Style 2 add → export → clear → import with identical IDs — PASS
- Historical pre-v1.31 locks/data/tests remain separated under `release/history/`; no active current-facing stale OSA / obsolete Runtime Sync markers remain — PASS

## Style 1 Preview

Executable Chromium verification at 1440×1000:

- Existing enlarged hover preview remains enabled — PASS
- Preview size remains **250×350 px** — PASS
- Preview center is positioned approximately at the left edge of the right-side deck panel — PASS
- Preview does not overlap the tested +/- quantity controls — PASS
- +/- remains clickable while preview behavior is enabled — PASS
- Preview uses `pointer-events:none` — PASS
- Source-card mouseleave hides preview immediately — PASS
- Moving from source card toward the preview immediately closes it — PASS
- Preview remains inside the usable desktop viewport — PASS

## Style 2 Preview

Executable Chromium verification at 1440×1000:

- One singleton enlarged hover preview is used — PASS
- Preview size matches Style 1: **250×350 px** — PASS
- Card Library source → preview opens on the **RIGHT**, toward center — PASS
- Current Deck source → preview opens on the **LEFT**, toward center — PASS
- Preview remains inside the usable viewport — PASS
- Preview uses `pointer-events:none` and is display-only — PASS
- Source-card mouseleave hides immediately — PASS
- Moving toward/into the former preview region does not create a hover bridge — PASS
- Rapid Card A → Card B source hover updates the singleton to Card B — PASS
- No delayed close / sticky preview behavior — PASS
- Mobile/touch layout does not force desktop hover preview — PASS
- Mobile +/- controls remain functional — PASS

## Existing Deck Builder Regression

- Card Library load / rendering — PASS
- Search — PASS (exercised in browser with Warp Scroll / Freeze Bomb)
- Filters — PASS (real Item filter path exercised in browser)
- Tabs — PASS
- Hero selection workflow — PASS
- Deck editing — PASS
- Style 1 — PASS
- Style 2 — PASS
- Import — PASS
- Export — PASS
- Starter60 — PASS
- Mobile navigation / mobile deck quantity controls — PASS
- Active source lock / Deck Rule Lock — PASS

## Automated Gates

- Data regeneration from build source — PASS
- JavaScript syntax gate — PASS
- Static/regression test scripts: **15 / 15 PASS**
- Executable Chromium browser integration suite: **1 / 1 PASS**
- Manifest verification suite: **1 / 1 PASS**
- Total automated test suites: **17 / 17 PASS, 0 FAIL**
- `FILE_MANIFEST_SHA256.csv` byte-count/SHA256 verification — PASS

The browser integration suite executes the checked-in repository HTML/CSS/JS in headless Chromium. The execution environment blocks normal browser navigation, so the same checked-in files are inlined into the test document rather than served over HTTP; application code and DOM behavior are executed in Chromium.

## Scope / Repository Integrity

- OSA v1.9.0 was treated as read-only input authority — PASS
- VS AI, Tutorial, PvP, and Website repositories were not modified — PASS
- Final repository ZIP is not embedded inside the repository — PASS

## Final Packaging / History Cleanup Validation

- Loose root `RELEASE_NOTE_v1.30.md` duplicate removed — PASS
- Exactly one historical `RELEASE_NOTE_v1.30.md` remains at `release/history/RELEASE_NOTE_v1.30.md` — PASS
- v1.28-v1.30 release notes, verification reports, and Deck Rule Locks are isolated under `release/history/` — PASS
- Historical v1.28-v1.30 files retained byte-for-byte during relocation — PASS
- Current v1.31 release records remain directly under `release/` — PASS
- Root and release README filesystem claims match the final current/history layout — PASS
- Repository-root duplicate-content scan found no remaining unnecessary duplicate root files — PASS
- `FILE_MANIFEST_SHA256.csv` regenerated after cleanup — PASS
- Complete `npm run verify` functional/regression/browser/manifest suite remains PASS after cleanup — PASS

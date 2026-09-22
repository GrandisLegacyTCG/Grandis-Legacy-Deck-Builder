# Grandis Legacy Deck Builder v1.31 — Verification

Date: 2026-09-22  
Status: PASS

## Authority / Scope

- Public Deck Builder: **v1.31** (`package.json` 1.31.0) — PASS
- Current OSA package/reference used for this task: **Grandis Legacy Source Authority v1.9.5** — PASS
- Active Starter Deck Authority: **v1.6.1** — PASS
- Active Starter Decks: **5 / 5** — PASS
- Gameplay/runtime propagation: **NOT PERFORMED** — PASS
- Retained runtime baseline: Source Authority **v1.9.1-era consumer stack**, Runtime Data **v0.16.0**, Shared Runtime **v1.94.0**, Effect Recipe **v0.15.0**, Effect Checkpoint **v0.15.0**, UI Contract **v2.52**, Application Runtime Sync **v2.59**, Hero Components **v1.1.0** — PASS
- Canonical registry hash retained: `85d25ebda9bb2bc260983a566e6d430dde97bfc7a32e8042ec2fddfeaff1b42f` — PASS
- Hero Component registry hash retained: `f36f1cc83eb9845743176c3af71f7823125353eae73e832588e9d8b42c6818be` — PASS
- Canonical cards: **200 / 200** — PASS

The v1.6.1 manifest and all five `Generated/Starter60` files were copied from the supplied OSA v1.9.5 package without reconstructing the decks manually. Those authority files intentionally retain their own embedded OSA-generation metadata (v1.9.2); Deck Builder provenance separately records that the files were imported from the current OSA v1.9.5 package. This does not imply a full runtime migration.

## Starter 1 — Exact Semantic Delta

The only Main Deck composition changes from the previous active Starter 1 are:

- `S1-MAG-002`: **3 → 2**
- `S1-MAG-008`: **2 → 3**
- `S1-MAG-014`: **1 → 0**
- `S1-MAG-015`: **0 → 1**
- `S1-THF-010`: **2 → 3**
- `S1-THF-013`: **3 → 2**
- `S1-THF-015`: **1 → 2**
- `S1-THF-017`: **1 → 0**

- Previous Starter 1 Main Deck total: **60** — PASS
- Candidate Starter 1 Main Deck total: **60** — PASS
- No additional semantic Starter 1 composition delta: **PASS**

## Starters 2–5

Semantic hashes (deck name, 60-card Main Deck composition, Legacy package slots, expanded Legacy Deck, and default formation) remain identical to the previous active v1.6.0 set:

- Starter 2 semantic parity — PASS
- Starter 3 semantic parity — PASS
- Starter 4 semantic parity — PASS
- Starter 5 semantic parity — PASS

Their checked-in JSON bytes changed only as required by the v1.6.1 authority/provenance output; their gameplay composition did not change.

## Active Starter Authority / Consumers

- `data/starter-decks/ACTIVE_STARTERS_v1.6.1.json` is the single current active manifest — PASS
- No active `ACTIVE_STARTERS_v1.6.0.json` fallback remains — PASS
- `data/starter-decks/active/` contains exactly five `GL_DECK_1_0.json` files — PASS
- Each active Starter Main Deck totals exactly **60** cards — PASS
- Every referenced card ID is legal in the retained Deck Builder card database — PASS
- `js/data.js` regenerated from the authority sources — PASS
- `style-2/js/data.js` regenerated from the authority sources — PASS
- Both generated consumers expose exactly the same five starter semantics — PASS
- Both generated consumers report `starter60 = 1.6.1` — PASS
- Both generated consumers record current Starter authority source/reference `1.9.5` while retaining runtime baseline versions — PASS
- Retired 15-starter material is not active and no 15-starter fallback exists — PASS

## UI / Runtime Locks

Byte comparison against the supplied v1.31 baseline confirms these locked production files are unchanged:

- `index.html` — unchanged
- `css/app.css` — unchanged
- `js/app.js` — unchanged
- `style-2/index.html` — unchanged
- `style-2/css/app-v1.31.css` — unchanged
- `style-2/js/app-v1.31.js` — unchanged

Therefore Style 1 / Style 2 layout, card preview behavior, hover behavior, navigation, mobile behavior, save/export policy, import flow, deck legality behavior, copy limits, Hero selection, artwork, and CSS were not modified by this authority synchronization.

## Tests / Validation Executed

- `npm run build:data` — PASS
- `npm run check:syntax` — PASS
- `npm run check:regression` — PASS
- `npm run check:browser` — PASS
- Starter Authority v1.6.1 semantic test — PASS
- Style 1 browser preview / quantity-control regression — PASS
- Style 2 browser preview / starter load / import-export regression — PASS
- Mobile browser regression — PASS
- Manifest generation / verification — PASS (performed by final `npm run verify`)
- Final `npm run verify` — PASS

The browser test itself was corrected to reacquire the same Style 1 card row by stable `data-main-deck-id` after a rerender; this is test-only and does not change production UI behavior.

## Material Files Changed

- `data/starter-decks/ACTIVE_STARTERS_v1.6.1.json` (new current manifest)
- `data/starter-decks/ACTIVE_STARTERS_v1.6.0.json` (removed from active location)
- all five `data/starter-decks/active/*.json` authority snapshots
- `tools/build-deck-data.cjs`
- `js/data.js`
- `style-2/js/data.js`
- `tests/run-v131-starter-authority-v161.cjs` (replaces obsolete v1.6.0 starter test)
- `tests/run-v131-source-authority.cjs`
- `tests/run-v131-starter-favicon.cjs`
- `tests/run-v131-preview-browser.py` (test harness stability only)
- `package.json`
- `SOURCE_LOCK_v3.20.json`
- `style-2/SOURCE_LOCK_v2.22.json`
- `release/DECK_RULE_LOCK_v1.31.json`
- `README.md`
- `release/RELEASE_NOTE_v1.31.md`
- `release/VERIFICATION_v1.31.md`
- `FILE_MANIFEST_SHA256.csv` (regenerated)

## Intentionally Not Updated

Per the Deck Builder no-gameplay-runtime-propagation scope, these remain on the existing approved v1.31 stack and were not imported from newer OSA components:

- `data/season1/cards.runtime.v0.16.0.json`
- `data/season1/hero-components.runtime.v1.1.0.json`
- Shared Runtime 1.94.0
- Runtime Data 0.16.0
- Effect Recipe 0.15.0
- Effect Checkpoint 0.15.0
- UI Contract 2.52
- Application Runtime Sync 2.59

No PvP, VS AI, Tutorial, Website, Player Rulebook, or other Grandis Legacy repository was modified.

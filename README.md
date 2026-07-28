# Grandis Legacy Non-Scripted Tutorial Gameplay v0.31

GitHub Pages package built from the VS AI v5.56 gameplay base. The match remains a real, non-scripted match with fixed tutorial decks; General Arvon explains mechanics only when they first become relevant.

## v0.31 changes

- Lobby heading: **NON-SCRIPTED — TUTORIAL GAMEPLAY**.
- Separate first-use practice queues for Attack, Support, Tactical, Event, and Item cards. Each lesson uses the first legal card of that category and stops at its last cancellable step.
- Source selection is enabled only when it is needed to reveal the next legal target stage. Final target selection remains blocked before commitment, followed by mandatory **Cancel Action**.
- Direct-commit cards such as Magic Compass stop before **Play**.
- Opponent Area Attack lessons now continue through every affected Hero response window, including a third target.
- All earlier tutorial locks remain: Casting start/resolve Card Played tiles, Revive, Racial Traits, Dragon Scale, lineage fallback through Card Played, Force Reposition, Ultimate rules, and Game Result explanations.

## GitHub Pages

Copy the extracted package contents directly into the GitHub repository root. Keep `.nojekyll`, `index.html`, `404.html`, `assets/`, `css/`, `js/`, `data/`, and `runtime-source/` at the root. Enable GitHub Pages from the repository root, then hard-refresh after deployment.

## Verification

```bash
npm run verify
```

The package includes `FILE_MANIFEST_SHA256.csv` and the required Noto Sans variable font binaries.

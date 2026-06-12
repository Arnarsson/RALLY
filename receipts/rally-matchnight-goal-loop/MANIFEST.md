# RALLY match-night loop — MANIFEST

Goal: deliver the social-first match-night loop (picks → tally → result → taunt/share),
stats on demand, demo-safe build. Source contract: `docs/plans/2026-06-11-rally-masterplan-stats-social-play.md`.

## Smallest stable data shape (subgoal 1)
Already present in WIP; kept as-is — the smallest shape the loop needs:

| Object | Shape | Where |
|---|---|---|
| match | `{ id, team_a, team_b, score_a, score_b, status }` | `fixtures.json` / Supabase rows |
| room | `PLAN { id, match_id, venue_id, participant_ids[], time, vibe }` | `mockData.js` PLANS |
| pick | `{ user_id, match_id, pick: 'team_a'\|'draw'\|'team_b' }` | `localStorage['rally-picks-v1']` (demo) |
| tally | derived — count picks across `demoPredictionsForMatch` | computed in `PredictionBoard` |
| result | `matchWinner(match)` from scores; `predictionOutcome(match,pick)` → right/wrong/pending | `mockData.js` |
| taunt/share | derived strings (`tauntCopy` / `bragCopy` / `resultCardCopy`) | `MatchScreen.jsx` |

## Checkpoints

### CP1 — baseline (pre-edit)
- Commands: `npm test` → 50 passed · `npm run build` → ✓ built
- Status: GREEN baseline captured.

### CP2 — social-first reorder + stats drawer (subgoals 2, 6)
- Paths touched: `src/screens/MatchScreen.jsx`
- Change: match screen now renders **lowdown → PredictionBoard (picks/tally/payoff) → Spots (room) → StatsDrawer**.
  Stats (`MatchAnalytics`, fun-fact, `HeadToHead`, `TeamExtras`) moved into a collapsed
  `StatsDrawer` ("the numbers · stats on demand ↓"). Honors masterplan Rule 1 (social first)
  + Rule 2 (stats are a drill-down).
- Expected: picks/room visible above the fold; stats hidden until tapped; build+tests green.

### CP3 — taunt/brag/share payoff (subgoals 4, 5)
- Paths touched: `src/screens/MatchScreen.jsx`
- Change: replaced single "copy taunt" with a share row — **copy brag** (always, once picked),
  **copy taunt** (when result + right), **copy result card** (when result), **share** (native
  `navigator.share`, clipboard fallback). New builders `bragCopy` / `resultCardCopy` + `ShareBtn`.
- Expected: result state triggers the taunt/share affordance; pre-result you can still brag.

### CP4 — lock the data shape with tests (verification)
- Paths touched: `src/data/mockData.test.js`
- Change: +6 tests for `demoPrediction` determinism, `matchWinner`, `predictionOutcome`
  (pending→right/wrong), `predictionLabel`, and `demoPredictionsForMatch` (ME-included, deduped).
- Expected: 56 passed.

## Verifiers (final)
- `npm test` → **56 passed (2 files)**
- `npm run build` → **✓ built** (MatchScreen chunk 21.x kB gzip 6.2 kB)
- `npm run build:standalone` → **✓ built** (dist/index.html 721 kB single-file)

## Rerun
```bash
cd source
npm test
npm run build
npm run build:standalone   # shipping/standalone surface
```

## Residual risk
- Visual QA not yet run in a live browser (dev server). Structural reorder is code-evident
  and build-clean, but a `/browse` pass on the match screen would confirm above-the-fold layout.
- Picks are demo-local (`localStorage`); persistence/sync across devices is a later phase
  (masterplan §6 Phase 6) — intentionally out of scope for the wedge.
- `result card` / `brag` share via `navigator.share` falls back to clipboard on `file://`.

## Status
Loop delivered and demo-safe. See FINAL.md.

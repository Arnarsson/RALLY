# RALLY match-night loop — FINAL

## End goal
Social-first match-night loop with live pulse, match picks, room tally, and taunt/share
payoff — buildable and demo-safe. Contract: `docs/plans/2026-06-11-rally-masterplan-stats-social-play.md`.

## Phases / agents used
- No multi-writer workflow. Implementation is concentrated in one file (`MatchScreen.jsx`);
  the brief forbids multiple writers on the same file, so parallel writers would conflict for
  no gain. Single sequential writer + read-only recon. Verification via repo-native commands.

## Success criteria → evidence

| Criterion | Status | Evidence |
|---|---|---|
| Match screen feels social-first | ✅ | `MatchScreen.jsx`: order is lowdown → PredictionBoard → Spots → `StatsDrawer` (collapsed) |
| Picks can be made + survive demo path | ✅ | `useStoredPick` ↔ `localStorage['rally-picks-v1']`; refresh-safe; tests lock the helpers |
| Room tally visible | ✅ | `PredictionBoard` counts picks (team_a / draw / team_b) + per-person rows |
| Result triggers taunt/share | ✅ | share row: brag (always) · taunt (right) · result card (post-result) · native share |
| Stats on demand, not homepage | ✅ | `StatsDrawer` collapses MatchAnalytics + fun-fact + H2H + TeamExtras |
| Build still passes | ✅ | `npm run build` ✓ · `npm run build:standalone` ✓ |
| Demo mode still works | ✅ | `hasSupabase=false` path; demo predictions deterministic; 56 tests green |

## Paths touched
- `source/src/screens/MatchScreen.jsx` — reorder (social-first), `StatsDrawer`, expanded share row, `bragCopy`/`resultCardCopy`/`ShareBtn`
- `source/src/data/mockData.test.js` — +6 pick-loop tests
- (pre-existing WIP retained: `mockData.js` pick helpers, `PredictionBoard`)

## Verifiers — pass evidence
- `npm test` → **56 passed (2 files)** (was 50; +6)
- `npm run build` → **✓ built in ~1.7s**
- `npm run build:standalone` → **✓ built**, dist/index.html 721.66 kB single-file

## Blocker / next
- No blocker. Suggested next: live `/browse` visual QA of the match screen above-the-fold;
  then masterplan Phase 6 (persistent picks/rooms via Supabase) when the wedge proves out.

## Master end goal
**Satisfied** for the wedge: social-first screen + end-to-end picks + room tally +
taunt/share payoff + on-demand stats, all demo-safe and build-green.

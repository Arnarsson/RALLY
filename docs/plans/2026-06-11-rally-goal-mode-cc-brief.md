# RALLY — Goal Mode CC Brief

## End goal
Execute the RALLY masterplan in priority order so the product becomes a *social-first match-night loop* with a live pulse, match picks, room tally, and taunt/share payoff, while keeping the app buildable and demo-safe.

Masterplan source:
- `docs/plans/2026-06-11-rally-masterplan-stats-social-play.md`

## Working contract
- Stay inside the RALLY repo only.
- Do not touch unrelated files.
- Do not use broad resets or broad staging.
- Prefer the smallest reversible change that moves the loop forward.
- Keep the app working in demo mode while iterating.

## Priority subgoals
1. Map the current architecture and identify the smallest stable data shape that supports:
   - match
   - room
   - pick
   - tally
   - result
   - taunt/share output

2. Make the match screen explicitly social-first.
   - friends / room context visible
   - match pulse visible
   - pick action visible
   - share / invite affordance visible

3. Wire the pick loop end-to-end.
   - choose home / draw / away
   - persist the pick
   - show your pick clearly
   - refresh-safe in demo mode

4. Add room tally and result payoff.
   - room-wide tally
   - simple comparison view
   - right/wrong state
   - result-driven highlight/feedback

5. Add taunt / brag / share output.
   - copy taunt
   - copy brag
   - copy result card
   - share to room or externally

6. Expand stats without making stats the homepage.
   - live pulse
   - form / H2H / lineup context
   - deeper stats drawer on demand
   - short data-driven commentary

7. Keep the product contract explicit for future growth.
   - persistence / sync boundaries
   - venue / host / growth surfaces only after the loop works

## Allowed implementation areas
- app/source code under `source/`
- tests under `source/`
- supporting docs/receipts under `docs/` and `receipts/`

## Forbidden
- unrelated cleanup in other repos
- broad refactors that do not move the match-night loop
- shipping a stats-only homepage
- season-manager / fantasy complexity before the loop works

## Verifiers
Use the repo-native commands discovered from `source/package.json`:
- `npm test`
- `npm run build`
- `npm run build:standalone` if needed for the shipping surface

If a verifier fails, report:
- exact command
- exact failure
- smallest next fix

## Required receipts
- `receipts/rally-matchnight-goal-loop/MANIFEST.md`
- `receipts/rally-matchnight-goal-loop/FINAL.md`

Each checkpoint should record:
- paths touched
- commands run
- expected vs actual
- rerun instructions
- residual risk
- status

## Output contract back to Eureka
Reply in compact receipts, not a wall of prose:
- Status
- End goal
- Subgoal in progress
- Paths touched
- Verifier run
- Blocker / next
- Receipt path

## Success criteria
- Match screen feels social-first.
- Picks can be made and survive the immediate demo path.
- Room tally is visible.
- Result state triggers taunt/share affordance.
- Build still passes.
- Demo mode still works.

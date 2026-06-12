# RALLY Match-Night Predictions — Master Plan

## Goal loop

**North star:** turn RALLY into the app people open on match night to see **who’s going**, **what friends picked**, and **who gets to taunt after the final whistle**.

**Product rule:** stay tied to a single match, a room / plan, and a social loop. No season-long fantasy sprawl.

**Success looks like:**
- a user can open a match and immediately see friends’ picks
- a user can make a pick in one tap
- a room can see a lightweight leaderboard / tally
- after the result, the winner can copy a taunt/share card in one tap
- the whole thing still feels like RALLY, not a generic fantasy app

**Check cadence:** ship in phases, verify each phase with a build and a live screen check, then only widen scope if the previous phase is actually used.

---

## Non-goals

- No full season fantasy manager
- No deep roster management
- No player transfers, captaincy, or weekly league admin
- No generic stats homepage that competes with the social app
- No architecture rewrite unless a phase forces it

---

## Phase 0 — Lock the wedge and the rules

**Purpose:** make sure we are building the right thing before growing the feature.

**Outcome:** the product, engineering, and CC session all share the same scope.

**Deliverables:**
- a one-page plan doc (this file)
- the exact wedge statement
- the acceptance criteria for “done enough to test”
- the first screen(s) and data shape to touch

**Acceptance criteria:**
- everyone agrees the wedge is: **friends’ picks + room tally + taunt/share**
- stats remain secondary and on demand
- no new fantasy surfaces are introduced in phase 0

---

## Phase 1 — Match picks MVP

**Purpose:** make the prediction loop real on the match screen.

**What ships:**
- pick one of three outcomes: home / draw / away
- show friends’ picks in the match card
- show my pick clearly
- persist the pick locally first so the UI has real state immediately
- keep the UI match-scoped, not a global fantasy dashboard

**Likely files:**
- `source/src/screens/MatchScreen.jsx`
- `source/src/data/mockData.js`
- later: Supabase table / RPC for real pick storage

**Acceptance criteria:**
- I can open a match and place a pick in one tap
- the screen shows at least a mock/fallback list of other picks
- build passes
- refresh does not lose my own pick in demo mode

**Exit test:**
- open a match
- make a pick
- refresh
- confirm the pick is still there

---

## Phase 2 — Shared room tally

**Purpose:** turn the pick into a social object that belongs to a room / plan.

**What ships:**
- room / plan associated picks
- a visible tally of how the room is leaning
- simple leaderboard logic: right / wrong / pending
- friend list grouped by room instead of a flat personal list

**Likely files:**
- prediction storage schema
- plan / room UI
- social helpers that already exist for follows / plans

**Acceptance criteria:**
- picks are visible per room/plan, not just per person
- the room tally is obvious at a glance
- the user can tell whether their room is bold or cowardly without opening a spreadsheet

**Exit test:**
- open the room view
- see tally + participant picks
- verify the room summary updates when a pick changes

---

## Phase 3 — Taunt/share loop

**Purpose:** create the viral payoff after the result.

**What ships:**
- “copy taunt” button when the pick is right
- result-aware copy for winners and losers
- a share card / share text that names the match and the room
- optional notification or nudge when a friend gets a pick right

**Likely files:**
- match screen
- share helpers
- result / notification copy helpers

**Acceptance criteria:**
- the winner has one-tap bragging rights
- the copy references the actual match/result
- the output feels playful, not generic
- no extra effort is needed to start the taunt loop

**Exit test:**
- finish a match
- identify the correct picker
- tap copy/share
- confirm the payload is usable as-is

---

## Phase 4 — On-demand stats, not a stats monster

**Purpose:** support the people who want to nerd out without turning the app into a stat desert.

**What ships:**
- match pulse / live state
- quick form / H2H / lineup / momentum views
- one-tap expand into deeper stats
- stats hidden by default unless the user asks

**Rule:** stats are a rabbit hole, not the front door.

**Acceptance criteria:**
- the default screen stays social-first
- a user can expand stats without losing the match-night flow
- there is a clear visual difference between “social mode” and “stats mode”

**Exit test:**
- open match in social mode
- expand stats
- return without losing the pick / room context

---

## Phase 5 — Real persistence and rollout

**Purpose:** move from demo-local behavior to the actual product.

**What ships:**
- shared persistence for picks and taunts
- syncing across devices
- guards against stale demo data masquerading as live data
- analytics for adoption and retention

**Acceptance criteria:**
- picks survive across devices
- room tally is consistent for everyone
- stale demo data is clearly separated from live data
- we can tell if the wedge is being used

**Exit test:**
- pick from device A
- confirm on device B
- confirm the room tally matches
- confirm the taunt output reflects the same result state

---

## Suggested implementation order

1. **Match picks MVP**
2. **Room tally**
3. **Taunt/share loop**
4. **On-demand stats**
5. **Shared persistence + rollout**

That order keeps the product useful fast and prevents the feature from drifting into generic fantasy.

---

## What the Claude Code session should do first

**First task:** make the match picks feel real in the current screen, using the smallest possible storage path.

**First question to answer in code:**
- what is the smallest data shape that supports a pick, a room tally, and a result state?

**First verification command:**
- `npm run build`

**Then verify on the live screen:**
- the match screen shows friends’ picks
- my pick can be changed
- the taunt/share action appears only when the result is known

---

## Guardrails for the CC session

- keep the scope match-night and room-based
- do not introduce full fantasy features
- do not touch unrelated files
- prefer reversible changes
- keep demo fallback working
- if a data model change is needed, make the smallest schema change that unlocks the UI

---

## Handoff summary for CC

RALLY’s wedge is **friends’ picks + room tally + taunt/share**.

The current source app already has the first slice of the UI. The next work is to make it real in shared storage and keep the product socially-first, stats-on-demand.

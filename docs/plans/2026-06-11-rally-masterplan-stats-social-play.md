# RALLY — Masterplan for Stats, Social, Play

*One product. Three feelings. No compromise.*

RALLY is not a fixtures app, not a pure fantasy app, and not a stats bunker. It is the place you open when football night is happening and you want to know:

- **Stats** — what is happening, what it means, and what the match looks like under the hood
- **Social** — who is going, who is watching, who is talking, who is bragging
- **Play** — what small, fun action can I take right now that changes the night

The product rule is simple:

> **Social by default. Stats on demand. Play as the loop that makes people come back.**

---

## 1. Product thesis

RALLY wins if it becomes the app that makes match night feel coordinated, alive, and slightly competitive without turning into work.

The core loop is:

1. Open a match or plan
2. See what friends are doing
3. See a live pulse of the game
4. Make a small play — pick a winner, join a plan, react, taunt, share
5. Get a payoff when the result lands
6. Return for the next match because the social thread is already there

This is a **match-night operating system**, not a manager game.

---

## 2. Three pillars

### A. Stats
Stats are the truth layer.

They answer:
- Who is actually winning?
- What changed?
- Is this game dead or chaos?
- What does the crowd / venue / room think is happening?
- What does the match mean in context?

Stats should be fast, legible, and optional. They must not dominate the experience unless the user asks for them.

### B. Social
Social is the default product surface.

It answers:
- Who is here?
- Who is coming?
- Who picked what?
- Who is winning the room?
- Who can I send this to?
- Who do I get to tease later?

This is where RALLY is different. The social graph is not decoration. It is the reason the match matters.

### C. Play
Play is the action loop.

It answers:
- What can I do in 1 tap?
- How do I join the night?
- How do I make a prediction?
- How do I react to what just happened?
- How do I earn a bragging right?

Play must be lightweight. One match. One room. One result. One payoff.

---

## 3. The wedge

The first wedge is not “all football.”

The first wedge is:

> **Friends’ picks + room tally + taunt/share + live match pulse**

That is enough to create a real habit.

The first screen should make one thing obvious immediately:
- **I am not alone here**
- **This match is live**
- **I can do something right now**

---

## 4. What the app should feel like

### Default feeling
- warm
- social
- alive
- a little competitive
- easy to share
- never cluttered

### Stats feeling
- sharp
- confident
- informative
- one tap deeper
- no spreadsheet energy

### Play feeling
- lightweight
- immediate
- funny when possible
- low friction
- socially legible

If a feature does not improve one of those feelings, it is probably noise.

---

## 5. What we are building, in plain English

### Core objects
- **Match** — the center of attention
- **Plan / Room** — the social container
- **People / Friends** — the social participants
- **Pick / Prediction** — the play action
- **Pulse** — the live match state
- **Result** — the payoff
- **Taunt / Share** — the output loop

### Core actions
- join
- watch
- pick
- react
- compare
- share
- brag
- return

---

## 6. Design rules

### Rule 1: Social first
The first thing you see should usually be people, plans, or actions — not raw data.

### Rule 2: Stats are a drill-down
Stats expand from the match, not from a separate analytics home.

### Rule 3: Play is per match
Do not build a season manager. Keep it tied to the current match night.

### Rule 4: Everything should be one tap away from a result
A good state in RALLY creates a next state:
- pick → tally
- tally → taunt
- live pulse → reaction
- reaction → share

### Rule 5: Use the smallest data shape that works
Do not invent structure before the loop needs it.

---

## 7. Feature map by pillar

### Stats features

#### 7.1 Live pulse
A tiny, always-legible live strip:
- minute
- score
- status
- goals/cards/subs if available
- big match event highlights

Purpose: give the user instant orientation.

#### 7.2 Form and context
- recent form
- head-to-head
- lineup / formation
- standings implication
- venue / crowd context if available

Purpose: answer “why should I care?” in one glance.

#### 7.3 Deeper stats drawer
When the user wants more:
- team comparison
- shot / momentum / possession indicators if available
- player ratings if available
- win probability / outcome hints if available

Purpose: serve nerds without forcing nerdhood on everyone.

#### 7.4 Smart commentary
A short, data-driven match summary:
- what changed
- what matters now
- what the room should notice

Purpose: make stats feel opinionated instead of sterile.

---

### Social features

#### 7.5 Plans / rooms
A plan is the social anchor.

It should support:
- who is going
- who joined
- where it is
- when it starts
- what the vibe is
- quick invite/share

#### 7.6 Friends’ presence
Show:
- who is going
- who is watching
- who is likely to join
- who is active in this match

Purpose: make the app feel inhabited.

#### 7.7 Room conversation loop
Not a giant chat product. Keep it lightweight:
- reactions
- short comments
- matchup banter
- friend prompts
- match-night status

Purpose: enough social texture to keep people inside the product.

#### 7.8 Venue social layer
For places and hosts:
- claimed venue / plan
- visible headcount
- simple host surface
- “RALLY here” style identity

Purpose: allow the product to work in public places, not only in DMs.

---

### Play features

#### 7.9 Match picks
The first play loop.

User can choose:
- home
- draw
- away

Later, maybe more depth. But start with simple outcome picks.

#### 7.10 Room tally
Show how the room is leaning:
- who picked what
- how many on each side
- confidence or split
- your pick relative to the room

Purpose: make picks social, not private.

#### 7.11 Result payoff
After the match:
- right pick gets highlighted
- wrong pick gets gently roasted
- group outcome summary appears
- leaderboards update

Purpose: close the loop.

#### 7.12 Taunt / brag / share
One tap output when the result is known:
- copy a taunt
- copy a brag
- copy a result card
- share to the room or externally

Purpose: convert correctness into social energy.

#### 7.13 Streaks / lightweight progression
Not a giant game system.

Only if it stays playful:
- correct pick streak
- room brag streak
- “called it” moments
- match-night badges

Purpose: reward return behavior without turning the app into homework.

---

## 8. The master product loop

### Before the match
- social context
- plans
- invites
- picks
- expectations

### During the match
- live pulse
- stats on demand
- room reactions
- real-time social shifts

### After the match
- result
- leaderboard
- taunt/share
- recap
- next match suggestion

This loop is the engine.

---

## 9. Scope boundaries

### Do not build
- full season fantasy
- complex roster management
- transfer markets
- deep fantasy leagues
- heavy stats dashboards as the homepage
- broad social network complexity before the match-night loop works

### Build instead
- match-scoped play
- room-scoped social context
- stats-on-demand
- clear payoff after the result

If it doesn’t strengthen the match-night loop, it’s probably a distraction.

---

## 10. Data / system direction

### Principles
- keep a stable internal data shape
- support live and demo modes
- make the UI source-agnostic
- add live depth without rewriting the app

### Data sources / layers
- match fixtures
- live event updates
- lineups
- standings / context
- user picks
- room participation
- social graph / follows
- share / copy helpers
- local persistence for demo and fallback

### Important architecture rule
The app should not care where the football data came from.
It should only care that the normalized shape exists.

That is how you keep the UI cheap to extend.

---

## 11. Phase plan

### Phase 0 — Wedge lock
Define the loop and refuse scope drift.

Deliverables:
- product thesis
- acceptance criteria
- feature boundaries
- first implementation path

### Phase 1 — Social match screen
Make the match screen clearly social-first.

Deliverables:
- friends / room context visible
- match pulse visible
- pick action visible
- share / invite affordance visible

### Phase 2 — Pick loop
Make predictions real.

Deliverables:
- choose home / draw / away
- store the pick
- show other picks
- show your pick clearly
- refresh-safe in demo mode

### Phase 3 — Room tally
Make the pick social.

Deliverables:
- room-wide tally
- simple comparison view
- who’s leaning which way
- leaderboard / right-wrong state

### Phase 4 — Taunt/share payoff
Make correctness funny.

Deliverables:
- copy taunt
- share result card
- highlight correct pickers
- result-driven messaging

### Phase 5 — Live stats expansion
Deepen the match without changing the default feel.

Deliverables:
- live pulse
- lineup / formation
- H2H / form
- deeper stats drawer
- “stats rabbit hole” on demand

### Phase 6 — Persistent social product
Make the room real across devices.

Deliverables:
- persistent picks
- persistent rooms
- follow graph integration
- live participant counts
- notifications

### Phase 7 — Growth surfaces
Make it spread.

Deliverables:
- deep links
- share cards
- venue / host surfaces
- lightweight referrals
- external sharing with the right tone

---

## 12. Suggested build order

If we want the fastest real product, build in this order:

1. **Match picks**
2. **Room tally**
3. **Taunt/share**
4. **Live pulse**
5. **Stats drawer**
6. **Persistence / sync**
7. **Growth surfaces**

That order keeps the product fun before it gets fancy.

---

## 13. What success looks like

### Short-term
- users can make picks quickly
- the match screen feels alive
- friends’ actions are visible
- the room tally matters
- a taunt/share moment exists after the result

### Mid-term
- the app becomes a match-night habit
- people return because their room is already there
- stats are useful but not oppressive
- the product feels coherent, not feature-bloated

### Long-term
- RALLY is the default football social layer for match nights
- stats, social, and play reinforce each other
- the app feels like a place, not a tool

---

## 14. Acceptance rules for every feature

A feature only stays if it answers at least one of these:
- does this help someone understand the match?
- does this help someone feel the room?
- does this help someone make a play?
- does this help someone brag, share, or return?

If the answer is no, cut it or hide it.

---

## 15. Working principle for implementation

Every ticket should produce one of these outcomes:
- better stats
- stronger social context
- a better play loop
- a clearer payoff

Anything else is support work, not product work.

---

## 16. CC / execution handoff

The Claude Code session should treat this masterplan as the product contract.

### First execution question
What is the smallest data shape that supports:
- a match
- a room
- a pick
- a tally
- a result
- a taunt/share output

### First implementation slice
- the match screen should become explicitly social-first
- the pick loop should be wired end-to-end in the smallest possible way
- the app should continue to build and still work in demo mode

### First verification
- build succeeds
- match screen renders the loop
- pick state survives the immediate demo path
- the result state triggers the taunt/share affordance

---

## 17. Final rule

**Stats make it smart. Social makes it sticky. Play makes it worth returning to.**

That is the whole product.

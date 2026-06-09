<div align="center">

# RALLY

**Find your game. Find your people.**

A match-night social app — find where Copenhagen is watching tonight's game, and
show up together. *We don't just watch the game. We rally for it.*

`React + Vite + Tailwind` · mobile-first · real World Cup 2026 data

</div>

---

## What it is

RALLY is a high-fidelity, fully interactive front-end prototype of a football
match-night social app. The core loop works end to end:

**Tonight** (live match schedule) → **Match** (AI "lowdown", head-to-head, who's
going) → **Plan** (join + share) → **Create a plan** → **Outfit** (style for the
game) → **Leaders**.

Social data (plans, people, venues) is mock. The football data is **real**:

- **Fixtures** — the full World Cup 2026 group stage, with Copenhagen kickoff
  times, venues, recent form, team colours, and live-status fields that flip cards
  to a live score the moment a match starts.
- **TV channels** — each match matched to its actual Danish broadcaster (DR1 /
  TV 2 / TV 2 Sport X) from the published DR/TV 2 schedule.
- **Archive photos** — for matches with history, a real Creative-Commons photo of
  the two teams, rendered B&W and tinted in their colours, with attribution.

## Quick look

Double-click **`RALLY — open me.html`** (use Chrome, needs internet for fonts +
photos). It's a phone app shown in a phone frame on desktop.

## Run / develop

```bash
cd source
npm install
npm run dev        # local dev server
npm run build      # → dist/index.html (single inlined file)
```

Data pipeline (regenerates `src/data/fixtures.json`):

```bash
npm run fixtures   # schedule + live-status fields
npm run channels   # Danish TV channel per match (team-pair matcher)
npm run archive    # CC/public-domain archive photo per match (Wikimedia Commons)
```

## Tech

React 18 · Vite 5 · Tailwind 3 · `vite-plugin-singlefile` (portable standalone).
No backend yet — everything is mock or generated JSON. See the roadmap for the
live architecture.

## Data sources & licensing

- Fixtures/live: moving to **football-data.org** (free, European, `WC`) +
  **API-Football** (live) — see `docs/RALLY-10x-plan.md`. (Prototype currently
  seeded from ESPN's public endpoint.)
- TV channels: published DR / TV 2 World Cup schedule.
- Archive photos: **Wikimedia Commons**, commercial-use licences only
  (CC BY / CC BY-SA / CC0 / public domain). Credits in `docs/ATTRIBUTION.md`.
- Not affiliated with FIFA; no FIFA marks used.

## Docs

- `CLAUDE.md` — architecture & how everything fits (start here to develop)
- `SKILL.md` — the brand system
- `docs/RALLY-10x-plan.md` — product roadmap
- `docs/HANDOFF-backend.md` — Supabase + Vercel plan to go live
- `docs/PITCH-Sven.md` · `docs/STORE-LISTING.md`

## Status

Research/prototype. Built to feel the product and validate the flow before the
backend. Next: take it live (Supabase + Vercel) — see the handoff.

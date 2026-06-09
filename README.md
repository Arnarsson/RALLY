<div align="center">

# RALLY

**Find your game. Find your people.**

A match-night social app — find where Copenhagen is watching tonight's game, and
show up together. *We don't just watch the game. We rally for it.*

`React + Vite + Tailwind` · mobile-first · real World Cup 2026 data

**[▶ Live demo — www.rally.futbol](https://www.rally.futbol)**

[Standalone: `RALLY — open me.html`](./RALLY%20—%20open%20me.html) ·
[Architecture (CLAUDE.md)](./CLAUDE.md) ·
[Roadmap](./docs/RALLY-10x-plan.md) ·
[Backend handoff](./docs/HANDOFF-backend.md)

</div>

---

## What it is

A high-fidelity, fully interactive front-end prototype. The whole core loop works:

**Tonight** (live match schedule) → **Match** (AI "lowdown", head-to-head, who's
going) → **Plan** (join + share card) → **Create a plan** → **Outfit** (style for
the game) → **Leaders**.

Social data (plans, people, venues) is mock. The football data is **real**.

## What's built

- **Real fixtures** — the full 72-match World Cup 2026 group stage: Copenhagen
  kickoff times, real venues, recent form, team colours.
- **Live-aware match cards** — a scheduled match shows kickoff + a ticking
  countdown; it flips to **● LIVE 67' · 2–1** when in play and **FULL TIME** after.
  The data layer is wired; the fields go live when a backend worker feeds them.
- **"Busiest tonight" banner** — the most-subscribed venue, which game is on
  there, and the headcount, on the Tonight screen.
- **"The numbers" analytics panel** — on every match: a win-probability bar plus
  both teams' recent form with points. Real model when the prediction worker has
  run, otherwise a form-based estimate (never blank).
- **Danish TV channel + watch links** — each fixture matched to its real
  broadcaster (DR1 / TV 2 / TV 2 Sport X); the chip deep-links to DRTV / TV 2 Play
  to stream it.
- **Match art from the teams** — national colours + flags, or for matches with
  history a real **B&W Creative-Commons photo** of the two teams (attributed);
  no-photo matches get a dark editorial panel, never a stock image.
- **Head-to-head** — a "last met" line (or "first-ever meeting").
- **AI "lowdown"** — a 30-second hype script per match (browser voice today;
  ElevenLabs in production).
- **Outfit** — the real brand-board shoot (hero, Women/Men looks, essentials),
  shopping via Miinto. **Leaders** + **Share card** for sponsorship and the viral
  loop.
- **Mobile-first & fast** — 48 flags bundled as data URIs (zero flag requests),
  momentum scroll, single-file standalone.

## Data pipeline (`source/scripts/`)

| Script | Command | Source | Writes |
|---|---|---|---|
| Fixtures + live status | `npm run fixtures` | football API (see decisions) | `fixtures.json` schedule, venues, form, colours, odds→win-prob, live fields |
| Danish TV channels | `npm run channels` | published DR/TV 2 guide | `fixtures.json` `.tv` — matched by **team pair** |
| Archive photos | `npm run archive` | Wikimedia Commons API | `fixtures.json` `.archive` — commercial-OK licences only |

The UI only ever reads one shape (`mockData.js`). Swapping the data source is a
change in `scripts/` — never in the UI. That adapter boundary is the whole design.

## Run / develop

```bash
cd source
npm install
npm run dev        # local dev server (phone frame on desktop)
npm run build      # → dist/index.html (single inlined file via vite-plugin-singlefile)
```

Then copy `dist/index.html` to `../RALLY — open me.html` to refresh the standalone.

## Key decisions

- **European data over ESPN.** The prototype was seeded from ESPN's public
  endpoint, but ESPN is US-only (US broadcasters, no Danish channels, no support).
  We're migrating to **football-data.org** (free, European, World Cup code `WC` —
  the API behind `football-cli`) for schedule, and **API-Football** for live
  events/lineups/odds every 15s. `openfootball/worldcup.json` is the keyless
  fallback. See `docs/RALLY-10x-plan.md`.
- **Channels matched by team pair, not time.** Two teams meet once in the group
  stage, so the pair is a unique key — no fragile kickoff-time math, and it
  self-heals if DR/TV 2 move a match.
- **Archive photos: commercial licences only.** RALLY is a commercial product, so
  the Commons finder accepts **CC BY / CC BY-SA / CC0 / public domain** and
  explicitly rejects NonCommercial and NoDerivs. Attribution is stored per image
  and rendered in-app (`docs/ATTRIBUTION.md`).
- **History from data, photos curated.** Head-to-head "last met" comes from the
  API (free, every match). Real match *photographs* are licensed/owned, so we
  auto-use Commons where it exists and hand-curate licensed shots for marquee
  games — never auto-scrape press photos.
- **penaltyblog for analytics.** For win-probability and a real predictions
  leaderboard we use **penaltyblog** (Dixon-Coles / Bivariate Poisson, FBref /
  Understat / Club Elo) — a production library, not a novelty.
- **Single-file standalone.** `vite-plugin-singlefile` inlines everything so
  `RALLY — open me.html` runs from `file://` with no server.
- **Bundled flags, not a flag CDN.** The fixture list renders ~150 flags; fetching
  them per-image caused scroll pop-in on mobile, so the 48 needed flags are inlined
  as data URIs (`src/data/flags.js`) — zero flag requests.
- **Watch where you are.** The channel chips deep-link to DRTV / TV 2 Play so a tap
  goes straight to the stream.

## Tech

React 18 · Vite 5 · Tailwind 3 · `vite-plugin-singlefile`. No backend yet —
everything is mock or generated JSON.

## Data sources & licensing

- Fixtures/live: football-data.org + API-Football (keys required).
- TV channels: published DR / TV 2 World Cup schedule.
- Archive photos: Wikimedia Commons, commercial-use licences only — credits in
  `docs/ATTRIBUTION.md`.
- Not affiliated with FIFA; no FIFA / "World Cup" marks used in the brand.

## Going live

The static front-end is **already deployed on Vercel** (www.rally.futbol). The
remaining work — Supabase schema, RLS, Realtime, the data + prediction workers,
the front-end port, and auth — is a complete build plan in
`docs/HANDOFF-backend.md`, with a definition-of-done checklist. Deploy into the
**existing** Vercel project (`rally`), don't create a new one.

## Status

Research / prototype — built to feel the product and validate the flow before the
backend.

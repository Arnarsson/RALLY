<div align="center">

# RALLY

**Find your game. Find your people.**

A match-night social app — find where Copenhagen is watching tonight's game, and
show up together. *We don't just watch the game. We rally for it.*

`React + Vite + Tailwind` · `Supabase` · mobile-first · real World Cup 2026 data

**[▶ Live — www.rally.futbol](https://www.rally.futbol)**

[Standalone: `RALLY — open me.html`](./RALLY%20—%20open%20me.html) ·
[Architecture (CLAUDE.md)](./CLAUDE.md) ·
[Roadmap](./docs/RALLY-10x-plan.md)

</div>

---

## What it is

A live, mobile-first match-night app. The whole core loop works end to end:

**Tonight** (live match schedule) → **Match** (AI "lowdown", head-to-head, teams,
who's going) → **Plan** (join + share card) → **Create a plan** → **Outfit** (style
for the game) → **Leaders**.

It runs on a **real Supabase backend** — schema, row-level security, and Realtime.
Plans, "going" counts, and live scores are real and shared across devices. The
standalone `file://` build keeps a self-contained demo mode (no backend) as a
fallback.

## What's built

- **Real fixtures** — the full 72-match World Cup 2026 group stage in Supabase:
  Copenhagen kickoff times, real venues, recent form, team colours.
- **Live scores** — a Supabase Edge Function (`live-scores`) runs every minute on
  `pg_cron` (guarded to match windows) and pulls scores from a **free public
  feed**. Cards show kickoff + a ticking countdown, flip to **● LIVE 67' · 2–1**
  when in play, then **FULL TIME** — all driven from the live table over Realtime.
- **Persistent, shared plans** — anonymous Supabase Auth, plans and live "going"
  counts stored in Postgres and synced across devices via Realtime.
- **Teams panel** — a collapsible per-match panel with full **squad lists** (48
  nations: players, positions, coach) and **all-time World Cup records** (sourced
  from Wikipedia), both stored in Supabase.
- **"Busiest tonight" banner** — the most-subscribed venue, which game is on
  there, and the headcount, on the Tonight screen.
- **"The numbers" analytics panel** — on every match: a win-probability bar plus
  both teams' recent form with points. Real model when predictions are populated,
  otherwise a form-based estimate (never blank).
- **Danish TV channel + watch links** — each fixture matched to its real
  broadcaster (DR1 / TV 2 / TV 2 Sport X); the chip deep-links to DRTV / TV 2 Play
  to stream it.
- **Match art from the teams** — national colours + flags, or for matches with
  history a real **B&W Creative-Commons photo** of the two teams (attributed,
  synced to Supabase); no-photo matches get a dark editorial panel, never a stock
  image.
- **Head-to-head** — a "last met" line (or "first-ever meeting").
- **AI "lowdown"** — a 30-second hype script per match (browser voice today).
- **Matchday poster** — an in-app Share sheet (`PosterCard`) plus a generated
  image at `/api/poster/[id].png` (`@vercel/og`): a 630×1120 portrait poster, or a
  1200×630 landscape share card (`?format=og`). Team-colour glow, the lime mark,
  flags, the lowdown, "N going".
- **Per-plan share unfurls** — when a friend pastes a `/p/<id>` link, an Edge
  middleware routes link-preview crawlers to `/api/p-og`, which names the actual
  match, venue and headcount in RALLY's voice with the landscape poster as the
  image. Humans pass straight through to the app.
- **Voice everywhere** — the splash, share copy, OG/Twitter meta and posters are
  all written in the SOUL.md voice (the cocky-but-warm football mate), never
  brand-deck plumbing.
- **Floodlight theme** — a neon-on-deep-ink look (lime / pink / violet / cyan,
  team-colour card spines, halftone grain). One-line toggle in `src/theme.js`
  (`ACTIVE_THEME`) flips back to the `classic` look.
- **Outfit** — the real brand-board shoot (hero, Women/Men looks, essentials),
  shopping via Miinto. **Leaders** + **Share card** for sponsorship and the viral
  loop.
- **Mobile-first & fast** — 48 flags bundled as data URIs (zero flag requests),
  momentum scroll, single-file standalone fallback.

## Backend (Supabase)

Live on Supabase: schema, row-level security, and Realtime. Tables: `matches`,
`venues`, `plans`, `plan_participants`, `profiles`, `predictions`, `squads`,
`team_records`. Scheduled work runs as Supabase **Edge Functions** on `pg_cron`:

| Function | Schedule | Does |
|---|---|---|
| `live-scores` | every minute (match-window guarded) | pulls live scores from a free public feed → `matches` |
| `sync-fixtures` | daily | refreshes the schedule |
| `sync-squads` | daily | refreshes squad lists |

The seed/build scripts in `source/scripts/` normalise external sources into the
same shape (`fetch-fixtures`, `fetch-channels`, `fetch-archive`). The UI only ever
reads one shape — whether it comes from Supabase or, in fallback demo mode, from
generated JSON. That adapter boundary is the whole design.

## Run / develop

```bash
cd source
npm install
npm run dev        # local dev server (phone frame on desktop)
npm run build      # → dist/index.html (single inlined file via vite-plugin-singlefile)
```

Then copy `dist/index.html` to `../RALLY — open me.html` to refresh the standalone.

## Key decisions

- **Live scores from a free public feed.** The `live-scores` Edge Function reads a
  free public scoreboard feed — no key, no quota — and only during match windows
  (a `pg_cron` job guarded so it isn't hammering the feed off-hours). The feed URL
  lives in a Supabase secret, never in the repo.
- **Anonymous auth first.** Supabase anonymous Auth lets anyone join and create
  plans with zero friction; the `profiles` row can be upgraded later. Plans and
  "going" counts persist in Postgres and sync over Realtime.
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

React 18 · Vite 5 · Tailwind 3 · `vite-plugin-singlefile` (front-end) ·
**Supabase** (Postgres + RLS + Realtime + Edge Functions + `pg_cron`) ·
`@vercel/og` for the poster image · `@vercel/edge` middleware + a serverless
`p-og` route for per-plan share unfurls. Front-end on Vercel (project `rally`,
www.rally.futbol); backend on Supabase.

## Data sources & licensing

- Live scores: a free public scoreboard feed (no key) via the `live-scores` Edge
  Function.
- TV channels: published DR / TV 2 World Cup schedule.
- Squads + records: openly published listings (records sourced from Wikipedia).
- Archive photos: Wikimedia Commons, commercial-use licences only — credits in
  `docs/ATTRIBUTION.md`.
- Not affiliated with FIFA; no FIFA / "World Cup" marks used in the brand.

## Status

**Live.** Real Supabase backend (schema, RLS, Realtime, Edge Functions on
`pg_cron`) behind www.rally.futbol; 72 real WC2026 fixtures with live scores,
persistent shared plans, squads, and all-time records. The standalone `file://`
build keeps a no-backend demo mode as a fallback.

# RALLY — match-night app

*Find where Copenhagen is watching tonight's match, and join them.*

A mobile-first app for the core loop, **live on a real Supabase backend**. The
full 2026 World Cup schedule, live scores, persistent plans, and shared "going"
counts are all real and synced across devices via Realtime. The standalone
`file://` build keeps a self-contained demo mode (no backend) as a fallback.

---

## Backend (Supabase)

Schema, row-level security, and Realtime are live on Supabase. Tables: `matches`,
`venues`, `plans`, `plan_participants`, `profiles`, `predictions`, `squads`,
`team_records`. Scheduled work runs as **Edge Functions** on `pg_cron`:

- `live-scores` — every minute (guarded to match windows), pulls live scores from
  a **free public feed** (no key, no scraping) into `matches`.
- `sync-fixtures` — daily schedule refresh.
- `sync-squads` — daily squad refresh.

The feed URL lives in a Supabase secret, never in the repo. The app reads the
tables over Realtime; the seed/build scripts below produce the same shape so the
UI never changes.

## Build / seed scripts (`src/data/fixtures.json` shape)

```bash
npm run fixtures                       # whole group stage
node scripts/fetch-fixtures.mjs 20260611 20260614   # a date window
npm run channels                       # Danish TV channel per match (DR/TV2)
npm run archive                        # CC/PD archive photo per match (Commons)
```

These normalise external sources into our shape and back the fallback demo mode;
the hand-authored editorial matches are merged on top.

---

## Run it (you already have everything installed)

From this folder:

```bash
npm run dev
```

Then open the URL it prints (e.g. `http://localhost:5173`).

**To demo on your phone (recommended for the pitch):**
The terminal also prints a `Network:` URL like `http://192.168.x.x:5173`.
Open that on your phone *while on the same Wi-Fi as your laptop*. It looks and
feels like a real app. Add to Home Screen for full-screen.

On a laptop it renders inside a phone frame automatically.

---

## What's in the app

The whole core loop works, with real Copenhagen data:

1. **Tonight** — today's & upcoming World Cup matches, your team (Denmark) featured, live "X going" counts (shared across devices via Realtime).
2. **Match → spots** — every venue with a plan: vibe, who's going, headcount. Plus a collapsible **Teams** panel (squad lists + all-time World Cup records).
3. **Plan detail** — host, note, the people going, **Join**, **Share**. Backed by Supabase + anonymous Auth, so plans persist.
4. **Create a plan** — pick venue, time, vibe, note → instantly live + shareable.
5. **Share card / poster** — the growth engine: an in-app Share sheet (`PosterCard`) and a generated Open Graph image (`/api/poster/[id].png`, `@vercel/og`) for WhatsApp/iMessage/IG.
6. **Leaders** — the simple sponsorship layer: 3 recognition categories, Unisport-branded. No points economy.

Joining, creating, and live scores all update live and persist.

---

## Theme

`src/theme.js` exposes a one-line `ACTIVE_THEME` toggle: **`floodlight`** (default
— neon-on-deep-ink: lime / pink / violet / cyan, team-colour card spines, halftone
grain) or **`classic`** (the original lime-on-ink look).

## Deploy

Front-end on Vercel (project `rally`, www.rally.futbol); backend on Supabase
(Postgres + RLS + Realtime + Edge Functions on `pg_cron`). `hasSupabase` gates the
backend so the standalone `file://` build still runs in demo mode with no backend.

## Stack
React + Vite + Tailwind, one screen file (`src/App.jsx`). Supabase for data, auth, and Realtime. Deliberately tiny so it's fast to change.

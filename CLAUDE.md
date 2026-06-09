# CLAUDE.md — guide for Claude Code

This file orients an AI agent (or human) working in the RALLY repo. Read it
first. The brand source-of-truth is a trinity: `SKILL.md` (the system — colours,
type, tokens), `SOUL.md` (the voice — who RALLY is, how every word is written),
and `RALLY-design-philosophy.md` ("Convergence" — the visual soul: the gathering
as pattern, rationed colour, charged darkness). For where the product is headed
read `docs/RALLY-10x-plan.md`.

## What RALLY is

A mobile-first social app for football match nights: *find where people are
watching tonight's match in Copenhagen, and show up together.* Tagline — **Find
your game. Find your people.** It is **live on a real Supabase backend** — schema,
row-level security, and Realtime. 72 real WC2026 fixtures with live scores,
persistent plans, shared "going" counts (across devices), squad lists, and
all-time World Cup records are all real. The standalone `file://` build keeps a
self-contained demo mode (no backend) as a fallback via `hasSupabase`.

## Repo layout

```
RALLY/
├── RALLY — open me.html     # standalone build — double-click to run, no server
├── CLAUDE.md                # you are here
├── SKILL.md                 # the brand system (colours, type, voice)
├── READ ME FIRST.md         # non-technical "just look at it" guide
├── docs/
│   ├── RALLY-10x-plan.md    # product roadmap (data → real-time → social → …)
│   ├── ATTRIBUTION.md       # image credits (CC licences must be honoured)
│   ├── PITCH-Sven.md        # 60-sec pitch script
│   ├── RALLY-brand-guidelines.md
│   └── STORE-LISTING.md
├── worker/
│   └── predict.py           # penaltyblog prediction worker (stub)
└── source/                  # the app (React + Vite + Tailwind + Supabase)
    ├── src/
    │   ├── App.jsx          # entire UI (single file by design)
    │   ├── theme.js         # ACTIVE_THEME toggle — 'floodlight' (default) | 'classic'
    │   ├── data/
    │   │   ├── mockData.js     # editorial matches + venues/plans/people; fallback demo data
    │   │   ├── fixtures.json    # GENERATED — real WC2026 data (do not hand-edit)
    │   │   ├── flags.js        # GENERATED — 48 country flags as data URIs (no network)
    │   │   └── outfitImages.js  # GENERATED — brand-board outfit crops (data URIs)
    │   ├── index.css
    │   └── main.jsx
    ├── scripts/             # seed/build data pipeline (see below)
    └── vite.config.js       # react + vite-plugin-singlefile
```

(Supabase Edge Functions — `live-scores`, `sync-fixtures`, `sync-squads` — and the
`/api/poster/[id].png` route also live in `source/`.)

## Deployment (LIVE)

- **Front-end** — live on **Vercel** (project `rally`, account `arnarsson`) at
  **www.rally.futbol** (and `rally-ecru.vercel.app`). Deploy into the **existing**
  Vercel project, never a new one.
- **Backend** — live on **Supabase** (project `owxofpjcfymgjgrctnab`): schema,
  RLS, Realtime, and Edge Functions on `pg_cron` (see Data pipeline). The feed URL
  for live scores lives in a Supabase secret, never in the repo.
- **Fallback** — the standalone `file://` build runs in demo mode (no backend),
  gated by `hasSupabase`.

## Commands

```bash
cd source
npm install
npm run dev            # local dev server (phone frame on desktop)
npm run build          # → dist/index.html, fully inlined (vite-plugin-singlefile)
npm run fixtures       # regenerate src/data/fixtures.json (schedule + live status)
npm run channels       # match each fixture to its Danish TV channel (DR/TV2)
npm run archive        # find a CC/PD archive photo per fixture (Wikimedia Commons)
```

After `npm run build`, copy `dist/index.html` to `../RALLY — open me.html` to
refresh the standalone. The standalone is opened via `file://`, so the build must
be single-file (the singlefile plugin handles this) and asset paths in
`index.html` are relative (`./icon.svg`).

## Architecture

- **One-file UI.** `src/App.jsx` is the whole app on purpose — easy to scan and to
  inline. Screens: splash → onboarding → Tonight (match list) → Match detail
  (AI "lowdown", the numbers, head-to-head, Teams panel, spots) → Plan detail
  (join/share/poster) → Create plan → Outfit → Leaders. Navigation is a simple
  view stack in `App` state.
- **Data adapter pattern (important).** The UI only ever reads our own shape.
  Live, that shape comes from **Supabase** over Realtime; in fallback demo mode it
  comes from `mockData.js` (which merges the generated `fixtures.json` with the
  hand-authored editorial matches). `hasSupabase` gates which path is used.
  **Swapping data sources never touches the UI** — same `MATCHES`, `VENUES`,
  `PLANS` shape either way.
- **Persistent social.** Plans, `plan_participants`, and live "going" counts are
  real Postgres rows under RLS, written via anonymous Supabase Auth and pushed to
  every device over Realtime.
- **Theme.** `src/theme.js` exposes a one-line `ACTIVE_THEME` toggle — `floodlight`
  (default) or `classic`.
- **Editorial + live merge (demo mode).** `mockData.js` keeps 6 hand-written
  "hero" matches (commentary, fun facts, head-to-head, attached plans/people),
  enriches them with data matched by team pair, and appends the rest of the
  schedule from `fixtures.json`. Brand badges (featured/marquee) come from
  booleans, not the day string, so day-grouping stays clean.

## Data pipeline

### Live — Supabase Edge Functions on `pg_cron`

| Function | Schedule | Does |
|---|---|---|
| `live-scores` | every minute, **match-window guarded** | reads a **free public feed** (no key, no quota) and writes scores/clock/status into `matches`. Realtime pushes to clients |
| `sync-fixtures` | daily | refreshes the schedule into `matches` |
| `sync-squads` | daily | refreshes `squads` (48 nations: players, positions, coach) |

Tables: `matches`, `venues`, `plans`, `plan_participants`, `profiles`,
`predictions`, `squads`, `team_records` (48 all-time World Cup records, sourced
from Wikipedia). Match-detail hero archive photos are also synced to Supabase.
Never name the live-scores provider — it's "a free public feed". Its URL lives in
a Supabase secret, never in the repo.

### Seed/build scripts (`source/scripts/`) — produce the fallback shape

| Script | Source | Writes | Notes |
|---|---|---|---|
| `fetch-fixtures.mjs` | external schedule source | `fixtures.json` | Schedule, Copenhagen kickoff, venues, form, colours, flag logos, win-prob from odds, live-status fields |
| `fetch-channels.mjs` | Published DR/TV 2 guide (digitalt.tv) | `fixtures.json` `.tv` | Matches fixture→channel by **team pair** (unique key). `--source sample` for offline seed |
| `fetch-archive.mjs` | Wikimedia Commons API | `fixtures.json` `.archive` | Only commercial-OK licences (CC BY / BY-SA / CC0 / PD — never NC/ND). Attribution required |

`src/data/flags.js` and `src/data/outfitImages.js` are also generated (one-off
node scripts — flag PNGs from flagcdn, and crops of the brand board — committed as
data URIs so the standalone stays self-contained and the list makes no flag
requests).

## Live-status model

Every match carries `status` (`pre` | `in` | `post`), `score_a/score_b`, `clock`,
`form_a/form_b`, `color_a/color_b`, `prob_a/prob_draw/prob_b`, `venue`, `tv`,
`archive`, `h2h`. The UI is live-aware: cards show a countdown when scheduled,
"● LIVE 67' · 2–1" when in play, and "FULL TIME" after. Live, the `live-scores`
Edge Function fills these in real time and Realtime pushes them to the cards.

## What the app surfaces now

- **Tonight** — a "Busiest tonight" banner (most-subscribed venue + which game +
  headcount), then the full real schedule grouped by day. Live-aware cards
  (kickoff + countdown → live score → full time).
- **Match detail** — the AI "lowdown" (browser TTS today), a prominent
  **"the numbers"** analytics panel (win probability + recent form with points),
  a **head-to-head** line, a collapsible **Teams panel** (squad lists from
  `squads` + all-time World Cup records from `team_records`), and for fixtures
  with history a **B&W archive photo** of the two teams (Wikimedia Commons, CC,
  synced to Supabase). No-photo matches use a dark editorial team-colour panel,
  never a stock image.
- **Plans + poster** — join/create plans (persistent, shared); a Share sheet with
  an in-app **`PosterCard`** plus a generated Open Graph image at
  `/api/poster/[id].png` (`@vercel/og`) for social.
- **Watch links** — the TV-channel chips deep-link to where to stream:
  DR1/DR2 → DRTV, TV 2 family → TV 2 Play (broadcaster hub).
- **Outfit** — uses the real brand-board shoot (hero couple, Women/Men looks,
  essentials), embedded as data URIs; "Shop · Miinto".
- **Flags** — 48 country flags are bundled as data URIs (`src/data/flags.js`) so
  the dense fixture list makes **zero external flag requests** (mobile perf).
- **Win probability** — real model when `predictions` is populated by the
  penaltyblog worker; otherwise a form-based estimate so the bar is never blank.

## Conventions & gotchas

- **Brand:** the active theme is **Floodlight** by default — neon on deep ink
  (Ink `#0B0B0B`, Lime `#A8FF00`, Pink `#FF2D7A`, Violet `#7B61FF`, Cyan
  `#00C2FF`), team-colour card spines, halftone grain. `src/theme.js`
  `ACTIVE_THEME = 'classic'` restores the original lime-on-ink look. Archivo Black
  headlines, Instrument Serif italics, Inter body. Follow `SKILL.md`.
- **Legal:** never use "FIFA"/"World Cup" marks or logos in the brand. Danish TV
  channels are real where matched, illustrative otherwise. Commons images **must**
  keep their attribution (`docs/ATTRIBUTION.md`, rendered in-app).
- **`fixtures.json` is generated** — re-run the scripts, don't hand-edit.
- **Standalone build must stay single-file** and use relative asset paths.
- **No secrets in the repo.** Use `source/.env.example` → `.env`.

## Where this is going

The backend is live (Supabase: schema, RLS, Realtime, Edge Functions on
`pg_cron`). `docs/RALLY-10x-plan.md` has the full roadmap for what's next — richer
predictions, per-match deep links, social graph, and broader venue coverage.

# CLAUDE.md — guide for Claude Code

This file orients an AI agent (or human) working in the RALLY repo. Read it
first. For the brand system read `SKILL.md`; for where the product is headed read
`docs/RALLY-10x-plan.md`; for the backend/deploy work read
`docs/HANDOFF-backend.md`.

## What RALLY is

A mobile-first social app for football match nights: *find where people are
watching tonight's match in Copenhagen, and show up together.* Tagline — **Find
your game. Find your people.** Today this repo is a high-fidelity, fully
interactive **front-end prototype**. Social data (plans, people, venues) is mock;
**fixtures, Danish TV channels, and archival match photos are real**.

## Repo layout

```
RALLY/
├── RALLY — open me.html     # standalone build — double-click to run, no server
├── CLAUDE.md                # you are here
├── SKILL.md                 # the brand system (colours, type, voice)
├── READ ME FIRST.md         # non-technical "just look at it" guide
├── docs/
│   ├── RALLY-10x-plan.md    # product roadmap (data → real-time → social → …)
│   ├── HANDOFF-backend.md   # Supabase + Vercel build plan for going live
│   ├── ATTRIBUTION.md       # image credits (CC licences must be honoured)
│   ├── PITCH-Sven.md        # 60-sec pitch script
│   ├── RALLY-brand-guidelines.md
│   └── STORE-LISTING.md
├── worker/
│   └── predict.py           # penaltyblog prediction worker (stub) — Phase D
└── source/                  # the app (React + Vite + Tailwind)
    ├── src/
    │   ├── App.jsx          # entire UI (single file by design)
    │   ├── data/
    │   │   ├── mockData.js     # editorial matches + venues/plans/people; merges fixtures.json
    │   │   ├── fixtures.json    # GENERATED — real WC2026 data (do not hand-edit)
    │   │   ├── flags.js        # GENERATED — 48 country flags as data URIs (no network)
    │   │   └── outfitImages.js  # GENERATED — brand-board outfit crops (data URIs)
    │   ├── index.css
    │   └── main.jsx
    ├── scripts/             # data pipeline (see below)
    └── vite.config.js       # react + vite-plugin-singlefile
```

## Live deployment

Already live on **Vercel** (project `rally`, account `arnarsson`): the static
front-end at **www.rally.futbol** (and `rally-ecru.vercel.app`). `vercel deploy
--prod` from a folder containing the standalone `index.html` redeploys. The full
backend deploy (Supabase + workers) is the next step — see `docs/HANDOFF-backend.md`;
CC should deploy into the **existing** Vercel project, not create a new one.

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
  (AI "lowdown", head-to-head, spots) → Plan detail (join/share) → Create plan →
  Outfit → Leaders. Navigation is a simple view stack in `App` state.
- **Data adapter pattern (important).** The UI only ever reads our own shape. The
  `scripts/` fetchers normalise an external source into `fixtures.json`;
  `mockData.js` merges that with the hand-authored editorial matches and exposes
  `MATCHES`, `VENUES`, `PLANS`, etc. **Swapping data sources never touches the
  UI** — it's a change in `scripts/` only. This is the key to the roadmap.
- **Editorial + live merge.** `mockData.js` keeps 6 hand-written "hero" matches
  (commentary, fun facts, head-to-head, and the plans/people attached to them),
  enriches them with live data matched by team pair, and appends the rest of the
  real schedule from `fixtures.json`. Brand badges (featured/marquee) come from
  booleans, not the day string, so day-grouping stays clean.

## Data pipeline (`source/scripts/`)

| Script | Source | Writes | Notes |
|---|---|---|---|
| `fetch-fixtures.mjs` | ESPN hidden API (⚠️ migrating to football-data.org `WC`) | `fixtures.json` | Schedule, Copenhagen kickoff, venues, form, colours, flag logos, win-prob from odds, live-status fields |
| `fetch-channels.mjs` | Published DR/TV 2 guide (digitalt.tv) | `fixtures.json` `.tv` | Matches fixture→channel by **team pair** (unique key). `--source sample` for offline seed |
| `fetch-archive.mjs` | Wikimedia Commons API | `fixtures.json` `.archive` | Only commercial-OK licences (CC BY / BY-SA / CC0 / PD — never NC/ND). Attribution required |

`src/data/flags.js` and `src/data/outfitImages.js` are also generated (one-off
node scripts — flag PNGs from flagcdn, and crops of the brand board — committed as
data URIs so the standalone stays self-contained and the list makes no flag
requests).

**Migration note:** `fetch-fixtures.mjs` currently reads ESPN. The roadmap (and
`HANDOFF-backend.md`) replaces this with **football-data.org** (European, free,
`WC` code) and **API-Football** for live. Keep the output shape identical so the
UI and the other two scripts are unaffected.

## Live-status model

Every match carries `status` (`pre` | `in` | `post`), `score_a/score_b`, `clock`,
`form_a/form_b`, `color_a/color_b`, `prob_a/prob_draw/prob_b`, `venue`, `tv`,
`archive`, `h2h`. The UI is already live-aware: cards show a countdown when
scheduled, "● LIVE 67' · 2–1" when in play, and "FULL TIME" after. These fields
are static today; the backend worker fills them in real time (see handoff).

## What the app surfaces now

- **Tonight** — a "Busiest tonight" banner (most-subscribed venue + which game +
  headcount), then the full real schedule grouped by day. Live-aware cards
  (kickoff + countdown → live score → full time).
- **Match detail** — the AI "lowdown" (browser TTS today), a prominent
  **"the numbers"** analytics panel (win probability + recent form with points),
  a **head-to-head** line, and for fixtures with history a **B&W archive photo**
  of the two teams (Wikimedia Commons, CC). No-photo matches use a dark editorial
  team-colour panel (cohesive with the photos), never a stock image.
- **Watch links** — the TV-channel chips deep-link to where to stream:
  DR1/DR2 → DRTV, TV 2 family → TV 2 Play. (Currently the broadcaster hub; capture
  per-match deep links in the backend — see handoff.)
- **Outfit** — uses the real brand-board shoot (hero couple, Women/Men looks,
  essentials), embedded as data URIs; "Shop · Miinto".
- **Flags** — 48 country flags are bundled as data URIs (`src/data/flags.js`) so
  the dense fixture list makes **zero external flag requests** (mobile perf).
- **Win probability** — real model when `predictions` is populated by the
  penaltyblog worker; otherwise a form-based estimate so the bar is never blank.

## Conventions & gotchas

- **Brand:** dark/ink base, lime `#8ACE00` hero, Archivo Black headlines,
  Instrument Serif italics, Inter body. Follow `SKILL.md`.
- **Legal:** never use "FIFA"/"World Cup" marks or logos in the brand. Danish TV
  channels are real where matched, illustrative otherwise. Commons images **must**
  keep their attribution (`docs/ATTRIBUTION.md`, rendered in-app).
- **`fixtures.json` is generated** — re-run the scripts, don't hand-edit.
- **Standalone build must stay single-file** and use relative asset paths.
- **No secrets in the repo.** Use `source/.env.example` → `.env`.

## Where this is going

`docs/RALLY-10x-plan.md` has the full roadmap. The immediate next step is the
backend: `docs/HANDOFF-backend.md` is a complete build plan to take this prototype
live on Vercel + Supabase (schema, data workers, auth, realtime).

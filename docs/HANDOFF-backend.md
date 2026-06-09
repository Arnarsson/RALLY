# RALLY — backend & deploy handoff (for Claude Code)

Goal: take the front-end prototype in this repo and make it **fully live on
Vercel**, backed by **Supabase** (Postgres + Auth + Realtime), fed by European
football data. The UI already reads a clean shape (`mockData.js`), so the job is
to (1) stand up the database, (2) build the data workers, (3) swap the app's mock
imports for Supabase reads + realtime, (4) deploy.

Read `CLAUDE.md` first for architecture. Keep the **data-adapter pattern**: the UI
shape must not change; workers normalise external APIs into our tables.

---

## 0. Accounts & secrets

Create and put in Vercel/Supabase env (`source/.env.example` lists them):
- **Supabase** project → `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`; expose `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  to the client.
- **football-data.org** API token (`FOOTBALL_DATA_TOKEN`) — free, competition
  code `WC`.
- **API-Football** key (`API_FOOTBALL_KEY`) — live scores/events/lineups, 15s.
- Optional: `ELEVENLABS_API_KEY` (custom "lowdown" voice).

---

## 1. Database schema (Supabase / Postgres)

The field names already match the prototype's mock objects, so the UI port is
mechanical. Suggested DDL:

```sql
-- profiles (1:1 with auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  flag text,                       -- emoji or ISO code
  color text default '#8ACE00',
  created_at timestamptz default now()
);

create table venues (
  id text primary key,
  name text not null, area text, emoji text,
  vibe_tags text[] default '{}', capacity int, big_screen bool default false,
  lat double precision, lng double precision
);

create table matches (
  id text primary key,             -- e.g. wc_760415
  team_a text, flag_a text, logo_a text, color_a text, form_a text,
  team_b text, flag_b text, logo_b text, color_b text, form_b text,
  kickoff_utc timestamptz, kickoff_local text, day text, stage text, venue text,
  tv jsonb,                        -- [{name, free}]
  status text default 'pre',       -- pre | in | post
  score_a int, score_b int, clock text, completed bool default false,
  prob_a real, prob_draw real, prob_b real,
  archive jsonb,                   -- {src, credit, license, source}
  h2h jsonb,                       -- {last, score, note}
  featured bool default false, marquee bool default false,
  commentary text, fun_fact text
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  match_id text references matches(id) on delete cascade,
  venue_id text references venues(id),
  host_id uuid references profiles(id),
  time text, vibe text, note text, capacity_hint int,
  created_at timestamptz default now()
);

create table plan_participants (
  plan_id uuid references plans(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (plan_id, user_id)
);

-- model predictions (penaltyblog) — optional, powers win-prob + Super Predictor
create table predictions (
  match_id text references matches(id) on delete cascade primary key,
  prob_a real, prob_draw real, prob_b real, model text, updated_at timestamptz default now()
);
```

RLS: profiles/plans/plan_participants are user-writable (owner checks); matches/
venues/predictions are read-only to clients, written only by the service role.

Enable **Realtime** on `plan_participants` (live "going" counts) and `matches`
(live scores).

---

## 2. Data workers

Reuse the scripts in `source/scripts/` — change their output target from
`fixtures.json` to Supabase upserts (service-role key).

1. **Schedule (replace ESPN → football-data.org).** Rewrite `fetch-fixtures.mjs`
   to call `https://api.football-data.org/v4/competitions/WC/matches`
   (`X-Auth-Token: FOOTBALL_DATA_TOKEN`). Map to the `matches` columns above,
   converting kickoff to `Europe/Copenhagen`. Keep the exact field names. Run
   daily (Vercel Cron) + once at deploy.
2. **Live (API-Football).** A worker calling `/fixtures?live=all` (and
   `/fixtures?id=` for events/lineups) every ~15s during match windows; upsert
   `status/score_a/score_b/clock/completed` into `matches`. Realtime pushes to the
   app. Wire push notifications on goal/card events.
3. **Channels.** `fetch-channels.mjs` already matches fixture→Danish channel by
   team pair; point it at the `matches.tv` column. Run daily.
4. **Archive photos.** `fetch-archive.mjs` → `matches.archive`. Run once (static).
5. **Predictions (penaltyblog).** A small Python worker (penaltyblog: Dixon-Coles
   / Bivariate Poisson; data from FBref/Understat/Club Elo) writing
   `prob_a/draw/b` into `predictions` nightly. Powers the win-prob bar and a real
   Super Predictor leaderboard.

Scheduling options: Vercel Cron (`vercel.json`) for the JS workers, or Supabase
Edge Functions / `pg_cron`. The live worker needs a long-running/iterating host
(a small Fly.io/Railway service or a 15s-interval edge invocation).

---

## 3. Front-end port (`source/src`)

- Add `@supabase/supabase-js`; create `src/lib/supabase.js` from
  `VITE_SUPABASE_*`.
- Replace the imports in `mockData.js` with async loaders:
  `MATCHES` ← `select * from matches order by kickoff_utc`,
  `VENUES`, `PLANS` (+ join `plan_participants`). Keep the **same object shape** so
  `App.jsx` is untouched. The editorial extras (commentary, fun_fact, h2h) can
  live as columns on `matches` or a small `match_editorial` table merged client-side.
- **Realtime:** subscribe to `plan_participants` → live "going" counts; subscribe
  to `matches` → live scores/clock (the UI is already live-aware).
- **Auth:** Supabase Auth (phone / Apple / Google). The existing onboarding screen
  becomes the post-sign-in profile step; persist to `profiles`.
- **Join/Create/Share** already mutate local state — repoint to Supabase
  insert/delete on `plans` / `plan_participants`.

---

## 4. Deploy to Vercel

- Import the GitHub repo. **Root directory: `source`.** Framework: Vite. Build:
  `npm run build`. Output dir: `dist`.
- Add all env vars (server + `VITE_` client vars).
- `vercel.json` for cron (example):

```json
{
  "crons": [
    { "path": "/api/sync-fixtures", "schedule": "0 4 * * *" },
    { "path": "/api/sync-channels", "schedule": "30 4 * * *" },
    { "path": "/api/sync-predictions", "schedule": "0 3 * * *" }
  ]
}
```

  Implement those as `source/api/*.js` serverless functions wrapping the workers.
  The 15s live worker runs off-Vercel (Fly/Railway) or as a frequent edge job.
- PWA: `manifest.webmanifest` + icons are already present; add a service worker
  for offline schedule + installability.

---

## 5. Definition of done

- [ ] Supabase schema + RLS live; Realtime on `plan_participants` and `matches`.
- [ ] Daily workers populating `matches`, `tv`, `archive`, `predictions`.
- [ ] Live worker updating scores every ~15s during matches.
- [ ] App reads Supabase (same shape), with auth + persistent plans.
- [ ] Live "going" counts update across devices.
- [ ] Deployed on Vercel with env + cron; PWA installable.
- [ ] No secrets committed; attribution preserved (`ATTRIBUTION.md`).

See `RALLY-10x-plan.md` for the phased product roadmap this implements.

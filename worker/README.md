# RALLY workers

Two backend workers that keep Supabase fresh. They run **off Vercel** (Vercel
functions are short-lived; these are long-running / scheduled). Everything they
write is read by the app via Supabase — swapping or restarting a worker never
touches the UI.

| Worker | What it does | Cadence | Writes |
|---|---|---|---|
| `live.mjs` | Polls API-Football for in-play fixtures, upserts live scores/minutes | always-on, ~15s loop | `matches` (status, score_a, score_b, clock, completed) |
| `predict.py` | Fits a penaltyblog Dixon-Coles model, predicts win/draw/win | nightly | `predictions` (match_id pk, prob_a/draw/b, model, updated_at) |

The schedule/metadata workers (`fetch-fixtures.mjs`, `fetch-channels.mjs`,
`fetch-archive.mjs`) live in `../source/scripts/` and own everything else in
`matches`. This directory owns only live scores + predictions.

---

## How matches are keyed

Our match ids are `wc_<footballdata_id>` (set by `fetch-fixtures.mjs`), so the
live worker can't join on the API-Football fixture id. Instead — exactly like
`fetch-channels.mjs` — it matches on the **team pair**:

1. Load all `matches` rows once (refreshed hourly), build an index from a
   normalised, order-independent `pairKey(team_a, team_b)` to `match.id`.
2. For each live API-Football fixture, build the same key from its two team
   names and look up the row. A small `ALIAS` table reconciles naming
   differences (e.g. API-Football "Korea Republic" → "South Korea").
3. Update only the live fields on that row.

`predict.py` keys directly on `matches.id` (it reads pre-match rows straight
from Supabase and writes `predictions.match_id = matches.id`).

---

## Env vars

Copy `../source/.env.example` → `.env` and fill in. The workers read from the
process environment:

- `live.mjs`: `API_FOOTBALL_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (optional: `POLL_MS`, `BACKOFF_MS`)
- `predict.py`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Use the **service-role** key — these workers write to read-only-to-clients
tables. Never ship the service-role key to the frontend.

---

## Run locally

### Live worker (Node)

```bash
cd worker
npm install                        # installs @supabase/supabase-js
API_FOOTBALL_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node live.mjs
```

Logs one line per tick: `… tick ok — N fixture(s) updated`. Ctrl-C (SIGINT) or
SIGTERM shuts it down cleanly after the current tick. On a 429 it backs off
(`BACKOFF_MS`, default 60s) and resumes.

### Predictions worker (Python)

```bash
cd worker
pip install -r requirements.txt
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… python predict.py
```

> `load_results()` currently returns a **SAMPLE** results set so the script
> runs end-to-end. Swap in a real source (penaltyblog FBref/Understat/Club Elo
> scrapers, or your own results table) — see the TODO in `predict.py`.

---

## Where to host

Both are designed for an always-on / scheduled container, **not** Vercel.

### Coolify (Sven's Hetzner box — recommended)

- **Live worker:** deploy `worker/` as a long-running app (Nixpacks/Node).
  Start command `node live.mjs`. Set the three env vars. Health = the process
  staying up; add a restart-on-crash policy. One replica is enough.
- **Predictions:** a Coolify **Scheduled Task** (cron `0 3 * * *`) running
  `python predict.py` from the same image, or a tiny separate Python service.

### Alternatives

- **Fly.io / Railway:** `live.mjs` as a worker process (no public port needed);
  `predict.py` as a cron/scheduled machine.
- The live loop already tolerates restarts (it rebuilds its index on boot), so a
  container that restarts on deploy is fine.

---

## v1 caveats / TODO

- `live.mjs` polls always-on every 15s. v2: only poll inside match windows
  (read kickoff times from `matches`, sleep between) to save API quota — flagged
  in-code.
- Push notifications on goals/cards are out of scope — `// TODO(push)` marks
  where to diff scores and fire events.
- `predict.py` uses a sample results set — wire a real historical source before
  trusting the numbers.

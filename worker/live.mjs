#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — live-score worker (API-Football)
//
// Phase D, §2.2 of docs/HANDOFF-backend.md. A long-running loop that polls
// API-Football for every in-play fixture every ~15s and upserts the live
// fields into Supabase `matches` so the app (subscribed to Supabase Realtime)
// shows live scores and minutes without touching the UI.
//
// Endpoint: GET https://v3.football.api-sports.io/fixtures?live=all
//   Auth header: x-apisports-key: <API_FOOTBALL_KEY>
//
// Keying — how an API-Football fixture finds OUR row:
//   Our match ids are 'wc_<footballdata_id>' (see fetch-fixtures.mjs), so we
//   can't join on the provider id. Instead, exactly like fetch-channels.mjs,
//   we match on the *team pair*: a normalised, order-independent key built
//   from the two team names (`pairKey`). We load all `matches` once at start
//   (and refresh hourly), build a pairKey -> match.id index, and look each
//   live fixture up in it. A small ALIAS table reconciles API-Football's team
//   names with football-data's (e.g. "South Korea" vs "Korea Republic").
//
// We update ONLY the live fields: status ('in' | 'post'), score_a, score_b,
// clock (elapsed minute + "'"), completed. Pre-match metadata (kickoff, teams,
// venue, tv, …) is owned by fetch-fixtures.mjs and never overwritten here.
//
// Designed to run OFF Vercel as an always-on container (Coolify / Fly /
// Railway) — see README.md. A simple always-on 15s loop is fine for v1; it
// backs off on 429 (rate-limit). Ideally we'd only poll inside match windows;
// that's a v2 optimisation (read kickoff times from `matches` and sleep
// between windows) — flagged below.
//
// Usage:
//   API_FOOTBALL_KEY=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
//     node live.mjs
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js'

// --- config -----------------------------------------------------------------
const API_KEY = process.env.API_FOOTBALL_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const API_URL = 'https://v3.football.api-sports.io/fixtures?live=all'
const POLL_MS = Number(process.env.POLL_MS || 15_000)   // ~15s baseline
const BACKOFF_MS = Number(process.env.BACKOFF_MS || 60_000) // on 429 / error
const INDEX_REFRESH_MS = 60 * 60 * 1000                 // re-read matches hourly

// --- team-name normalisation (mirrors fetch-channels.mjs) -------------------
const norm = (s) => (s || '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim()
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('~')

// API-Football team name -> the canonical name football-data/our `matches`
// table uses. Extend as live tournaments surface mismatches.
const ALIAS = {
  'korea republic': 'south korea',
  'south korea': 'south korea',
  'ir iran': 'iran',
  'usa': 'usa',
  'united states': 'usa',
  'czech republic': 'czechia',
  'türkiye': 'türkiye',
  'turkey': 'türkiye',
  'côte d’ivoire': 'ivory coast',
  "côte d'ivoire": 'ivory coast',
  'dr congo': 'congo dr',
  'congo dr': 'congo dr',
  'bosnia and herzegovina': 'bosnia-herz',
  'bosnia-herzegovina': 'bosnia-herz',
  'cabo verde': 'cape verde',
}
const canon = (name) => ALIAS[norm(name)] || norm(name)
const teamPair = (a, b) => [canon(a), canon(b)].sort().join('~')

// --- logging ----------------------------------------------------------------
const log = (...args) => console.log(new Date().toISOString(), ...args)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- supabase ---------------------------------------------------------------
function makeClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see ../source/.env.example)')
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
}

// Build a pairKey -> match.id index from the `matches` table. Cached and
// refreshed hourly so newly-scheduled fixtures get picked up without a restart.
async function loadMatchIndex(sb) {
  const { data, error } = await sb.from('matches').select('id, team_a, team_b')
  if (error) throw new Error(`load matches failed: ${error.message}`)
  const index = new Map()
  for (const m of data || []) index.set(teamPair(m.team_a, m.team_b), m.id)
  log(`indexed ${index.size} matches by team pair`)
  return index
}

// --- API-Football -----------------------------------------------------------
async function fetchLive() {
  const r = await fetch(API_URL, { headers: { 'x-apisports-key': API_KEY } })
  if (r.status === 429) {
    const err = new Error('rate-limited (429)')
    err.rateLimited = true
    throw err
  }
  if (!r.ok) throw new Error(`API-Football HTTP ${r.status} ${r.statusText}`)
  const json = await r.json()
  // API-Football wraps results in `response`; `errors` is an object/array on fault.
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`)
  }
  return json.response || []
}

// Map an API-Football live fixture to RALLY's live `matches` columns. The
// provider's status.short tells us the phase; status.elapsed is the minute.
//   1H/2H/ET/BT/P/LIVE/HT  -> in
//   FT/AET/PEN             -> post
// Anything else (NS/PST/CANC/…) we skip — those aren't "live".
function mapLive(fx) {
  const short = fx.fixture?.status?.short
  const elapsed = fx.fixture?.status?.elapsed
  const goals = fx.goals || {}

  const IN = new Set(['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'HT', 'INT'])
  const POST = new Set(['FT', 'AET', 'PEN'])

  let status
  if (IN.has(short)) status = 'in'
  else if (POST.has(short)) status = 'post'
  else return null // not a state we surface

  return {
    home: fx.teams?.home?.name,
    away: fx.teams?.away?.name,
    fields: {
      status,
      score_a: Number(goals.home ?? 0),
      score_b: Number(goals.away ?? 0),
      clock: status === 'in' && elapsed != null ? `${elapsed}'` : (status === 'post' ? null : null),
      completed: status === 'post',
    },
  }
}

// One poll: fetch live fixtures, resolve each to our match id, upsert the
// live fields. Returns the number of rows updated.
async function tick(sb, index) {
  const live = await fetchLive()
  let updated = 0
  let unmatched = 0

  for (const fx of live) {
    const m = mapLive(fx)
    if (!m) continue
    const id = index.get(teamPair(m.home, m.away))
    if (!id) {
      unmatched++
      continue
    }
    // Upsert only the live fields against the existing row (by primary key id).
    const { error } = await sb
      .from('matches')
      .update(m.fields)
      .eq('id', id)
    if (error) {
      log(`  update ${id} failed: ${error.message}`)
      continue
    }
    updated++
    // TODO(push): diff score_a/score_b against the previous tick and fire a
    // push notification (and a card-event feed) on goals/red cards. Out of
    // scope for v1 — needs an events fetch (/fixtures?id=) + a notifications
    // table + Expo/web-push. See HANDOFF-backend.md §2.2.
  }

  if (unmatched) log(`  ${unmatched} live fixture(s) had no matching RALLY row (non-WC or alias gap)`)
  return updated
}

// --- main loop --------------------------------------------------------------
async function main() {
  if (!API_KEY) throw new Error('API_FOOTBALL_KEY must be set (see ../source/.env.example)')
  const sb = makeClient()

  let index = await loadMatchIndex(sb)
  let indexLoadedAt = Date.now()

  let running = true
  const stop = (sig) => {
    log(`received ${sig} — shutting down after current tick`)
    running = false
  }
  process.on('SIGINT', () => stop('SIGINT'))
  process.on('SIGTERM', () => stop('SIGTERM'))

  log(`live worker started — polling every ${POLL_MS / 1000}s`)

  while (running) {
    let wait = POLL_MS
    try {
      // Refresh the team-pair index hourly so new fixtures are picked up.
      if (Date.now() - indexLoadedAt > INDEX_REFRESH_MS) {
        index = await loadMatchIndex(sb)
        indexLoadedAt = Date.now()
      }
      const updated = await tick(sb, index)
      log(`tick ok — ${updated} fixture(s) updated`)
      // TODO(windows): if updated === 0 and no fixtures are due for a while,
      // sleep until the next kickoff (read from `matches`) to save quota.
    } catch (e) {
      if (e.rateLimited) {
        wait = BACKOFF_MS
        log(`rate-limited — backing off ${wait / 1000}s`)
      } else {
        log(`tick error: ${e.message}`)
        wait = BACKOFF_MS
      }
    }
    if (!running) break
    await sleep(wait)
  }

  log('stopped.')
  process.exit(0)
}

main().catch((e) => {
  console.error(new Date().toISOString(), 'fatal:', e.message)
  process.exit(1)
})

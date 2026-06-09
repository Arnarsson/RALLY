#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — live fixtures fetcher
//
// Pulls the REAL 2026 FIFA World Cup schedule from football-data.org (v4) —
// a free, European, no-scraping JSON API (competition code "WC") — and
// rewrites it into RALLY's match shape: Copenhagen kickoff times, live
// status (scheduled / in-play / full-time), live score, recent form (n/a
// here), real venue.
//
// Endpoint: https://api.football-data.org/v4/competitions/WC/matches
//   Auth header: X-Auth-Token: <FOOTBALL_DATA_TOKEN>
//
// Usage:
//   node scripts/fetch-fixtures.mjs                  # whole competition
//   node scripts/fetch-fixtures.mjs 20260611 20260614  # a date window
//   FIXTURES_OUT=src/data/fixtures.json node scripts/fetch-fixtures.mjs
//   node scripts/fetch-fixtures.mjs --target=supabase  # upsert into Supabase
//
// --target=json (DEFAULT) writes src/data/fixtures.json (the standalone demo
//   reads this). --target=supabase upserts each match into the `matches`
//   table (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
//
// Production path: in the real app this runs on a backend cron every ~30s
// during live windows, writing into Supabase. The app just reads the table.
// Same JSON, same shape — swapping the data source never touches the UI.
// ---------------------------------------------------------------------------

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const COMP = 'WC'
const BASE = `https://api.football-data.org/v4/competitions/${COMP}/matches`
const TOKEN = process.env.FOOTBALL_DATA_TOKEN
const TZ = 'Europe/Copenhagen'
const OUT = process.env.FIXTURES_OUT || 'src/data/fixtures.json'

// Team code (TLA) -> flag emoji. Covers the 2026 field + likely qualifiers;
// unknown codes fall back to 🏴 so the app never renders blank.
const FLAG = {
  MEX:'🇲🇽', RSA:'🇿🇦', KOR:'🇰🇷', CZE:'🇨🇿', CAN:'🇨🇦', BIH:'🇧🇦', USA:'🇺🇸', PAR:'🇵🇾',
  QAT:'🇶🇦', SUI:'🇨🇭', BRA:'🇧🇷', MAR:'🇲🇦', ARG:'🇦🇷', FRA:'🇫🇷', ESP:'🇪🇸', ENG:'🏴',
  GER:'🇩🇪', POR:'🇵🇹', NED:'🇳🇱', BEL:'🇧🇪', CRO:'🇭🇷', URU:'🇺🇾', COL:'🇨🇴', JPN:'🇯🇵',
  SEN:'🇸🇳', SRB:'🇷🇸', POL:'🇵🇱', DEN:'🇩🇰', NOR:'🇳🇴', SWE:'🇸🇪', AUS:'🇦🇺', GHA:'🇬🇭',
  ECU:'🇪🇨', CMR:'🇨🇲', TUN:'🇹🇳', NGA:'🇳🇬', EGY:'🇪🇬', ALG:'🇩🇿', CRC:'🇨🇷', IRN:'🇮🇷',
  KSA:'🇸🇦', JOR:'🇯🇴', UZB:'🇺🇿', PAN:'🇵🇦', SCO:'🏴', ITA:'🇮🇹', TUR:'🇹🇷', UKR:'🇺🇦',
  WAL:'🏴', GRE:'🇬🇷', IRL:'🇮🇪', CHI:'🇨🇱', PER:'🇵🇪', VEN:'🇻🇪', CIV:'🇨🇮', MLI:'🇲🇱',
  NZL:'🇳🇿', HON:'🇭🇳', JAM:'🇯🇲', CUW:'🇨🇼', HAI:'🇭🇹', CPV:'🇨🇻', RSA2:'🇿🇦',
}
const flag = (tla, name) => FLAG[tla] || '🏴'

const fmt = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts }).format(new Date(iso))
// "2026-06-11T19:00Z" -> { date:'2026-06-12', time:'21:00', day:'THU 11 JUN' }
function cph(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:false,
  }).formatToParts(new Date(iso)).reduce((a,p)=>(a[p.type]=p.value,a),{})
  const date = `${parts.year}-${parts.month}-${parts.day}`
  let time = `${parts.hour}:${parts.minute}`
  if (time === '24:00') time = '00:00'
  const day = fmt(iso, { weekday:'short', day:'2-digit', month:'short' }).toUpperCase().replace(',', '')
  return { date, time, day, iso_local: `${date}T${time}` }
}

// Illustrative Danish broadcast (real DK rights vary; flagged illustrative,
// like the original mock). Marquee/openers default to free-to-air DR.
const dkTv = (hot) => hot ? [{ name:'DR1', free:true }] : [{ name:'TV2 Sport', free:false }]

// football-data status -> RALLY state (pre | in | post)
function mapStatus(s) {
  switch (s) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'in'
    case 'FINISHED':
      return 'post'
    case 'SCHEDULED':
    case 'TIMED':
    default:
      return 'pre'
  }
}

// Human-readable detail for the card subtitle.
function statusDetail(s, state) {
  if (state === 'in') return s === 'PAUSED' ? 'Half-time' : 'Live'
  if (state === 'post') return 'Full time'
  return 'Scheduled'
}

async function fetchMatches({ dateFrom, dateTo } = {}) {
  if (!TOKEN) throw new Error('FOOTBALL_DATA_TOKEN is not set (see .env.example)')
  const qs = new URLSearchParams()
  if (dateFrom) qs.set('dateFrom', dateFrom)
  if (dateTo) qs.set('dateTo', dateTo)
  const url = qs.toString() ? `${BASE}?${qs}` : BASE
  const r = await fetch(url, { headers: { 'X-Auth-Token': TOKEN, 'User-Agent': 'rally-fixtures/1.0' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`)
  return r.json()
}

function mapMatch(m) {
  const home = m.homeTeam || {}
  const away = m.awayTeam || {}
  const state = mapStatus(m.status)            // pre | in | post
  const { iso_local, day } = cph(m.utcDate)
  const ft = m.score?.fullTime || {}
  // RALLY renders team_a (home) v team_b (away)
  return {
    id: 'wc_' + m.id,
    fd_id: m.id,
    team_a: home.shortName || home.name || home.tla || 'TBD',
    flag_a: flag(home.tla, home.name),
    logo_a: home.crest || null,            // crisp crest image (cross-platform)
    color_a: null,                         // football-data has no team colour
    form_a: null,                          // not provided (UI _formProb fallback)
    team_b: away.shortName || away.name || away.tla || 'TBD',
    flag_b: flag(away.tla, away.name),
    logo_b: away.crest || null,
    color_b: null,
    form_b: null,
    prob_a: null, prob_draw: null, prob_b: null,  // no odds (form fallback downstream)
    kickoff: iso_local,                    // Copenhagen local, matches mock shape
    kickoff_utc: m.utcDate,
    day,
    stage: m.stage ? prettyStage(m.stage) : 'Knockout',
    venue: m.venue || null,
    tv: dkTv(false),
    // --- live status (auto-fills once the tournament kicks off) -------------
    status: state,                         // 'pre' | 'in' | 'post'
    status_detail: statusDetail(m.status, state),
    clock: state === 'pre' ? null : (m.minute != null ? `${m.minute}'` : null),
    completed: state === 'post',
    score_a: state === 'pre' ? null : Number(ft.home ?? 0),
    score_b: state === 'pre' ? null : Number(ft.away ?? 0),
  }
}

// football-data stage enum ("GROUP_STAGE", "ROUND_OF_16", "FINAL") -> label.
function prettyStage(stage) {
  if (stage === 'GROUP_STAGE') return 'Group Stage'
  return stage.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// "20260611" -> "2026-06-11" (football-data wants ISO date strings).
function isoDate(yyyymmdd) {
  return `${yyyymmdd.slice(0,4)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(6,8)}`
}

async function writeSupabase(fixtures) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for --target=supabase')
  const { createClient } = await import('@supabase/supabase-js')
  const supa = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await supa.from('matches').upsert(fixtures, { onConflict: 'id' })
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
  process.stderr.write(`\n✓ upserted ${fixtures.length} fixtures → Supabase matches\n`)
}

async function writeJson(out) {
  const payload = {
    source: 'football-data.org v4 (competitions/WC/matches)',
    league: COMP,
    fetched_at: new Date().toISOString(),
    timezone: TZ,
    count: out.length,
    fixtures: out,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(payload, null, 2))
  process.stderr.write(`\n✓ wrote ${out.length} fixtures → ${OUT}\n`)
}

async function main() {
  const args = process.argv.slice(2)
  const targetArg = args.find(a => a.startsWith('--target='))
  const target = targetArg ? targetArg.split('=')[1] : 'json'
  const positional = args.filter(a => !a.startsWith('--'))
  const [from, to] = positional

  // Optional date window (mirrors the old YYYYMMDD args). football-data also
  // caps a single request to a 10-day span, so a window is the safe default
  // when given; without args we pull the whole competition.
  const query = {}
  if (from) {
    query.dateFrom = isoDate(from)
    query.dateTo = isoDate(to || from)
  }

  let fixtures = []
  try {
    const data = await fetchMatches(query)
    for (const m of (data.matches || [])) fixtures.push(mapMatch(m))
    process.stderr.write(`  fetched ${data.matches?.length || 0} matches\n`)
  } catch (e) {
    process.stderr.write(`  ${e.message}\n`)
    throw e
  }

  // de-dupe + sort by kickoff
  const seen = new Set()
  const out = fixtures.filter(f => !seen.has(f.id) && seen.add(f.id))
    .sort((a,b) => a.kickoff_utc.localeCompare(b.kickoff_utc))

  if (target === 'supabase') {
    await writeSupabase(out)
  } else {
    await writeJson(out)
  }
}

main().catch(e => { console.error(e); process.exit(1) })

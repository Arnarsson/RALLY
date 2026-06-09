#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — live fixtures fetcher
//
// Pulls the REAL 2026 FIFA World Cup schedule from ESPN's hidden site API
// (the same "secret-identity" endpoint the Printing Press `espn` CLI sniffs —
// no key, no scraping, just JSON) and rewrites it into RALLY's match shape:
// Copenhagen kickoff times, live status (scheduled / in-play / full-time),
// live score, match minute, recent form, real venue.
//
// Endpoint: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
//
// Usage:
//   node scripts/fetch-fixtures.mjs                  # whole group stage
//   node scripts/fetch-fixtures.mjs 20260611 20260614  # a date window
//   FIXTURES_OUT=src/data/fixtures.json node scripts/fetch-fixtures.mjs
//
// Production path: in the real app this runs on a backend cron (or the
// `espn-pp-mcp` MCP server) every ~30s during live windows, writing into
// Supabase. The app just reads the table. Same JSON, same shape.
// ---------------------------------------------------------------------------

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const LEAGUE = 'fifa.world'
const BASE = `https://site.api.espn.com/apis/site/v2/sports/soccer/${LEAGUE}/scoreboard`
const TZ = 'Europe/Copenhagen'
const OUT = process.env.FIXTURES_OUT || 'src/data/fixtures.json'

// ESPN abbreviation -> flag emoji. Covers the 2026 field + likely qualifiers;
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
const flag = (abbr, name) => FLAG[abbr] || '🏴'

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

async function fetchDate(yyyymmdd) {
  const url = `${BASE}?dates=${yyyymmdd}`
  const r = await fetch(url, { headers: { 'User-Agent': 'rally-fixtures/1.0' } })
  if (!r.ok) throw new Error(`${yyyymmdd}: HTTP ${r.status}`)
  return r.json()
}

// American odds -> implied probability.
const implied = (o) => { const n = Number(o); if (!n) return null; return n < 0 ? (-n) / (-n + 100) : 100 / (n + 100) }

function mapEvent(ev) {
  const comp = ev.competitions[0]
  const home = comp.competitors.find(c => c.homeAway === 'home') || comp.competitors[0]
  const away = comp.competitors.find(c => c.homeAway === 'away') || comp.competitors[1]
  const t = comp.status?.type || {}
  const state = t.state || 'pre'            // pre | in | post
  const { date, time, day, iso_local } = cph(ev.date)
  // Win probability from moneyline odds (vig removed by normalising to 1).
  const ml = comp.odds?.[0]?.moneyline
  let prob = null
  if (ml) {
    const ph = implied(ml.home?.close?.odds ?? ml.home?.open?.odds)
    const pd = implied(ml.draw?.close?.odds ?? ml.draw?.open?.odds)
    const pa = implied(ml.away?.close?.odds ?? ml.away?.open?.odds)
    if (ph && pa) { const s = ph + (pd || 0) + pa; prob = { a: +(ph / s).toFixed(3), draw: pd ? +(pd / s).toFixed(3) : null, b: +(pa / s).toFixed(3) } }
  }
  // RALLY renders team_a (home) v team_b (away)
  return {
    id: 'wc_' + ev.id,
    espn_id: ev.id,
    team_a: home.team.shortDisplayName || home.team.name,
    flag_a: flag(home.team.abbreviation, home.team.name),
    logo_a: home.team.logo || null,        // crisp flag image (cross-platform)
    color_a: home.team.color ? '#' + home.team.color : null,
    form_a: home.form || null,             // e.g. "WWWDD"
    team_b: away.team.shortDisplayName || away.team.name,
    flag_b: flag(away.team.abbreviation, away.team.name),
    logo_b: away.team.logo || null,
    color_b: away.team.color ? '#' + away.team.color : null,
    form_b: away.form || null,
    prob_a: prob?.a ?? null, prob_draw: prob?.draw ?? null, prob_b: prob?.b ?? null,
    kickoff: iso_local,                    // Copenhagen local, matches mock shape
    kickoff_utc: ev.date,
    day,
    stage: (ev.season?.slug === 'group-stage' ? 'Group Stage' : (t.description || 'Knockout')),
    venue: comp.venue ? `${comp.venue.fullName}${comp.venue.address?.city ? ' · ' + comp.venue.address.city : ''}` : null,
    tv: dkTv(false),
    // --- live status (auto-fills once the tournament kicks off) -------------
    status: state,                         // 'pre' | 'in' | 'post'
    status_detail: t.shortDetail || t.detail || 'Scheduled',
    clock: comp.status?.displayClock || null,   // "67'"
    completed: !!t.completed,
    score_a: state === 'pre' ? null : Number(home.score ?? 0),
    score_b: state === 'pre' ? null : Number(away.score ?? 0),
  }
}

async function main() {
  const [from, to] = process.argv.slice(2)
  // Default window: group stage (11–27 Jun 2026). Pull the calendar to be exact.
  let dates = []
  if (from) {
    let d = new Date(`${from.slice(0,4)}-${from.slice(4,6)}-${from.slice(6,8)}T12:00:00Z`)
    const end = to ? new Date(`${to.slice(0,4)}-${to.slice(4,6)}-${to.slice(6,8)}T12:00:00Z`) : d
    while (d <= end) {
      dates.push(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`)
      d = new Date(d.getTime() + 864e5)
    }
  } else {
    const base = await fetchDate('20260611')
    const cal = base.leagues?.[0]?.calendar?.[0]?.entries || []
    const group = cal.find(e => /group/i.test(e.label)) || cal[0]
    let d = new Date(group.startDate), end = new Date(group.endDate)
    while (d <= end) {
      dates.push(`${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`)
      d = new Date(d.getTime() + 864e5)
    }
  }

  const fixtures = []
  for (const ymd of dates) {
    try {
      const data = await fetchDate(ymd)
      for (const ev of (data.events || [])) fixtures.push(mapEvent(ev))
      process.stderr.write(`  ${ymd}: ${data.events?.length || 0} matches\n`)
    } catch (e) {
      process.stderr.write(`  ${ymd}: ${e.message}\n`)
    }
  }
  // de-dupe + sort by kickoff
  const seen = new Set()
  const out = fixtures.filter(f => !seen.has(f.id) && seen.add(f.id))
    .sort((a,b) => a.kickoff_utc.localeCompare(b.kickoff_utc))

  const payload = {
    source: 'ESPN site API (fifa.world/scoreboard)',
    league: LEAGUE,
    fetched_at: new Date().toISOString(),
    timezone: TZ,
    count: out.length,
    fixtures: out,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(payload, null, 2))
  process.stderr.write(`\n✓ wrote ${out.length} fixtures → ${OUT}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })

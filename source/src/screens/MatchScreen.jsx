// Match detail — lazy-loaded (React.lazy in App.jsx). Pulls shared UI
// primitives back from App.jsx; that circular import is fine because this module
// only ever loads via dynamic import(), well after App's bindings are live. The
// payoff: none of this code (analytics, head-to-head, the Teams/rating panel)
// sits in the initial chunk that gates first paint on Tonight.
import { useState, useEffect } from 'react'
import {
  loadTeamExtras, venueById,
  ratePlayer, unratePlayer, matchRatings, myRatings, playerSlug, hasSupabase,
  demoPredictionsForMatch, predictionLabel, predictionOutcome, matchWinner,
} from '../data/mockData.js'
import { activeCategories, MAX_PICKS_PER_CATEGORY } from '../data/ratingConfig.js'
import PosterCard from '../components/PosterCard'
import {
  TopBar, MatchArt, MatchStatusLine, TvChips, Rundown, StickyBar, Pill,
  VibeTag, AvatarStack, Avatar, FlagImg, FormPips, FormLegend,
} from '../App.jsx'

const formPts = (f) => [...(f || '')].reduce((n, r) => n + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0)

const minuteFromClock = (clock) => {
  const match = String(clock || '').match(/\d+/)
  const minute = match ? Number(match[0]) : NaN
  return Number.isFinite(minute) ? minute : null
}

const pct = (n) => Math.round((Number(n) || 0) * 100)

const resultLabel = (match, key) => (key === 'draw' ? 'Draw' : key === 'team_a' ? match.team_a : match.team_b)

const scorelineWedge = (m) => {
  if (m?.score_a != null && m?.score_b != null) {
    return { label: `${m.score_a}–${m.score_b}`, note: m.completed ? 'final score' : 'live score' }
  }
  const pa = Number(m?.prob_a || 0)
  const pd = Number(m?.prob_draw || 0)
  const pb = Number(m?.prob_b || 0)
  const top = Math.max(pa, pd, pb)
  if (top === pd || Math.abs(pa - pb) < 0.07) return { label: '1–1', note: 'draw lean' }
  if (pa > pb) return { label: pa - pb >= 0.15 ? '2–0' : '2–1', note: 'home edge' }
  return { label: pb - pa >= 0.15 ? '0–2' : '1–2', note: 'away edge' }
}

function LiveApiStats({ m }) {
  const minute = minuteFromClock(m.clock)
  const live = m.status === 'in'
  const late = live && minute != null && minute >= 85
  const feed = m.prob_source === 'illustrative' ? 'demo model' : m.prob_source === 'form' ? 'form feed' : m.prob_source || 'api feed'
  const stats = [
    ['score', m.score_a != null && m.score_b != null ? `${m.score_a}–${m.score_b}` : '—'],
    ['clock', m.clock || '—'],
    ['status', m.status_detail || m.status || '—'],
    ['source', feed],
  ]
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="flourish text-xl leading-none text-lime">live api stats</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">real-time feed · no season bloat</div>
        </div>
        <div className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border ' + (live ? 'bg-lime/15 text-lime border-lime/30' : 'bg-night text-cream/55 border-line')}>
          <span className={'w-1.5 h-1.5 rounded-full ' + (live ? 'bg-lime animate-pulse' : 'bg-cream/30')} />
          {late ? 'last 5' : live ? 'live' : 'steady'}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-night/70 border border-line px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40">{label}</div>
            <div className="mt-1 font-display text-lg leading-none uppercase text-cream">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-cream/45 leading-snug">
        {live ? 'The feed can flip minute by minute. That is the point.' : 'The feed is warm and waiting. Kickoff data is already wired.'}
      </div>
    </div>
  )
}

function ScorelineWedge({ match, participantIds = [] }) {
  const predictions = demoPredictionsForMatch(match, participantIds)
  const counts = predictions.reduce((acc, p) => {
    acc[p.pick] = (acc[p.pick] || 0) + 1
    return acc
  }, { team_a: 0, draw: 0, team_b: 0 })
  const total = predictions.length || 1
  const model = [
    { key: 'team_a', label: match.team_a, prob: pct(match.prob_a), count: counts.team_a, color: match.color_a || '#8ACE00' },
    { key: 'draw', label: 'Draw', prob: pct(match.prob_draw), count: counts.draw, color: '#3A3A3A' },
    { key: 'team_b', label: match.team_b, prob: pct(match.prob_b), count: counts.team_b, color: match.color_b || '#2A5BFF' },
  ]
  const leader = [...model].sort((a, b) => (b.count - a.count) || (b.prob - a.prob))[0]
  const topProbability = [...model].sort((a, b) => b.prob - a.prob)[0]
  const wedge = scorelineWedge(match)
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="flourish text-xl leading-none text-pink">the call</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">room picks · 3-way wedge</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-cream/45">{leader.count} / {total} leaning {resultLabel(match, leader.key).toLowerCase()}</div>
      </div>
      <div className="space-y-2">
        {model.map((item) => (
          <div key={item.key} className="rounded-xl bg-night/70 border border-line p-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide">
              <span>{item.label}</span>
              <span>{item.prob}% model · {item.count} room</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-cream/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.max(item.prob, item.count ? Math.round((item.count / total) * 100) : 0)}%`, background: item.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-night/60 border border-line px-3 py-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40">scoreline wedge</div>
          <div className="font-display text-xl leading-none text-cream mt-1">{wedge.label}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40">fantasy-style</div>
          <div className="text-[11px] font-bold text-cream/70 mt-1">{wedge.note} · top model {topProbability.label}</div>
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, note, tone = 'cream' }) {
  const toneClass = tone === 'lime' ? 'text-lime' : tone === 'pink' ? 'text-pink' : tone === 'blue' ? 'text-[#6DA8FF]' : 'text-cream'
  return (
    <div className="rounded-xl bg-night/70 border border-line p-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40">{label}</div>
      <div className={`mt-1 font-display text-lg leading-none uppercase ${toneClass}`}>{value}</div>
      {note && <div className="mt-1 text-[10px] text-cream/45 leading-snug">{note}</div>}
    </div>
  )
}

function MatchMetaStats({ m }) {
  const live = m.status === 'in'
  const kickoff = m.kickoff || (m.kickoff_utc ? String(m.kickoff_utc).slice(11, 16) : '—')
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flourish text-xl leading-none text-lime">match sheet</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">fixture, venue, kick, feed</div>
        </div>
        <div className={'text-[10px] uppercase tracking-[0.18em] font-bold ' + (live ? 'text-lime' : 'text-cream/45')}>
          {live ? 'in play' : m.status || 'pre'}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="kickoff" value={kickoff} note={m.day || 'matchday'} tone="pink" />
        <StatTile label="tv" value={Array.isArray(m.tv) ? m.tv.join(' / ') : (m.tv || '—')} note="broadcast" tone="blue" />
        <StatTile label="venue" value={m.venue || '—'} note={m.stage || 'stage'} tone="lime" />
        <StatTile label="clock" value={m.clock || '—'} note={m.status_detail || m.status || '—'} tone="cream" />
      </div>
    </div>
  )
}

function PressureStats({ m }) {
  const total = [m.prob_a, m.prob_draw, m.prob_b].reduce((n, v) => n + (Number(v) || 0), 0)
  const pa = pct(m.prob_a)
  const pd = pct(m.prob_draw)
  const pb = pct(m.prob_b)
  const edge = Math.max(pa, pb) - Math.min(pa, pb)
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flourish text-xl leading-none text-pink">pressure</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">model vs draw vs edge</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-cream/45">edge {edge}%</div>
      </div>
      <div className="space-y-2">
        <div className="rounded-xl bg-night/70 border border-line p-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide"><span>{m.team_a}</span><span>{pa}%</span></div>
          <div className="mt-2 h-2 rounded-full bg-cream/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pa}%`, background: m.color_a || '#8ACE00' }} /></div>
        </div>
        <div className="rounded-xl bg-night/70 border border-line p-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide"><span>draw</span><span>{pd}%</span></div>
          <div className="mt-2 h-2 rounded-full bg-cream/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pd}%`, background: '#3A3A3A' }} /></div>
        </div>
        <div className="rounded-xl bg-night/70 border border-line p-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide"><span>{m.team_b}</span><span>{pb}%</span></div>
          <div className="mt-2 h-2 rounded-full bg-cream/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pb}%`, background: m.color_b || '#2A5BFF' }} /></div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatTile label="total" value={`${pct(total / 3)}%`} note="roughly normalized" />
        <StatTile label="top call" value={scorelineWedge(m).label} note={scorelineWedge(m).note} tone="lime" />
        <StatTile label="model source" value={m.prob_source || '—'} note="feed type" tone="blue" />
      </div>
    </div>
  )
}

function RoomPulseStats({ match, plans = [] }) {
  const participantIds = [...new Set(plans.flatMap((p) => p.participant_ids || []))]
  const topPlan = plans[0] || null
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flourish text-xl leading-none text-lime">room pulse</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">who is in, how many, how loud</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-cream/45">{plans.length} plans</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="going" value={participantIds.length.toString()} note="unique people in the room" tone="pink" />
        <StatTile label="spots" value={plans.length.toString()} note="watch plans on this match" tone="blue" />
        <StatTile label="busiest venue" value={topPlan ? venueById(topPlan.venue_id)?.name : '—'} note={topPlan ? `${topPlan.participant_ids.length} going there` : 'no spots yet'} tone="lime" />
        <StatTile label="avg room" value={plans.length ? Math.round(participantIds.length / plans.length).toString() : '0'} note="people per plan" tone="cream" />
      </div>
      {topPlan && (
        <div className="mt-3 rounded-xl bg-night/60 border border-line px-3 py-2 text-[11px] text-cream/55 leading-snug">
          Biggest room: <span className="text-cream font-bold">{venueById(topPlan.venue_id)?.emoji} {venueById(topPlan.venue_id)?.name}</span> · {topPlan.note}
        </div>
      )}
    </div>
  )
}

function MatchBrief({ match, plans = [] }) {
  const participantIds = [...new Set(plans.flatMap((p) => p.participant_ids || []))]
  const topPlan = plans[0] || null
  const live = match.status === 'in'
  const now = live
    ? (match.score_a != null && match.score_b != null ? `${match.score_a}–${match.score_b}` : (match.clock || 'LIVE'))
    : (match.kickoff || 'soon')
  const edge = scorelineWedge(match)
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flourish text-xl leading-none text-lime">match at a glance</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">one glance, then dive if you care</div>
        </div>
        <div className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] border ' + (live ? 'bg-lime/15 text-lime border-lime/30' : 'bg-night text-cream/55 border-line')}>
          <span className={'w-1.5 h-1.5 rounded-full ' + (live ? 'bg-lime animate-pulse' : 'bg-cream/30')} />
          {live ? 'live' : 'preview'}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="now" value={now} note={live ? 'score or clock' : 'kickoff' } tone="pink" />
        <StatTile label="room" value={`${participantIds.length}`} note={plans.length ? `${plans.length} spots` : 'no spots yet'} tone="blue" />
        <StatTile label="call" value={edge.label} note={edge.note} tone="lime" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-night/60 border border-line px-3 py-2 text-[11px] text-cream/55 leading-snug">
        <span>{topPlan ? `Busiest room: ${venueById(topPlan.venue_id)?.name}` : 'No rooms yet. Be first.'}</span>
        <span className="text-cream/40 uppercase tracking-[0.18em]">match-night / social-first</span>
      </div>
    </div>
  )
}

function TeamSheetStats({ extras }) {
  if (!extras) return null
  const rows = [
    { side: 'a', label: 'squad', value: extras.a?.squad?.players?.length || 0, note: extras.a?.squad?.coach || '—', tone: 'lime' },
    { side: 'a', label: 'record', value: extras.a?.record?.played || 0, note: extras.a?.record?.played ? `${extras.a.record.wins}W ${extras.a.record.draws}D ${extras.a.record.losses}L` : 'no record', tone: 'pink' },
    { side: 'b', label: 'squad', value: extras.b?.squad?.players?.length || 0, note: extras.b?.squad?.coach || '—', tone: 'blue' },
    { side: 'b', label: 'record', value: extras.b?.record?.played || 0, note: extras.b?.record?.played ? `${extras.b.record.wins}W ${extras.b.record.draws}D ${extras.b.record.losses}L` : 'no record', tone: 'cream' },
  ]
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flourish text-xl leading-none text-pink">team sheet</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">squads, coaches, records</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-cream/45">world cup history</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r, idx) => (
          <StatTile key={idx} label={r.label} value={String(r.value)} note={r.note} tone={r.tone} />
        ))}
      </div>
      {extras.a?.record?.played ? <WCRecord r={extras.a.record} /> : null}
      {extras.b?.record?.played ? <WCRecord r={extras.b.record} /> : null}
    </div>
  )
}

function MatchAnalytics({ m }) {
  const hasProb = m.prob_a != null && m.prob_b != null
  const hasForm = m.form_a || m.form_b
  if (!hasProb && !hasForm) return null
  const pa = Math.round((m.prob_a || 0) * 100), pd = Math.round((m.prob_draw || 0) * 100), pb = Math.round((m.prob_b || 0) * 100)
  const src = m.prob_source === 'illustrative' ? 'model · demo' : m.prob_source === 'form' ? 'form model' : 'model'
  const row = (flag, team, form) => (
    <div className="flex items-center justify-between text-[11px]">
      <span className="flex items-center gap-1.5"><FlagImg emoji={flag} team={team} size={13} /> {team}</span>
      <span className="flex items-center gap-2"><FormPips form={form} /><span className="font-bold text-cream/55 w-12 text-right">{formPts(form)} pts</span></span>
    </div>
  )
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flourish text-xl leading-none text-lime">the numbers</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40">{hasProb ? src : 'form'}</div>
      </div>
      {hasProb && (
        <div className="mb-1">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40 mb-1.5">Win probability</div>
          <div className="flex h-3 rounded-full overflow-hidden">
            <div style={{ width: pa + '%', background: m.color_a || '#8ACE00' }} />
            <div style={{ width: pd + '%', background: '#3a3a3a' }} />
            <div style={{ width: pb + '%', background: m.color_b || '#2A5BFF' }} />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold mt-1.5">
            <span className="flex items-center gap-1.5"><FlagImg emoji={m.flag_a} team={m.team_a} size={13} /> {pa}%</span>
            <span className="text-cream/40">Draw {pd}%</span>
            <span className="flex items-center gap-1.5">{pb}% <FlagImg emoji={m.flag_b} team={m.team_b} size={13} /></span>
          </div>
        </div>
      )}
      {hasForm && (
        <div className="mt-4 pt-4 border-t border-line">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40 mb-2">
            <span>Recent form · last 5</span><FormLegend />
          </div>
          <div className="space-y-2">{row(m.flag_a, m.team_a, m.form_a)}{row(m.flag_b, m.team_b, m.form_b)}</div>
        </div>
      )}
    </div>
  )
}

function HeadToHead({ m }) {
  if (!m.h2h && !m.first_meeting) return null
  return (
    <div className="mb-6 border-l-2 pl-4" style={{ borderColor: '#2A5BFF' }}>
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1" style={{ color: '#2A5BFF' }}>head to head</div>
      {m.h2h ? (
        <p className="flourish text-xl leading-snug text-cream/80">
          Last met at {m.h2h.last} — {m.flag_a} <span className="not-italic font-display">{m.h2h.score}</span> {m.flag_b}{m.h2h.note ? `, ${m.h2h.note}.` : '.'}
        </p>
      ) : (
        <p className="flourish text-xl leading-snug text-cream/80">First-ever meeting. New history tonight.</p>
      )}
    </div>
  )
}

const POS_GROUPS = [['G', 'Goalkeepers'], ['D', 'Defenders'], ['M', 'Midfielders'], ['F', 'Forwards']]
function WCRecord({ r }) {
  if (!r || !r.played) return null
  const cell = (label, val, color) => (
    <div className="text-center">
      <div className="text-[7px] font-bold uppercase tracking-wide text-cream/40 leading-tight">{label}</div>
      <div className="font-display text-lg leading-none mt-1" style={{ color }}>{val}</div>
    </div>
  )
  return (
    <div className="grid grid-cols-6 gap-1 rounded-xl bg-night border border-line p-3 mt-2">
      {cell('Played', r.played, '#F4F2EC')}
      {cell('Wins', r.wins, '#8ACE00')}
      {cell('Draws', r.draws, '#FF9F1C')}
      {cell('Losses', r.losses, '#FF5A1F')}
      {cell('Scored', r.gf, '#FF3E9A')}
      {cell('Against', r.ga, '#8a8a8a')}
    </div>
  )
}

// A jersey chip — number over surname. In rate mode it's a tappable button that
// mirrors the list's pick/count states so rating works identically on the pitch.
const surname = (name) => { const p = String(name || '').trim().split(/\s+/); return p[p.length - 1] || name }
function Jersey({ p, team, rate }) {
  const num = p.no ? p.no : ''
  if (!rate) {
    return (
      <div className="flex flex-col items-center w-[52px]">
        <div className="w-8 h-8 rounded-full bg-night/75 border border-cream/30 flex items-center justify-center text-[11px] font-bold text-cream">{num}</div>
        <div className="text-[9px] text-cream/90 mt-0.5 w-full text-center truncate">{surname(p.name)}</div>
      </div>
    )
  }
  const id = playerSlug(p.name, team)
  const picked = rate.picks.has(id)
  const count = rate.counts[id] || 0
  const blocked = !picked && rate.atMax
  return (
    <button disabled={blocked || rate.busy} onClick={() => rate.onToggle({ id, team, name: p.name, no: p.no, pos: p.pos })}
      className="flex flex-col items-center w-[52px] active:scale-[0.94] transition disabled:cursor-not-allowed">
      <div className={'relative w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border ' +
        (picked ? 'bg-lime text-night border-lime' : blocked ? 'bg-night/60 text-cream/25 border-line/60' : 'bg-night/75 text-cream border-cream/30')}>
        {num}
        {rate.hasVoted && count > 0 && (
          <span className={'absolute -top-1.5 -right-1.5 rounded-full px-1 text-[9px] font-bold ' + (picked ? 'bg-night text-lime' : 'bg-lime text-night')}>{count}</span>
        )}
      </div>
      <div className={'text-[9px] mt-0.5 w-full text-center truncate ' + (picked ? 'text-lime' : 'text-cream/90')}>{surname(p.name)}</div>
    </button>
  )
}

// The squad laid out on a pitch by position line (FWD top → GK bottom). Full
// rosters wrap within each band, so it reads as a formation without claiming a
// starting XI the data doesn't carry.
function FormationPitch({ grouped, team, rate }) {
  // bands top→bottom: Forwards, Midfielders, Defenders, then Goalkeepers + Other
  const byLabel = Object.fromEntries(grouped.map(([l, ps]) => [l, ps]))
  const bands = [
    byLabel['Forwards'] || [],
    byLabel['Midfielders'] || [],
    byLabel['Defenders'] || [],
    [...(byLabel['Goalkeepers'] || []), ...(byLabel['Other'] || [])],
  ].filter((b) => b.length)
  return (
    <div className="relative rounded-xl overflow-hidden border border-line"
      style={{ background: 'linear-gradient(180deg,#0e4524 0%,#0a3119 50%,#082813 100%)' }}>
      {/* pitch markings */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-cream/15" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-cream/15" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-24 h-7 border border-cream/15 border-t-0" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-24 h-7 border border-cream/15 border-b-0" />
      </div>
      <div className="relative flex flex-col justify-between gap-3 py-4 px-2 min-h-[280px]">
        {bands.map((ps, bi) => (
          <div key={bi} className="flex flex-wrap justify-center gap-x-2 gap-y-2">
            {ps.map((p, i) => <Jersey key={i} p={p} team={team} rate={rate} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamPanel({ team, flag, squad, record, rate }) {
  const [open, setOpen] = useState(!!rate)
  const [pitch, setPitch] = useState(true)
  if (!squad && (!record || !record.played)) return null
  const players = squad?.players || []
  const grouped = POS_GROUPS.map(([code, label]) => [label, players.filter((p) => p.pos === code)])
  const others = players.filter((p) => !['G', 'D', 'M', 'F'].includes(p.pos))
  if (others.length) grouped.push(['Other', others])
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-3">
      <div className="flex items-center gap-2">
        <FlagImg emoji={flag} team={team} size={16} />
        <span className="font-display uppercase text-lg leading-none">{team}</span>
        {record?.played > 0 && <span className="text-[9px] uppercase tracking-[0.16em] text-cream/40 ml-auto">World Cup record</span>}
      </div>
      <WCRecord r={record} />
      {players.length > 0 && (
        <>
          <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between mt-3 pt-3 border-t border-line text-sm font-bold active:scale-[0.99] transition">
            <span>{rate ? 'Squad · tap to rate' : 'Squad'} <span className="text-cream/35">· {players.length}</span></span>
            <span className="text-lime text-lg leading-none">{open ? '−' : '+'}</span>
          </button>
          {open && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between -mt-1">
                {rate && <span className="text-[10px] uppercase tracking-wide text-cream/40">tap a shirt to rate</span>}
                <div className="inline-flex rounded-full border border-line overflow-hidden text-[10px] font-bold uppercase tracking-wide ml-auto">
                  <button onClick={() => setPitch(true)} className={'px-3 py-1 ' + (pitch ? 'bg-lime text-night' : 'text-cream/50')}>Pitch</button>
                  <button onClick={() => setPitch(false)} className={'px-3 py-1 ' + (!pitch ? 'bg-lime text-night' : 'text-cream/50')}>List</button>
                </div>
              </div>
              {pitch ? (
                <FormationPitch grouped={grouped} team={team} rate={rate} />
              ) : (
              <>
              {grouped.map(([label, ps]) => ps.length > 0 && (
                <div key={label}>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-lime mb-1.5">{label}</div>
                  {rate ? (
                    <div className="flex flex-wrap gap-2">
                      {ps.map((p, i) => {
                        const id = playerSlug(p.name, team)
                        const picked = rate.picks.has(id)
                        const count = rate.counts[id] || 0
                        const blocked = !picked && rate.atMax
                        return (
                          <button key={i} disabled={blocked || rate.busy}
                            onClick={() => rate.onToggle({ id, team, name: p.name, no: p.no, pos: p.pos })}
                            className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] border transition active:scale-[0.96] ' +
                              (picked ? 'bg-lime text-night border-lime font-bold'
                                : blocked ? 'bg-night text-cream/25 border-line/60 cursor-not-allowed'
                                : 'bg-night text-cream/80 border-line hover:border-cream/40')}>
                            {p.no ? <span className={picked ? 'text-night/55' : 'text-cream/35'}>{p.no}</span> : null}
                            {p.name}
                            {rate.hasVoted && count > 0 && (
                              <span className={'ml-0.5 rounded-full px-1.5 text-[10px] font-bold ' +
                                (picked ? 'bg-night/15 text-night' : 'bg-lime/15 text-lime')}>{count}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-cream/80">
                      {ps.map((p, i) => <span key={i}>{p.no ? <span className="text-cream/35">{p.no} </span> : null}{p.name}</span>)}
                    </div>
                  )}
                </div>
              ))}
              </>
              )}
              {squad?.coach && <div className="text-[12px] text-cream/50 pt-1 border-t border-line/60 mt-1">Coach · <span className="text-cream/80">{squad.coach}</span></div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TeamExtras({ match, extras }) {
  const cats = activeCategories()
  const [cat, setCat] = useState(cats[0]?.id)
  const [mine, setMine] = useState({})
  const [tally, setTally] = useState({})
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    myRatings(match.id).then((m) => m && setMine(m))
    matchRatings(match.id).then((t) => t && setTally(t))
  }
  useEffect(() => { setMine({}); setTally({}); if (hasSupabase) refresh() }, [match.id])

  if (!extras) return null
  const { a, b } = extras
  const has = (t) => t?.squad || (t?.record && t.record.played)
  if (!has(a) && !has(b)) return null

  const anyPlayers = (a?.squad?.players?.length || 0) + (b?.squad?.players?.length || 0) > 0
  const rating = hasSupabase && cats.length > 0 && anyPlayers

  const myCat = mine[cat] || new Set()
  const atMax = myCat.size >= MAX_PICKS_PER_CATEGORY
  const catTally = tally[cat] || {}
  const hasVoted = myCat.size > 0

  const onToggle = async (p) => {
    if (busy) return
    const picked = myCat.has(p.id)
    if (!picked && atMax) return
    setBusy(true)
    if (picked) await unratePlayer(match.id, p.id, cat)
    else await ratePlayer(match.id, p.team, p.id, cat)
    refresh()
    setBusy(false)
  }

  const rateFor = rating ? { cat, picks: myCat, counts: catTally, atMax, busy, hasVoted, onToggle } : null

  return (
    <div className="mb-6">
      <div className="flex items-end justify-between mb-1">
        <h2 className="font-display text-2xl uppercase leading-none">Teams</h2>
        {rating && <span className="text-[10px] uppercase tracking-wide text-cream/40">rate · pick up to {MAX_PICKS_PER_CATEGORY}</span>}
      </div>
      {rating && (
        <>
          <p className="text-[11px] text-cream/40 mb-3">Tap a player in the squad to rate — anonymous</p>
          <div className="flex gap-2 mb-2">
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={'flex-1 rounded-full px-3 py-2 text-[12px] font-bold uppercase tracking-wide border transition active:scale-[0.97] ' +
                  (cat === c.id ? 'bg-lime text-night border-lime' : 'bg-panel text-cream/70 border-line')}>
                <span aria-hidden>{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cream/40 mb-3">
            <span>{myCat.size} / {MAX_PICKS_PER_CATEGORY} picked</span>
            {atMax && <span className="text-pink">max reached — tap a pick to swap</span>}
          </div>
        </>
      )}
      <TeamPanel team={match.team_a} flag={match.flag_a} squad={a?.squad} record={a?.record} rate={rateFor} />
      <TeamPanel team={match.team_b} flag={match.flag_b} squad={b?.squad} record={b?.record} rate={rateFor} />
    </div>
  )
}

const PICK_STORAGE_KEY = 'rally-picks-v1'
const tauntCopy = ({ match, myName, pickLabelText }) => {
  const score = match.score_a != null && match.score_b != null ? `${match.score_a}–${match.score_b}` : null
  const opening = score
    ? `${myName} called it: ${match.team_a} ${score} ${match.team_b}.`
    : `${myName} called ${pickLabelText} in ${match.team_a} v ${match.team_b}.`
  return `${opening} Told you so. 🏆`
}
const bragCopy = ({ match, pickLabelText, counts }) => {
  const total = (counts.team_a || 0) + (counts.draw || 0) + (counts.team_b || 0)
  return `Locking in ${pickLabelText} — ${match.team_a} v ${match.team_b}. ${total} of us in the room called it. Screenshot it. ⚽`
}
const resultCardCopy = ({ match, me, predictions }) => {
  const score = match.score_a != null && match.score_b != null ? `${match.score_a}–${match.score_b}` : 'TBD'
  const right = predictions.filter((p) => predictionOutcome(match, p.pick) === 'right')
  const myOutcome = me ? predictionOutcome(match, me.pick) : 'pending'
  return [
    `${match.team_a} ${score} ${match.team_b}`,
    me ? `My call: ${predictionLabel(match, me.pick)} — ${myOutcome === 'right' ? 'NAILED IT ✅' : myOutcome === 'wrong' ? 'ouch ❌' : 'pending'}` : null,
    right.length ? `Called it: ${right.map((p) => p.user.name).join(', ')}` : null,
    '— via RALLY',
  ].filter(Boolean).join('\n')
}

function ShareBtn({ onClick, children, primary }) {
  return (
    <button
      onClick={onClick}
      className={'inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide px-3 py-1.5 text-[11px] active:scale-95 transition border '
        + (primary ? 'bg-lime text-night border-lime' : 'bg-night text-cream/70 border-line')}
    >
      {children}
    </button>
  )
}

function useStoredPick(matchId, myId) {
  const [stored, setStored] = useState(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PICK_STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : {}
      setStored(all?.[matchId]?.[myId] || null)
    } catch {
      setStored(null)
    }
  }, [matchId, myId])
  const save = (pick) => {
    try {
      const raw = localStorage.getItem(PICK_STORAGE_KEY)
      const all = raw ? JSON.parse(raw) : {}
      all[matchId] ||= {}
      all[matchId][myId] = pick
      localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(all))
      setStored(pick)
    } catch {
      setStored(pick)
    }
  }
  return [stored, save]
}

function PredictionBoard({ match, participantIds = [], myId }) {
  const [storedPick, savePick] = useStoredPick(match.id, myId)
  const [copiedKind, setCopiedKind] = useState(null)
  const [showRoomCalls, setShowRoomCalls] = useState(false)
  const predictions = demoPredictionsForMatch(match, participantIds).map((p) =>
    p.user_id === myId && storedPick ? { ...p, pick: storedPick } : p,
  )
  const me = predictions.find((p) => p.user_id === myId)
  const result = matchWinner(match)
  const myStatus = me ? predictionOutcome(match, me.pick) : 'pending'
  const counts = predictions.reduce((acc, p) => {
    acc[p.pick] = (acc[p.pick] || 0) + 1
    return acc
  }, {})
  const pickChoices = [
    { id: 'team_a', label: match.team_a },
    { id: 'draw', label: 'Draw' },
    { id: 'team_b', label: match.team_b },
  ]
  const myLabel = me ? predictionLabel(match, me.pick) : ''
  const leader = [
    { key: 'team_a', value: counts.team_a || 0, label: match.team_a },
    { key: 'draw', value: counts.draw || 0, label: 'Draw' },
    { key: 'team_b', value: counts.team_b || 0, label: match.team_b },
  ].sort((a, b) => b.value - a.value)[0]
  const textFor = (kind) => {
    if (kind === 'taunt') return tauntCopy({ match, myName: 'I', pickLabelText: myLabel })
    if (kind === 'brag') return bragCopy({ match, pickLabelText: myLabel, counts })
    return resultCardCopy({ match, me, predictions })
  }
  const fire = async (kind) => {
    const text = textFor(kind)
    try { await navigator.clipboard.writeText(text) } catch { /* file:// / no clipboard */ }
    setCopiedKind(kind); setTimeout(() => setCopiedKind(null), 1200)
  }
  const shareNative = async () => {
    const text = textFor(result ? 'card' : 'brag')
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* cancelled */ } return }
    fire('share')
  }
  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flourish text-xl leading-none text-pink">make your call</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40 mt-1">pick first, brag later</div>
        </div>
        <div className="text-right text-[10px] uppercase tracking-[0.18em] text-cream/45">
          {leader.value} leaning {leader.label.toLowerCase()}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {pickChoices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => savePick(choice.id)}
            className={'rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide border transition active:scale-95 '
              + (me?.pick === choice.id ? 'bg-lime text-night border-lime' : 'bg-night text-cream/70 border-line')}
          >
            {choice.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-night/70 border border-line p-3 mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar user={me?.user || { name: 'You', flag: '🏴', color: '#8a8a8a' }} size={28} />
            <div className="min-w-0">
              <div className="font-bold truncate">{me ? `You picked ${predictionLabel(match, me.pick)}` : 'Pick a winner, draw, or away'}</div>
              <div className="text-[11px] text-cream/45 truncate">{me ? `${me.score} · ${me.taunt}` : 'One tap. That’s the whole interface.'}</div>
            </div>
          </div>
          {me && (
            <span className={'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide '
              + (myStatus === 'right' ? 'bg-lime text-night' : myStatus === 'wrong' ? 'bg-pink text-night' : 'bg-cream/10 text-cream/60')}>
              {myStatus === 'right' ? 'right' : myStatus === 'wrong' ? 'wrong' : 'pending'}
            </span>
          )}
        </div>
        {me && (
          <div className="mt-3 flex flex-wrap gap-2">
            <ShareBtn onClick={() => fire('brag')}>{copiedKind === 'brag' ? 'copied' : 'copy brag'}</ShareBtn>
            {result && myStatus === 'right' && (
              <ShareBtn primary onClick={() => fire('taunt')}>{copiedKind === 'taunt' ? 'copied' : 'copy taunt'}</ShareBtn>
            )}
            {result && (
              <ShareBtn onClick={() => fire('card')}>{copiedKind === 'card' ? 'copied' : 'copy result card'}</ShareBtn>
            )}
            <ShareBtn onClick={shareNative}>{copiedKind === 'share' ? 'shared' : 'share'}</ShareBtn>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowRoomCalls((v) => !v)}
        className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-night/80 border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-cream/70"
      >
        {showRoomCalls ? 'Hide room calls' : 'View room calls'}
      </button>

      {showRoomCalls && (
        <div className="space-y-2">
          {predictions.map((p) => {
            const status = predictionOutcome(match, p.pick)
            const isMe = p.user_id === myId
            return (
              <div key={p.user_id} className={'flex items-center gap-3 rounded-xl border p-3 ' + (isMe ? 'bg-lime/10 border-lime/30' : 'bg-night/60 border-line')}>
                <Avatar user={p.user} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-bold truncate">{p.user.name}</div>
                    <span className="text-[10px] uppercase tracking-wide text-cream/45">{predictionLabel(match, p.pick)}</span>
                    <span className="text-[10px] text-cream/35">{p.score}</span>
                  </div>
                  <div className="text-[11px] text-cream/45 truncate">{p.taunt}</div>
                </div>
                <span className={'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide '
                  + (status === 'right' ? 'bg-lime text-night' : status === 'wrong' ? 'bg-cream/10 text-cream/50' : 'bg-cream/10 text-cream/50')}>
                  {status === 'right' ? 'right' : status === 'wrong' ? 'off' : 'pending'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {result ? (
        <div className="mt-4 text-[11px] text-cream/45">Result is in — the loudest room gets the last laugh.</div>
      ) : (
        <div className="mt-4 text-[11px] text-cream/45">Taunts unlock once the result is in. Be annoying later.</div>
      )}
    </div>
  )
}

// Stats are a drill-down, not the homepage: collapsed by default, one tap deep.
function StatsDrawer({ children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between rounded-2xl bg-panel border border-line px-4 py-3 active:scale-[0.99] transition"
      >
        <span className="font-display text-xl uppercase leading-none">more stats</span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-cream/45">{open ? 'hide ↑' : 'show more ↓'}</span>
      </button>
      {open && <div className="pt-4">{children}</div>}
    </div>
  )
}

export default function MatchScreen({ match, plans, myId, following, onToggleFollow, onBack, onOpenPlan, onCreate }) {
  const matchPlans = plans.filter((p) => p.match_id === match.id).sort((a, b) => b.participant_ids.length - a.participant_ids.length)
  const [extras, setExtras] = useState(null)
  const [showPoster, setShowPoster] = useState(false)
  const topPlan = matchPlans[0] || null
  useEffect(() => {
    let alive = true
    setExtras(null)
    loadTeamExtras(match.team_a, match.team_b).then((e) => { if (alive) setExtras(e) })
    return () => { alive = false }
  }, [match.id])
  return (
    <div className="pb-28">
      <TopBar onBack={onBack} title={match.stage} />
      <div className="relative">
        <MatchArt m={match} className="h-56" credit />
        <div className="absolute inset-0 flex flex-col items-center justify-end text-center px-5 pb-4">
          <div className="font-display uppercase text-2xl leading-[0.95] drop-shadow">
            {match.flag_a} {match.team_a} <span className="text-cream/60 text-base">v</span> {match.flag_b} {match.team_b}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-cream/80 mt-2"><MatchStatusLine m={match} /></div>
          {match.venue && <div className="text-[11px] text-cream/55 mt-1">📍 {match.venue}</div>}
          <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
            <TvChips tv={match.tv} />
            <button onClick={() => onToggleFollow?.(match.id)}
              aria-pressed={!!following}
              className={'inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide px-3 py-1 text-[10px] active:scale-95 transition border '
                + (following ? 'bg-lime text-night border-lime' : 'bg-night/40 text-cream border-cream/30 backdrop-blur-sm')}>
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden
                fill={following ? 'currentColor' : 'none'} stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
              </svg>
              {following ? 'Following' : 'Follow'}
            </button>
            <button onClick={() => setShowPoster(true)}
              className="inline-flex items-center gap-1 rounded-full bg-lime text-night font-bold uppercase tracking-wide px-3 py-1 text-[10px] active:scale-95 transition">
              <span aria-hidden>⬆</span> Share
            </button>
          </div>
        </div>
      </div>
      <div className="px-5 pt-5">

        {match.commentary && <Rundown text={match.commentary} />}

        {/* SOCIAL FIRST (masterplan Rule 1): the play loop + the room come before the stats. */}
        <MatchBrief match={match} plans={matchPlans} />
        <PredictionBoard match={match} participantIds={matchPlans.flatMap((p) => p.participant_ids)} myId={myId} />

        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-2xl uppercase leading-none">Spots</h2>
          <span className="text-[11px] uppercase tracking-wide text-cream/40">{matchPlans.length} plans</span>
        </div>

        <div className="space-y-3 mb-6">
          {matchPlans.map((p) => {
            const venue = venueById(p.venue_id)
            return (
              <button key={p.id} onClick={() => onOpenPlan(p)} className="w-full text-left rounded-2xl bg-panel border border-line p-4 active:scale-[0.98] transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-lg"><span className="text-xl">{venue.emoji}</span>{venue.name}</div>
                  <VibeTag vibe={p.vibe} small />
                </div>
                <div className="text-sm text-cream/45 mt-1">{venue.area} · from {p.time}</div>
                <div className="flex items-center justify-between mt-3">
                  <AvatarStack ids={p.participant_ids} />
                  <span className="text-sm font-bold">{p.participant_ids.length} going →</span>
                </div>
              </button>
            )
          })}
          {matchPlans.length === 0 && <div className="text-center text-cream/40 py-10 text-sm">No spots yet. Start one and share it →</div>}
        </div>

        {/* STATS ON DEMAND (masterplan Rule 2): the numbers drill down, they don't lead. */}
        <StatsDrawer>
          <LiveApiStats m={match} />
          <MatchMetaStats m={match} />
          <RoomPulseStats match={match} plans={matchPlans} />
          <ScorelineWedge match={match} participantIds={matchPlans.flatMap((p) => p.participant_ids)} />
          <PressureStats m={match} />
          <MatchAnalytics m={match} />

          {match.fun_fact && (
            <div className="mb-6 border-l-2 border-pink pl-4">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-pink mb-1">did you know</div>
              <p className="flourish text-xl leading-snug text-cream/80">{match.fun_fact}</p>
            </div>
          )}

          <HeadToHead match={match} m={match} />

          <TeamSheetStats extras={extras} />
          <TeamExtras match={match} extras={extras} />
        </StatsDrawer>
      </div>

      <StickyBar><Pill onClick={onCreate} className="w-full">+ Start a watch plan</Pill></StickyBar>

      {showPoster && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 20, padding: 24,
          }}
          onClick={() => setShowPoster(false)}
        >
          <PosterCard
            match={match}
            plan={topPlan}
            planId={topPlan?.id}
            width={300}
          />
          <button
            className="rounded-full bg-lime text-night font-bold uppercase tracking-widest py-3.5 px-7 active:scale-[0.98] transition"
            onClick={async (e) => {
              e.stopPropagation()
              const url = `/api/poster/${match.id}.png${topPlan ? `?planId=${topPlan.id}` : ''}`
              if (navigator.share) {
                try {
                  await navigator.share({ url: `https://rally.futbol${url}`, title: `${match.team_a} vs ${match.team_b}` })
                } catch { /* user cancelled */ }
              } else {
                window.open(url, '_blank')
              }
            }}
          >
            Download / Share
          </button>
          <button
            className="text-cream/50 text-xs uppercase tracking-widest"
            onClick={() => setShowPoster(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

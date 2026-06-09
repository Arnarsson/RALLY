// Match detail — lazy-loaded (React.lazy in App.jsx). Pulls shared UI
// primitives back from App.jsx; that circular import is fine because this module
// only ever loads via dynamic import(), well after App's bindings are live. The
// payoff: none of this code (analytics, head-to-head, the Teams/rating panel)
// sits in the initial chunk that gates first paint on Tonight.
import { useState, useEffect } from 'react'
import {
  loadTeamExtras, venueById,
  ratePlayer, unratePlayer, matchRatings, myRatings, playerSlug, hasSupabase,
} from '../data/mockData.js'
import { activeCategories, MAX_PICKS_PER_CATEGORY } from '../data/ratingConfig.js'
import PosterCard from '../components/PosterCard'
import {
  TopBar, MatchArt, MatchStatusLine, TvChips, Rundown, StickyBar, Pill,
  VibeTag, AvatarStack, FlagImg, FormPips, FormLegend,
} from '../App.jsx'

const formPts = (f) => [...(f || '')].reduce((n, r) => n + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0)

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

function TeamPanel({ team, flag, squad, record, rate }) {
  const [open, setOpen] = useState(!!rate)
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

export default function MatchScreen({ match, plans, myId, onBack, onOpenPlan, onCreate }) {
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
            <button onClick={() => setShowPoster(true)}
              className="inline-flex items-center gap-1 rounded-full bg-lime text-night font-bold uppercase tracking-wide px-3 py-1 text-[10px] active:scale-95 transition">
              <span aria-hidden>⬆</span> Share
            </button>
          </div>
        </div>
      </div>
      <div className="px-5 pt-5">

        {match.commentary && <Rundown text={match.commentary} />}

        <MatchAnalytics m={match} />

        {match.fun_fact && (
          <div className="mb-6 border-l-2 border-pink pl-4">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-pink mb-1">did you know</div>
            <p className="flourish text-xl leading-snug text-cream/80">{match.fun_fact}</p>
          </div>
        )}

        <HeadToHead match={match} m={match} />

        <TeamExtras match={match} extras={extras} />

        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-2xl uppercase leading-none">Spots</h2>
          <span className="text-[11px] uppercase tracking-wide text-cream/40">{matchPlans.length} plans</span>
        </div>

        <div className="space-y-3">
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

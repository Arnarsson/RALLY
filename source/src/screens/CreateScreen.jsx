// Create plan — lazy-loaded. Shared primitives come back from App.jsx.
import { useState } from 'react'
import { VIBES, VENUES } from '../data/mockData.js'
import { StickyBar, Pill, TopBar, NIGHT } from '../App.jsx'

export default function CreateScreen({ match, onBack, onCreate }) {
  const [venue_id, setVenue] = useState(VENUES[0].id)
  const [time, setTime] = useState(match.kickoff.slice(11, 16))
  const [vibe, setVibe] = useState('chill')
  const [note, setNote] = useState('')
  return (
    <div className="pb-28">
      <TopBar onBack={onBack} title="Start a plan" />
      <div className="px-5 space-y-6">
        <div className="rounded-2xl bg-panel border border-line p-4 text-center">
          <div className="font-display uppercase text-xl">{match.flag_a} {match.team_a} v {match.team_b} {match.flag_b}</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-cream/50 mt-1">kickoff {match.kickoff.slice(11, 16)}</div>
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Where?</label>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {VENUES.map((v) => (
              <button key={v.id} onClick={() => setVenue(v.id)}
                className={'flex items-center gap-3 rounded-2xl p-3 border-2 text-left transition ' +
                  (venue_id === v.id ? 'border-lime bg-lime/10' : 'border-line bg-panel')}>
                <span className="text-xl">{v.emoji}</span>
                <div className="flex-1"><div className="font-bold">{v.name}</div><div className="text-xs text-cream/40">{v.area}</div></div>
                {venue_id === v.id && <span className="font-bold text-lime">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Meet from</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2 w-full bg-panel border-2 border-line rounded-2xl p-3 font-display text-xl text-cream [color-scheme:dark]" />
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Vibe</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(VIBES).map((k) => {
              const on = vibe === k
              const txt = VIBES[k].color === '#8ACE00' ? NIGHT : '#fff'
              return (
                <button key={k} onClick={() => setVibe(k)}
                  className={'rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide border-2 transition ' + (on ? 'border-transparent' : 'border-line bg-panel text-cream/50')}
                  style={on ? { background: VIBES[k].color, color: txt } : {}}>{VIBES[k].label}</button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Note <span className="normal-case font-normal text-cream/30">(optional)</span></label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Pre-drinks from 19:00, look for the green RALLY flag"
            className="mt-2 w-full bg-panel border-2 border-line rounded-2xl p-3 text-cream placeholder:text-cream/30 resize-none" />
        </div>
      </div>

      <StickyBar><Pill onClick={() => onCreate({ match_id: match.id, venue_id, time, vibe, note })} className="w-full">Create & share</Pill></StickyBar>
    </div>
  )
}

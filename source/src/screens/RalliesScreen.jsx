// Rallies — the Social Radius feed (project HEKLA). Self-contained and demo-only:
// reads its own seed shape from data/rallies.js, takes one optional callback so
// the orchestrator can wire navigation later. Renders fine with no props.
import { useState } from 'react'
import { RALLIES, RADII, ralliesByRadius, kindMeta } from '../data/rallies.js'

// Map each radius accent token → the Tailwind classes for its chip/badge.
// Rationed: one accent per layer, mostly mono otherwise.
const ACCENT = {
  cream:  { text: 'text-cream',  ring: 'border-cream/40',  dot: 'bg-cream/70',  selBg: 'bg-cream',  selText: 'text-night' },
  blue:   { text: 'text-blue',   ring: 'border-blue/50',   dot: 'bg-blue',      selBg: 'bg-blue',   selText: 'text-cream' },
  purple: { text: 'text-purple', ring: 'border-purple/50', dot: 'bg-purple',    selBg: 'bg-purple', selText: 'text-cream' },
  lime:   { text: 'text-lime',   ring: 'border-lime/50',   dot: 'bg-lime',      selBg: 'bg-lime',   selText: 'text-night' },
  pink:   { text: 'text-pink',   ring: 'border-pink/50',   dot: 'bg-pink',      selBg: 'bg-pink',   selText: 'text-cream' },
}

const accentFor = (key) => {
  const r = RADII.find((x) => x.key === key)
  return ACCENT[r?.accent] || ACCENT.cream
}

function RadiusBadge({ radiusKey }) {
  const r = RADII.find((x) => x.key === radiusKey)
  if (!r) return null
  const a = accentFor(radiusKey)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${a.ring} px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${a.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
      {r.label}
    </span>
  )
}

function RallyCard({ rally, onOpen }) {
  const k = kindMeta(rally.kind)
  const full = rally.cap != null && rally.going >= rally.cap
  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(rally) : undefined}
      className="w-full text-left rounded-2xl border border-line bg-panel p-4 active:scale-[0.98] transition"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{rally.emoji || k.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cream/40">{k.label}</div>
            <RadiusBadge radiusKey={rally.radius} />
          </div>
          <div className="font-display uppercase text-lg leading-[1.05] mt-1">{rally.title}</div>
          <p className="text-sm text-cream/65 mt-1.5 leading-snug">{rally.blurb}</p>

          <div className="flex items-center gap-2 mt-3 text-xs text-cream/45">
            <span className="font-bold text-cream/70">{rally.host}</span>
            <span className="text-cream/25">·</span>
            <span>{rally.area}</span>
            <span className="text-cream/25">·</span>
            <span>{rally.when}</span>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-sm font-bold">
              {rally.going} going
              {rally.cap != null && <span className="text-cream/40 font-normal"> · {rally.cap - rally.going > 0 ? `${rally.cap - rally.going} spots` : 'full'}</span>}
            </span>
            <span className="text-cream/30 font-bold">→</span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function RalliesScreen({ onOpenRally } = {}) {
  const [active, setActive] = useState('public')

  const chips = [{ key: 'all', label: 'All', accent: 'cream' }, ...RADII]
  const feed = ralliesByRadius(active)
  const hint = active === 'all' ? 'Everything happening, every radius.' : (RADII.find((r) => r.key === active)?.hint || '')

  return (
    <div className="px-5 pb-6">
      <header className="pt-2 pb-4">
        <h1 className="font-display text-[42px] leading-[0.88] uppercase">
          Gather<br /><span className="flourish lowercase text-[46px] text-lime">your people</span>
        </h1>
        <p className="text-sm text-cream/55 mt-3">
          The match was always the excuse. Dinners, runs, swaps, a quiet table for the people who came alone — pick how far the invite travels, then go find the room.
        </p>
      </header>

      {/* Radius filter — horizontally scrollable chips */}
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max pb-1">
          {chips.map((c) => {
            const a = ACCENT[c.accent] || ACCENT.cream
            const selected = active === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setActive(c.key)}
                className={
                  selected
                    ? `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${a.selBg} ${a.selText}`
                    : `shrink-0 rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/55`
                }
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-cream/45 mt-3 italic font-serif">{hint}</p>

      <div className="flex items-center justify-between mt-4 mb-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-cream/40">
          {feed.length} {feed.length === 1 ? 'rally' : 'rallies'}
        </div>
      </div>

      <div className="space-y-3">
        {feed.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel p-5 text-center text-sm text-cream/55">
            Nobody’s called it here yet. Be the one who starts the rally — the rest will follow.
          </div>
        ) : (
          feed.map((r) => <RallyCard key={r.id} rally={r} onOpen={onOpenRally} />)
        )}
      </div>
    </div>
  )
}

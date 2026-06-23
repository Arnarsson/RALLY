// Rallies — the Social Radius feed (project HEKLA). Self-contained and demo-only:
// reads its own seed shape from data/rallies.js, takes one optional callback so
// the orchestrator can wire navigation later. Renders fine with no props.
import { useState } from 'react'
import {
  RALLIES,
  RADII,
  ralliesByRadius,
  kindMeta,
  PAST_RALLIES,
  accessMeta,
} from '../data/rallies.js'

// New data is additive — guard everything. Older bundles won't export these.
const PAST = Array.isArray(PAST_RALLIES) ? PAST_RALLIES : []
const accessFor =
  typeof accessMeta === 'function' ? accessMeta : (k) => ({ key: k, label: k, emoji: '•' })

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
  const stats = rally.hostStats
  const access = Array.isArray(rally.access) ? rally.access : []
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

          {/* Trust — honest, not a badge farm. One muted line, lime number. */}
          {stats && stats.rate != null && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-cream/40">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
              <span className="text-cream/55">{rally.host}</span>
              <span>·</span>
              <span><span className="text-lime font-bold">{stats.rate}%</span> show-up</span>
              {stats.hosted != null && <span className="text-cream/30">· {stats.hosted} hosted</span>}
            </div>
          )}

          {/* Access — say it on the card so nobody has to ask at the door. */}
          {access.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {access.map((key) => {
                const t = accessFor(key)
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] text-cream/55"
                  >
                    <span aria-hidden="true">{t.emoji}</span>
                    {t.label}
                  </span>
                )
              })}
            </div>
          )}

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

// Loners Club — loneliness as a first-class on-ramp. Warm, never pity.
function LonersCard({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        active
          ? 'w-full text-left rounded-2xl border border-lime/50 bg-panel p-4 active:scale-[0.98] transition'
          : 'w-full text-left rounded-2xl border border-cream/25 bg-panel2 p-4 active:scale-[0.98] transition'
      }
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">🫂</span>
        <div className="flex-1 min-w-0">
          <div className="font-display uppercase text-base leading-[1.05]">
            Came alone? <span className="font-serif italic lowercase text-lime normal-case">we saved you a seat.</span>
          </div>
          <p className="text-xs text-cream/55 mt-1 leading-snug">
            {active
              ? 'Just the came-alone tables. Tap to head back to everything.'
              : 'New here, just moved, or your lot bailed — there’s a table with your name on it.'}
          </p>
        </div>
        <span className="text-cream/40 font-bold shrink-0">{active ? '↩' : '→'}</span>
      </div>
    </button>
  )
}

// Lately — a horizontal strip of the city's recent nights. Memory, not metrics.
function LatelyStrip({ rallies, onOpen }) {
  if (!rallies.length) return null
  return (
    <div className="mt-6">
      <div className="text-[11px] uppercase tracking-[0.18em] text-cream/40 mb-2">
        Lately in the city
      </div>
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 w-max pb-1">
          {rallies.map((p) => {
            const recap = p.recap || {}
            return (
              <button
                key={p.id}
                type="button"
                onClick={onOpen ? () => onOpen(p) : undefined}
                className="shrink-0 w-44 text-left rounded-2xl border border-line bg-panel p-3 active:scale-[0.98] transition"
              >
                <span className="text-2xl leading-none">{recap.photoEmoji || p.emoji || '📍'}</span>
                <div className="font-display uppercase text-sm leading-[1.05] mt-2">{p.title}</div>
                {recap.line && <p className="text-[11px] text-cream/50 mt-1 leading-snug">{recap.line}</p>}
                {recap.showed != null && (
                  <div className="text-[11px] text-cream/40 mt-2">
                    <span className="text-lime font-bold">{recap.showed}</span> showed up
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function RalliesScreen({ onOpenRally } = {}) {
  const [active, setActive] = useState('public')
  const [lonersOnly, setLonersOnly] = useState(false)
  const [accessibleOnly, setAccessibleOnly] = useState(false)

  const chips = [{ key: 'all', label: 'All', accent: 'cream' }, ...RADII]

  // Loners mode overrides the radius view; otherwise the normal radius feed.
  let feed = lonersOnly
    ? RALLIES.filter((r) => r.kind === 'loners')
    : ralliesByRadius(active)
  if (accessibleOnly) feed = feed.filter((r) => r.access?.length > 0)

  const hint = lonersOnly
    ? 'A seat held on purpose. Pull up a chair.'
    : active === 'all'
      ? 'Everything happening, every radius.'
      : (RADII.find((r) => r.key === active)?.hint || '')

  // Re-selecting any radius chip is also a clean way back out of loners mode.
  const pickRadius = (key) => {
    setLonersOnly(false)
    setActive(key)
  }

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

      {/* Loners Club — first-class on-ramp, sits right under the header. */}
      <div className="mb-4">
        <LonersCard active={lonersOnly} onToggle={() => setLonersOnly((v) => !v)} />
      </div>

      {/* Radius filter — horizontally scrollable chips */}
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max pb-1">
          {chips.map((c) => {
            const a = ACCENT[c.accent] || ACCENT.cream
            const selected = !lonersOnly && active === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => pickRadius(c.key)}
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

          {/* Accessibility toggle — everyone's welcome, and we mean it. */}
          <button
            type="button"
            onClick={() => setAccessibleOnly((v) => !v)}
            aria-pressed={accessibleOnly}
            className={
              accessibleOnly
                ? 'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] bg-cream text-night'
                : 'shrink-0 rounded-full border border-cream/30 bg-panel px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/55'
            }
          >
            ♿ Accessible
          </button>
        </div>
      </div>

      <p className="text-xs text-cream/45 mt-3 italic font-serif">{hint}</p>

      <div className="flex items-center justify-between mt-4 mb-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-cream/40">
          {feed.length} {feed.length === 1 ? 'rally' : 'rallies'}
        </div>
        {lonersOnly && (
          <button
            type="button"
            onClick={() => setLonersOnly(false)}
            className="text-[11px] uppercase tracking-[0.18em] text-lime font-bold"
          >
            ← all rallies
          </button>
        )}
      </div>

      <div className="space-y-3">
        {feed.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel p-5 text-center text-sm text-cream/55">
            {lonersOnly
              ? 'No came-alone tables out right now. Be the one who sets one — somebody else is hoping you do.'
              : accessibleOnly
                ? 'Nothing flagged accessible here yet. Clear the filter, or be the one who hosts it right.'
                : 'Nobody’s called it here yet. Be the one who starts the rally — the rest will follow.'}
          </div>
        ) : (
          feed.map((r) => <RallyCard key={r.id} rally={r} onOpen={onOpenRally} />)
        )}
      </div>

      {/* Lately — recent nights, only if we have any. */}
      <LatelyStrip rallies={PAST} onOpen={onOpenRally} />
    </div>
  )
}

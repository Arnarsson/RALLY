// Start a rally — the create form for project HEKLA. Self-contained: reads its
// own option shape from data/rallies.js, owns local form state, and hands a
// finished draft up through onCreate so the orchestrator can persist + navigate.
// Same idiom as CreateScreen.jsx (the plan form), dressed in the radius-accent
// language of RallyScreen / RalliesScreen. Voice per SOUL.md — warm, a take.
import { useState } from 'react'
import { KINDS, RADII, ACCESS_TAGS, accessMeta, kindMeta } from '../data/rallies.js'
import { RECURRENCE } from '../lib/creator.js'

// Radius accent token → Tailwind classes. Same rationed mapping the feed uses:
// one accent per element, mono on ink otherwise.
const ACCENT = {
  cream:  { text: 'text-cream',  ring: 'border-cream/40',  selBg: 'bg-cream',  selText: 'text-night' },
  blue:   { text: 'text-blue',   ring: 'border-blue/50',   selBg: 'bg-blue',   selText: 'text-cream' },
  purple: { text: 'text-purple', ring: 'border-purple/50', selBg: 'bg-purple', selText: 'text-cream' },
  lime:   { text: 'text-lime',   ring: 'border-lime/50',   selBg: 'bg-lime',   selText: 'text-night' },
  pink:   { text: 'text-pink',   ring: 'border-pink/50',   selBg: 'bg-pink',   selText: 'text-cream' },
}

const accentFor = (radiusKey) => {
  const r = RADII.find((x) => x.key === radiusKey)
  return ACCENT[r?.accent] || ACCENT.cream
}

function SectionLabel({ children }) {
  return <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cream/40 mb-2">{children}</div>
}

export default function CreateRallyScreen({ onBack, onCreate } = {}) {
  const [kind, setKind] = useState('social')
  const [radius, setRadius] = useState('public')
  const [title, setTitle] = useState('')
  const [blurb, setBlurb] = useState('')
  const [area, setArea] = useState('')
  const [when, setWhen] = useState('')
  const [cap, setCap] = useState('')
  const [access, setAccess] = useState([])
  const [recurrence, setRecurrence] = useState('none')

  const r = RADII.find((x) => x.key === radius)
  const a = accentFor(radius)
  const ready = title.trim().length > 0

  const toggleAccess = (key) =>
    setAccess((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const submit = () => {
    if (!ready) return
    onCreate?.({
      kind,
      radius,
      title: title.trim(),
      blurb,
      area,
      when,
      cap,
      access,
      emoji: kindMeta(kind).emoji,
      recurrence,
    })
  }

  return (
    <div className="px-5 pb-28">
      {/* 1 — Header: back + title */}
      <header className="pt-2 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/70 active:scale-[0.98] transition"
        >
          ← Back
        </button>
      </header>
      <h1 className="font-display uppercase text-[34px] leading-[0.92] mb-1">Start a rally</h1>
      <p className="text-sm text-cream/55 mb-8">
        Call it, and the room fills up around you. Pick how far the invite travels — the rest is just showing up.
      </p>

      <div className="space-y-8">
        {/* 2 — Kind picker */}
        <div>
          <SectionLabel>What kind of night</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {Object.entries(KINDS).map(([key, meta]) => {
              const on = kind === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setKind(key)}
                  className={
                    on
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-lime px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-night'
                      : 'inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/55'
                  }
                >
                  <span aria-hidden="true">{meta.emoji}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 3 — Radius dial: how far the invite reaches */}
        <div>
          <SectionLabel>How far it travels</SectionLabel>
          <div className="-mx-5 px-5 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 w-max pb-1">
              {RADII.map((layer) => {
                const la = ACCENT[layer.accent] || ACCENT.cream
                const on = radius === layer.key
                return (
                  <button
                    key={layer.key}
                    type="button"
                    onClick={() => setRadius(layer.key)}
                    className={
                      on
                        ? `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${la.selBg} ${la.selText}`
                        : `shrink-0 rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/55`
                    }
                  >
                    {layer.label}
                  </button>
                )
              })}
            </div>
          </div>
          {r && (
            <div className="mt-3">
              <p className={`text-sm leading-snug ${a.text}`}>{r.hint}</p>
              <p className="text-xs text-cream/45 mt-1 italic font-serif">{r.example}</p>
            </div>
          )}
        </div>

        {/* 4 — Title */}
        <div>
          <SectionLabel>What are we calling it</SectionLabel>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are we doing?"
            className="w-full bg-panel border border-line rounded-xl p-3 text-cream placeholder:text-cream/30"
          />
        </div>

        {/* 5 — Blurb */}
        <div>
          <SectionLabel>The pitch</SectionLabel>
          <textarea
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            rows={3}
            placeholder="Sell it in one line. Give it a take."
            className="w-full bg-panel border border-line rounded-xl p-3 text-cream placeholder:text-cream/30 resize-none"
          />
        </div>

        {/* 6 — When + Area */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <SectionLabel>When</SectionLabel>
            <input
              type="text"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              placeholder="Sat 21:00"
              className="w-full bg-panel border border-line rounded-xl p-3 text-cream placeholder:text-cream/30"
            />
          </div>
          <div>
            <SectionLabel>Where</SectionLabel>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Nørrebro"
              className="w-full bg-panel border border-line rounded-xl p-3 text-cream placeholder:text-cream/30"
            />
          </div>
        </div>

        {/* 7 — Cap (headcount only, no per-head fee, ever) */}
        <div>
          <SectionLabel>Room for</SectionLabel>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            placeholder="—"
            className="w-full bg-panel border border-line rounded-xl p-3 text-cream placeholder:text-cream/30 [color-scheme:dark]"
          />
          <p className="text-xs text-cream/45 mt-2 leading-snug">Leave blank for an open door.</p>
        </div>

        {/* 8 — Repeats: turn a one-off into a standing thing */}
        <div>
          <SectionLabel>Repeats?</SectionLabel>
          <p className="text-xs text-cream/45 mb-2 leading-snug">Make it a standing thing — same crew, every week.</p>
          <div className="flex flex-wrap gap-2">
            {RECURRENCE.map((option) => {
              const on = recurrence === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRecurrence(option.key)}
                  aria-pressed={on}
                  className={
                    on
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-lime px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-night'
                      : 'inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/55'
                  }
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 9 — Access tags */}
        <div>
          <SectionLabel>Welcomes — say it out loud</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {ACCESS_TAGS.map((tag) => {
              const on = access.includes(tag.key)
              const meta = accessMeta(tag.key)
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => toggleAccess(tag.key)}
                  aria-pressed={on}
                  className={
                    on
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-cream px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-night'
                      : 'inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/55'
                  }
                >
                  <span aria-hidden="true">{meta.emoji}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 10 — Submit */}
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className={
            ready
              ? 'w-full rounded-full bg-lime px-4 py-4 text-base font-display uppercase tracking-[0.04em] text-night active:scale-[0.98] transition'
              : 'w-full rounded-full bg-lime/30 px-4 py-4 text-base font-display uppercase tracking-[0.04em] text-night/50 cursor-not-allowed transition'
          }
        >
          Start the rally
        </button>
      </div>
    </div>
  )
}

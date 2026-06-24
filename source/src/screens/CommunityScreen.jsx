// Community detail — Layer 3 of the Social Radius (project HEKLA, S2.3). The
// standing-crew page: who's in, what's on. Self-contained — imports only react;
// the orchestrator resolves community/rallies/members from communities.js and
// wires onOpenRally/onBack. Renders gracefully for a missing community and an
// empty calendar. No-semicolon style, mobile-first px-5, parent owns scroll.
import { useMemo } from 'react'
import { suggestNextRally } from '../lib/suggest.js'

// Community accent token → Tailwind classes. Same rationed mapping the feed and
// rally screen use: one accent per element, mono on ink otherwise. Only real
// tokens here (cream/blue/purple/lime/pink) — cyan/violet aren't classes.
const ACCENT = {
  cream:  { text: 'text-cream',  ring: 'border-cream/40',  dot: 'bg-cream/70',  solid: 'bg-cream',  on: 'text-night' },
  blue:   { text: 'text-blue',   ring: 'border-blue/50',   dot: 'bg-blue',      solid: 'bg-blue',   on: 'text-cream' },
  purple: { text: 'text-purple', ring: 'border-purple/50', dot: 'bg-purple',    solid: 'bg-purple', on: 'text-cream' },
  lime:   { text: 'text-lime',   ring: 'border-lime/50',   dot: 'bg-lime',      solid: 'bg-lime',   on: 'text-night' },
  pink:   { text: 'text-pink',   ring: 'border-pink/50',   dot: 'bg-pink',      solid: 'bg-pink',   on: 'text-cream' },
}

const accentFor = (token) => ACCENT[token] || ACCENT.cream

function SectionLabel({ children }) {
  return <div className="text-[11px] uppercase tracking-[0.18em] text-cream/40 mb-2">{children}</div>
}

// Compact rally card — the RalliesScreen idiom, trimmed to fit a crew's calendar.
// Inert-safe: with no onOpen it renders as a plain (unclickable-feeling) card.
function RallyCard({ rally, onOpen }) {
  const kindLabel = (rally.kind || 'rally').replace(/[_-]/g, ' ')
  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(rally) : undefined}
      className="w-full text-left rounded-2xl border border-line bg-panel p-4 active:scale-[0.98] transition"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{rally.emoji || '📍'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-cream/40">{kindLabel}</div>
          <div className="font-display uppercase text-lg leading-[1.05] mt-1">{rally.title}</div>
          {rally.blurb && <p className="text-sm text-cream/65 mt-1.5 leading-snug">{rally.blurb}</p>}

          <div className="flex items-center gap-2 mt-3 text-xs text-cream/45 flex-wrap">
            {rally.host && <span className="font-bold text-cream/70">{rally.host}</span>}
            {rally.area && <><span className="text-cream/25">·</span><span>{rally.area}</span></>}
            {rally.when && <><span className="text-cream/25">·</span><span>{rally.when}</span></>}
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-sm font-bold">
              {rally.going} going
              {rally.cap != null && (
                <span className="text-cream/40 font-normal"> · {rally.cap - rally.going > 0 ? `${rally.cap - rally.going} spots` : 'full'}</span>
              )}
            </span>
            <span className="text-cream/30 font-bold">→</span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function CommunityScreen({ community, rallies = [], members = [], onOpenRally, onSpinUp, onBack } = {}) {
  // Guard the arrays — older bundles or a sparse orchestrator might pass nothing.
  const memberList = Array.isArray(members) ? members : []
  const rallyList = Array.isArray(rallies) ? rallies : []

  // How many members exist beyond the avatar preview we were handed. Memoised so
  // the chip row doesn't recompute on unrelated re-renders.
  const extra = useMemo(() => {
    const total = community?.memberCount ?? memberList.length
    return Math.max(0, total - memberList.length)
  }, [community?.memberCount, memberList.length])

  // The AI "next up" — read the crew's history, propose the next rally (S4.1).
  // suggestNextRally guards a falsy community itself, so this stays a top-level
  // hook above the empty-state return (order never changes between renders).
  const suggestion = useMemo(() => suggestNextRally(community, rallyList), [community, rallyList])

  // Graceful empty state — same warmth as the feed's "nobody's called it" line.
  if (!community) {
    return (
      <div className="px-5 pb-6">
        <header className="pt-2 pb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/70 active:scale-[0.98] transition"
          >
            ← Back
          </button>
        </header>
        <div className="rounded-2xl border border-line bg-panel p-6 text-center">
          <div className="text-3xl mb-3">🫥</div>
          <h1 className="font-display uppercase text-2xl leading-[0.95]">No crew here</h1>
          <p className="text-sm text-cream/55 mt-3 leading-snug">
            This club slipped off the map. Head back — there’s a room out there with your people in it.
          </p>
        </div>
      </div>
    )
  }

  const a = accentFor(community.accent)

  return (
    <div className="px-5 pb-10">
      {/* 1 — Header: back pill (copied from RallyScreen) + accent badge */}
      <header className="pt-2 pb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/70 active:scale-[0.98] transition"
        >
          ← Back
        </button>
        <span className={`inline-flex items-center gap-1.5 rounded-full border ${a.ring} px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${a.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
          Community
        </span>
      </header>

      {/* 2 — Hero: emoji + name tinted with the accent, then the count line */}
      <div className="mb-5">
        <div className="text-4xl leading-none">{community.emoji || '🫂'}</div>
        <h1 className={`font-display uppercase text-[34px] leading-[0.92] mt-3 ${a.text}`}>{community.name}</h1>
        <div className="flex items-center gap-2 mt-3 text-xs text-cream/45 flex-wrap">
          <span className="font-bold text-cream/70">{community.memberCount ?? memberList.length} members</span>
          {community.area && <><span className="text-cream/25">·</span><span>{community.area}</span></>}
        </div>
      </div>

      {/* 3 — The blurb: the crew's take, in the serif flourish */}
      {community.blurb && (
        <p className="flourish font-serif italic text-xl leading-snug text-cream/80 mb-6">{community.blurb}</p>
      )}

      {/* 3.5 — The nudge: AI "next up" suggestion, only when there's one. A quiet
          card in the lowdown's voice — accent rationed to the label + button. */}
      {suggestion && (
        <div className="rounded-2xl border border-line bg-panel p-4 mb-6">
          <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] ${a.text} mb-2`}>
            <span aria-hidden="true">↗</span>
            <span>Next up</span>
          </div>
          <div className="font-display uppercase text-lg leading-[1.05]">{suggestion.draft.title}</div>
          <p className="font-serif italic text-base leading-snug text-cream/75 mt-1.5">{suggestion.reason}</p>
          <div className="flex items-center gap-2 mt-3 text-xs text-cream/45 flex-wrap">
            <span aria-hidden="true">{suggestion.draft.emoji}</span>
            <span className="uppercase tracking-[0.12em] text-cream/55">{(suggestion.draft.kind || 'rally').replace(/[_-]/g, ' ')}</span>
            {suggestion.draft.area && <><span className="text-cream/25">·</span><span>{suggestion.draft.area}</span></>}
            {suggestion.draft.when && <><span className="text-cream/25">·</span><span>{suggestion.draft.when}</span></>}
          </div>
          <button
            type="button"
            onClick={onSpinUp ? () => onSpinUp(suggestion.draft) : undefined}
            disabled={!onSpinUp}
            className={
              onSpinUp
                ? `mt-4 inline-flex items-center gap-1.5 rounded-full ${a.solid} ${a.on} px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] active:scale-[0.98] transition`
                : 'mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/30'
            }
          >
            Spin it up →
          </button>
        </div>
      )}

      {/* 4 — Who's in: a row of flag chips + the overflow tail */}
      <div className="mb-6">
        <SectionLabel>Who’s in</SectionLabel>
        {memberList.length === 0 && extra === 0 ? (
          <div className="rounded-2xl border border-line bg-panel p-4 text-sm text-cream/55 leading-snug">
            Quiet so far. Be the first face in the door — the rest follow the brave.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {memberList.map((m) => (
              <span
                key={m.id}
                title={m.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-2.5 py-1 text-xs text-cream/80"
              >
                <span aria-hidden="true">{m.flag || '🏳️'}</span>
                {m.name && <span className="font-bold text-cream/70">{m.name.charAt(0)}</span>}
              </span>
            ))}
            {extra > 0 && (
              <span className="inline-flex items-center rounded-full border border-line bg-panel px-2.5 py-1 text-xs text-cream/40">
                +{extra} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* 5 — What's on: the crew's rallies, or a nudge to call one */}
      <div>
        <SectionLabel>What’s on</SectionLabel>
        {rallyList.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel p-5 text-center text-sm text-cream/55 leading-snug">
            Nothing on the calendar yet — be the one who calls it. The lot are waiting for somebody to.
          </div>
        ) : (
          <div className="space-y-3">
            {rallyList.map((r) => (
              <RallyCard key={r.id} rally={r} onOpen={onOpenRally} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

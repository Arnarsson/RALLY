// Rally detail — the single-rally screen for project HEKLA. Self-contained:
// reads its own shape from data/rallies.js, fires light telemetry through
// data/telemetry.js, and takes one optional onBack callback so the orchestrator
// wires it into the nav. Renders gracefully for a missing or sparse rally — every
// block below the hero is optional and only paints when its data is present.
import { useState, useEffect } from 'react'
import { kindMeta, radiusByKey, accessMeta } from '../data/rallies.js'
import { friendsGoing, friendsGoingLabel } from '../lib/social.js'
import { isRecurring, recurrenceLabel, nextCapTier } from '../lib/creator.js'
import * as telemetry from '../data/telemetry.js'

// Radius accent → Tailwind classes. Same mapping the feed uses, rationed: one
// accent per element, mostly mono on ink otherwise.
const ACCENT = {
  cream:  { text: 'text-cream',  ring: 'border-cream/40',  dot: 'bg-cream/70',  solid: 'bg-cream',  on: 'text-night' },
  blue:   { text: 'text-blue',   ring: 'border-blue/50',   dot: 'bg-blue',      solid: 'bg-blue',   on: 'text-cream' },
  purple: { text: 'text-purple', ring: 'border-purple/50', dot: 'bg-purple',    solid: 'bg-purple', on: 'text-cream' },
  lime:   { text: 'text-lime',   ring: 'border-lime/50',   dot: 'bg-lime',      solid: 'bg-lime',   on: 'text-night' },
  pink:   { text: 'text-pink',   ring: 'border-pink/50',   dot: 'bg-pink',      solid: 'bg-pink',   on: 'text-cream' },
}

const accentFor = (radiusKey) => {
  const r = radiusByKey(radiusKey)
  return ACCENT[r?.accent] || ACCENT.cream
}

// Telemetry should never take the screen down — guard every call. Payload is
// optional and stays light (a rallyId at most); telemetry.js strips anything
// location-shaped and no-ops entirely without consent.
const track = (name, payload = {}) => {
  try { telemetry.logEvent?.(name, payload) } catch { /* telemetry is best-effort */ }
}

function RadiusBadge({ radiusKey }) {
  const r = radiusByKey(radiusKey)
  if (!r) return null
  const a = accentFor(radiusKey)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${a.ring} px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${a.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
      {r.label}
    </span>
  )
}

function SectionLabel({ children }) {
  return <div className="text-[11px] uppercase tracking-[0.18em] text-cream/40 mb-2">{children}</div>
}

export default function RallyScreen({ rally, onBack, joined = false, waitlisted = false, waiting = 0, onToggleJoin, onUnlockCap, onScheduleNext, onInviteReward } = {}) {
  // Consent mirror — reflect the stored opt-in, re-render on toggle. Read once;
  // if the helper is missing or throws, we stay opted-out (off by default).
  const readConsent = () => {
    try { return !!telemetry.hasConsent?.() } catch { return false }
  }
  const [consent, setConsent] = useState(readConsent)
  const [shareState, setShareState] = useState('') // '', 'shared', 'copied'

  // A deliberate view is the first signal in the intent graph. No-ops without
  // consent; carries only the rally id (telemetry strips anything else).
  useEffect(() => {
    if (rally?.id) track('rally_view', { rallyId: rally.id })
  }, [rally?.id])

  // Graceful empty state — same warmth as the feed's "nobody's called it" line.
  if (!rally) {
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
          <div className="text-3xl mb-3">🌫️</div>
          <h1 className="font-display uppercase text-2xl leading-[0.95]">This rally drifted off</h1>
          <p className="text-sm text-cream/55 mt-3 leading-snug">
            Whatever was here has wandered into the night. Head back — there’s always another room filling up.
          </p>
        </div>
      </div>
    )
  }

  const k = kindMeta(rally.kind)
  const a = accentFor(rally.radius)
  const full = rally.cap != null && rally.going >= rally.cap
  const spotsLeft = rally.cap != null ? rally.cap - rally.going : null
  const stats = rally.hostStats
  const recap = rally.past && rally.recap ? rally.recap : null
  // Who you know is going — the people whose presence changes your mind.
  const friends = friendsGoing(rally.id)
  const friendsLabel = friendsGoingLabel(rally.id)

  // Build the share payload from what we have. Code-first so it works on a dead
  // phone at the door; link is the soft fallback.
  const shareUrl = rally.code ? `https://rally.futbol/r/${rally.code}` : 'https://rally.futbol'
  const shareText = `${rally.title} — ${rally.when}${rally.area ? ` · ${rally.area}` : ''}. Come find us.${rally.code ? ` Code: ${rally.code}` : ''}`

  const doShare = async () => {
    track('rally_share', { rallyId: rally.id })
    // Native share first, clipboard second, then a silent no-op. Never throw.
    try {
      if (navigator.share) {
        await navigator.share({ title: rally.title, text: shareText, url: shareUrl })
        setShareState('shared')
        setTimeout(() => setShareState(''), 1400)
        return
      }
    } catch { /* user cancelled or share unavailable */ }
    try {
      await navigator.clipboard?.writeText?.(shareUrl)
      setShareState('copied')
      setTimeout(() => setShareState(''), 1400)
    } catch { /* file:// / no clipboard — fail quietly */ }
  }

  const doCopy = async () => {
    track('rally_share', { rallyId: rally.id })
    try {
      await navigator.clipboard?.writeText?.(shareUrl)
      setShareState('copied')
      setTimeout(() => setShareState(''), 1400)
    } catch { /* no clipboard — fail quietly */ }
  }

  const doInvite = () => {
    // A mate joining through you is the referral loop. Log the intent, mint the
    // reward (15% Miinto — same loop the football share fires), then share.
    track('rally_invite', { rallyId: rally.id })
    try { onInviteReward?.(rally) } catch { /* reward mint is best-effort */ }
    doShare()
  }

  // The whole loop in one tap. Decide join-vs-leave from the CURRENT status:
  // already in or waitlisted ⇒ this tap is a leave. Telemetry is best-effort.
  const doToggleJoin = () => {
    if (!onToggleJoin) return
    const leaving = joined || waitlisted
    track(leaving ? 'rally_leave' : 'rally_join', { rallyId: rally.id })
    onToggleJoin()
  }

  const onConsentChange = (next) => {
    setConsent(next)
    try { telemetry.setConsent?.(next) } catch { /* persist is best-effort */ }
  }

  return (
    <div className="px-5 pb-10">
      {/* 1 — Header: back + radius badge */}
      <header className="pt-2 pb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cream/70 active:scale-[0.98] transition"
        >
          ← Back
        </button>
        <RadiusBadge radiusKey={rally.radius} />
      </header>

      {/* 2 — Hero */}
      <div className="mb-6">
        <div className="text-4xl leading-none">{rally.emoji || k.emoji}</div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-cream/40 mt-3">{k.label}</div>
        <h1 className="font-display uppercase text-[34px] leading-[0.92] mt-1">{rally.title}</h1>
        {rally.blurb && <p className="flourish text-xl leading-snug text-cream/80 mt-3">{rally.blurb}</p>}
        <div className="flex items-center gap-2 mt-4 text-xs text-cream/45 flex-wrap">
          {rally.host && <span className="font-bold text-cream/70">{rally.host}</span>}
          {rally.area && <><span className="text-cream/25">·</span><span>{rally.area}</span></>}
          {rally.when && <><span className="text-cream/25">·</span><span>{rally.when}</span></>}
          {isRecurring(rally) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel2 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-lime">
              ↻ {recurrenceLabel(rally.recurrence)}
            </span>
          )}
        </div>
      </div>

      {/* 3 — Trust badge: the thing that lets a stranger join an inner-ring rally */}
      {stats && (
        <div className="rounded-2xl border border-lime/30 bg-panel p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display uppercase text-lg leading-none text-lime">{rally.host}</span>
            <span className="text-cream/25">·</span>
            <span className="font-bold text-cream">{stats.rate}% show-up</span>
            <span className="text-cream/25">·</span>
            <span className="font-bold text-cream">{stats.hosted} hosted</span>
          </div>
          <p className="text-[11px] text-cream/45 mt-2 leading-snug">
            People who say they’re coming, come. That’s what the number means.
          </p>
        </div>
      )}

      {/* 3b — Friends going: the people whose presence changes your mind.
          Hidden entirely when none are going (created/past rallies). */}
      {friendsLabel && (
        <div className="rounded-2xl border border-lime/30 bg-panel p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              {friends.slice(0, 3).map((f, i) => (
                <span
                  key={f.id}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-panel2 border border-line text-sm ${i > 0 ? '-ml-1' : ''}`}
                >
                  {f.flag}
                </span>
              ))}
            </div>
            <span className="font-bold text-lime">{friendsLabel}</span>
          </div>
          <p className="text-[11px] text-cream/45 mt-2 leading-snug">
            The people whose presence changes your mind.
          </p>
        </div>
      )}

      {/* 4 — The numbers */}
      <div className="rounded-2xl border border-line bg-panel p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="font-display uppercase text-2xl leading-none">
            {rally.going} going
            {waiting > 0 && <span className="text-cream/40 text-base"> · {waiting} waiting</span>}
          </span>
          <span className={`text-[11px] uppercase tracking-[0.16em] font-bold ${full ? 'text-pink' : a.text}`}>
            {rally.cap == null ? 'open' : full ? 'Full' : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'}`}
          </span>
        </div>
      </div>

      {/* 4b — The CTA: the whole loop in one tap. This is the nudge made a button.
          Past rallies are read-only — they already happened; the recap is the point. */}
      {!rally.past && (() => {
        const inert = !onToggleJoin
        // waitlisted → leave the list; joined → drop out; full → queue; else → in.
        const label = waitlisted
          ? 'On the waitlist ✓'
          : joined
            ? "You're in ✓"
            : full
              ? 'Join the waitlist'
              : "I'm in"
        const filled = joined && !waitlisted
        const hint = waitlisted
          ? (waiting > 0 ? `${waiting} waiting — we’ll wave you in the second a seat opens.` : 'We’ll wave you in the second a seat opens.')
          : joined
            ? 'Tap to drop out — no hard feelings, but you’ll be missed.'
            : full
              ? (waiting > 0 ? `Room’s full — ${waiting} already waiting. Get in line, we save seats.` : 'Room’s full, but we save seats. Get in line.')
              : 'Say you’re coming. Then actually come — that’s the whole point.'
        return (
          <div className="mb-6">
            <button
              type="button"
              onClick={doToggleJoin}
              disabled={inert}
              aria-pressed={joined || waitlisted}
              className={
                inert
                  ? 'w-full rounded-full border border-line bg-panel px-4 py-4 text-base font-bold uppercase tracking-[0.12em] text-cream/30 cursor-default'
                  : filled
                    ? 'w-full rounded-full bg-lime px-4 py-4 text-base font-bold uppercase tracking-[0.12em] text-night active:scale-[0.98] transition'
                    : 'w-full rounded-full border border-lime/50 bg-panel px-4 py-4 text-base font-bold uppercase tracking-[0.12em] text-lime active:scale-[0.98] transition'
              }
            >
              {label}
            </button>
            <p className="text-[11px] text-cream/45 mt-2 leading-snug text-center">{hint}</p>
          </div>
        )
      })()}

      {/* 5 — Accessibility: say it on the card so nobody has to ask at the door */}
      {rally.access?.length > 0 && (
        <div className="mb-6">
          <SectionLabel>Welcomes</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {rally.access.map((key) => {
              const tag = accessMeta(key)
              return (
                <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-3 py-1.5 text-xs text-cream/80">
                  <span aria-hidden>{tag.emoji}</span> {tag.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 6 — Bring a friend / invite (offline-first, code at the door) */}
      <div className="rounded-2xl border border-line bg-panel p-4 mb-6">
        <SectionLabel>Bring a friend</SectionLabel>
        {rally.code && (
          <>
            <div className="text-[10px] uppercase tracking-[0.18em] text-cream/40">Show at the door</div>
            <div className="font-display uppercase text-3xl leading-none text-lime mt-1 break-words">{rally.code}</div>
            <p className="text-[11px] text-cream/45 mt-2 leading-snug">
              Works offline, works on a dead phone. Flash the code, you’re in.
            </p>
          </>
        )}

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={doCopy}
            className="flex-1 rounded-full border border-line bg-night px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-cream/80 active:scale-[0.98] transition"
          >
            {shareState === 'copied' ? 'Link copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={doInvite}
            className="flex-1 rounded-full bg-lime px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-night active:scale-[0.98] transition"
          >
            {shareState === 'shared' ? 'Shared' : 'Share'}
          </button>
        </div>

        <p className="text-[11px] text-cream/55 mt-4 leading-snug">
          A mate joins through you? You <span className="text-lime font-bold">both</span> get 15% at Miinto. Bring the one who never comes out — that’s the whole point.
        </p>
      </div>

      {/* 7 — Recap: the memory that triggers the re-rally */}
      {recap && (
        <div className="rounded-2xl border border-line bg-panel2 p-5 mb-6 text-center">
          <div className="text-4xl leading-none">{recap.photoEmoji}</div>
          {recap.line && <p className="flourish text-xl leading-snug text-cream/85 mt-3">“{recap.line}”</p>}
          {recap.showed != null && (
            <div className="text-[11px] uppercase tracking-[0.18em] text-cream/45 mt-3">{recap.showed} showed up</div>
          )}
        </div>
      )}

      {/* 7b — Your rally: host tools. Only the host sees these. */}
      {rally.mine && (() => {
        const tier = nextCapTier(rally)
        return (
          <div className="mb-6">
            <SectionLabel>Your rally</SectionLabel>
            <div className="rounded-2xl border border-lime/30 bg-panel p-4">
              {/* Capacity unlock — flat fee, never per-head. */}
              {tier ? (
                <>
                  <div className="text-sm font-bold text-cream">Filling up?</div>
                  <p className="text-[13px] text-cream/65 mt-1 leading-snug">
                    Lift the cap to {tier.cap} — flat <span className="text-lime font-bold">{tier.price} kr</span>, never per-head.
                  </p>
                  <button
                    type="button"
                    onClick={() => onUnlockCap?.(tier.key)}
                    disabled={!onUnlockCap}
                    className={
                      onUnlockCap
                        ? 'w-full rounded-full bg-lime px-4 py-3 mt-3 text-sm font-bold uppercase tracking-[0.12em] text-night active:scale-[0.98] transition'
                        : 'w-full rounded-full border border-line bg-panel px-4 py-3 mt-3 text-sm font-bold uppercase tracking-[0.12em] text-cream/30 cursor-default'
                    }
                  >
                    Lift the cap
                  </button>
                </>
              ) : (
                <p className="text-[13px] text-cream/55 leading-snug">
                  {rally.capTier ? `Cap lifted to ${rally.cap}. ` : ''}Open door — no cap.
                </p>
              )}

              {/* Schedule next — only for recurring rallies. */}
              {isRecurring(rally) && (
                <div className="mt-4 pt-4 border-t border-line">
                  <button
                    type="button"
                    onClick={() => onScheduleNext?.()}
                    disabled={!onScheduleNext}
                    className={
                      onScheduleNext
                        ? 'w-full rounded-full border border-lime/50 bg-panel px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-lime active:scale-[0.98] transition'
                        : 'w-full rounded-full border border-line bg-panel px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-cream/30 cursor-default'
                    }
                  >
                    Schedule the next one
                  </button>
                  <p className="text-[11px] text-cream/45 mt-2 leading-snug text-center">
                    Keep the streak — spin up next week’s now.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* 8 — Consent: opt in to the city's pulse, GDPR-clean */}
      <button
        type="button"
        onClick={() => onConsentChange(!consent)}
        aria-pressed={consent}
        className="w-full text-left rounded-2xl border border-line bg-panel p-4 active:scale-[0.99] transition"
      >
        <div className="flex items-center gap-3">
          <span
            className={`shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-md border ${consent ? 'bg-lime border-lime text-night' : 'border-cream/30 text-transparent'}`}
            aria-hidden
          >
            ✓
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold">Count me in the city’s pulse</div>
            <div className="text-[11px] text-cream/45 mt-1 leading-snug">
              Anonymous, no location, off by default. Change it anytime.
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}

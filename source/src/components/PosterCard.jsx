// PosterCard — 9:16 matchday poster / share-card component.
//
// Reproduces the "Section 02 · Matchday poster" design from the Floodlight
// preview (rally-floodlight-preview.html): dark ink base, dual team-colour
// glow, halftone texture overlay, Archivo Black team names, Instrument Serif
// "versus" accent, flags, lowdown line, win-prob / TV / going pills, and a
// JOIN THE RALLY footer with the plan URL.
//
// Usage:
//   import PosterCard from './components/PosterCard'
//   <PosterCard match={match} plan={plan} />
//
// Props
//   match   — fixture/match object from fixtures.json / mockData MATCHES shape.
//             Required fields: team_a, team_b. Everything else has a fallback.
//   plan    — optional plan object { venue: {name}, participants: [] }
//   planId  — optional plan id / slug for the footer URL
//   width   — optional override (number, px). Default 340.
//   style   — optional extra inline style on the root element.

import React from 'react'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatKickoff(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  } catch {
    return ''
  }
}

function formatDay(match) {
  // Try the pre-formatted day string first ("THU 11 JUN"), else derive from kickoff.
  if (match.day) return match.day
  if (!match.kickoff) return ''
  try {
    const d = new Date(match.kickoff)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
  } catch {
    return ''
  }
}

function isTonight(match) {
  if (!match.kickoff) return false
  try {
    const now = new Date()
    const k = new Date(match.kickoff)
    return (
      k.getFullYear() === now.getFullYear() &&
      k.getMonth() === now.getMonth() &&
      k.getDate() === now.getDate()
    )
  } catch {
    return false
  }
}

function statusTag(match) {
  if (match.status === 'in') return `LIVE ${match.clock || ''}`
  if (match.status === 'post') return 'FULL TIME'
  if (isTonight(match)) return 'TONIGHT'
  return formatDay(match) || 'UPCOMING'
}

function winProb(match) {
  // Returns { label, pct } for the highest probability side, or null.
  const { prob_a, prob_draw, prob_b, team_a } = match
  if (!prob_a && !prob_b) return null
  const pa = Number(prob_a) || 0
  const pb = Number(prob_b) || 0
  const pd = Number(prob_draw) || 0
  if (pa === 0 && pb === 0) return null
  const top = pa >= pb ? { label: team_a, pct: Math.round(pa * 100) } : { label: match.team_b, pct: Math.round(pb * 100) }
  if (pd > pa && pd > pb) return null // draw favourite — show nothing rather than mislead
  return top
}

function firstTv(match) {
  const tv = match.tv
  if (!tv || !tv.length) return null
  const t = tv[0]
  return typeof t === 'string' ? t : t?.name || null
}

function truncate(str, max = 115) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ── colour helpers ────────────────────────────────────────────────────────────

// Ensure a colour is a valid hex string, else return a fallback.
function safeColor(c, fallback) {
  return (c && /^#[0-9a-fA-F]{3,8}$/.test(c.trim())) ? c.trim() : fallback
}

// Blend a hex colour toward transparent using CSS color-mix (supported in
// modern browsers). Falls back to the colour directly if not.
function alpha(hex, pct) {
  return `color-mix(in srgb, ${hex} ${pct}%, transparent)`
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PosterCard({ match = {}, plan, planId, width = 340, style }) {
  const W = Number(width) || 340
  const H = Math.round(W * (16 / 9))

  // ── data extraction ─────────────────────────────────────────────────────────
  const teamA = match.team_a || 'Team A'
  const teamB = match.team_b || 'Team B'
  const flagA = match.flag_a || ''
  const flagB = match.flag_b || ''
  const colorA = safeColor(match.color_a, '#006847')
  const colorB = safeColor(match.color_b, '#c8102e')

  const kickoffStr = formatKickoff(match.kickoff)
  const dayLabel = formatDay(match)
  const tag = statusTag(match)
  const isLive = match.status === 'in'

  // Archive photo — B&W archive image when available
  const archiveSrc = match.archive?.src || null

  // Lowdown: check editorial fields first, then fall back to h2h line
  const lowdown = truncate(
    match.lowdown || match.commentary || match.h2h || ''
  )

  const prob = winProb(match)
  const tvChannel = firstTv(match)

  const venueName = plan?.venue?.name || match.venue?.split('·')[0]?.trim() || ''
  const goingCount = plan?.participants?.length ?? null

  // Plan URL slug
  const planSlug = planId || (venueName ? venueName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : null)
  const footerUrl = planSlug ? `rally.futbol/p/${planSlug}` : 'rally.futbol'

  // When line: compose "tonight · 21:00 · Reffen" or "THU 11 JUN · 21:00"
  const whenParts = []
  if (isTonight(match)) whenParts.push('tonight')
  else if (dayLabel) whenParts.push(dayLabel)
  if (kickoffStr) whenParts.push(kickoffStr)
  if (venueName) whenParts.push(venueName)
  const whenLine = whenParts.join(' · ')

  // ── styles (all inline so no Tailwind compiler needed) ──────────────────────
  const INK = '#0B0B0B'
  const LIME = '#A8FF00'
  const PINK = '#FF2D7A'
  const CYAN = '#00C2FF'
  const TEXT = '#F5F5F1'
  const MUT = '#9b9b93'
  const PAPER = '#F3F0E8'

  const root = {
    position: 'relative',
    width: W,
    height: H,
    borderRadius: 24,
    overflow: 'hidden',
    background: INK,
    border: '1px solid #242424',
    boxShadow: '0 30px 70px -30px rgba(0,0,0,.9)',
    fontFamily: 'Inter, system-ui, sans-serif',
    WebkitFontSmoothing: 'antialiased',
    flexShrink: 0,
    ...style,
  }

  const photoLayer = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
  }

  const photoImg = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: '50% 28%',
    filter: 'grayscale(1) contrast(1.08)',
  }

  const shadeLayer = {
    position: 'absolute',
    inset: 0,
    background: [
      'linear-gradient(180deg, rgba(11,11,11,.15) 0%, rgba(11,11,11,.05) 30%, rgba(11,11,11,.92) 78%, #0B0B0B 100%)',
      `linear-gradient(125deg, ${alpha(colorA, 60)}, transparent 38%)`,
      `linear-gradient(235deg, ${alpha(colorB, 55)}, transparent 38%)`,
    ].join(', '),
  }

  // Halftone dot texture
  const texLayer = {
    position: 'absolute',
    inset: 0,
    opacity: 0.12,
    mixBlendMode: 'overlay',
    backgroundImage: 'radial-gradient(rgba(255,255,255,.9) .8px, transparent .9px)',
    backgroundSize: '4px 4px',
    pointerEvents: 'none',
  }

  // Content wrapper
  const inner = {
    position: 'absolute',
    inset: 0,
    padding: Math.round(W * 0.059), // ~20px at 340w
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  }

  const PAD = Math.round(W * 0.059)

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={root}>
      {/* Archive photo (B&W) */}
      {archiveSrc && (
        <div style={photoLayer}>
          <img src={archiveSrc} alt="" style={photoImg} />
        </div>
      )}

      {/* Colour shade + team glow overlay */}
      <div style={shadeLayer} />

      {/* Halftone texture */}
      <div style={texLayer} />

      {/* ── content ── */}
      <div style={inner}>

        {/* TOP — brand + tag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: Math.round(W * 0.053),
            letterSpacing: '-0.02em',
            color: TEXT,
          }}>
            RALLY<span style={{ color: PINK }}>.</span>
          </div>
          <div style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: Math.round(W * 0.026),
            letterSpacing: '.18em',
            padding: `${Math.round(W * 0.015)}px ${Math.round(W * 0.024)}px`,
            borderRadius: 999,
            background: isLive ? PINK : LIME,
            color: isLive ? '#fff' : INK,
            boxShadow: isLive ? '0 0 18px rgba(255,45,122,.5)' : 'none',
          }}>
            {tag}
          </div>
        </div>

        {/* BOTTOM — match info block */}
        <div>

          {/* Flags */}
          <div style={{
            fontSize: Math.round(W * 0.088),
            letterSpacing: '0.18em',
            marginBottom: Math.round(W * 0.018),
            lineHeight: 1,
          }}>
            {flagA} {flagB}
          </div>

          {/* Team names + versus */}
          <div>
            <div style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: Math.round(W * 0.1),
              lineHeight: 0.92,
              letterSpacing: '-0.02em',
              color: TEXT,
              textTransform: 'uppercase',
            }}>
              {teamA}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: Math.round(W * 0.029),
              margin: `${Math.round(W * 0.012)}px 0`,
            }}>
              <span style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: 'italic',
                fontSize: Math.round(W * 0.076),
                color: LIME,
                lineHeight: 1,
              }}>
                versus
              </span>
            </div>
            <div style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: Math.round(W * 0.1),
              lineHeight: 0.92,
              letterSpacing: '-0.02em',
              color: TEXT,
              textTransform: 'uppercase',
            }}>
              {teamB}
            </div>
          </div>

          {/* When line */}
          {whenLine && (
            <div style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: 'italic',
              fontSize: Math.round(W * 0.056),
              color: PAPER,
              marginTop: Math.round(W * 0.029),
              opacity: 0.95,
            }}>
              {whenLine}
            </div>
          )}

          {/* Lowdown line */}
          {lowdown && (
            <div style={{
              fontSize: Math.round(W * 0.037),
              lineHeight: 1.45,
              color: '#e8e8e2',
              marginTop: Math.round(W * 0.029),
              maxWidth: '90%',
            }}>
              {lowdown}
            </div>
          )}

          {/* Pills row: win-prob · TV · going */}
          <div style={{
            display: 'flex',
            gap: Math.round(W * 0.021),
            flexWrap: 'wrap',
            marginTop: Math.round(W * 0.041),
          }}>
            {prob && (
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: Math.round(W * 0.026),
                fontWeight: 800,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                padding: `${Math.round(W * 0.015)}px ${Math.round(W * 0.024)}px`,
                borderRadius: 999,
                background: LIME,
                color: INK,
                border: 'none',
              }}>
                {prob.pct}% {prob.label.split(' ')[0].toUpperCase()}
              </span>
            )}
            {tvChannel && (
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: Math.round(W * 0.026),
                fontWeight: 800,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                padding: `${Math.round(W * 0.015)}px ${Math.round(W * 0.024)}px`,
                borderRadius: 999,
                background: 'transparent',
                color: CYAN,
                border: `1px solid ${alpha(CYAN, 45)}`,
              }}>
                ▶ {tvChannel}
              </span>
            )}
            {goingCount !== null && goingCount > 0 && (
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: Math.round(W * 0.026),
                fontWeight: 800,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                padding: `${Math.round(W * 0.015)}px ${Math.round(W * 0.024)}px`,
                borderRadius: 999,
                background: 'transparent',
                color: '#dcdcd6',
                border: '1px solid rgba(255,255,255,.18)',
              }}>
                {goingCount} GOING
              </span>
            )}
          </div>

          {/* CTA footer */}
          <div style={{
            marginTop: Math.round(W * 0.041),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,.12)',
            paddingTop: Math.round(W * 0.035),
          }}>
            <span style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: Math.round(W * 0.038),
              color: TEXT,
              textTransform: 'uppercase',
            }}>
              JOIN THE RALLY →
            </span>
            <span style={{
              fontSize: Math.round(W * 0.032),
              color: MUT,
              letterSpacing: '.04em',
            }}>
              {footerUrl}
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}

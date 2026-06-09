// Vercel Serverless Function — /api/poster/:id.png
//
// Renders the RALLY matchday poster as a 630×1120 PNG (9:16, 70-dpi-friendly
// social share size). Same visual design as PosterCard.jsx — team-colour dual
// glow, halftone texture, Archivo Black team names, Instrument Serif "versus",
// flags, lowdown/TV/going pills, JOIN THE RALLY footer.
//
// URL shape:  /api/poster/wc_760415.png
//             /api/poster/wc_760415.png?planId=reffen&going=6
//
// Query params (all optional):
//   planId   — venue slug for the footer URL  (e.g. "reffen")
//   going    — attendee count for the GOING pill
//   lowdown  — override the lowdown line (URL-encoded string)
//   tv       — override TV channel label
//
// Data source:
//   1. If SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, fetch from the
//      `matches` table (Supabase server-side client, NOT the anon key).
//   2. Otherwise, read the bundled fixtures.json directly — keeps the endpoint
//      working in preview deploys without a backend.
//
// Font loading:
//   @vercel/og (satori) requires font ArrayBuffers. We fetch them from Google
//   Fonts at cold-start, then cache in module scope so warm invocations are fast.
//   Both fonts are weight-400-italic (Instrument Serif) and weight-400-regular
//   (Archivo Black — GF only ships the one weight).
//
// Dependencies added to package.json:
//   "@vercel/og": "^0.6.3"   (satori + resvg-js WASM renderer)
//
// SECURITY: no auth required — this is a public read-only image endpoint.
// Cache-Control is set to 1 h (social crawlers cache for up to 24 h anyway).

import { ImageResponse } from '@vercel/og'

// Node runtime: @vercel/og renders the PNG here and we stream the bytes via
// res.send. (Edge produced a 0-byte body; Node is verified to render. No JSX in
// this file — it uses the h() hyperscript below — so nothing needs transpiling.)

// ── size ─────────────────────────────────────────────────────────────────────

const W = 630
const H = 1120 // 9:16

// ── colours ──────────────────────────────────────────────────────────────────

const INK = '#0B0B0B'
const LIME = '#A8FF00'
const PINK = '#FF2D7A'
const CYAN = '#00C2FF'
const TEXT = '#F5F5F1'
const MUT = '#9b9b93'
const PAPER = '#F3F0E8'

// ── font cache (module-scope, survives warm invocations) ─────────────────────

let fontArchivoBlack = null    // Archivo Black 400
let fontInstrumentSerifItalic = null  // Instrument Serif 400 italic

async function loadFonts() {
  if (fontArchivoBlack && fontInstrumentSerifItalic) return

  // Google Fonts CSS2 API returns a @font-face block; we extract the src URL
  // and fetch the actual woff2/ttf bytes.
  const [abBuf, isBuf] = await Promise.all([
    fetchGoogleFont('Archivo Black', '400', false),
    fetchGoogleFont('Instrument Serif', '400', true),
  ])
  fontArchivoBlack = abBuf
  fontInstrumentSerifItalic = isBuf
}

async function fetchGoogleFont(family, weight, italic) {
  const style = italic ? 'italic' : 'normal'
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
    `:ital,wght@${italic ? '1' : '0'},${weight}&display=swap`

  const cssRes = await fetch(cssUrl, {
    headers: {
      // An OLD User-Agent makes Google Fonts serve TTF, not woff2 — satori
      // ("Unsupported OpenType signature wOF2") can only parse ttf/otf/woff.
      'User-Agent': 'Mozilla/4.0',
    },
  })
  const css = await cssRes.text()

  // Extract src url(...) from the CSS.
  const urlMatch = css.match(/src:\s*url\(([^)]+)\)/)
  if (!urlMatch) throw new Error(`Could not find font URL for ${family}`)

  const fontRes = await fetch(urlMatch[1])
  if (!fontRes.ok) throw new Error(`Font fetch failed for ${family}: ${fontRes.status}`)
  return fontRes.arrayBuffer()
}

// ── data helpers ──────────────────────────────────────────────────────────────

// Load match by id from Supabase REST (edge-compatible fetch). On prod
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are always set; returns null otherwise.
async function getMatch(id) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const r = await fetch(
    `${url}/rest/v1/matches?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!r.ok) return null
  const rows = await r.json()
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

// Resolve the EVENT framing for a shared plan: venue name, host name, kickoff
// time, and a live "going" count. All Supabase REST (service-role). Resilient by
// design — any failed lookup degrades to null so the caller can fall back to the
// plain matchday poster rather than 500. Returns null when planId/env missing.
async function getPlanEvent(planId) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!planId || !url || !key) return null
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const r = await fetch(
      `${url}/rest/v1/plans?id=eq.${encodeURIComponent(planId)}` +
        `&select=id,venue_id,host_id,time&limit=1`,
      { headers },
    )
    if (!r.ok) return null
    const rows = await r.json()
    const plan = Array.isArray(rows) && rows.length ? rows[0] : null
    if (!plan) return null

    // venue name, host name, and live participant count — best-effort, parallel.
    const venueP = plan.venue_id
      ? fetch(`${url}/rest/v1/venues?id=eq.${encodeURIComponent(plan.venue_id)}&select=name&limit=1`, { headers })
          .then((x) => (x.ok ? x.json() : [])).then((a) => a[0]?.name || null).catch(() => null)
      : Promise.resolve(null)
    const hostP = plan.host_id
      ? fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(plan.host_id)}&select=name&limit=1`, { headers })
          .then((x) => (x.ok ? x.json() : [])).then((a) => a[0]?.name || null).catch(() => null)
      : Promise.resolve(null)
    // count=exact via Prefer header → Content-Range "0-N/total"
    const countP = fetch(
      `${url}/rest/v1/plan_participants?plan_id=eq.${encodeURIComponent(planId)}&select=user_id`,
      { headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } },
    ).then((x) => {
      const cr = x.headers.get('content-range') || ''
      const total = cr.split('/')[1]
      return total && total !== '*' ? Number(total) : null
    }).catch(() => null)

    const [venue, host, going] = await Promise.all([venueP, hostP, countP])
    return { id: plan.id, time: plan.time || null, venue, host, going }
  } catch {
    return null
  }
}

function safeColor(c, fallback) {
  return (c && /^#[0-9a-fA-F]{3,8}$/.test(c.trim())) ? c.trim() : fallback
}

// Fetch a remote image (following redirects, e.g. Commons Special:FilePath) and
// return it as a data URI so satori embeds it directly — no second fetch, no
// redirect/size-detection failure. Returns null on any problem (poster then
// renders without the photo rather than 500ing).
async function imageDataUri(src) {
  if (!src) return null
  try {
    const r = await fetch(src, { redirect: 'follow' })
    if (!r.ok) return null
    const ct = r.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return null
    const buf = Buffer.from(await r.arrayBuffer())
    return `data:${ct};base64,${buf.toString('base64')}`
  } catch { return null }
}

function formatKickoff(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

function isTonight(kickoff) {
  if (!kickoff) return false
  try {
    const now = new Date()
    const k = new Date(kickoff)
    return k.getFullYear() === now.getFullYear() && k.getMonth() === now.getMonth() && k.getDate() === now.getDate()
  } catch { return false }
}

function winProb(match) {
  const pa = Number(match.prob_a) || 0
  const pb = Number(match.prob_b) || 0
  const pd = Number(match.prob_draw) || 0
  if (pa === 0 && pb === 0) return null
  if (pd > pa && pd > pb) return null
  return pa >= pb
    ? { label: (match.team_a || '').split(' ')[0].toUpperCase(), pct: Math.round(pa * 100) }
    : { label: (match.team_b || '').split(' ')[0].toUpperCase(), pct: Math.round(pb * 100) }
}

function firstTvName(match) {
  const tv = match.tv
  if (!tv || !tv.length) return null
  const t = tv[0]
  return typeof t === 'string' ? t : t?.name || null
}

// Truncate on a word boundary so the lowdown never cuts mid-word ("quarter-f…").
function truncate(str, max = 120) {
  if (!str) return ''
  if (str.length <= max) return str
  const cut = str.slice(0, max)
  const at = cut.lastIndexOf(' ')
  const body = at > max * 0.5 ? cut.slice(0, at) : cut
  return body.replace(/[\s.,;:!?–—-]+$/, '') + '…'
}

// Approximate colour-mix as a hex with alpha channel (satori does not support
// CSS color-mix). We blend toward #0B0B0B (the INK base).
function blendHex(hex, opacity) {
  // Return as rgba string.
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${opacity})`
  } catch {
    return `rgba(128,128,128,${opacity})`
  }
}

// ── hyperscript helper for satori ─────────────────────────────────────────────
// In a standalone (non-Next.js) Vercel function the builder does NOT transpile
// JSX, so we emit Satori's element format directly. `h` mirrors React.createElement
// but produces { type, props: { ...props, children } } which @vercel/og/satori
// accepts directly. null/false/'' children are filtered out.

function h(type, props, ...children) {
  const kids = children.flat().filter((c) => c != null && c !== false && c !== '')
  return { type, props: { ...(props || {}), children: kids.length === 0 ? undefined : kids.length === 1 ? kids[0] : kids } }
}

// ── element template for satori ───────────────────────────────────────────────
// Satori supports a subset of CSS (no mix-blend-mode, no radial-gradient on
// pseudo-elements, no box-shadow on children). We replicate the visual with
// layered absolute divs.

function PosterElement({ match, planId, going, lowdownOverride, tvOverride, event }) {
  const teamA = match.team_a || 'Team A'
  const teamB = match.team_b || 'Team B'
  const flagA = match.flag_a || ''
  const flagB = match.flag_b || ''
  const colorA = safeColor(match.color_a, '#006847')
  const colorB = safeColor(match.color_b, '#c8102e')

  const kickoffStr = formatKickoff(match.kickoff)
  const dayLabel = match.day || ''
  const tonight = isTonight(match.kickoff)
  const isLive = match.status === 'in'

  // EVENT mode — a shared watch-plan. Reframes the poster as an invite: venue +
  // time + host + "N going", with the lime "WATCH PARTY" tag and the plan link.
  const isEvent = !!(event && (event.venue || event.host || event.going != null))
  // The plan time wins over kickoff when this is an event invite.
  const eventTime = (event && event.time) || kickoffStr
  const eventGoing = event && event.going != null ? event.going : (going != null ? Number(going) : null)

  let tag = 'UPCOMING'
  if (isEvent && !isLive) tag = 'WATCH PARTY'
  else if (isLive) tag = `LIVE ${match.clock || ''}`
  else if (match.status === 'post') tag = 'FULL TIME'
  else if (tonight) tag = 'TONIGHT'
  else if (dayLabel) tag = dayLabel

  const archiveSrc = match.archive?.src || null

  const lowdown = truncate(lowdownOverride || match.lowdown || match.commentary || match.h2h || '')
  const prob = winProb(match)
  const tvChannel = tvOverride || firstTvName(match)

  // Footer is always the clean root — the /p/<id> link rides in the message, not
  // stamped across the poster (a raw UUID wraps and reads like a bug).
  const footerUrl = 'rally.futbol'

  // When-line: in event mode it's the venue + time invite; otherwise the
  // day/kickoff line as before.
  let whenLine
  if (isEvent) {
    const parts = []
    if (event.venue) parts.push(event.venue)
    if (eventTime) parts.push(`from ${eventTime}`)
    whenLine = parts.join(' · ')
  } else {
    const whenParts = []
    if (tonight) whenParts.push('tonight')
    else if (dayLabel) whenParts.push(dayLabel)
    if (kickoffStr) whenParts.push(kickoffStr)
    whenLine = whenParts.join(' · ')
  }

  const PAD = 36
  const FONT_SCALE = W / 340

  // Glow layer backgrounds
  const glowA = blendHex(colorA, 0.55)
  const glowB = blendHex(colorB, 0.50)

  return h(
    'div',
    {
      style: {
        position: 'relative',
        width: W,
        height: H,
        background: INK,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, sans-serif',
        overflow: 'hidden',
      },
    },

    // Archive photo layer
    archiveSrc
      ? h('img', {
          src: archiveSrc,
          alt: '',
          width: W,
          height: H,
          style: {
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            width: W, height: H,
            objectFit: 'cover',
            objectPosition: '50% 28%',
            filter: 'grayscale(1) contrast(1.08)',
          },
        })
      : null,

    // Dark scrim
    h('div', {
      style: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(180deg, rgba(11,11,11,0.1) 0%, rgba(11,11,11,0.0) 28%, rgba(11,11,11,0.88) 72%, #0B0B0B 100%)',
      },
    }),

    // Team A colour glow — top-left corner
    h('div', {
      style: {
        position: 'absolute',
        top: -60, left: -60,
        width: W * 0.65,
        height: H * 0.42,
        background: `radial-gradient(ellipse at 30% 30%, ${glowA}, transparent 65%)`,
        opacity: 0.65,
      },
    }),

    // Team B colour glow — top-right corner
    h('div', {
      style: {
        position: 'absolute',
        top: -60, right: -60,
        width: W * 0.65,
        height: H * 0.42,
        background: `radial-gradient(ellipse at 70% 30%, ${glowB}, transparent 65%)`,
        opacity: 0.6,
      },
    }),

    // Content
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          padding: PAD,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        },
      },

      // TOP — brand + tag pill
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center' } },
          h(
            'div',
            {
              style: {
                fontFamily: 'Archivo Black',
                fontSize: 34,
                letterSpacing: '-0.02em',
                color: TEXT,
                display: 'flex',
              },
            },
            'RALLY',
          ),
          // the gathering node — the new mark (lime, ringed), echoing the logo
          h(
            'div',
            {
              style: {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: 11, width: 19, height: 19, borderRadius: 999,
                border: `2px solid ${blendHex(LIME, 0.45)}`,
              },
            },
            h('div', { style: { width: 8, height: 8, borderRadius: 999, background: LIME } }),
          ),
        ),
        h(
          'div',
          {
            style: {
              fontFamily: 'Archivo Black',
              fontSize: 16,
              letterSpacing: '0.18em',
              padding: '9px 15px',
              borderRadius: 999,
              background: isLive ? PINK : LIME,
              color: isLive ? '#ffffff' : INK,
            },
          },
          tag,
        ),
      ),

      // BOTTOM — match block
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },

        // Flags
        h(
          'div',
          { style: { fontSize: 56, letterSpacing: '0.2em', marginBottom: 10, lineHeight: 1 } },
          `${flagA} ${flagB}`,
        ),

        // Team A name
        h(
          'div',
          {
            style: {
              fontFamily: 'Archivo Black',
              fontSize: 64,
              lineHeight: 0.92,
              letterSpacing: '-0.02em',
              color: TEXT,
              textTransform: 'uppercase',
              display: 'flex',
            },
          },
          teamA,
        ),

        // "versus"
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', margin: '8px 0' } },
          h(
            'span',
            {
              style: {
                fontFamily: 'Instrument Serif',
                fontStyle: 'italic',
                fontSize: 48,
                color: LIME,
                lineHeight: 1,
              },
            },
            'versus',
          ),
        ),

        // Team B name
        h(
          'div',
          {
            style: {
              fontFamily: 'Archivo Black',
              fontSize: 64,
              lineHeight: 0.92,
              letterSpacing: '-0.02em',
              color: TEXT,
              textTransform: 'uppercase',
              display: 'flex',
            },
          },
          teamB,
        ),

        // When line
        whenLine
          ? h(
              'div',
              {
                style: {
                  fontFamily: 'Instrument Serif',
                  fontStyle: 'italic',
                  fontSize: 36,
                  color: PAPER,
                  marginTop: 18,
                  opacity: 0.95,
                  display: 'flex',
                },
              },
              whenLine,
            )
          : null,

        // Lowdown
        lowdown
          ? h(
              'div',
              {
                style: {
                  fontSize: 24,
                  lineHeight: 1.45,
                  color: '#e8e8e2',
                  marginTop: 18,
                  maxWidth: '90%',
                  display: 'flex',
                  flexWrap: 'wrap',
                },
              },
              lowdown,
            )
          : null,

        // Pills
        h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 } },
          prob
            ? h(
                'div',
                {
                  style: {
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '9px 15px',
                    borderRadius: 999,
                    background: LIME,
                    color: INK,
                    display: 'flex',
                  },
                },
                `${prob.pct}% ${prob.label}`,
              )
            : null,
          tvChannel
            ? h(
                'div',
                {
                  style: {
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '9px 14px',
                    borderRadius: 999,
                    background: 'transparent',
                    color: CYAN,
                    border: `1.5px solid ${blendHex(CYAN, 0.45)}`,
                    display: 'flex',
                  },
                },
                `▶ ${tvChannel}`,
              )
            : null,
          eventGoing != null && eventGoing > 0
            ? h(
                'div',
                {
                  style: {
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '9px 14px',
                    borderRadius: 999,
                    background: isEvent ? PINK : 'transparent',
                    color: isEvent ? '#ffffff' : '#dcdcd6',
                    border: isEvent ? 'none' : '1.5px solid rgba(255,255,255,0.18)',
                    display: 'flex',
                  },
                },
                `${eventGoing} GOING`,
              )
            : null,
          isEvent && event.host
            ? h(
                'div',
                {
                  style: {
                    fontFamily: 'Inter',
                    fontSize: 16,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '9px 14px',
                    borderRadius: 999,
                    background: 'transparent',
                    color: '#dcdcd6',
                    border: '1.5px solid rgba(255,255,255,0.18)',
                    display: 'flex',
                  },
                },
                `HOST ${event.host}`,
              )
            : null,
        ),

        // Footer CTA
        h(
          'div',
          {
            style: {
              marginTop: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: 20,
            },
          },
          h(
            'div',
            {
              style: {
                fontFamily: 'Archivo Black',
                fontSize: 24,
                color: TEXT,
                textTransform: 'uppercase',
                display: 'flex',
              },
            },
            'JOIN THE RALLY →',
          ),
          h(
            'div',
            { style: { fontSize: 20, color: MUT, letterSpacing: '0.04em', display: 'flex' } },
            footerUrl,
          ),
        ),
      ),
    ),
  )
}

// ── landscape OG variant (1200×630) ───────────────────────────────────────────
// Same data, same Floodlight look as the portrait poster — but laid out for a
// link-unfurl card (Twitter summary_large_image, OG, Slack/iMessage). The match
// is the hero; the photo bleeds right, text sits in a dark left column.

function pill(label, bg, color, border) {
  return h(
    'div',
    {
      style: {
        fontFamily: 'Inter', fontSize: 15, fontWeight: 800, letterSpacing: '0.12em',
        textTransform: 'uppercase', padding: '8px 13px', borderRadius: 999,
        background: bg, color, display: 'flex', ...(border ? { border } : {}),
      },
    },
    label,
  )
}

function PosterOGElement({ match, planId, going, lowdownOverride, tvOverride, event }) {
  const teamA = match.team_a || 'Team A'
  const teamB = match.team_b || 'Team B'
  const flagA = match.flag_a || ''
  const flagB = match.flag_b || ''
  const colorA = safeColor(match.color_a, '#006847')
  const colorB = safeColor(match.color_b, '#c8102e')

  const kickoffStr = formatKickoff(match.kickoff)
  const dayLabel = match.day || ''
  const tonight = isTonight(match.kickoff)
  const isLive = match.status === 'in'

  const isEvent = !!(event && (event.venue || event.host || event.going != null))
  const eventTime = (event && event.time) || kickoffStr
  const eventGoing = event && event.going != null ? event.going : (going != null ? Number(going) : null)

  let tag = 'UPCOMING'
  if (isEvent && !isLive) tag = 'WATCH PARTY'
  else if (isLive) tag = `LIVE ${match.clock || ''}`
  else if (match.status === 'post') tag = 'FULL TIME'
  else if (tonight) tag = 'TONIGHT'
  else if (dayLabel) tag = dayLabel

  const archiveSrc = match.archive?.src || null
  const lowdown = truncate(lowdownOverride || match.lowdown || match.commentary || match.h2h || '', 132)
  const prob = winProb(match)
  const tvChannel = tvOverride || firstTvName(match)

  let whenLine
  if (isEvent) {
    const parts = []
    if (event.venue) parts.push(event.venue)
    if (eventTime) parts.push(`from ${eventTime}`)
    whenLine = parts.join(' · ')
  } else {
    const wp = []
    if (tonight) wp.push('tonight')
    else if (dayLabel) wp.push(dayLabel)
    if (kickoffStr) wp.push(kickoffStr)
    whenLine = wp.join(' · ')
  }

  const glowA = blendHex(colorA, 0.55)
  const glowB = blendHex(colorB, 0.50)
  const OW = 1200, OH = 630

  return h(
    'div',
    {
      style: {
        position: 'relative', width: OW, height: OH, background: INK,
        display: 'flex', fontFamily: 'Inter, sans-serif', overflow: 'hidden',
      },
    },

    archiveSrc
      ? h('img', {
          src: archiveSrc, width: OW, height: OH,
          style: {
            position: 'absolute', top: 0, left: 0, width: OW, height: OH,
            objectFit: 'cover', objectPosition: '50% 26%',
            filter: 'grayscale(1) contrast(1.08)',
          },
        })
      : null,

    // left-weighted scrim so the text column stays legible over the photo
    h('div', {
      style: {
        position: 'absolute', top: 0, left: 0, width: OW, height: OH,
        background: 'linear-gradient(90deg, rgba(11,11,11,0.95) 0%, rgba(11,11,11,0.88) 42%, rgba(11,11,11,0.5) 70%, rgba(11,11,11,0.18) 100%)',
      },
    }),
    h('div', {
      style: {
        position: 'absolute', top: 0, left: 0, width: OW, height: OH,
        background: 'linear-gradient(180deg, rgba(11,11,11,0.18) 0%, rgba(11,11,11,0) 32%, rgba(11,11,11,0.55) 100%)',
      },
    }),

    h('div', { style: { position: 'absolute', top: -90, left: -90, width: 560, height: 360, background: `radial-gradient(ellipse at 30% 30%, ${glowA}, transparent 65%)`, opacity: 0.6 } }),
    h('div', { style: { position: 'absolute', top: -90, right: -90, width: 560, height: 360, background: `radial-gradient(ellipse at 70% 30%, ${glowB}, transparent 65%)`, opacity: 0.5 } }),

    h(
      'div',
      {
        style: {
          position: 'absolute', top: 0, left: 0, width: 840, height: OH,
          padding: 54, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        },
      },

      // TOP — brand + tag
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: 732 } },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center' } },
          h('div', { style: { fontFamily: 'Archivo Black', fontSize: 30, letterSpacing: '-0.02em', color: TEXT, display: 'flex' } }, 'RALLY'),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 10, width: 17, height: 17, borderRadius: 999, border: `2px solid ${blendHex(LIME, 0.45)}` } },
            h('div', { style: { width: 7, height: 7, borderRadius: 999, background: LIME } }),
          ),
        ),
        h('div', { style: { fontFamily: 'Archivo Black', fontSize: 15, letterSpacing: '0.18em', padding: '8px 14px', borderRadius: 999, background: isLive ? PINK : LIME, color: isLive ? '#ffffff' : INK, display: 'flex' } }, tag),
      ),

      // BOTTOM — match block
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { fontSize: 44, letterSpacing: '0.18em', marginBottom: 6, lineHeight: 1 } }, `${flagA} ${flagB}`),
        h('div', { style: { fontFamily: 'Archivo Black', fontSize: 60, lineHeight: 0.9, letterSpacing: '-0.02em', color: TEXT, textTransform: 'uppercase', display: 'flex' } }, teamA),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', margin: '2px 0' } },
          h('span', { style: { fontFamily: 'Instrument Serif', fontStyle: 'italic', fontSize: 38, color: LIME, lineHeight: 1 } }, 'versus'),
        ),
        h('div', { style: { fontFamily: 'Archivo Black', fontSize: 60, lineHeight: 0.9, letterSpacing: '-0.02em', color: TEXT, textTransform: 'uppercase', display: 'flex' } }, teamB),

        whenLine
          ? h('div', { style: { fontFamily: 'Instrument Serif', fontStyle: 'italic', fontSize: 30, color: PAPER, marginTop: 14, opacity: 0.95, display: 'flex' } }, whenLine)
          : null,

        lowdown
          ? h('div', { style: { fontSize: 19, lineHeight: 1.4, color: '#e8e8e2', marginTop: 12, maxWidth: 700, display: 'flex', flexWrap: 'wrap' } }, lowdown)
          : null,

        h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 } },
          eventGoing != null && eventGoing > 0 ? pill(`${eventGoing} GOING`, isEvent ? PINK : 'transparent', isEvent ? '#ffffff' : '#dcdcd6', isEvent ? null : '1.5px solid rgba(255,255,255,0.18)') : null,
          isEvent && event.host ? pill(`HOST ${event.host}`, 'transparent', '#dcdcd6', '1.5px solid rgba(255,255,255,0.18)') : null,
          prob ? pill(`${prob.pct}% ${prob.label}`, LIME, INK, null) : null,
          tvChannel ? pill(`▶ ${tvChannel}`, 'transparent', CYAN, `1.5px solid ${blendHex(CYAN, 0.45)}`) : null,
        ),

        h(
          'div',
          { style: { marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 732, borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 16 } },
          h('div', { style: { fontFamily: 'Archivo Black', fontSize: 22, color: TEXT, textTransform: 'uppercase', display: 'flex' } }, 'JOIN THE RALLY →'),
          h('div', { style: { fontSize: 18, color: MUT, letterSpacing: '0.04em', display: 'flex' } }, 'rally.futbol'),
        ),
      ),
    ),
  )
}

// ── handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Vercel passes the dynamic [id] segment as req.query.id; strip a trailing .png.
  let id = (req.query && req.query.id) || (req.url || '').split('?')[0].split('/').pop() || ''
  id = decodeURIComponent(id).replace(/\.png$/i, '')
  if (!id) { res.status(400).send('Missing match id. Usage: /api/poster/<matchId>.png'); return }

  const q = req.query || {}
  const planId = q.planId || null
  const going = q.going || null
  const lowdownParam = q.lowdown || null
  const tvParam = q.tv || null
  // format=og → 1200×630 landscape unfurl card; default → 630×1120 portrait poster.
  const fmt = String(q.format || (q.og ? 'og' : '')).toLowerCase()
  const landscape = fmt === 'og' || fmt === 'landscape'

  let match
  try { match = await getMatch(id) }
  catch (err) { res.status(500).send('Data fetch failed: ' + err.message); return }
  if (!match) { res.status(404).send(`Match not found: ${id}`); return }

  // EVENT variant — when a planId is present, resolve the plan's venue/host/time
  // and a live going-count so the poster renders as a watch-party invite. Any
  // failure leaves `event` null and the plain matchday poster renders.
  let event = null
  if (planId) {
    try { event = await getPlanEvent(planId) } catch { event = null }
  }

  // Embed the archive photo as a data URI (handles Commons redirects); drop it
  // gracefully if it can't be fetched so the poster always renders.
  if (match.archive && match.archive.src) {
    const du = await imageDataUri(match.archive.src)
    match = { ...match, archive: du ? { ...match.archive, src: du } : null }
  }

  try { await loadFonts() } catch (err) { console.warn('Font load warning:', err.message) }

  const fonts = []
  if (fontArchivoBlack) fonts.push({ name: 'Archivo Black', data: fontArchivoBlack, weight: 400, style: 'normal' })
  if (fontInstrumentSerifItalic) fonts.push({ name: 'Instrument Serif', data: fontInstrumentSerifItalic, weight: 400, style: 'italic' })

  try {
    const props = { match, planId, going, lowdownOverride: lowdownParam, tvOverride: tvParam, event }
    const ir = new ImageResponse(
      landscape ? PosterOGElement(props) : PosterElement(props),
      { width: landscape ? 1200 : W, height: landscape ? 630 : H, fonts },
    )
    const buf = Buffer.from(await ir.arrayBuffer())
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400')
    res.setHeader('X-Rally-Match', id)
    res.status(200).send(buf)
  } catch (err) {
    res.status(500).send('Render failed: ' + (err && err.message))
  }
}

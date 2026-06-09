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
      // Request a woff2 compatible format — satori can handle woff2 and ttf.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

function safeColor(c, fallback) {
  return (c && /^#[0-9a-fA-F]{3,8}$/.test(c.trim())) ? c.trim() : fallback
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

function truncate(str, max = 120) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1) + '…' : str
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

function PosterElement({ match, planId, going, lowdownOverride, tvOverride }) {
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

  let tag = 'UPCOMING'
  if (isLive) tag = `LIVE ${match.clock || ''}`
  else if (match.status === 'post') tag = 'FULL TIME'
  else if (tonight) tag = 'TONIGHT'
  else if (dayLabel) tag = dayLabel

  const archiveSrc = match.archive?.src || null

  const lowdown = truncate(lowdownOverride || match.lowdown || match.commentary || match.h2h || '')
  const prob = winProb(match)
  const tvChannel = tvOverride || firstTvName(match)

  const planSlug = planId || null
  const footerUrl = planSlug ? `rally.futbol/p/${planSlug}` : 'rally.futbol'

  const whenParts = []
  if (tonight) whenParts.push('tonight')
  else if (dayLabel) whenParts.push(dayLabel)
  if (kickoffStr) whenParts.push(kickoffStr)
  const whenLine = whenParts.join(' · ')

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
          h('span', { style: { color: PINK } }, '.'),
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
          going && Number(going) > 0
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
                `${going} GOING`,
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

  let match
  try { match = await getMatch(id) }
  catch (err) { res.status(500).send('Data fetch failed: ' + err.message); return }
  if (!match) { res.status(404).send(`Match not found: ${id}`); return }

  try { await loadFonts() } catch (err) { console.warn('Font load warning:', err.message) }

  const fonts = []
  if (fontArchivoBlack) fonts.push({ name: 'Archivo Black', data: fontArchivoBlack, weight: 400, style: 'normal' })
  if (fontInstrumentSerifItalic) fonts.push({ name: 'Instrument Serif', data: fontInstrumentSerifItalic, weight: 400, style: 'italic' })

  try {
    const ir = new ImageResponse(
      PosterElement({ match, planId, going, lowdownOverride: lowdownParam, tvOverride: tvParam }),
      { width: W, height: H, fonts },
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

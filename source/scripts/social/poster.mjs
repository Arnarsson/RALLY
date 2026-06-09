// ---------------------------------------------------------------------------
// RALLY — poster + slate-digest renderers
//
// poster: fetch the LIVE matchday poster (GET rally.futbol/api/poster/<id>.png),
//   which returns a 630×1120 PNG, then upscale to 1080×1920 with ffmpeg (no
//   sharp dependency). The lowdown query param carries a SOUL hook onto the card.
//
// slate-digest: a new small graphic in the same brand style — the day's matches
//   on one card — composed deterministically with ffmpeg (lime spine + RALLY
//   mark + a list of fixtures). Brand-frame, not gen-AI.
//
// Everything is cached by fixture id / date so a re-run is idempotent.
// ---------------------------------------------------------------------------

import { writeFile, readFile, stat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const POSTER_BASE = process.env.RALLY_POSTER_BASE || 'https://rally.futbol/api/poster'
const W = 1080, H = 1920

// Brand palette (mirrors api/poster + SKILL.md).
const INK = '0x0B0B0B'
const LIME = '#A8FF00'
const PINK = '#FF2D7A'
const TEXT = '#F5F5F1'

const FONT_BOLD = '/usr/share/fonts/liberation/LiberationSans-Bold.ttf'
const FONT_ITALIC = '/usr/share/fonts/liberation/LiberationSerif-Italic.ttf'

async function exists(p) {
  try { await stat(p); return true } catch { return false }
}

function kickoffTime(fx) {
  const m = (fx.kickoff || '').match(/T(\d{2}:\d{2})/)
  return m ? m[1] : ''
}

// A short SOUL hook for the poster's lowdown line (kept tight — it's a card).
export function posterHook(fx, content) {
  // Prefer the model's TikTok line (it's the sharpest); fall back to a template.
  const tk = content?.captions?.tiktok
  if (tk) {
    const firstLine = tk.split('\n')[0].trim()
    if (firstLine && firstLine.length <= 120) return firstLine
  }
  return `${fx.team_a} v ${fx.team_b} — nobody watches a night like this alone.`
}

// Render the poster. Primary path: the LIVE /api/poster endpoint (630×1120),
// upscaled to 1080×1920. If that endpoint is unavailable (it is currently 500ing
// on a server-side font issue), fall back to a deterministic brand-style poster
// composed locally with ffmpeg — so the daily pack always produces a poster.
export async function renderPoster(fx, outPath, { hook, going, tv, force } = {}) {
  if (!force && await exists(outPath)) return { status: 'cached', path: outPath }

  const params = new URLSearchParams()
  if (hook) params.set('lowdown', hook)
  if (going) params.set('going', String(going))
  if (tv) params.set('tv', tv)
  const url = `${POSTER_BASE}/${encodeURIComponent(fx.id)}.png?${params.toString()}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`poster endpoint ${res.status}: ${detail.slice(0, 120)}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const tmp = outPath + '.630.png'
    await writeFile(tmp, buf)
    // Upscale 630×1120 → 1080×1920 (lanczos, exact 9:16 so no letterbox).
    await run('ffmpeg', ['-y', '-i', tmp, '-vf', `scale=${W}:${H}:flags=lanczos`, '-frames:v', '1', outPath])
    await run('rm', ['-f', tmp]).catch(() => {})
    return { status: 'rendered', source: 'api', path: outPath, src_url: url }
  } catch (err) {
    const r = await renderLocalPoster(fx, outPath, { hook, tv })
    return { status: 'rendered', source: 'local-fallback', path: outPath, fallback_reason: err.message, ...r }
  }
}

// Deterministic, on-brand poster composed locally (ffmpeg) — the same visual
// language as the slate digest and the app: ink base, archive photo (B&W) when
// present, team-colour glow otherwise, Archivo-Black-style team names, lime
// "versus", the SOUL hook, and the JOIN THE RALLY footer. Commons attribution
// burned small when the photo is used.
async function renderLocalPoster(fx, outPath, { hook, tv } = {}) {
  const haveBold = await exists(FONT_BOLD)
  const fb = haveBold ? FONT_BOLD : FONT_ITALIC
  const fi = (await exists(FONT_ITALIC)) ? FONT_ITALIC : FONT_BOLD

  const colA = (fx.color_a || '#006847').replace('#', '0x')
  const colB = (fx.color_b || '#c8102e').replace('#', '0x')
  const time = kickoffTime(fx)
  const when = [fx.day, time].filter(Boolean).join(' · ')

  // Wrap the hook to ~34 chars/line, max 3 lines.
  const hookLines = wrap(hook || `${fx.team_a} v ${fx.team_b}`, 34).slice(0, 3)

  const filters = []
  let inputs = ['-f', 'lavfi', '-i', `color=c=${INK}:s=${W}x${H}`]
  let photoInput = false

  // Archive photo (B&W) as the backdrop when we have one.
  if (fx.archive && fx.archive.src) {
    const tmpImg = outPath + '.src'
    try {
      const r = await fetch(fx.archive.src)
      if (r.ok) {
        await writeFile(tmpImg, Buffer.from(await r.arrayBuffer()))
        inputs = ['-i', tmpImg]
        photoInput = true
      }
    } catch { /* fall through to colour panel */ }
  }

  if (photoInput) {
    filters.push(`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},format=gray,eq=contrast=1.08[bg]`)
    // dark scrim toward the bottom
    filters.push(`color=c=${INK}:s=${W}x${H}[ink]`)
    filters.push(`[bg][ink]blend=all_mode=normal:all_opacity=0.0,format=yuv420p[base]`)
  } else {
    // Team-colour glow panel.
    filters.push(`[0:v]drawbox=x=0:y=0:w=${W}:h=${Math.round(H * 0.42)}:color=${colA}@0.5:t=fill,drawbox=x=0:y=${Math.round(H * 0.58)}:w=${W}:h=${Math.round(H * 0.42)}:color=${colB}@0.45:t=fill[base]`)
  }

  // Bottom scrim for legibility.
  let chain = '[base]'
  const scrimY = Math.round(H * 0.45)
  filters.push(`${chain}drawbox=x=0:y=${scrimY}:w=${W}:h=${H - scrimY}:color=${INK}@0.62:t=fill[scr]`)
  chain = '[scr]'

  const parts = []
  // Wordmark + tag pill.
  parts.push(`drawtext=fontfile='${fb}':text='RALLY':fontcolor=${'#F5F5F1'}:fontsize=92:x=70:y=90`)
  parts.push(`drawtext=fontfile='${fb}':text='.':fontcolor=#FF2D7A:fontsize=92:x=380:y=90`)
  const tag = (fx.day || 'TONIGHT').toUpperCase()
  parts.push(`drawbox=x=${W - 60 - (tag.length * 26)}:y=96:w=${tag.length * 26 + 40}:h=72:color=${LIME}:t=fill`)
  parts.push(`drawtext=fontfile='${fb}':text='${dt(tag)}':fontcolor=${INK}:fontsize=40:x=${W - 40 - (tag.length * 26)}:y=112`)

  // Flags + team names + versus, lower third.
  const ny = H - 880
  parts.push(`drawtext=fontfile='${fb}':text='${dt((fx.flag_a || '') + ' ' + (fx.flag_b || ''))}':fontcolor=white:fontsize=96:x=70:y=${ny - 130}`)
  parts.push(`drawtext=fontfile='${fb}':text='${dt(fx.team_a.toUpperCase())}':fontcolor=#F5F5F1:fontsize=110:x=70:y=${ny}`)
  parts.push(`drawtext=fontfile='${fi}':text='versus':fontcolor=${LIME}:fontsize=84:x=70:y=${ny + 130}`)
  parts.push(`drawtext=fontfile='${fb}':text='${dt(fx.team_b.toUpperCase())}':fontcolor=#F5F5F1:fontsize=110:x=70:y=${ny + 240}`)
  if (when) parts.push(`drawtext=fontfile='${fi}':text='${dt(when)}':fontcolor=#F3F0E8:fontsize=58:x=70:y=${ny + 380}`)

  // SOUL hook.
  hookLines.forEach((ln, i) => {
    parts.push(`drawtext=fontfile='${fi}':text='${dt(ln)}':fontcolor=#e8e8e2:fontsize=46:x=70:y=${ny + 470 + i * 60}`)
  })

  // TV chip.
  if (tv) parts.push(`drawtext=fontfile='${fb}':text='${dt('▶ ' + tv)}':fontcolor=#00C2FF:fontsize=40:x=70:y=${H - 320}`)

  // Footer CTA + attribution.
  parts.push(`drawtext=fontfile='${fb}':text='JOIN THE RALLY →':fontcolor=#F5F5F1:fontsize=52:x=70:y=${H - 230}`)
  parts.push(`drawtext=fontfile='${fi}':text='rally.futbol':fontcolor=#9b9b93:fontsize=44:x=70:y=${H - 160}`)
  if (photoInput) {
    const att = `${fx.archive.credit || 'Wikimedia Commons'} · ${fx.archive.license || 'free licence'}`
    parts.push(`drawtext=fontfile='${fi}':text='${dt(att)}':fontcolor=#cfcfc8:fontsize=24:x=70:y=${H - 60}`)
  }
  // Lime spine.
  parts.push(`drawbox=x=0:y=0:w=18:h=${H}:color=${LIME}:t=fill`)

  filters.push(`${chain}${parts.join(',')}[out]`)

  await run('ffmpeg', ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', outPath])
  await run('rm', ['-f', outPath + '.src']).catch(() => {})
  return {}
}

// Naive word-wrap to N chars per line.
function wrap(s, n) {
  const words = String(s).split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur); cur = w }
    else cur = (cur ? cur + ' ' : '') + w
  }
  if (cur) lines.push(cur)
  return lines
}

// Escape text for ffmpeg drawtext.
function dt(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '’')
    .replace(/%/g, '\\%')
}

// The slate digest: "Tonight in Copenhagen" + the day's fixtures, brand-styled.
// Deterministic ffmpeg compose — lime spine, RALLY wordmark, fixture list.
export async function renderSlateDigest(fixtures, dateLabel, outPath, { force } = {}) {
  if (!force && await exists(outPath)) return { status: 'cached', path: outPath }

  const haveBold = await exists(FONT_BOLD)
  const haveItalic = await exists(FONT_ITALIC)
  const fb = haveBold ? FONT_BOLD : FONT_ITALIC
  const fi = haveItalic ? FONT_ITALIC : FONT_BOLD

  const filters = []
  // Lime vertical spine on the left edge (brand signature).
  filters.push(`drawbox=x=0:y=0:w=24:h=${H}:color=${LIME}:t=fill`)

  // Wordmark.
  filters.push(`drawtext=fontfile='${fb}':text='RALLY':fontcolor=${TEXT}:fontsize=120:x=80:y=120`)
  filters.push(`drawtext=fontfile='${fb}':text='.':fontcolor=${PINK}:fontsize=120:x=470:y=120`)

  // Heavy line / soft line (one heavy, one chic italic — SOUL rhythm).
  filters.push(`drawtext=fontfile='${fb}':text='TONIGHT IN':fontcolor=${TEXT}:fontsize=92:x=80:y=320`)
  filters.push(`drawtext=fontfile='${fi}':text='${dt('København')}':fontcolor=${LIME}:fontsize=104:x=80:y=420`)

  // Fixture list — up to 8 lines.
  const top = 660
  const rowH = 132
  const shown = fixtures.slice(0, 8)
  shown.forEach((fx, i) => {
    const y = top + i * rowH
    const t = kickoffTime(fx)
    const teams = `${fx.team_a} v ${fx.team_b}`
    filters.push(`drawtext=fontfile='${fb}':text='${dt(t || '·')}':fontcolor=${LIME}:fontsize=52:x=80:y=${y}`)
    filters.push(`drawtext=fontfile='${fb}':text='${dt(teams)}':fontcolor=${TEXT}:fontsize=58:x=300:y=${y}`)
    const tv = fx.tv && fx.tv.length ? (typeof fx.tv[0] === 'string' ? fx.tv[0] : fx.tv[0]?.name) : ''
    if (tv) filters.push(`drawtext=fontfile='${fi}':text='${dt(tv)}':fontcolor=#9b9b93:fontsize=40:x=300:y=${y + 64}`)
  })

  if (fixtures.length > 8) {
    filters.push(`drawtext=fontfile='${fi}':text='${dt('+ ' + (fixtures.length - 8) + ' more')}':fontcolor=#9b9b93:fontsize=44:x=80:y=${top + 8 * rowH}`)
  }

  // Footer CTA.
  filters.push(`drawtext=fontfile='${fb}':text='FIND YOUR GAME. FIND YOUR PEOPLE.':fontcolor=${TEXT}:fontsize=46:x=80:y=${H - 220}`)
  filters.push(`drawtext=fontfile='${fi}':text='rally.futbol':fontcolor=${LIME}:fontsize=52:x=80:y=${H - 150}`)

  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `color=c=${INK}:s=${W}x${H}`,
    '-vf', filters.join(','),
    '-frames:v', '1',
    outPath,
  ])
  return { status: 'rendered', path: outPath, fixtures: shown.length }
}

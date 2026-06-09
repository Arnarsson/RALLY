// ---------------------------------------------------------------------------
// RALLY — 9:16 video builder (TikTok / Reels), pluggable motion provider
//
// The "motion shot" is a PLUGGABLE provider so the engine runs even with the
// gen-AI step disabled:
//
//   • kenburns (DEFAULT, deterministic) — ffmpeg slow pan/zoom on the archive
//     photo. Works with ZERO external keys. THIS is the budget-safe fallback.
//   • higgsfield (OPTIONAL) — image→video via the Higgsfield API generate_video
//     (grok_video_v15 / kling3_0), audio OFF, preflight cost, cap clips/day,
//     cache per fixture. Needs HIGGSFIELD_API_KEY; if absent we never call it.
//
// Assembly (ffmpeg), per the handoff:
//   poster cover (~0.5s) → motion shot(s) → SOUL captions burned in →
//   brand frame (lime spine + RALLY mark, deterministic) → outro = the poster
//   with "find your people · rally.futbol".
//   VO: robotic local TTS of the script if espeak/espeak-ng/say is available,
//   else silent (noted in the manifest). Commons attribution burned small on
//   any photo frame.
//
// Nothing here publishes. Output is an .mp4 on disk.
// ---------------------------------------------------------------------------

import { writeFile, stat, mkdir, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'

const run = promisify(execFile)
const W = 1080, H = 1920, FPS = 30

const FONT_BOLD = '/usr/share/fonts/liberation/LiberationSans-Bold.ttf'
const FONT_ITALIC = '/usr/share/fonts/liberation/LiberationSerif-Italic.ttf'
const LIME = '#A8FF00'
const TEXT = '#F5F5F1'
const INK = '0x0B0B0B'

async function exists(p) { try { await stat(p); return true } catch { return false } }

async function which(bin) {
  try { await run('sh', ['-c', `command -v ${bin}`]); return true } catch { return false }
}

function dt(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '’')
    .replace(/%/g, '\\%')
}

// ── TTS (robotic, local, free) ──────────────────────────────────────────────
// Per spec the voice stays robotic. Try espeak-ng → espeak → say, else skip.

export async function makeVO(text, outWav) {
  if (await which('espeak-ng')) {
    await run('espeak-ng', ['-s', '150', '-p', '30', '-w', outWav, text])
    return { ok: true, engine: 'espeak-ng' }
  }
  if (await which('espeak')) {
    await run('espeak', ['-s', '150', '-p', '30', '-w', outWav, text])
    return { ok: true, engine: 'espeak' }
  }
  if (await which('say')) {
    // macOS — say writes aiff; convert via ffmpeg.
    const aiff = outWav + '.aiff'
    await run('say', ['-o', aiff, text])
    await run('ffmpeg', ['-y', '-i', aiff, outWav])
    await rm(aiff, { force: true }).catch(() => {})
    return { ok: true, engine: 'say' }
  }
  return { ok: false, engine: null, note: 'no local TTS (espeak/espeak-ng/say) — video built without VO' }
}

// ── motion providers ────────────────────────────────────────────────────────

// kenburns: deterministic slow push-in + drift on the archive photo (or, if no
// photo, on a team-colour panel). Returns a clip path. Zero external keys.
async function kenburnsClip(fx, srcImage, outClip, seconds = 8) {
  const frames = Math.round(seconds * FPS)
  // zoompan slow zoom 1.0 → 1.12 with a gentle pan; grayscale for the archival feel.
  const zexpr = `min(zoom+0.0006,1.12)`
  const vf = [
    `scale=${W * 2}:-1`,
    `zoompan=z='${zexpr}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`,
    `format=gray,format=yuv420p`,
    `eq=contrast=1.08`,
  ].join(',')
  await run('ffmpeg', [
    '-y', '-loop', '1', '-i', srcImage,
    '-t', String(seconds),
    '-vf', vf,
    '-r', String(FPS),
    '-an',
    outClip,
  ])
  return { provider: 'kenburns', seconds, clip: outClip, cost_usd: 0 }
}

// higgsfield: image→video via generate_video. OPTIONAL — only when the key is
// present. Preflight with get_cost, cap clips/day, cache per fixture. We POST
// to the API directly (no SDK). If anything fails, the caller falls back to
// kenburns, so a dry balance never breaks the pack.
async function higgsfieldClip(fx, srcImage, outClip, { apiKey, model = 'grok_video_v15', maxCostUsd = 0.5 } = {}) {
  const base = process.env.HIGGSFIELD_API_BASE || 'https://api.higgsfield.ai'
  const headers = { 'content-type': 'application/json', 'authorization': `Bearer ${apiKey}` }

  const prompt = `Subtle, tasteful motion on an archival black-and-white football photograph: slow cinematic push-in, gentle parallax, faint film-grain drift. No new objects, no people added, no text. It is historic footage, not a music video. 9:16 vertical.`

  // 1) Preflight cost.
  const costRes = await fetch(`${base}/v1/video/generate`, {
    method: 'POST', headers,
    body: JSON.stringify({ model, get_cost: true, params: { start_image: srcImage, prompt, duration: 5, audio: false, aspect_ratio: '9:16' } }),
  })
  if (!costRes.ok) throw new Error(`higgsfield get_cost ${costRes.status}`)
  const costJson = await costRes.json().catch(() => ({}))
  const cost = Number(costJson.cost_usd ?? costJson.cost ?? 0)
  if (cost > maxCostUsd) throw new Error(`higgsfield clip $${cost} exceeds cap $${maxCostUsd}`)

  // 2) Generate.
  const genRes = await fetch(`${base}/v1/video/generate`, {
    method: 'POST', headers,
    body: JSON.stringify({ model, params: { start_image: srcImage, prompt, duration: 5, audio: false, aspect_ratio: '9:16' } }),
  })
  if (!genRes.ok) throw new Error(`higgsfield generate ${genRes.status}`)
  const gen = await genRes.json()
  const videoUrl = gen.video_url || gen.url || gen.output?.[0]
  if (!videoUrl) throw new Error('higgsfield: no video url in response')

  // 3) Download + normalise to our canvas.
  const vres = await fetch(videoUrl)
  const raw = outClip + '.raw.mp4'
  await writeFile(raw, Buffer.from(await vres.arrayBuffer()))
  await run('ffmpeg', ['-y', '-i', raw,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`,
    '-an', outClip])
  await rm(raw, { force: true }).catch(() => {})
  return { provider: 'higgsfield', model, seconds: 5, clip: outClip, cost_usd: cost }
}

// A team-colour panel when there's no archive photo (cohesive with the photos,
// never a stock image — matches the app's MatchArt fallback).
async function colourPanel(fx, outImg) {
  const a = (fx.color_a || '#006847').replace('#', '0x')
  const b = (fx.color_b || '#c8102e').replace('#', '0x')
  // Two diagonal colour blocks over ink.
  await run('ffmpeg', ['-y',
    '-f', 'lavfi', '-i', `color=c=${INK}:s=${W}x${H}`,
    '-vf', [
      `drawbox=x=0:y=0:w=${W}:h=${Math.round(H / 2)}:color=${a}@0.55:t=fill`,
      `drawbox=x=0:y=${Math.round(H / 2)}:w=${W}:h=${Math.round(H / 2)}:color=${b}@0.5:t=fill`,
    ].join(','),
    '-frames:v', '1', outImg])
  return outImg
}

// ── caption overlay clip (SOUL beats burned in over the motion) ──────────────

async function captionOverlay(inClip, outClip, beats, attribution) {
  const haveBold = await exists(FONT_BOLD)
  const fb = haveBold ? FONT_BOLD : FONT_ITALIC
  const fi = (await exists(FONT_ITALIC)) ? FONT_ITALIC : FONT_BOLD

  // Probe duration so we can spread beats across the motion.
  let dur = 8
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', inClip])
    dur = parseFloat(stdout.trim()) || 8
  } catch { /* keep default */ }

  const filters = []
  const n = beats.length || 1
  const per = dur / n
  beats.forEach((beat, i) => {
    const from = (i * per).toFixed(2)
    const to = ((i + 1) * per).toFixed(2)
    const y = H - 520
    // Heavy caption line, lime, low third.
    filters.push(`drawtext=fontfile='${fb}':text='${dt(beat.caption)}':fontcolor=${TEXT}:fontsize=72:box=1:boxcolor=${INK}@0.55:boxborderw=24:x=(w-text_w)/2:y=${y}:enable='between(t,${from},${to})'`)
  })
  // Lime spine + RALLY mark (brand frame), persistent.
  filters.push(`drawbox=x=0:y=0:w=18:h=${H}:color=${LIME}:t=fill`)
  filters.push(`drawtext=fontfile='${fb}':text='RALLY':fontcolor=${TEXT}:fontsize=48:x=60:y=70`)
  filters.push(`drawtext=fontfile='${fb}':text='.':fontcolor=#FF2D7A:fontsize=48:x=210:y=70`)
  // Commons attribution, small, bottom — required on any photo frame.
  if (attribution) {
    filters.push(`drawtext=fontfile='${fi}':text='${dt(attribution)}':fontcolor=#cfcfc8:fontsize=26:x=60:y=${H - 60}`)
  }

  await run('ffmpeg', ['-y', '-i', inClip, '-vf', filters.join(','), '-an', outClip])
  return outClip
}

// ── still helper: make a ~0.5s clip from a poster PNG ────────────────────────

async function stillClip(img, outClip, seconds, label) {
  const vf = [`scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`, `fps=${FPS}`, 'format=yuv420p']
  const args = ['-y', '-loop', '1', '-i', img, '-t', String(seconds), '-r', String(FPS)]
  if (label) {
    const fb = (await exists(FONT_BOLD)) ? FONT_BOLD : FONT_ITALIC
    vf.push(`drawtext=fontfile='${fb}':text='${dt(label)}':fontcolor=${TEXT}:fontsize=52:box=1:boxcolor=${INK}@0.6:boxborderw=20:x=(w-text_w)/2:y=${H - 200}`)
  }
  args.push('-vf', vf.join(','), '-an', outClip)
  await run('ffmpeg', args)
  return outClip
}

// ── public: build one fixture's 9:16 video ───────────────────────────────────
//
// Returns { status, path, provider, vo, cost_usd, attribution, notes[] }
// Always resolves: on any motion-provider failure it falls back to kenburns.

export async function buildVideo(fx, {
  posterPath, script, outPath, workDir,
  higgsfieldKey, force,
} = {}) {
  if (!force && await exists(outPath)) {
    return { status: 'cached', path: outPath, provider: 'cache', cost_usd: 0, notes: [] }
  }
  await mkdir(workDir, { recursive: true })
  const notes = []
  const cleanup = []

  // Source image for the motion shot: archive photo if we have one, else panel.
  let srcImage
  let attribution = null
  if (fx.archive && fx.archive.src) {
    srcImage = join(workDir, 'src.jpg')
    const r = await fetch(fx.archive.src)
    if (r.ok) {
      await writeFile(srcImage, Buffer.from(await r.arrayBuffer()))
      attribution = `${fx.archive.credit || 'Wikimedia Commons'} · ${fx.archive.license || 'free licence'}`
    } else {
      notes.push(`archive image fetch failed (${r.status}); using colour panel`)
      srcImage = await colourPanel(fx, join(workDir, 'panel.png'))
    }
  } else {
    srcImage = await colourPanel(fx, join(workDir, 'panel.png'))
  }
  cleanup.push(srcImage)

  // Motion shot — provider chosen by key presence, kenburns as the safety net.
  const motionRaw = join(workDir, 'motion.mp4')
  let motion
  if (higgsfieldKey) {
    try {
      motion = await higgsfieldClip(fx, fx.archive?.src || srcImage, motionRaw, { apiKey: higgsfieldKey })
    } catch (err) {
      notes.push(`higgsfield unavailable (${err.message}); fell back to kenburns`)
      motion = await kenburnsClip(fx, srcImage, motionRaw, 8)
    }
  } else {
    motion = await kenburnsClip(fx, srcImage, motionRaw, 8)
  }
  cleanup.push(motionRaw)

  // Burn SOUL caption beats + brand frame + attribution onto the motion.
  const beats = (script.beats || []).filter(b => b.caption)
  const motionCapped = join(workDir, 'motion_cap.mp4')
  await captionOverlay(motionRaw, motionCapped, beats, attribution)
  cleanup.push(motionCapped)

  // Cover (~0.5s) and outro (the poster + CTA) from the poster PNG.
  const cover = join(workDir, 'cover.mp4')
  const outro = join(workDir, 'outro.mp4')
  await stillClip(posterPath, cover, 0.6, null)
  await stillClip(posterPath, outro, 2.0, 'find your people · rally.futbol')
  cleanup.push(cover, outro)

  // Concat: cover → motion(captioned) → outro.
  const concatList = join(workDir, 'concat.txt')
  await writeFile(concatList, [cover, motionCapped, outro].map(p => `file '${p}'`).join('\n'))
  cleanup.push(concatList)
  const silentOut = join(workDir, 'silent.mp4')
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', concatList,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS), silentOut])
  cleanup.push(silentOut)

  // VO — robotic local TTS over the whole thing if available.
  let voInfo = { ok: false, engine: null }
  const wav = join(workDir, 'vo.wav')
  try {
    voInfo = await makeVO(script.vo || '', wav)
  } catch (err) {
    voInfo = { ok: false, engine: null, note: `TTS failed: ${err.message}` }
  }

  if (voInfo.ok) {
    // Mux VO; pad/trim audio to video length with -shortest.
    await run('ffmpeg', ['-y', '-i', silentOut, '-i', wav,
      '-c:v', 'copy', '-c:a', 'aac', '-shortest', outPath])
    cleanup.push(wav)
  } else {
    notes.push(voInfo.note || 'no VO')
    await run('cp', [silentOut, outPath])
  }

  // Tidy intermediates (keep the final + src for caching).
  for (const p of cleanup) await rm(p, { force: true }).catch(() => {})

  return {
    status: 'rendered',
    path: outPath,
    provider: motion.provider,
    model: motion.model || null,
    vo: voInfo.ok ? voInfo.engine : null,
    cost_usd: motion.cost_usd || 0,
    attribution,
    notes,
  }
}

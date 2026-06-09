#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — social-pack.mjs  ·  the daily Content Engine (GENERATE-ONLY)
//
//   node source/scripts/social-pack.mjs <YYYY-MM-DD>
//
// Gathers that date's fixtures from src/data/fixtures.json and writes a dated
// folder /social/<date>/ containing, per fixture:
//   <a>-<b>.png   poster (live /api/poster, upscaled to 1080×1920, SOUL hook)
//   <a>-<b>.txt   captions (IG / TikTok / FB) + hashtags + a 20–25s video script
//   <a>-<b>.mp4   a 9:16 video (kenburns fallback with no keys; higgsfield opt-in)
// plus:
//   slate-digest.png / .txt   the day's matches on one brand graphic + caption
//   manifest.json             every asset, status, Commons attribution, cost line
//
// Idempotent + cached per fixture id: re-running skips assets already on disk
// (pass --force to rebuild). NOTHING is published — a human posts the folder.
//
// Voice: every caption + script is written to SOUL.md. With ANTHROPIC_API_KEY
// the captions come from claude-opus-4-8 (system = SOUL.md); without it they
// degrade to a deterministic SOUL-flavoured TEMPLATE so the pack always builds.
//
// The daily cron trigger is OUT OF SCOPE for this pass (follow-up).
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

import { generateContent, renderCaptionFile } from './social/captions.mjs'
import { renderPoster, renderSlateDigest, posterHook } from './social/poster.mjs'
import { buildVideo } from './social/video.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')       // repo root (…/RALLY)
const SRC = resolve(__dirname, '..')              // source/
const FIXTURES = resolve(SRC, 'src', 'data', 'fixtures.json')
const SOUL = resolve(ROOT, 'SOUL.md')

const args = process.argv.slice(2)
const force = args.includes('--force')
const noVideo = args.includes('--no-video')
const dateArg = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a))

// Per-day clip cap so the gen-AI path can never run away (budget-safe).
const MAX_VIDEOS_PER_DAY = Number(process.env.RALLY_MAX_VIDEOS || 25)

function slug(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Match a fixture to a calendar date via its ISO kickoff.
function fixtureDate(fx) {
  const m = (fx.kickoff_utc || fx.kickoff || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

async function main() {
  if (!dateArg) {
    console.error('Usage: node source/scripts/social-pack.mjs <YYYY-MM-DD> [--force] [--no-video]')
    process.exit(1)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  const higgsfieldKey = process.env.HIGGSFIELD_API_KEY || ''

  const fixturesRaw = JSON.parse(await readFile(FIXTURES, 'utf8'))
  const all = fixturesRaw.fixtures || fixturesRaw
  const soul = await readFile(SOUL, 'utf8')

  const todays = all.filter(fx => fixtureDate(fx) === dateArg)
  if (!todays.length) {
    console.error(`No fixtures found for ${dateArg}. Available dates:`)
    const dates = [...new Set(all.map(fixtureDate).filter(Boolean))].sort()
    console.error('  ' + dates.slice(0, 12).join(', ') + (dates.length > 12 ? ' …' : ''))
    process.exit(2)
  }

  const outDir = join(ROOT, 'social', dateArg)
  await mkdir(outDir, { recursive: true })
  const workRoot = join(outDir, '.work')

  console.log(`RALLY content engine · ${dateArg} · ${todays.length} fixture(s)`)
  console.log(`  captions: ${apiKey ? 'Anthropic (claude-opus-4-8, system=SOUL.md)' : 'TEMPLATE (no ANTHROPIC_API_KEY — deterministic SOUL fallback)'}`)
  console.log(`  video:    ${noVideo ? 'skipped (--no-video)' : (higgsfieldKey ? 'higgsfield (with kenburns fallback)' : 'kenburns (deterministic, no keys)')}`)
  console.log('')

  const manifest = {
    engine: 'rally-social-pack',
    mode: 'generate-only',
    note: 'Nothing is published. A human posts these assets by hand.',
    date: dateArg,
    generated_at: new Date().toISOString(),
    caption_source: apiKey ? 'anthropic' : 'template',
    video_provider_default: higgsfieldKey ? 'higgsfield' : 'kenburns',
    fixtures: [],
    cost: { caption_usd: 0, video_usd: 0, total_usd: 0, currency: 'USD' },
    attributions: [],
    follow_ups: [
      'Daily cron trigger (Vercel cron / scheduled task) to run this for "today" and notify Sven — OUT OF SCOPE this pass.',
    ],
  }

  let videosMade = 0

  for (const fx of todays) {
    const base = `${slug(fx.team_a)}-${slug(fx.team_b)}`
    const pngPath = join(outDir, `${base}.png`)
    const txtPath = join(outDir, `${base}.txt`)
    const mp4Path = join(outDir, `${base}.mp4`)
    const entry = { id: fx.id, fixture: `${fx.team_a} v ${fx.team_b}`, base, assets: {} }

    console.log(`▶ ${fx.team_a} v ${fx.team_b}`)

    // 1) captions + script (SOUL voice; degrades without a key)
    let content
    try {
      content = await generateContent(fx, soul, { apiKey })
      manifest.cost.caption_usd += content.cost?.usd || 0
      entry.captions = { source: content.source, cost_usd: content.cost?.usd || 0, degraded_reason: content.degraded_reason || null }
      await writeFile(txtPath, renderCaptionFile(fx, content), 'utf8')
      entry.assets.captions = { file: `${base}.txt`, status: 'written' }
      console.log(`  · captions (${content.source})  → ${base}.txt`)
    } catch (err) {
      entry.assets.captions = { status: 'error', error: err.message }
      console.log(`  · captions FAILED: ${err.message}`)
      content = null
    }

    // 2) poster (live endpoint, upscaled, SOUL hook on the card)
    try {
      const hook = posterHook(fx, content)
      const tvName = fx.tv?.length ? (typeof fx.tv[0] === 'string' ? fx.tv[0] : fx.tv[0]?.name) : ''
      const r = await renderPoster(fx, pngPath, { hook, tv: tvName, force })
      entry.assets.poster = { file: `${base}.png`, status: r.status, source: r.source || 'api', size: '1080x1920' }
      if (r.fallback_reason) entry.assets.poster.fallback_reason = r.fallback_reason
      console.log(`  · poster (${r.status}, ${r.source || 'api'})  → ${base}.png`)
    } catch (err) {
      entry.assets.poster = { status: 'error', error: err.message }
      console.log(`  · poster FAILED: ${err.message}`)
    }

    // 3) video (9:16, pluggable provider; kenburns with no keys)
    if (!noVideo && entry.assets.poster?.status && entry.assets.poster.status !== 'error') {
      if (videosMade >= MAX_VIDEOS_PER_DAY) {
        entry.assets.video = { status: 'skipped', reason: `daily cap ${MAX_VIDEOS_PER_DAY} reached` }
        console.log(`  · video skipped (daily cap)`)
      } else {
        try {
          const r = await buildVideo(fx, {
            posterPath: pngPath,
            script: (content?.script) || { vo: '', beats: [] },
            outPath: mp4Path,
            workDir: join(workRoot, base),
            higgsfieldKey,
            force,
          })
          if (r.status === 'rendered') videosMade++
          manifest.cost.video_usd += r.cost_usd || 0
          entry.assets.video = {
            file: `${base}.mp4`, status: r.status, provider: r.provider,
            model: r.model || null, vo: r.vo, cost_usd: r.cost_usd || 0,
            notes: r.notes || [],
          }
          console.log(`  · video (${r.status}, ${r.provider}${r.vo ? ', VO=' + r.vo : ', no VO'})  → ${base}.mp4`)
          for (const n of (r.notes || [])) console.log(`      note: ${n}`)
        } catch (err) {
          entry.assets.video = { status: 'error', error: err.message }
          console.log(`  · video FAILED: ${err.message}`)
        }
      }
    } else if (noVideo) {
      entry.assets.video = { status: 'skipped', reason: '--no-video' }
    }

    // Commons attribution rides along on any asset using the photo.
    if (fx.archive && fx.archive.src) {
      const att = {
        fixture: `${fx.team_a} v ${fx.team_b}`,
        used_in: [base + '.png', base + '.mp4'],
        credit: fx.archive.credit || 'Wikimedia Commons',
        license: fx.archive.license || 'free licence',
        source: fx.archive.source || fx.archive.src,
      }
      entry.attribution = att
      manifest.attributions.push(att)
    }

    manifest.fixtures.push(entry)
    console.log('')
  }

  // 4) slate digest — the day's matches on one brand graphic + caption
  console.log('▶ slate digest')
  const digestPng = join(outDir, 'slate-digest.png')
  const digestTxt = join(outDir, 'slate-digest.txt')
  const dateLabel = todays[0]?.day || dateArg
  try {
    const r = await renderSlateDigest(todays, dateLabel, digestPng, { force })
    manifest.slate_digest = { poster: 'slate-digest.png', status: r.status, fixtures: r.fixtures }
    console.log(`  · graphic (${r.status})  → slate-digest.png`)
  } catch (err) {
    manifest.slate_digest = { poster: 'slate-digest.png', status: 'error', error: err.message }
    console.log(`  · graphic FAILED: ${err.message}`)
  }
  await writeFile(digestTxt, renderDigestCaption(todays, dateLabel), 'utf8')
  console.log(`  · caption  → slate-digest.txt`)
  console.log('')

  manifest.cost.total_usd = +(manifest.cost.caption_usd + manifest.cost.video_usd).toFixed(5)
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  // Tidy the scratch dir (intermediate clips/frames live here during a run).
  await rm(workRoot, { recursive: true, force: true }).catch(() => {})

  console.log(`✓ pack written → social/${dateArg}/`)
  console.log(`  cost: $${manifest.cost.total_usd} (captions $${manifest.cost.caption_usd.toFixed(5)} + video $${manifest.cost.video_usd.toFixed(5)})`)
  console.log(`  manifest: social/${dateArg}/manifest.json`)
}

// The digest caption — one anchor post for the day, SOUL voice (template; it's
// a fixed-shape briefing, so it doesn't need the model).
function renderDigestCaption(fixtures, dateLabel) {
  const lines = []
  lines.push(`Tonight in København. ${fixtures.length === 1 ? "One match, and it's the only place to be." : fixtures.length + " matches, and not one of them is worth watching alone."}`)
  lines.push('')
  for (const fx of fixtures) {
    const t = (fx.kickoff || '').match(/T(\d{2}:\d{2})/)?.[1] || ''
    const tv = fx.tv?.length ? (typeof fx.tv[0] === 'string' ? fx.tv[0] : fx.tv[0]?.name) : ''
    lines.push(`${t ? t + '  ' : ''}${fx.team_a} v ${fx.team_b}${tv ? '  ·  ' + tv : ''}`)
  }
  lines.push('')
  lines.push('Pick a screen, grab your lot, make a night of it.')
  lines.push("Who's rallying? Find your game, find your people · rally.futbol")
  lines.push('')
  lines.push('#RALLY #København #Copenhagen')
  return lines.join('\n')
}

main().catch(err => {
  console.error('social-pack failed:', err)
  process.exit(1)
})

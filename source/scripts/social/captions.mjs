// ---------------------------------------------------------------------------
// RALLY — caption + video-script generator (the SOUL voice, on demand)
//
// Takes ONE fixture's facts + SOUL.md and returns:
//   • 3 captions (Instagram / TikTok / Facebook) — lead with a take, one
//     screenshot-worthy line, end on the loop ("who's rallying?"). FB longer.
//   • minimal real hashtags (the two nations + #RALLY + #København —
//     NEVER FIFA / "World Cup" marks)
//   • a 20–25s video script (the lowdown in SOUL voice as VO + caption beats)
//
// Two paths, same shape out:
//   1. Anthropic API (claude-opus-4-8, system = SOUL.md) when ANTHROPIC_API_KEY
//      is set. Raw fetch — no SDK, keeps the pack zero-install.
//   2. A deterministic SOUL-flavoured TEMPLATE when the key is absent, so the
//      pack ALWAYS builds (budget-safe, dry-key-safe). Voice is degraded but
//      never off-brand or neutral.
//
// generate-only: nothing here publishes anything. The output is text on disk.
// ---------------------------------------------------------------------------

const MODEL = 'claude-opus-4-8'
const API_URL = 'https://api.anthropic.com/v1/messages'

// ── helpers ────────────────────────────────────────────────────────────────

// A real, FIFA-mark-free hashtag for a nation name.
function nationTag(team) {
  return '#' + (team || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

export function hashtagsFor(fx) {
  // Minimal + real: the two nations, the brand, the city. No FIFA marks.
  const tags = [nationTag(fx.team_a), nationTag(fx.team_b), '#RALLY', '#København', '#Copenhagen']
  // de-dupe, drop empties
  return [...new Set(tags.filter(t => t && t.length > 1))]
}

function kickoffTime(fx) {
  const k = fx.kickoff || ''
  const m = k.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : ''
}

function tvName(fx) {
  const tv = fx.tv
  if (!tv || !tv.length) return ''
  const t = tv[0]
  return typeof t === 'string' ? t : (t?.name || '')
}

// A compact, model-friendly fact sheet for one fixture.
export function factSheet(fx) {
  return {
    team_a: fx.team_a,
    team_b: fx.team_b,
    flag_a: fx.flag_a,
    flag_b: fx.flag_b,
    kickoff_local: kickoffTime(fx),
    day: fx.day,
    stage: fx.stage,
    venue: fx.venue,
    tv: tvName(fx),
    form_a: fx.form_a,
    form_b: fx.form_b,
    win_prob: (fx.prob_a || fx.prob_b)
      ? { a: fx.prob_a, draw: fx.prob_draw, b: fx.prob_b }
      : null,
    h2h: fx.h2h || null,
    has_archive_photo: !!(fx.archive && fx.archive.src),
  }
}

// ── the deterministic SOUL TEMPLATE (no key needed) ─────────────────────────
// Not as alive as the model, but never neutral and never off-brand. The whole
// point of the fallback is that the daily pack builds with a dry/absent key.

export function templateCaptions(fx) {
  const a = fx.team_a, b = fx.team_b
  const time = kickoffTime(fx)
  const tv = tvName(fx)
  const tags = hashtagsFor(fx)
  const venue = fx.venue ? fx.venue.split('·')[0].trim() : ''

  // The hook — lead with a TAKE, not the fixture (SOUL: a scoreline is plumbing).
  // One heavy line, then a soft one. Punch up, warm under the cocky.
  const hook = `Nobody watches a night like ${a}–${b} alone. Two teams, one room, and the best seat's in a packed bar.`
  const when = [fx.day, time && `kick-off ${time}`, tv && `on ${tv}`].filter(Boolean).join(' · ')

  // INSTAGRAM — texts not essays. Take up top, details below, loop at the end.
  const ig = [
    hook,
    '',
    when,
    venue ? `Find the room. ${venue} and every screen in the city.` : 'Find the room.',
    '',
    `Who's rallying? Find your people · rally.futbol`,
    '',
    tags.join(' '),
  ].join('\n')

  // TIKTOK — sharper, shorter, built to be forwarded.
  const tiktok = [
    `${a} or ${b} — but the real winner's whoever's in the loudest bar.`,
    when,
    `Who's rallying tonight? rally.futbol`,
    '',
    tags.join(' '),
  ].join('\n')

  // FACEBOOK — slightly longer, a touch warmer for the venue-tagging crowd.
  const fb = [
    hook,
    '',
    `${a} and ${b}, ${(fx.stage || 'the group stage').toLowerCase()}. Every match is somebody's everything — so grab your lot, pick a screen, and make a night of it.`,
    '',
    when,
    venue ? `We'll be down at ${venue} and the rest of Copenhagen's best rooms.` : `We'll be in Copenhagen's best rooms.`,
    '',
    `Who's rallying? Find your game, find your people · rally.futbol`,
    '',
    tags.join(' '),
  ].join('\n')

  return { instagram: ig, tiktok, facebook: fb, hashtags: tags }
}

export function templateScript(fx) {
  const a = fx.team_a, b = fx.team_b
  const time = kickoffTime(fx)
  // 20–25s of VO, in the SOUL register, as beats (each ~3–4s on screen).
  return {
    vo: `Tonight: ${a} against ${b}. Don't watch it on the sofa. ${a} bring the noise, ${b} bring the heart, and Copenhagen brings the bar. Kick-off ${time || 'tonight'}. Find your game. Find your people.`,
    beats: [
      { t: '0–4s', caption: `${a.toUpperCase()} v ${b.toUpperCase()}`, vo: `Tonight: ${a} against ${b}.` },
      { t: '4–9s', caption: 'NOT ON THE SOFA', vo: `Don't watch it on the sofa.` },
      { t: '9–16s', caption: 'BRING THE NOISE', vo: `${a} bring the noise, ${b} bring the heart, and Copenhagen brings the bar.` },
      { t: '16–21s', caption: time ? `KICK-OFF ${time}` : 'TONIGHT', vo: `Kick-off ${time || 'tonight'}.` },
      { t: '21–25s', caption: 'FIND YOUR PEOPLE · RALLY.FUTBOL', vo: `Find your game. Find your people.` },
    ],
  }
}

// ── the Anthropic path (claude-opus-4-8, system = SOUL.md) ──────────────────

function buildUserPrompt(fx) {
  const facts = factSheet(fx)
  return [
    'You are writing daily social posts for RALLY about ONE football match. Write strictly to your SOUL (the system prompt): cocky but warm, a take never plumbing, one heavy line then one soft one, end on the loop ("who\'s rallying?" / "find your people"). Punch up, never down. Never use "FIFA" or "World Cup" as marks. No emoji rows — a flag or a single 🔥 only when earned.',
    '',
    'MATCH FACTS (JSON):',
    JSON.stringify(facts, null, 2),
    '',
    'Return ONLY a JSON object (no prose, no markdown fence) with this exact shape:',
    '{',
    '  "instagram": "caption string — lead with a take, one screenshot-worthy line up top, details (day/time/TV) below, end on the loop",',
    '  "tiktok": "shorter, sharper, forward-it-to-the-group-chat caption",',
    '  "facebook": "slightly longer + warmer caption for the older Copenhagen / venue-tagging crowd",',
    '  "hashtags": ["#Nation1", "#Nation2", "#RALLY", "#København"],',
    '  "script": {',
    '    "vo": "20–25 seconds of voiceover — the lowdown in your voice, read aloud",',
    '    "beats": [ { "t": "0–4s", "caption": "ON-SCREEN TEXT", "vo": "what the VO says over this beat" } ]',
    '  }',
    '}',
    'Hashtags must be real and minimal (the two nations, #RALLY, #København) — never FIFA/World Cup marks. Put the hashtags at the end of each caption too.',
  ].join('\n')
}

function extractJson(text) {
  // Model should return bare JSON, but be tolerant of a stray fence.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object in model output')
  return JSON.parse(raw.slice(start, end + 1))
}

async function anthropicCaptions(fx, soul, apiKey) {
  const body = {
    model: MODEL,
    max_tokens: 4000,
    system: soul,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: buildUserPrompt(fx) }],
  }
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json()
  const text = (json.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
  const parsed = extractJson(text)
  const usage = json.usage || {}
  return { parsed, usage }
}

// Opus 4.8 pricing (per 1M tokens) for the manifest cost line.
const PRICE_IN = 5.0 / 1e6
const PRICE_OUT = 25.0 / 1e6

export function estimateCost(usage) {
  const inTok = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0)
  const outTok = usage.output_tokens || 0
  return {
    input_tokens: inTok,
    output_tokens: outTok,
    usd: +(inTok * PRICE_IN + outTok * PRICE_OUT).toFixed(5),
  }
}

// ── public API ──────────────────────────────────────────────────────────────
//
// Returns { captions: {instagram,tiktok,facebook,hashtags}, script, source, cost }
// Always resolves (falls back to the template on any failure).

export async function generateContent(fx, soul, { apiKey } = {}) {
  if (apiKey) {
    try {
      const { parsed, usage } = await anthropicCaptions(fx, soul, apiKey)
      const tags = Array.isArray(parsed.hashtags) && parsed.hashtags.length
        ? parsed.hashtags
        : hashtagsFor(fx)
      return {
        captions: {
          instagram: parsed.instagram || '',
          tiktok: parsed.tiktok || '',
          facebook: parsed.facebook || '',
          hashtags: tags,
        },
        script: parsed.script || templateScript(fx),
        source: 'anthropic',
        cost: estimateCost(usage),
      }
    } catch (err) {
      // Degrade to the template; record why on the result so the manifest shows it.
      const caps = templateCaptions(fx)
      return {
        captions: caps,
        script: templateScript(fx),
        source: 'template',
        cost: { input_tokens: 0, output_tokens: 0, usd: 0 },
        degraded_reason: `anthropic failed: ${err.message}`,
      }
    }
  }
  // No key → deterministic template. The daily pack still builds.
  const caps = templateCaptions(fx)
  return {
    captions: caps,
    script: templateScript(fx),
    source: 'template',
    cost: { input_tokens: 0, output_tokens: 0, usd: 0 },
  }
}

// Render a caption .txt file body (all three platforms + the script).
export function renderCaptionFile(fx, content) {
  const c = content.captions
  const s = content.script
  const line = '─'.repeat(60)
  const out = []
  out.push(`RALLY · ${fx.team_a} v ${fx.team_b} · ${fx.day || ''} ${kickoffTime(fx)}`.trim())
  out.push(`voice: SOUL.md   ·   captions: ${content.source}${content.degraded_reason ? ' (' + content.degraded_reason + ')' : ''}`)
  out.push('')
  out.push(line); out.push('INSTAGRAM'); out.push(line)
  out.push(c.instagram)
  out.push('')
  out.push(line); out.push('TIKTOK'); out.push(line)
  out.push(c.tiktok)
  out.push('')
  out.push(line); out.push('FACEBOOK'); out.push(line)
  out.push(c.facebook)
  out.push('')
  out.push(line); out.push('VIDEO SCRIPT (20–25s · VO + on-screen beats)'); out.push(line)
  out.push('VO: ' + (s.vo || ''))
  out.push('')
  for (const beat of (s.beats || [])) {
    out.push(`  [${beat.t}]  ${beat.caption}`)
    out.push(`           ↳ ${beat.vo}`)
  }
  out.push('')
  if (fx.archive && fx.archive.src) {
    out.push(line); out.push('PHOTO ATTRIBUTION (required on any asset using the photo)'); out.push(line)
    out.push(`${fx.archive.credit || 'Wikimedia Commons'} · ${fx.archive.license || 'free licence'}`)
    if (fx.archive.source) out.push(fx.archive.source)
    out.push('')
  }
  out.push(line)
  out.push('Generated by RALLY content engine — GENERATE-ONLY. Nothing is published. A human posts this.')
  return out.join('\n')
}

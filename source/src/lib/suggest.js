// ---------------------------------------------------------------------------
// suggest.js — "what should this community do next?" (project HEKLA, S4.1).
//
// The AI coordination layer, demo-shaped: read a community's history (its
// signature kind, its usual neighbourhood, whether it runs on a cadence) and
// propose the next rally — a ready-to-edit draft + a one-line reason in SOUL
// voice. Pure and deterministic so it's testable and works offline; a real LLM
// endpoint (source/api/suggest-rally.js) swaps in behind a flag later, the same
// way the match "lowdown" upgrades from template to model.
// ---------------------------------------------------------------------------
import { kindMeta } from '../data/rallies.js'
import { isRecurring, recurrenceLabel } from './creator.js'

// The most common value of keyFn across a list (ties → first seen). Deterministic.
const topBy = (arr, keyFn) => {
  const counts = new Map()
  for (const x of arr) {
    const k = keyFn(x)
    if (k == null || k === '') continue
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  let best = null, bestN = 0
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n }
  return best
}

// SOUL-voice title + blurb templates per kind. Fallbacks keep any kind covered.
const TITLE = {
  run:    (c) => `${c.name} — the next loop`,
  match:  (c) => `${c.name} watch night`,
  social: (c) => `${c.name} round`,
  dinner: (c) => `${c.name} table`,
  civic:  (c) => `${c.name} gives back`,
  gig:    (c) => `${c.name} night out`,
  trip:   (c) => `${c.name} day trip`,
}
const titleFor = (kind, c) => (TITLE[kind] || ((cc) => `${cc.name} meetup`))(c)

const BLURB = {
  run:    'Same loop, same no-one-gets-dropped rule. Lace up.',
  match:  'Big screen, your people, the only seat that matters.',
  social: 'No agenda, just the regulars and a round. Pull up.',
  dinner: 'One long table, bring a chair and an appetite.',
  civic:  'An hour of graft, then the good kind of tired together.',
  gig:    'Lights low, the crew out, nowhere else to be.',
  trip:   'Early train, daft plan, a story by the evening.',
}
const blurbFor = (kind) => BLURB[kind] || 'You know the drill. Same crew, new night.'

// Why we're suggesting this — honest, in voice.
const reasonFor = (c, kind, recurringSeed, count) => {
  if (recurringSeed) return `It’s a ${recurrenceLabel(recurringSeed.recurrence).toLowerCase()} thing — here’s the next one, ready to post.`
  if (count >= 2) return `You’ve run ${count} of these. Keep the streak — spin up the next.`
  return `${c.name} is quiet. Be the one who calls the next one.`
}

// Build the suggestion: { headline, reason, draft }. draft is CreateRallyScreen-
// shaped so "Spin it up" can prefill the form. Returns null without a community.
export const suggestNextRally = (community, rallies = []) => {
  if (!community) return null
  const list = (Array.isArray(rallies) ? rallies : []).filter(Boolean)
  const kind = topBy(list, (r) => r.kind) || 'social'
  const area = topBy(list, (r) => r.area) || community.area || 'Copenhagen'
  const recurringSeed = list.find(isRecurring) || null
  const cap = topBy(list, (r) => r.cap) // typical headcount, or null when mixed/open
  const sameKind = list.filter((r) => r.kind === kind).length

  const draft = {
    kind,
    radius: 'community',
    title: titleFor(kind, community),
    blurb: blurbFor(kind),
    area,
    when: recurringSeed ? recurringSeed.when : 'This week',
    cap: typeof cap === 'number' ? cap : '',
    access: [],
    emoji: kindMeta(kind).emoji,
    recurrence: recurringSeed ? recurringSeed.recurrence : 'none',
  }

  return {
    headline: `Next up for ${community.name}`,
    reason: reasonFor(community, kind, recurringSeed, sameKind),
    draft,
  }
}

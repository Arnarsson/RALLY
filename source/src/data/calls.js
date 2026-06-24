// ---------------------------------------------------------------------------
// calls.js — your personal "call it" record across the tournament.
//
// The match detail already shows the ROOM's picks (the 3-way wedge). This is the
// other half: the call YOU commit to, scored at full time, tallied into a caller
// record you carry from match to match. RALLY always has a take — now you prove
// yours. Pure logic; reuses the existing result helpers in mockData.js so a pick
// is scored exactly like the room's. A real `predictions` table swaps in later.
// ---------------------------------------------------------------------------
import { predictionOutcome, predictionLabel } from './mockData.js'

export const POINTS_PER_HIT = 3
// pick encoding matches mockData: 'team_a' | 'draw' | 'team_b'
export const CALL_CHOICES = ['team_a', 'draw', 'team_b']

const matchIndex = (matches) => {
  const by = new Map()
  for (const m of matches || []) by.set(m.id, m)
  return by
}

// Aggregate a calls map ({ [matchId]: pick }) against the fixtures.
// → { made, settled, pending, hits, misses, points, accuracy }
export const callRecord = (calls, matches) => {
  const by = matchIndex(matches)
  let made = 0, settled = 0, pending = 0, hits = 0, misses = 0
  for (const [matchId, pick] of Object.entries(calls || {})) {
    const m = by.get(matchId)
    if (!m || !CALL_CHOICES.includes(pick)) continue
    made++
    const o = predictionOutcome(m, pick)
    if (o === 'pending') { pending++; continue }
    settled++
    if (o === 'right') hits++; else misses++
  }
  const points = hits * POINTS_PER_HIT
  const accuracy = settled ? Math.round((hits / settled) * 100) : null
  return { made, settled, pending, hits, misses, points, accuracy }
}

// Current hit streak: walk settled calls in kickoff order, reset on a miss.
export const callStreak = (calls, matches) => {
  const by = matchIndex(matches)
  const settled = Object.entries(calls || {})
    .map(([id, pick]) => ({ m: by.get(id), pick }))
    .filter((x) => x.m && CALL_CHOICES.includes(x.pick) && predictionOutcome(x.m, x.pick) !== 'pending')
    .sort((a, b) => String(a.m.kickoff || '').localeCompare(String(b.m.kickoff || '')))
  let streak = 0
  for (const { m, pick } of settled) {
    if (predictionOutcome(m, pick) === 'right') streak++
    else streak = 0
  }
  return streak
}

// A short, in-voice line for a settled or pending call (UI helper).
export const callBlurb = (match, pick) => {
  if (!pick) return ''
  const o = predictionOutcome(match, pick)
  const who = predictionLabel(match, pick)
  if (o === 'pending') return `You called it: ${who}.`
  if (o === 'right') return `You called it — ${who}. Take the bow.`
  return `You said ${who}. The pitch disagreed.`
}

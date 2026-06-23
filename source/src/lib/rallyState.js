// ---------------------------------------------------------------------------
// rallyState.js — pure helpers for the in-session rally coordination loop.
//
// Demo mode holds rallies + "who's in" in React state (App.jsx); these functions
// compute the next state without touching React or a backend. A real
// rallies / rally_participants table (see docs/RALLY-HEKLA-schema.md) swaps in
// behind hasSupabase later — same shape, so the UI never changes.
// ---------------------------------------------------------------------------
import { kindMeta } from '../data/rallies.js'

let _seq = 0

// A shoutable, door-friendly invite code from the title (offline-first invites).
const genCode = (title) => {
  const stem = String(title || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'RALLY'
  return `RLY-${stem}-${String(Date.now()).slice(-3)}`
}

// Turn a Create form draft into a full rally row. The host is in by default
// (going: 1), trust starts honest (a first-time host: 100% of 1).
export const makeRally = (draft = {}) => {
  const kind = draft.kind || 'social'
  const capNum = Number(draft.cap)
  return {
    id: `r_new_${++_seq}_${Date.now().toString(36)}`,
    kind,
    radius: draft.radius || 'public',
    title: (draft.title || '').trim() || 'Untitled rally',
    blurb: (draft.blurb || '').trim(),
    host: (draft.host || 'You').trim() || 'You',
    area: (draft.area || '').trim() || 'Copenhagen',
    when: (draft.when || '').trim() || 'Soon',
    going: 1,
    waiting: 0,
    cap: Number.isFinite(capNum) && capNum > 0 ? Math.round(capNum) : null,
    emoji: draft.emoji || kindMeta(kind).emoji,
    hostStats: { rate: 100, hosted: 1 },
    access: Array.isArray(draft.access) ? draft.access : [],
    code: draft.code || genCode(draft.title),
    recurrence: draft.recurrence || 'none',
    mine: true,
  }
}

export const isFull = (rally) =>
  !!rally && rally.cap != null && (rally.going || 0) >= rally.cap

// Given a rally and the viewer's current status ('in' | 'waitlist' | null/undefined),
// return the next status plus the deltas to apply to the rally's counts. Pure.
//   - in        → tapping leaves            (going -1)
//   - waitlist  → tapping leaves the list   (waiting -1)
//   - none      → join if room, else queue  (going +1) | (waiting +1, status 'waitlist')
export const nextJoinState = (rally, status) => {
  if (status === 'in')       return { status: null,       goingDelta: -1, waitDelta: 0 }
  if (status === 'waitlist') return { status: null,       goingDelta: 0,  waitDelta: -1 }
  if (isFull(rally))         return { status: 'waitlist',  goingDelta: 0,  waitDelta: 1 }
  return { status: 'in', goingDelta: 1, waitDelta: 0 }
}

// Apply a join/leave toggle across the rally list + status map. Returns a new
// { rallies, statusById } pair; never mutates its inputs.
export const applyToggleJoin = (rallies, statusById, rallyId) => {
  const rally = rallies.find((r) => r.id === rallyId)
  if (!rally) return { rallies, statusById }
  const current = statusById[rallyId] || null
  const { status, goingDelta, waitDelta } = nextJoinState(rally, current)

  const nextRallies = rallies.map((r) =>
    r.id === rallyId
      ? { ...r, going: Math.max(0, (r.going || 0) + goingDelta), waiting: Math.max(0, (r.waiting || 0) + waitDelta) }
      : r,
  )
  const nextStatus = { ...statusById }
  if (status) nextStatus[rallyId] = status
  else delete nextStatus[rallyId]

  return { rallies: nextRallies, statusById: nextStatus }
}

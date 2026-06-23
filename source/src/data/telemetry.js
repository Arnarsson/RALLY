// ---------------------------------------------------------------------------
// telemetry.js — the real-world intent graph, GDPR-clean BY DESIGN.
//
// RALLY's edge isn't surveillance, it's intent: who's actually showing up,
// together. To learn that without becoming the thing we hate, telemetry here
// obeys three hard rules, enforced in code, not in a policy doc nobody reads:
//
//   1. OPT-IN ONLY. Consent defaults OFF. Nothing is logged until the user
//      flips it on (setConsent(true)). No consent → logEvent no-ops and the log
//      stays empty.
//   2. USER-INITIATED EVENTS ONLY. We log deliberate actions — viewing,
//      joining, sharing, arriving — never passive background activity.
//   3. NEVER LOCATION. No GPS, no coordinates, no passive tracking, ever. Any
//      payload key that smells like location (lat/lng/lon/coord/gps/geo) is
//      stripped before storage, defensively, so a careless caller can't leak it.
//
// This feeds AGGREGATE "group intent" only — how many, which rally, what action.
// It is not a per-person trail. Demo: pure, in-memory, no network, no storage.
// ---------------------------------------------------------------------------

// The only events we recognise. All user-initiated, all deliberate. An `arrive`
// is a tap ("I'm here"), never a passive geofence ping — see rule 3.
export const EVENT_KINDS = [
  'rally_view',
  'rally_join',
  'rally_leave',
  'rally_share',
  'rally_invite',
  'arrive',
]

// Substrings that mark a payload key as location-ish. Anything matching is
// dropped — we never log where you are.
const GEO_HINTS = ['lat', 'lng', 'lon', 'coord', 'gps', 'geo']

let _consent = false
let _log = []

export const hasConsent = () => _consent

export const setConsent = (on) => {
  _consent = !!on
  return _consent
}

// Strip any location-shaped keys from a payload before it's ever stored.
const sanitize = (payload) => {
  const clean = {}
  for (const [key, value] of Object.entries(payload || {})) {
    const lower = key.toLowerCase()
    if (GEO_HINTS.some((hint) => lower.includes(hint))) continue
    clean[key] = value
  }
  return clean
}

// Record a deliberate event. Returns false (and stores nothing) without consent
// or for an unknown kind; otherwise stores a sanitized, timestamped row.
export const logEvent = (kind, payload = {}) => {
  if (!_consent) return false
  if (!EVENT_KINDS.includes(kind)) return false
  _log.push({ kind, at: Date.now(), ...sanitize(payload) })
  return true
}

export const getLog = () => _log.slice()

export const clearLog = () => {
  _log = []
}

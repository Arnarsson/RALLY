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

// Whole-segment tokens that mark a key as location-ish. We match on segments
// (camelCase + separators) rather than raw substrings, so 'userLat'/'gpsFix'
// are dropped but innocent keys like 'latency'/'translation'/'relation' survive.
const GEO_TOKENS = new Set([
  'lat', 'latitude', 'lng', 'lon', 'longitude',
  'coord', 'coords', 'coordinate', 'coordinates',
  'gps', 'geo', 'geolocation', 'location',
])

// Split a key into lowercase segments: camelCase boundaries + non-alphanumerics.
const isGeoKey = (key) =>
  String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((seg) => GEO_TOKENS.has(seg))

let _consent = false
let _log = []

export const hasConsent = () => _consent

export const setConsent = (on) => {
  _consent = !!on
  return _consent
}

// Strip any location-shaped keys before storage — RECURSIVELY, through nested
// objects and arrays, so a careless caller can't smuggle coordinates in a
// sub-object. Primitives pass through untouched.
const sanitize = (value) => {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') {
    const clean = {}
    for (const [key, v] of Object.entries(value)) {
      if (isGeoKey(key)) continue
      clean[key] = sanitize(v)
    }
    return clean
  }
  return value
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

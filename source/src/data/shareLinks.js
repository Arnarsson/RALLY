// ---------------------------------------------------------------------------
// SHARE LOOP — pure helpers for the shareable event card + guest-join link.
//
// Kept dependency-free and side-effect-free so they're unit-testable and reused
// by both the Share sheet (build the link + card URL) and the guest-join
// bootstrap (parse the incoming link). No DOM, no Supabase — App.jsx wires these
// into navigator.share / the view-stack.
// ---------------------------------------------------------------------------

// Origin for shared links. The deployed SPA serves clean /p/<id> paths (a
// vercel.json rewrite points them at index.html, where the bootstrap reads the
// id back out of the path), so we hand out the pretty form.
export const SHARE_ORIGIN = 'https://rally.futbol'

// Parse an incoming location into the shared-plan params. Accepts BOTH the clean
// path form (/p/<planId>) and the query form (?p=<planId>) so a link works
// whether or not the SPA rewrite is in place. Also captures ?ref=<code> (stashed
// for §2 referrals — no logic here). Returns { planId, ref } (either may be null).
//
//   parseShareParams({ pathname: '/p/abc', search: '?ref=X' })  → { planId:'abc', ref:'X' }
//   parseShareParams({ pathname: '/',      search: '?p=abc' })   → { planId:'abc', ref:null }
export function parseShareParams(loc) {
  const pathname = (loc && loc.pathname) || ''
  const search = (loc && loc.search) || ''
  const params = new URLSearchParams(search)

  let planId = params.get('p') || null
  if (!planId) {
    const m = pathname.match(/^\/p\/([^/?#]+)/)
    if (m) planId = decodeURIComponent(m[1])
  }
  const ref = params.get('ref') || null
  return { planId: planId || null, ref: ref || null }
}

// The shareable plan link. Clean path form by default; carries ?ref for §2.
export function planShareUrl(planId, ref) {
  if (!planId) return SHARE_ORIGIN
  const base = `${SHARE_ORIGIN}/p/${encodeURIComponent(planId)}`
  return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base
}

// ---------------------------------------------------------------------------
// §2 REFERRAL — a user's STABLE referral code, derived deterministically from
// their (auth) id. Pure + side-effect-free so it's unit-testable and identical
// on every device for the same user (no extra column on `profiles` needed).
//
// Shape: RALLY-XXXXXX — a short, human-ish, uppercase code. The derivation is a
// tiny stable string hash (FNV-1a) over the id, base36-encoded and padded. It is
// NOT a secret — it just has to be stable per user and collision-light across the
// app's user base. The code travels as ?ref=<code> on the sharer's link and is
// looked up server-side by the claim_referral RPC.
// ---------------------------------------------------------------------------
export function referralCodeFor(userId) {
  if (!userId) return null
  // FNV-1a 32-bit over the id, then a second pass over the reversed id so the
  // 6 chars use more of the input (more spread than a single 32-bit word).
  const fnv = (s) => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0)
  }
  const id = String(userId)
  const a = fnv(id)
  const b = fnv(id.split('').reverse().join(''))
  const raw = (a.toString(36) + b.toString(36)).toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = (raw + '000000').slice(0, 6)
  return `RALLY-${body}`
}

// The referral-bearing plan link: a normal /p/<id> link that also carries the
// sharer's referral code as ?ref. Thin convenience over planShareUrl so the
// Share sheet has one obvious call. Falls back to a plain plan link when there's
// no code yet (demo mode / pre-auth).
export function referralLink(planId, userId) {
  return planShareUrl(planId, referralCodeFor(userId) || undefined)
}

// The Open Graph / event-card image URL for a plan (served by /api/poster).
// going is optional — it just pre-seeds the GOING pill for crawlers; the route
// fetches the live count anyway.
export function planCardUrl(matchId, planId, going) {
  if (!matchId) return `${SHARE_ORIGIN}/`
  const qs = new URLSearchParams()
  if (planId) qs.set('planId', planId)
  if (going != null && going !== '') qs.set('going', String(going))
  const q = qs.toString()
  return `${SHARE_ORIGIN}/api/poster/${encodeURIComponent(matchId)}.png${q ? `?${q}` : ''}`
}

// SOUL-voice share copy for navigator.share — "the burn": ammo for the group
// chat, written by the cocky-but-warm mate who's already at the bar. Speaks from
// the room ("we", "get down here"), never an ad. The URL rides separately.
export function shareText({ teamA, teamB, venue }) {
  const match = [teamA, teamB].filter(Boolean).join(' v ')
  const where = venue ? ` at ${venue}` : ''
  const text = match
    ? `We’re on ${match}${where} tonight. Get down here — don’t watch it alone.`
    : `Tonight’s match${where}, your lot, one room. Get down here — don’t watch it alone.`
  const title = match ? `RALLY — ${match} tonight` : 'RALLY — get down here'
  return { title, text }
}

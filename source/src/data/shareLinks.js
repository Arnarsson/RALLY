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

// SOUL-voice share copy for navigator.share. Keeps it an invitation, not an ad.
export function shareText({ teamA, teamB, venue }) {
  const match = [teamA, teamB].filter(Boolean).join(' v ')
  const where = venue ? ` at ${venue}` : ''
  const game = match ? `Come watch ${match}${where} with us` : `Come watch the match${where} with us`
  return { title: 'RALLY — find your people', text: `${game} — find your game, find your people.` }
}

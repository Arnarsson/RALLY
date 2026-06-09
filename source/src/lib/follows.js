// ---------------------------------------------------------------------------
// MATCH FOLLOWS — "star a match to get its goal alerts without joining a party."
//
// A follow is a row in Supabase `match_follows` (user_id, match_id). The backend
// already targets followers for goal pushes; this module is just the client half
// that creates / removes / reads those rows. Data-adapter pattern, same as the
// rest of mockData.js: the UI only ever sees a Set of followed match ids.
//
// Guarded by `hasSupabase`. On the standalone file:// demo (no backend) every
// call is a no-op and the App keeps the follow-set in local state, so the star
// still toggles offline — it just doesn't persist or push.
// ---------------------------------------------------------------------------
import { supabase, hasSupabase } from './supabase.js'

// Star a match. Idempotent: a re-follow of an already-followed match is a no-op
// (upsert on the composite PK). No-op on the demo path.
export async function followMatch(matchId, userId) {
  if (!hasSupabase || !userId || !matchId) return { ok: false, reason: 'demo' }
  const { error } = await supabase
    .from('match_follows')
    .upsert({ user_id: userId, match_id: matchId }, { onConflict: 'user_id,match_id' })
  return error ? { ok: false, reason: 'error' } : { ok: true }
}

// Unstar a match. No-op on the demo path.
export async function unfollowMatch(matchId, userId) {
  if (!hasSupabase || !userId || !matchId) return { ok: false, reason: 'demo' }
  const { error } = await supabase
    .from('match_follows')
    .delete()
    .eq('user_id', userId)
    .eq('match_id', matchId)
  return error ? { ok: false, reason: 'error' } : { ok: true }
}

// The signed-in user's followed match ids, as a Set (so the UI can O(1) check
// each card). Returns an empty Set on the demo path / on any error.
export async function loadMyFollows(userId) {
  if (!hasSupabase || !userId) return new Set()
  const { data, error } = await supabase
    .from('match_follows')
    .select('match_id')
    .eq('user_id', userId)
  if (error || !data) return new Set()
  return new Set(data.map((r) => r.match_id))
}

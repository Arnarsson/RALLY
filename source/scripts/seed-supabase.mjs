#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — one-off Supabase seed (idempotent)
//
// Seeds the demo/editorial layer that the data workers don't produce:
//   - venues          ← VENUES        (the real Copenhagen watch spots)
//   - matches overlay ← the 6 editorial "hero" matches (m_01..m_06):
//                       commentary, fun_fact, h2h, featured, marquee, archive
//   - profiles        ← USERS         (best-effort — see the FK note below)
//   - plans / parts   ← PLANS         (best-effort — depend on profiles)
//
// Order of operations:
//   1. apply schema.sql to the Supabase project
//   2. node scripts/fetch-fixtures.mjs --target supabase   (populates `matches`)
//   3. node scripts/seed-supabase.mjs                       (this file)
//
// Re-running is safe: every write is an upsert keyed on the primary key, and the
// editorial overlay only patches columns the workers leave blank.
//
// ── profiles / plans FK note ────────────────────────────────────────────────
// `profiles.id` REFERENCES auth.users(id). Our mock users (u_me, u_001 …) are
// not real auth accounts, so inserting them into `profiles` will FK-violate when
// the constraint is enforced (the production schema). There is no way to put a
// row in `profiles` without a matching auth.users row while that FK is on.
// So this seed treats venues + the editorial match columns as the RELIABLE seed,
// and profiles/plans as BEST-EFFORT demo data wrapped in try/catch: if they fail
// (FK violation, RLS, missing table) we log a clear note and carry on. Real
// profiles come from Supabase Auth; the editorial content (commentary, fun_fact,
// h2h, archive, featured/marquee) is what actually makes the demo sing, and that
// is seeded onto `matches` without any user dependency.
//
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).
//
// Usage:
//   node scripts/seed-supabase.mjs
// ---------------------------------------------------------------------------

import { register } from 'node:module'

// mockData.js is written for Vite, not plain Node. Two things trip Node up:
//   1. `import LIVE_DATA from './fixtures.json'` — bare JSON import needs an
//      import attribute (`with { type: 'json' }`) under Node.
//   2. `import { supabase } from '../lib/supabase.js'` — that module reads
//      `import.meta.env.VITE_*`, a Vite-only global that is undefined in Node and
//      throws at import time.
// A single loader hook fixes both WITHOUT editing any source file: it adds the
// json attribute for .json imports, and substitutes a tiny stub for supabase.js
// (the same null/false mock-fallback the browser uses when env vars are absent).
const loaderHook = `
export async function load(url, context, next) {
  if (url.endsWith('/lib/supabase.js')) {
    return { format: 'module', shortCircuit: true,
      source: 'export const supabase = null; export const hasSupabase = false;' }
  }
  if (url.endsWith('.json')) context = { ...context, importAttributes: { type: 'json' } }
  return next(url, context)
}`
register('data:text/javascript,' + encodeURIComponent(loaderHook), import.meta.url)

const { VENUES, USERS, PLANS, MATCHES } = await import('../src/data/mockData.js')

// The 6 hand-authored hero matches aren't exported on their own — they're the
// MATCHES entries carrying editorial copy. Filter them back out.
const EDITORIAL = MATCHES.filter((m) => m.commentary || m.fun_fact)

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  // --- venues (reliable) ----------------------------------------------------
  const venueRows = VENUES.map((v) => ({
    id: v.id,
    name: v.name,
    area: v.area,
    emoji: v.emoji,
    vibe_tags: v.vibe_tags ?? [],
    capacity: v.capacity ?? null,
    big_screen: v.big_screen ?? false,
  }))
  {
    const { error } = await sb.from('venues').upsert(venueRows, { onConflict: 'id' })
    if (error) throw new Error(`venues upsert: ${error.message}`)
    process.stderr.write(`venues: upserted ${venueRows.length}\n`)
  }

  // --- matches editorial overlay (reliable) ---------------------------------
  // Patch the editorial columns onto rows that fetch-fixtures already created.
  // Prefer matching by id (the editorial m_0x ids); fall back to team pair if the
  // worker keyed the row differently (e.g. wc_######).
  const { data: existing, error: readErr } = await sb
    .from('matches')
    .select('id, team_a, team_b')
  if (readErr) throw new Error(`read matches: ${readErr.message}`)

  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '')
  const pair = (a, b) => [norm(a), norm(b)].sort().join('-')
  const byId = new Map((existing || []).map((r) => [r.id, r]))
  const byPair = new Map((existing || []).map((r) => [pair(r.team_a, r.team_b), r]))

  let overlaid = 0, missed = 0
  for (const m of EDITORIAL) {
    const row = byId.get(m.id) || byPair.get(pair(m.team_a, m.team_b))
    if (!row) {
      missed++
      process.stderr.write(`  · no matches row for ${m.id} (${m.team_a} v ${m.team_b}) — run fetch-fixtures --target supabase first\n`)
      continue
    }
    const patch = {
      commentary: m.commentary ?? null,
      fun_fact: m.fun_fact ?? null,
      h2h: m.h2h ?? null,
      featured: !!m.featured,
      marquee: !!m.marquee,
    }
    if (m.archive) patch.archive = m.archive // don't clobber a worker-found photo with null
    const { error } = await sb.from('matches').update(patch).eq('id', row.id)
    if (error) { process.stderr.write(`  ! overlay ${row.id}: ${error.message}\n`); continue }
    overlaid++
  }
  process.stderr.write(`matches: editorial overlay on ${overlaid}/${EDITORIAL.length} (${missed} missing rows)\n`)

  // --- profiles (best-effort — FK on auth.users) ----------------------------
  // See the header note: these will FK-violate when profiles.id → auth.users is
  // enforced. We attempt the upsert and, on failure, log and continue so the
  // reliable seed above still lands.
  try {
    const profileRows = USERS.map((u) => ({
      id: u.id, name: u.name, flag: u.flag, color: u.color,
    }))
    const { error } = await sb.from('profiles').upsert(profileRows, { onConflict: 'id' })
    if (error) throw error
    process.stderr.write(`profiles: upserted ${profileRows.length}\n`)
  } catch (e) {
    process.stderr.write(
      `profiles: SKIPPED (${e.message}). Mock users can't satisfy the profiles→auth.users FK; ` +
      `real profiles come from Supabase Auth. Editorial demo content is already seeded above.\n`
    )
  }

  // --- plans + participants (best-effort — depend on profiles) --------------
  // Plans reference host_id/user_id → profiles, so if profiles were skipped these
  // will fail too. Attempt anyway and report clearly.
  try {
    const planRows = PLANS.map((p) => ({
      id: p.id, match_id: p.match_id, venue_id: p.venue_id, host_id: p.host_id,
      time: p.time, vibe: p.vibe, note: p.note, capacity_hint: p.capacity_hint ?? null,
    }))
    const { error: planErr } = await sb.from('plans').upsert(planRows, { onConflict: 'id' })
    if (planErr) throw planErr

    const partRows = PLANS.flatMap((p) =>
      (p.participant_ids || []).map((uid) => ({ plan_id: p.id, user_id: uid }))
    )
    const { error: partErr } = await sb
      .from('plan_participants')
      .upsert(partRows, { onConflict: 'plan_id,user_id' })
    if (partErr) throw partErr
    process.stderr.write(`plans: upserted ${planRows.length} (+${partRows.length} participants)\n`)
  } catch (e) {
    process.stderr.write(
      `plans: SKIPPED (${e.message}). Plans depend on mock profiles (host_id/user_id → profiles); ` +
      `seed real plans after users exist via Supabase Auth.\n`
    )
  }

  process.stderr.write('\nSeed complete (venues + editorial reliable; profiles/plans best-effort).\n')
}

main().catch((e) => { console.error(e.message); process.exit(1) })

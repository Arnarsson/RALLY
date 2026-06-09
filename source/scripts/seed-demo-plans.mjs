#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — demo social seed (real auth users + profiles + plans).
//
// Creates a handful of real Supabase Auth users so plans satisfy the
// profiles -> auth.users FK, then seeds a few watch-plans against real match
// rows (matched by team pair) so "Busiest tonight" + going-counts render live.
// Idempotent: users looked up by email, plans/profiles upserted by fixed id.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-demo-plans.mjs
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !KEY) { console.error('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const sb = createClient(SB_URL, KEY, { auth: { persistSession: false } })

// demo crew (mirrors mockData USERS, minus "You")
const PEOPLE = [
  { key: 'sofie',   name: 'Sofie',   flag: '🇩🇰', color: '#FF3E9A' },
  { key: 'mathias', name: 'Mathias', flag: '🇩🇰', color: '#2A5BFF' },
  { key: 'lucas',   name: 'Lucas',   flag: '🇧🇷', color: '#FF5A1F' },
  { key: 'diego',   name: 'Diego',   flag: '🇦🇷', color: '#2A5BFF' },
  { key: 'freja',   name: 'Freja',   flag: '🇩🇰', color: '#FF3E9A' },
  { key: 'nadia',   name: 'Nadia',   flag: '🇲🇦', color: '#FF5A1F' },
  { key: 'oliver',  name: 'Oliver',  flag: '🏴', color: '#2A5BFF' },
  { key: 'ingrid',  name: 'Ingrid',  flag: '🇳🇴', color: '#8ACE00' },
]

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '')
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('-')

// Look up (or create) a confirmed auth user, return its uid.
async function getOrCreateUser(p) {
  const email = `${p.key}@demo.rally.futbol`
  // page through existing users (small project, one page is plenty)
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = list?.users?.find((u) => u.email === email)
  if (found) return found.id
  const { data, error } = await sb.auth.admin.createUser({
    email, password: 'demo-' + p.key + '-rally', email_confirm: true,
    user_metadata: { name: p.name, flag: p.flag, demo: true },
  })
  if (error) { console.error(`  user ${p.key}: ${error.message}`); return null }
  return data.user.id
}

const ids = {}
for (const p of PEOPLE) ids[p.key] = await getOrCreateUser(p)
console.error(`users ready: ${Object.values(ids).filter(Boolean).length}/${PEOPLE.length}`)

// profiles (id = auth uid)
const profiles = PEOPLE.filter((p) => ids[p.key]).map((p) => ({
  id: ids[p.key], name: p.name, flag: p.flag, color: p.color,
}))
{
  const { error } = await sb.from('profiles').upsert(profiles, { onConflict: 'id' })
  console.error(error ? `profiles: ${error.message}` : `profiles: upserted ${profiles.length}`)
}

// resolve real match ids by team pair
const { data: matches } = await sb.from('matches').select('id, team_a, team_b')
const byPair = {}
for (const m of matches || []) byPair[pairKey(m.team_a, m.team_b)] = m.id
const mexRsa = byPair[pairKey('Mexico', 'South Africa')]
const braMar = byPair[pairKey('Brazil', 'Morocco')]

// demo plans (fixed uuids → idempotent). venue ids come from the venues seed.
const PLANS = [
  { id: '11111111-1111-4111-8111-111111111111', match_id: mexRsa, venue_id: 'v_08', host: 'sofie',
    time: '20:00', vibe: 'party', note: 'Opening night on the big square. Look for the green RALLY flag.',
    going: ['sofie', 'mathias', 'freja', 'ingrid', 'oliver', 'diego', 'nadia'] },
  { id: '22222222-2222-4222-8222-222222222222', match_id: mexRsa, venue_id: 'v_01', host: 'mathias',
    time: '20:15', vibe: 'hardcore', note: 'Loud crowd, singing section. Pre-drinks from 19:00.',
    going: ['mathias', 'oliver', 'freja'] },
  { id: '33333333-3333-4333-8333-333333333333', match_id: braMar, venue_id: 'v_02', host: 'lucas',
    time: '23:00', vibe: 'expat', note: 'Brazilians & friends at Reffen. Samba + street food before kickoff.',
    going: ['lucas', 'diego', 'nadia', 'sofie', 'ingrid'] },
].filter((p) => p.match_id && ids[p.host])

for (const p of PLANS) {
  const { error: pe } = await sb.from('plans').upsert({
    id: p.id, match_id: p.match_id, venue_id: p.venue_id, host_id: ids[p.host],
    time: p.time, vibe: p.vibe, note: p.note, capacity_hint: 60,
  }, { onConflict: 'id' })
  if (pe) { console.error(`plan ${p.id}: ${pe.message}`); continue }
  const parts = p.going.filter((k) => ids[k]).map((k) => ({ plan_id: p.id, user_id: ids[k] }))
  const { error: ppe } = await sb.from('plan_participants').upsert(parts, { onConflict: 'plan_id,user_id' })
  console.error(ppe ? `  participants: ${ppe.message}` : `plan ${p.id}: ${parts.length} going`)
}
console.error('✓ demo social seed complete')

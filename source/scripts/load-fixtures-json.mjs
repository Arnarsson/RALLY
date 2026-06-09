#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — seed `matches` from the committed fixtures.json snapshot.
//
// Lets us populate Supabase with the 72 real fixtures WITHOUT a live
// football-data.org token (handy for first boot / offline). Once
// FOOTBALL_DATA_TOKEN is set, `fetch-fixtures.mjs --target=supabase` becomes
// the daily refresh — this is just the cold-start loader. Idempotent upsert.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/load-fixtures-json.mjs
// ---------------------------------------------------------------------------
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !KEY) { console.error('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const data = JSON.parse(await readFile(new URL('../src/data/fixtures.json', import.meta.url)))
const rows = data.fixtures.map((f) => ({
  id: f.id, espn_id: f.espn_id ?? null,
  team_a: f.team_a, flag_a: f.flag_a, color_a: f.color_a ?? null, form_a: f.form_a ?? null,
  team_b: f.team_b, flag_b: f.flag_b, color_b: f.color_b ?? null, form_b: f.form_b ?? null,
  kickoff_utc: f.kickoff_utc, kickoff_local: f.kickoff, day: f.day, stage: f.stage, venue: f.venue ?? null,
  tv: f.tv ?? [], status: f.status ?? 'pre', status_detail: f.status_detail ?? null,
  clock: f.clock ?? null, completed: f.completed ?? false,
  score_a: f.score_a ?? null, score_b: f.score_b ?? null,
  archive: f.archive ?? null,
}))

const sb = createClient(SB_URL, KEY, { auth: { persistSession: false } })
const { error } = await sb.from('matches').upsert(rows, { onConflict: 'id' })
if (error) { console.error('upsert failed:', error.message); process.exit(1) }
console.error(`✓ upserted ${rows.length} matches`)

#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — seed `team_records` (all-time World Cup record per nation).
//
// Source: Wikipedia "FIFA World Cup records and statistics" → "Overall team
// records" table (public REST/action API, no auth). The all-time W/D/L/GF/GA
// is curated/editorial data — no clean sports API exposes it — so we parse it
// once from Wikipedia and upsert. Re-run after a tournament to refresh.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-team-records.mjs
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SB_URL || !KEY) { console.error('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const UA = 'rally-records/1.0 (https://rally.futbol)'

// FIFA 3-letter code → our team_key (normalised team name used by matches/squads).
const CODE2KEY = { ALG:'algeria', ARG:'argentina', AUS:'australia', AUT:'austria', BEL:'belgium', BIH:'bosniaherz', BRA:'brazil', CAN:'canada', CPV:'capeverde', COL:'colombia', COD:'congodr', CRO:'croatia', CUW:'curaao', CZE:'czechia', ECU:'ecuador', EGY:'egypt', ENG:'england', FRA:'france', GER:'germany', GHA:'ghana', HAI:'haiti', IRN:'iran', IRQ:'iraq', CIV:'ivorycoast', JPN:'japan', JOR:'jordan', MEX:'mexico', MAR:'morocco', NED:'netherlands', NZL:'newzealand', NOR:'norway', PAN:'panama', PAR:'paraguay', POR:'portugal', QAT:'qatar', KSA:'saudiarabia', SCO:'scotland', SEN:'senegal', RSA:'southafrica', KOR:'southkorea', ESP:'spain', SWE:'sweden', SUI:'switzerland', TUR:'trkiye', TUN:'tunisia', URU:'uruguay', USA:'usa', UZB:'uzbekistan' }
const TEAM = { algeria:'Algeria', argentina:'Argentina', australia:'Australia', austria:'Austria', belgium:'Belgium', bosniaherz:'Bosnia-Herzegovina', brazil:'Brazil', canada:'Canada', capeverde:'Cape Verde', colombia:'Colombia', congodr:'Congo DR', croatia:'Croatia', curaao:'Curaçao', czechia:'Czechia', ecuador:'Ecuador', egypt:'Egypt', england:'England', france:'France', germany:'Germany', ghana:'Ghana', haiti:'Haiti', iran:'Iran', iraq:'Iraq', ivorycoast:'Ivory Coast', japan:'Japan', jordan:'Jordan', mexico:'Mexico', morocco:'Morocco', netherlands:'Netherlands', newzealand:'New Zealand', norway:'Norway', panama:'Panama', paraguay:'Paraguay', portugal:'Portugal', qatar:'Qatar', saudiarabia:'Saudi Arabia', scotland:'Scotland', senegal:'Senegal', southafrica:'South Africa', southkorea:'South Korea', spain:'Spain', sweden:'Sweden', switzerland:'Switzerland', trkiye:'Türkiye', tunisia:'Tunisia', uruguay:'Uruguay', usa:'United States', uzbekistan:'Uzbekistan' }

const api = 'https://en.wikipedia.org/w/api.php?action=parse&page=FIFA%20World%20Cup%20records%20and%20statistics&prop=wikitext&section=3&format=json'
const res = await fetch(api, { headers: { 'User-Agent': UA } })
const wt = (await res.json()).parse.wikitext['*']
const tbl = wt.slice(wt.indexOf('{|'), wt.indexOf('\n|}', wt.indexOf('{|'))) // first table only

const rows = []
const seen = new Set()
for (const block of tbl.split('|-')) {
  const m = block.match(/\{\{fb\|([A-Z]{3})(?:\|[^}]*)?\}\}/) // allow {{fb|SUI|}}
  const key = m && CODE2KEY[m[1]]
  if (!key || seen.has(key)) continue
  const data = block.split('\n').map((l) => l.trim())
    .find((s) => s.startsWith('|') && (s.match(/\|\|/g) || []).length >= 6 && /\d/.test(s))
  if (!data) continue
  const n = data.match(/\d+/g) // part, pld, w, d, l, gf, ga, gd, pts
  if (!n || n.length < 7) continue
  seen.add(key)
  rows.push({ team_key: key, team: TEAM[key], played: +n[1], wins: +n[2], draws: +n[3], losses: +n[4], gf: +n[5], ga: +n[6] })
}

const sb = createClient(SB_URL, KEY, { auth: { persistSession: false } })
const { error } = await sb.from('team_records').upsert(rows, { onConflict: 'team_key' })
if (error) { console.error('upsert failed:', error.message); process.exit(1) }
console.error(`✓ seeded ${rows.length} team records (e.g. Germany P112 W68)`)

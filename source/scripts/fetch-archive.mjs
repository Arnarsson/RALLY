#!/usr/bin/env node
// ---------------------------------------------------------------------------
// RALLY — archival photo finder (Wikimedia Commons)
//
// For each fixture, search Wikimedia Commons for a photo of the two teams and
// keep the best COMMERCIALLY-USABLE one (CC BY / CC BY-SA / CC0 / public
// domain — never NC or ND, since RALLY is a commercial product). The app then
// renders it in B&W behind the match, with the required attribution.
//
// This is the scalable version of the hand-placed opener photo: history on
// every card that has a Commons image, colour-block art everywhere else.
//
// Usage:
//   node scripts/fetch-archive.mjs              # all fixtures
//   node scripts/fetch-archive.mjs --limit 20   # first N
//   npm run archive
// ---------------------------------------------------------------------------

import { readFile, writeFile } from 'node:fs/promises'

const FIXTURES = new URL('../src/data/fixtures.json', import.meta.url)
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'rally-archive/1.0 (https://rally.app; dev@rally.app)'

// Search aliases where the ESPN name isn't how Commons files are titled.
const ALIAS = {
  'USA': 'United States', 'Bosnia-Herz': 'Bosnia and Herzegovina', 'Türkiye': 'Turkey',
  'Congo DR': 'DR Congo', 'Czechia': 'Czech Republic', 'Curaçao': 'Curacao',
  'South Korea': 'South Korea', 'Cape Verde': 'Cape Verde', 'Ivory Coast': 'Ivory Coast',
}
const term = (t) => ALIAS[t] || t

// Commercial-OK only. Reject NonCommercial / NoDerivs and anything unclear.
function commercialOK(licShort, licUrl) {
  const s = (licShort || '').toLowerCase()
  if (/\bnc\b|noncommercial|no deriv|\bnd\b/.test(s)) return false
  if (/cc0|public domain|^pd|cc by(?!-nc| nc)/.test(s)) return true
  if (/creativecommons\.org\/licenses\/by(-sa)?\//.test(licUrl || '')) return true
  if (/creativecommons\.org\/publicdomain\//.test(licUrl || '')) return true
  return false
}

const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

async function searchCommons(a, b) {
  const q = `${term(a)} ${term(b)} football`
  const url = `${API}?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}` +
    `&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=1000&format=json`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = await r.json()
  const pages = Object.values(j.query?.pages || {})
  const wantA = term(a).toLowerCase(), wantB = term(b).toLowerCase()
  let best = null, bestScore = 0
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii) continue
    if (!/image\/(jpeg|png)/.test(ii.mime || '')) continue
    const em = ii.extmetadata || {}
    if (!commercialOK(em.LicenseShortName?.value, em.LicenseUrl?.value)) continue
    const hay = (p.title + ' ' + strip(em.ImageDescription?.value) + ' ' + strip(em.Categories?.value)).toLowerCase()
    let score = 0
    if (hay.includes(wantA)) score += 2
    if (hay.includes(wantB)) score += 2
    if (/world cup|fifa/.test(hay)) score += 1
    if (score < 4) continue // require BOTH teams present — keeps it on-topic
    if (score > bestScore) {
      bestScore = score
      best = {
        src: ii.thumburl || ii.url,
        credit: (strip(em.Artist?.value) || 'Wikimedia Commons') + ' · ' + (em.LicenseShortName?.value || 'CC'),
        license: em.LicenseShortName?.value || 'CC',
        source: ii.descriptionurl,
      }
    }
  }
  return best
}

async function main() {
  const limit = process.argv.includes('--limit') ? Number(process.argv[process.argv.indexOf('--limit') + 1]) : Infinity
  const data = JSON.parse(await readFile(FIXTURES, 'utf8'))
  let hit = 0, n = 0
  for (const f of data.fixtures) {
    if (n++ >= limit) break
    if (f.archive) { hit++; continue }
    try {
      const img = await searchCommons(f.team_a, f.team_b)
      if (img) { f.archive = img; hit++; process.stderr.write(`  ✓ ${f.team_a} v ${f.team_b}  ${img.license}\n`) }
      else process.stderr.write(`  · ${f.team_a} v ${f.team_b}  (colour-art fallback)\n`)
    } catch (e) { process.stderr.write(`  ! ${f.team_a} v ${f.team_b}  ${e.message}\n`) }
    await new Promise((r) => setTimeout(r, 140))
  }
  data.archive_meta = { matched: hit, scanned: Math.min(n, data.fixtures.length), source: 'Wikimedia Commons', updated_at: new Date().toISOString() }
  await writeFile(FIXTURES, JSON.stringify(data, null, 2))
  process.stderr.write(`\nArchive photos for ${hit}/${Math.min(n, data.fixtures.length)} fixtures (commercial-OK only).\n`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })

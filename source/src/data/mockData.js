// ---------------------------------------------------------------------------
// MOCK DATA
// Shape mirrors the planned Supabase schema (users, venues, matches, plans,
// plan_participants). When you wire Supabase, swap these arrays for queries —
// the field names already match, so the UI shouldn't need to change.
//
// Fixtures: REAL 2026 FIFA World Cup opening-round games (11–14 June 2026),
// kickoff times converted to Copenhagen time (CEST = US Eastern + 6h).
// Denmark did NOT qualify for 2026 — so there's no "home team" game; the demo
// is built around the opener + big expat draws (Brazil etc.).
// TV channels per match are illustrative: in DK all 104 games air across
// DR1/DR2 (free) and TV2 / TV2 Sport / TV2 Sport X (subscription).
// ---------------------------------------------------------------------------

import LIVE_DATA from './fixtures.json'

// Real 2026 World Cup fixtures pulled from ESPN's hidden API.
// See scripts/fetch-fixtures.mjs. In production this table is kept fresh by a
// backend cron / the espn-pp-mcp server; the app just reads it.
export const LIVE_FIXTURES = LIVE_DATA.fixtures
export const FIXTURES_SOURCE = LIVE_DATA.source
const _norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '')
const _key = (a, b) => [_norm(a), _norm(b)].sort().join('-')
const _liveByKey = {}
for (const f of LIVE_FIXTURES) _liveByKey[_key(f.team_a, f.team_b)] = f

export const VIBES = {
  student:  { label: 'Student',   emoji: '🎓', color: '#2A5BFF' },
  party:    { label: 'Party',     emoji: '🎉', color: '#FF3E9A' },
  chill:    { label: 'Chill',     emoji: '🛋️', color: '#8ACE00' },
  expat:    { label: 'Expat',     emoji: '🌍', color: '#7B3FF2' },
  hardcore: { label: 'Hardcore',  emoji: '🔥', color: '#FF5A1F' },
  family:   { label: 'Family',    emoji: '👨‍👩‍👧', color: '#0F0F0F' },
}

// Flags offered in profile setup
export const FLAGS = ['🇩🇰', '🇧🇷', '🇦🇷', '🇪🇸', '🇫🇷', '🏴', '🇲🇦', '🇵🇱', '🇳🇴', '🇲🇽', '🇺🇸', '🇯🇵', '🇭🇷', '🇨🇭', '🇰🇷']

// users -----------------------------------------------------------------------
export const USERS = [
  { id: 'u_me',  name: 'You',        flag: '🇩🇰', color: '#8ACE00' },
  { id: 'u_001', name: 'Sofie',      flag: '🇩🇰', color: '#FF3E9A' },
  { id: 'u_002', name: 'Mathias',    flag: '🇩🇰', color: '#2A5BFF' },
  { id: 'u_003', name: 'Lucas',      flag: '🇧🇷', color: '#FF5A1F' },
  { id: 'u_004', name: 'Emma',       flag: '🇩🇰', color: '#7B3FF2' },
  { id: 'u_005', name: 'Diego',      flag: '🇦🇷', color: '#2A5BFF' },
  { id: 'u_006', name: 'Freja',      flag: '🇩🇰', color: '#FF3E9A' },
  { id: 'u_007', name: 'Tomek',      flag: '🇵🇱', color: '#7B3FF2' },
  { id: 'u_008', name: 'Nadia',      flag: '🇲🇦', color: '#FF5A1F' },
  { id: 'u_009', name: 'Oliver',     flag: '🏴', color: '#2A5BFF' },
  { id: 'u_010', name: 'Ingrid',     flag: '🇳🇴', color: '#8ACE00' },
  { id: 'u_011', name: 'Carlos',     flag: '🇪🇸', color: '#FF3E9A' },
  { id: 'u_012', name: 'Yuki',       flag: '🇯🇵', color: '#7B3FF2' },
]

export const ME = USERS[0]

export const userById = (id) => USERS.find((u) => u.id === id)

// venues ----------------------------------------------------------------------
export const VENUES = [
  { id: 'v_01', name: 'Charlie Scott’s',          area: 'Indre By',    vibe_tags: ['party', 'hardcore'], capacity: 220, big_screen: true,  emoji: '🍺' },
  { id: 'v_02', name: 'Reffen',                    area: 'Refshaleøen', vibe_tags: ['expat', 'chill'],    capacity: 900, big_screen: true,  emoji: '🌭' },
  { id: 'v_03', name: 'KU Big Screen — CSS',       area: 'Nørrebro',    vibe_tags: ['student'],           capacity: 500, big_screen: true,  emoji: '🎓' },
  { id: 'v_04', name: 'The Globe Irish Pub',       area: 'Indre By',    vibe_tags: ['hardcore', 'expat'], capacity: 160, big_screen: true,  emoji: '☘️' },
  { id: 'v_05', name: 'Ørsted Ølbar',              area: 'Vesterbro',   vibe_tags: ['chill'],             capacity: 70,  big_screen: false, emoji: '🛋️' },
  { id: 'v_06', name: 'Bjørg’s Café',              area: 'Indre By',    vibe_tags: ['chill', 'family'],   capacity: 90,  big_screen: true,  emoji: '☕' },
  { id: 'v_07', name: 'Nørrebro Bryghus',          area: 'Nørrebro',    vibe_tags: ['chill', 'student'],  capacity: 140, big_screen: true,  emoji: '🍻' },
  { id: 'v_08', name: 'Fan Zone — Rådhuspladsen',  area: 'Indre By',    vibe_tags: ['party', 'family', 'hardcore'], capacity: 4000, big_screen: true, emoji: '🏟️' },
  { id: 'v_09', name: 'Mikkeller Viktoriagade',    area: 'Vesterbro',   vibe_tags: ['chill', 'expat'],    capacity: 60,  big_screen: false, emoji: '🍺' },
  { id: 'v_10', name: 'Studenterhuset',            area: 'Indre By',    vibe_tags: ['student', 'party'],  capacity: 300, big_screen: true,  emoji: '🎓' },
]

export const venueById = (id) => VENUES.find((v) => v.id === id)

// ---------------------------------------------------------------------------
// OUTFITS — "Style for the game". Shaped like a product feed so it can be
// swapped for a live Miinto catalogue (image, brand, price, url) with no UI change.
// Imagery here is placeholder (see photo() in App.jsx); real shots come from
// the brand / Miinto.
// ---------------------------------------------------------------------------
export const OUTFITS = {
  partner: 'Miinto',
  looks: [
    { id: 'l1', title: 'The Terrace', who: 'Unisex', price: 'fr. 899 kr', seed: 'rally-look-terrace' },
    { id: 'l2', title: 'Blokecore',   who: 'Unisex', price: 'fr. 1.299 kr', seed: 'rally-look-bloke' },
    { id: 'l3', title: 'Game Night',  who: 'Women',  price: 'fr. 749 kr',  seed: 'rally-look-night' },
    { id: 'l4', title: 'Clean Casual',who: 'Men',    price: 'fr. 1.099 kr', seed: 'rally-look-clean' },
  ],
  essentials: [
    { id: 'e1', name: 'Retro jersey',  price: '699 kr',   emoji: '👕', seed: 'rally-ess-jersey' },
    { id: 'e2', name: 'Cap',           price: '249 kr',   emoji: '🧢', seed: 'rally-ess-cap' },
    { id: 'e3', name: 'Scarf',         price: '199 kr',   emoji: '🧣', seed: 'rally-ess-scarf' },
    { id: 'e4', name: 'Trainers',      price: '1.199 kr', emoji: '👟', seed: 'rally-ess-shoe' },
    { id: 'e5', name: 'Crossbody bag', price: '449 kr',   emoji: '👜', seed: 'rally-ess-bag' },
    { id: 'e6', name: 'Track jacket',  price: '899 kr',   emoji: '🧥', seed: 'rally-ess-jacket' },
  ],
}

// matches ---------------------------------------------------------------------
// Hand-authored editorial cards (commentary + fun facts + plans live on these).
// They get enriched with live ESPN data below; the rest of the real schedule
// is appended automatically.
const EDITORIAL = [
  {
    id: 'm_01', team_a: 'Mexico', flag_a: '🇲🇽', team_b: 'South Africa', flag_b: '🇿🇦',
    kickoff: '2026-06-11T21:00', stage: 'Group A · Opening match', day: 'OPENING NIGHT · THU 11 JUN', featured: true,
    tv: [{ name: 'TV 2', free: false }],
    h2h: { last: '2010 World Cup', score: '1–1', note: 'the opening match in Johannesburg' },
    // Illustrative until the penaltyblog worker fills real model output.
    prob_a: 0.46, prob_draw: 0.28, prob_b: 0.26, prob_source: 'illustrative',
    // Real archive photo of THAT match (Wikimedia Commons, CC BY 2.0).
    archive: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/First_game_of_the_2010_FIFA_World_Cup%2C_South_Africa_vs_Mexico.jpg/960px-First_game_of_the_2010_FIFA_World_Cup%2C_South_Africa_vs_Mexico.jpg',
      credit: 'Shine 2010 · CC BY 2.0',
    },
    fun_fact: 'Estadio Azteca is the only stadium ever to host two World Cup finals (1970 & 1986) — and now it opens 2026. South Africa were the first African nation to host a World Cup, back in 2010.',
    commentary: "Ohhh here we go, opening night, baby! Mexico — seventeen World Cups deep and STILL bashing their head on that quarter-final ceiling, ha! But nobody, and I mean nobody, parties like El Tri. Their keeper Memo Ochoa turns into Spider-Man every single tournament. And South Africa — first African nation to ever host the whole show, 2010, vuvuzelas, Shakira, the lot! Two teams, zero titles, a hundred percent vibes. Skål!",
  },
  {
    id: 'm_05', team_a: 'South Korea', flag_a: '🇰🇷', team_b: 'Czechia', flag_b: '🇨🇿',
    kickoff: '2026-06-12T04:00', stage: 'Group F', day: 'OPENING NIGHT · THU 11 JUN',
    tv: [{ name: 'TV 2 Sport X', free: false }],
    fun_fact: 'A proper night-owl kickoff. The “Mexican wave” went global at Mexico ’86 — South Korea co-hosted in 2002 and stunned everyone by reaching the semi-finals.',
    commentary: "Four in the morning Copenhagen time? You absolute legend for being awake. South Korea — the 2002 fairytale! Co-hosts who marched all the way to the semis and broke Italian and Spanish hearts, hahaha, they STILL talk about it. Son Heung-min now, pure lightning in boots. Czechia — back in the Czechoslovakia days they reached two World Cup finals, so close yet so far. And Patrik Schick once scored from the halfway line, genuinely! Grab a coffee — this one's for the diehards.",
  },
  {
    id: 'm_02', team_a: 'Canada', flag_a: '🇨🇦', team_b: 'Bosnia & Herz.', flag_b: '🇧🇦',
    kickoff: '2026-06-12T21:00', stage: 'Group B', day: 'FRI 12 JUN',
    tv: [{ name: 'DR1', free: true }],
    fun_fact: 'This is the first 48-team World Cup — 104 matches in all. Canada are co-hosts and playing their first ever home World Cup.',
    commentary: "Canada! Co-hosts, and let's be honest, for the longest time their World Cup story was one trip in 1986 and a WHOLE lot of ice hockey, ha! But now? Alphonso Davies, the man has actual rockets strapped to his legs. Bosnia and Herzegovina — one World Cup, 2014, led by Edin Džeko, a proper old-school number nine who simply refuses to retire. Neither's ever lifted the trophy, but both turn up swinging. Lovely stuff.",
  },
  {
    id: 'm_06', team_a: 'USA', flag_a: '🇺🇸', team_b: 'Paraguay', flag_b: '🇵🇾',
    kickoff: '2026-06-13T03:00', stage: 'Group D', day: 'FRI 12 JUN',
    tv: [{ name: 'TV 2 Sport X', free: false }],
    fun_fact: 'USA, Canada and Mexico are co-hosting — the first three-country World Cup. The 1994 USA edition still holds the record for highest average attendance.',
    commentary: "Team USA! Hosts back in '94, when they sold out every stadium and the world finally went, oh — they DO like soccer! Christian Pulisic carries the badge now. Paraguay — World Cup regulars, quarter-finalists in 2010, and home to football's wildest goalkeeper ever, Chilavert, who used to score free kicks AND penalties, hahaha, a keeper with a striker's ego! Three a.m. kickoff, so this one is purely for the obsessed. Respect.",
  },
  {
    id: 'm_03', team_a: 'Qatar', flag_a: '🇶🇦', team_b: 'Switzerland', flag_b: '🇨🇭',
    kickoff: '2026-06-13T21:00', stage: 'Group E', day: 'SAT 13 JUN',
    tv: [{ name: 'DR1', free: true }],
    fun_fact: 'The trophy is 18-carat solid gold and weighs about 6.1 kg. Switzerland is where it all gets organised — FIFA’s HQ sits in Zürich.',
    commentary: "Qatar — threw the most expensive World Cup in history in 2022, and then, awkwardly, became the first hosts to lose all three group games, ooof, ha! Akram Afif is the local hero though. Switzerland — punching way above a country famous for chocolate, watches, and being suspiciously neutral. Granit Xhaka, all elbows and leadership. And fun fact: FIFA itself lives in Zürich, so technically this is a home game for the paperwork. Cheers!",
  },
  {
    id: 'm_04', team_a: 'Brazil', flag_a: '🇧🇷', team_b: 'Morocco', flag_b: '🇲🇦',
    kickoff: '2026-06-14T00:00', stage: 'Group G', day: 'SAT 13 JUN', marquee: true,
    tv: [{ name: 'TV 2 Sport X', free: false }],
    fun_fact: 'Brazil are the only nation to appear at every World Cup since 1930. Morocco made history in 2022 as the first African and Arab team to reach a World Cup semi-final.',
    commentary: "NOW we're talking! Brazil — FIVE World Cups, the only nation on earth to show up to every single one since 1930, the gold standard, samba in their boots. From Pelé to Ronaldo to the new kids, they just keep printing magicians. And Morocco?! 2022 — the first African AND first Arab team to ever reach a semi-final, the whole continent lost its mind, hahaha, what a story! Hakimi flying down that wing. Midnight kickoff, worth every yawn. Let's go!",
  },
]

// Merge editorial + live. Editorial cards win (keep id, commentary, plans) and
// pick up live status/score/form/venue; every other real fixture is appended.
function _enrich(m) {
  const f = _liveByKey[_key(m.team_a, m.team_b)]
  if (!f) return { ...m, status: 'pre' }
  return {
    ...m,
    status: f.status, status_detail: f.status_detail, clock: f.clock,
    completed: f.completed, score_a: f.score_a, score_b: f.score_b,
    form_a: f.form_a, form_b: f.form_b, venue: f.venue,
    color_a: f.color_a, color_b: f.color_b,
    archive: m.archive || f.archive,
    kickoff_utc: f.kickoff_utc, espn_id: f.espn_id, day: f.day || m.day,
  }
}
const _usedKeys = new Set(EDITORIAL.map((m) => _key(m.team_a, m.team_b)))
const _extra = LIVE_FIXTURES
  .filter((f) => !_usedKeys.has(_key(f.team_a, f.team_b)))
  .map((f) => ({
    id: f.id, team_a: f.team_a, flag_a: f.flag_a, team_b: f.team_b, flag_b: f.flag_b,
    kickoff: f.kickoff, day: f.day, stage: f.stage, tv: f.tv,
    status: f.status, status_detail: f.status_detail, clock: f.clock,
    completed: f.completed, score_a: f.score_a, score_b: f.score_b,
    form_a: f.form_a, form_b: f.form_b, venue: f.venue,
    color_a: f.color_a, color_b: f.color_b, archive: f.archive,
    kickoff_utc: f.kickoff_utc, espn_id: f.espn_id,
  }))

export const MATCHES = [...EDITORIAL.map(_enrich), ..._extra]
  .sort((a, b) => a.kickoff.localeCompare(b.kickoff))

export const matchById = (id) => MATCHES.find((m) => m.id === id)

// plans -----------------------------------------------------------------------
// A plan = a structured intention to watch a match at a venue.
export const PLANS = [
  // --- Opening night: Mexico v South Africa (biggest night) ---
  {
    id: 'p_01', match_id: 'm_01', venue_id: 'v_08', host_id: 'u_001',
    time: '20:00', vibe: 'party',
    note: 'Opening night on the big square. Meeting by the south entrance — look for the green RALLY flag. Bring everyone.',
    participant_ids: ['u_001', 'u_002', 'u_004', 'u_006', 'u_010', 'u_007', 'u_005'],
    capacity_hint: 200,
  },
  {
    id: 'p_02', match_id: 'm_01', venue_id: 'v_01', host_id: 'u_002',
    time: '20:15', vibe: 'hardcore',
    note: 'Loud crowd, singing section. Pre-drinks from 19:00 — fills up fast.',
    participant_ids: ['u_002', 'u_009', 'u_011', 'u_006'],
    capacity_hint: 40,
  },
  {
    id: 'p_03', match_id: 'm_01', venue_id: 'v_03', host_id: 'u_004',
    time: '20:30', vibe: 'student',
    note: 'KU students big screen, cheap beer. Bring student ID.',
    participant_ids: ['u_004', 'u_007', 'u_012'],
    capacity_hint: 80,
  },
  {
    id: 'p_04', match_id: 'm_01', venue_id: 'v_05', host_id: 'u_006',
    time: '20:45', vibe: 'chill',
    note: 'Low-key watch, good for first-timers. Small place, ~10 of us.',
    participant_ids: ['u_006', 'u_008'],
    capacity_hint: 12,
  },
  // --- Canada v Bosnia ---
  {
    id: 'p_05', match_id: 'm_02', venue_id: 'v_04', host_id: 'u_009',
    time: '20:15', vibe: 'expat',
    note: 'Internationals corner at The Globe.',
    participant_ids: ['u_009', 'u_010'],
    capacity_hint: 25,
  },
  // --- Brazil v Morocco (midnight, expat marquee) ---
  {
    id: 'p_06', match_id: 'm_04', venue_id: 'v_02', host_id: 'u_003',
    time: '23:00', vibe: 'expat',
    note: 'Brazilians & friends at Reffen. Samba + street food before kickoff, staying up for it.',
    participant_ids: ['u_003', 'u_005', 'u_008', 'u_012'],
    capacity_hint: 60,
  },
  {
    id: 'p_07', match_id: 'm_04', venue_id: 'v_10', host_id: 'u_005',
    time: '23:15', vibe: 'party',
    note: 'Late one. Drums, jerseys, the works.',
    participant_ids: ['u_005', 'u_007'],
    capacity_hint: 50,
  },
  // --- Qatar v Switzerland ---
  {
    id: 'p_08', match_id: 'm_03', venue_id: 'v_09', host_id: 'u_011',
    time: '20:30', vibe: 'chill',
    note: 'Quiet craft-beer watch.',
    participant_ids: ['u_011'],
    capacity_hint: 10,
  },
]

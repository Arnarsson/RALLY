// ---------------------------------------------------------------------------
// RALLIES — the Social Radius model (project HEKLA), demo/seed shape.
//
// RALLY started as football, but the engine underneath is simpler and bigger:
// a rally point for ANYTHING with people. Same religion as SOUL.md — the best
// seat isn't in the stadium, it's in a packed room — just pointed at the whole
// city now. Dinners, away-days, runs, swaps, gigs, a quiet table for the people
// who came alone.
//
// Everything is organised by how far the invite travels — the Social Radius:
//   private    → just your people. Named, trusted, in the group chat already.
//   circle     → friends-of-friends. One hop out. Bring who you bring.
//   community  → a club, a course, a team you belong to. Same badge.
//   local      → your neighbourhood. Anyone within walking distance is welcome.
//   public     → the whole city. Doors open, come as you are.
//
// Pure data, no React. Field names are kept close to the existing PLANS shape
// (host, area, going, cap) so a real `rallies` table can swap in with no UI
// rewrite — same adapter pattern as mockData.js.
// ---------------------------------------------------------------------------

// The five layers, in order of how far the invite reaches. `accent` names a
// brand token so each radius reads as its own colour (rationed — one per layer).
// `hint` is the one-line SOUL-voice explainer; `example` is a concrete "like…".
export const RADII = [
  {
    key: 'private',
    label: 'Private',
    accent: 'cream',
    hint: 'Just your people. No strangers, no spillover.',
    example: 'like Sunday dinner with the flatmates',
  },
  {
    key: 'circle',
    label: 'Extended Circle',
    accent: 'blue',
    hint: 'Friends, and the friends they vouch for. One hop out.',
    example: 'like a birthday where you can bring a +1',
  },
  {
    key: 'community',
    label: 'Community',
    accent: 'purple',
    hint: 'A club, a course, a team. Everyone wearing the same badge.',
    example: 'like your five-a-side or your Danish class',
  },
  {
    key: 'local',
    label: 'Local',
    accent: 'lime',
    hint: 'Your neighbourhood. If you can walk to it, you belong.',
    example: 'like the Nørrebro lot, anyone within a few streets',
  },
  {
    key: 'public',
    label: 'Public',
    accent: 'pink',
    hint: 'The whole city. Doors open, come as you are.',
    example: 'like the square on a big match night',
  },
]

export const radiusByKey = (key) => RADII.find((r) => r.key === key) || null

// Kinds of gathering RALLY now covers. emoji doubles as the card glyph.
export const KINDS = {
  match:    { label: 'Match night', emoji: '⚽' },
  dinner:   { label: 'Dinner',      emoji: '🍝' },
  trip:     { label: 'Away day',    emoji: '🚆' },
  wellness: { label: 'Wellness',    emoji: '🧖' },
  swap:     { label: 'Swap / give', emoji: '♻️' },
  run:      { label: 'Run / sport', emoji: '🏃' },
  gig:      { label: 'Gig / culture', emoji: '🎶' },
  social:   { label: 'Drinks / social', emoji: '🍻' },
  loners:   { label: 'Loners club', emoji: '🫂' },
  civic:    { label: 'Civic / cause', emoji: '🤝' },
}

export const kindMeta = (kind) => KINDS[kind] || { label: kind, emoji: '📍' }

// Access tags — say it on the card so nobody has to ask at the door. Fixed set,
// fixed order. Everyone's welcome at the bar; this is how we mean it.
export const ACCESS_TAGS = [
  { key: 'step-free',      label: 'Step-free',      emoji: '♿' },
  { key: 'hearing-loop',   label: 'Hearing loop',   emoji: '👂' },
  { key: 'quiet-corner',   label: 'Quiet corner',   emoji: '🤫' },
  { key: 'kid-friendly',   label: 'Kid-friendly',   emoji: '🧒' },
  { key: 'sober-friendly', label: 'Sober-friendly', emoji: '🥤' },
]

export const accessMeta = (key) =>
  ACCESS_TAGS.find((t) => t.key === key) || { key, label: key, emoji: '•' }

// At least a dozen rallies, Copenhagen-flavoured, spread across all five radii
// and every kind. Voice per SOUL.md — warm, sharp, a take, never a brand deck.
export const RALLIES = [
  // ---- PRIVATE -----------------------------------------------------------
  {
    id: 'r_01', kind: 'dinner', radius: 'private',
    title: 'Sunday lasagne, the flat',
    blurb: 'Three layers minimum or don’t bother. Bring the red, I’ve got the oven.',
    host: 'Sofie', area: 'Vesterbro', when: 'Sun 18:30',
    going: 5, cap: 6, emoji: '🍝',
    hostStats: { rate: 96, hosted: 23 }, access: [], code: 'RLY-LASAGNE',
  },
  {
    id: 'r_02', kind: 'wellness', radius: 'private',
    title: 'Saturday sauna, just us',
    blurb: 'La Banchina, dawn slot, dip in the harbour after. No phones, no chat — that’s the rule.',
    host: 'Emma', area: 'Christianshavn', when: 'Sat 08:00',
    going: 4, cap: 5, emoji: '🧖',
    hostStats: { rate: 88, hosted: 11 }, access: ['quiet-corner'], code: 'RLY-SAUNA-08',
  },
  // ---- EXTENDED CIRCLE ---------------------------------------------------
  {
    id: 'r_03', kind: 'match', radius: 'circle',
    title: 'Brazil v Morocco, bring a mate',
    blurb: 'Samba on the speaker, midnight kickoff, samba in their boots. Bring one person I’d like.',
    host: 'Lucas', area: 'Refshaleøen', when: 'Sat 23:00',
    going: 9, cap: 14, emoji: '⚽',
    hostStats: { rate: 82, hosted: 7 }, access: [], code: 'RLY-SAMBA-23',
  },
  {
    id: 'r_04', kind: 'gig', radius: 'circle',
    title: 'Loft party + whoever you vouch for',
    blurb: 'Vinyl only, lights low, one rule: if you bring them, you’re responsible for them. Skål.',
    host: 'Mathias', area: 'Nørrebro', when: 'Fri 22:00',
    going: 18, cap: 30, emoji: '🎶',
    hostStats: { rate: 79, hosted: 14 }, access: [], code: 'RLY-LOFT-22',
  },
  {
    id: 'r_05', kind: 'trip', radius: 'circle',
    title: 'Møn cliffs day-trip, +1s welcome',
    blurb: 'Early train, white cliffs, one cold swim that we’ll all regret and remember. Pack a sandwich.',
    host: 'Ingrid', area: 'Hovedbanegården', when: 'Sun 08:15',
    going: 7, cap: 12, emoji: '🚆',
    hostStats: { rate: 91, hosted: 9 }, access: ['kid-friendly'], code: 'RLY-MOEN-08',
  },
  // ---- COMMUNITY ---------------------------------------------------------
  {
    id: 'r_06', kind: 'run', radius: 'community',
    title: 'Tuesday run club — all paces',
    blurb: 'The lakes loop, then coffee. No one gets dropped, that’s the whole point. Back by eight.',
    host: 'Nadia', area: 'Søerne', when: 'Tue 18:30',
    going: 22, cap: null, emoji: '🏃',
    hostStats: { rate: 94, hosted: 38 }, access: ['step-free', 'sober-friendly'], code: 'RLY-RUNCLUB',
  },
  {
    id: 'r_07', kind: 'match', radius: 'community',
    title: 'Five-a-side lot, screen at the bryghus',
    blurb: 'Same shirts off the pitch as on it. We lost 6–1 Sunday — we’ll win the night anyway.',
    host: 'Diego', area: 'Nørrebro', when: 'Wed 20:00',
    going: 11, cap: 16, emoji: '⚽',
    hostStats: { rate: 85, hosted: 19 }, access: [], code: 'RLY-FIVEASIDE',
  },
  {
    id: 'r_08', kind: 'social', radius: 'community',
    title: 'Danish class kickoff drinks',
    blurb: 'Hold 3, you survived the present tense, now order a beer in it. Round one’s on the teacher.',
    host: 'Yuki', area: 'Indre By', when: 'Thu 17:30',
    going: 14, cap: 20, emoji: '🍻',
    hostStats: { rate: 90, hosted: 6 }, access: ['hearing-loop'], code: 'RLY-HOLD3',
  },
  // ---- LOCAL -------------------------------------------------------------
  {
    id: 'r_09', kind: 'swap', radius: 'local',
    title: 'Nørrebro clothes swap',
    blurb: 'Bring what you’ve stopped wearing, leave with someone else’s favourite. Nothing changes hands but a smile.',
    host: 'Freja', area: 'Nørrebro', when: 'Sat 14:00',
    going: 31, cap: null, emoji: '♻️',
    hostStats: { rate: 87, hosted: 12 }, access: ['step-free', 'kid-friendly'], code: 'RLY-SWAP-14',
  },
  {
    id: 'r_10', kind: 'dinner', radius: 'local',
    title: 'Street long-table, Jægersborggade',
    blurb: 'Everyone brings one dish, one chair, one neighbour they’ve never met. The street does the rest.',
    host: 'Sofie', area: 'Nørrebro', when: 'Sun 13:00',
    going: 46, cap: 80, emoji: '🍝',
    hostStats: { rate: 96, hosted: 23 }, access: ['step-free', 'kid-friendly'], code: 'RLY-LONGTABLE',
  },
  {
    id: 'r_11', kind: 'loners', radius: 'local',
    title: 'Came-alone table, Bjørg’s',
    blurb: 'New to the city, just moved, didn’t know who to ask? Sit here. We saved you the seat on purpose.',
    host: 'Oliver', area: 'Indre By', when: 'Tonight 19:00',
    going: 8, cap: 12, emoji: '🫂',
    hostStats: { rate: 100, hosted: 16 }, access: ['sober-friendly', 'quiet-corner'], code: 'RLY-CAMEALONE',
  },
  // ---- PUBLIC ------------------------------------------------------------
  {
    id: 'r_12', kind: 'match', radius: 'public',
    title: 'Opening night, the big square',
    blurb: 'Mexico v South Africa on the giant screen. Zero titles between them, a hundred percent vibes. Come find us.',
    host: 'RALLY', area: 'Rådhuspladsen', when: 'Tonight 21:00',
    going: 312, cap: 4000, emoji: '⚽',
    hostStats: { rate: 98, hosted: 41 }, access: ['step-free', 'hearing-loop'], code: 'RLY-BIGSQUARE',
  },
  {
    id: 'r_13', kind: 'run', radius: 'public',
    title: 'Harbour parkrun, 5k, no excuses',
    blurb: 'Walk it, jog it, or pretend you’re chasing a bus — nobody’s timing your dignity. Saturdays, free, the whole city’s invited.',
    host: 'RALLY', area: 'Islands Brygge', when: 'Sat 09:00',
    going: 140, cap: null, emoji: '🏃',
    hostStats: { rate: 97, hosted: 52 }, access: ['step-free'], code: 'RLY-PARKRUN',
  },
  {
    id: 'r_14', kind: 'swap', radius: 'public',
    title: 'City book giveaway, the lakes',
    blurb: 'Take one, leave one, no money, no rules. The best library in town runs on a park bench.',
    host: 'RALLY', area: 'Søerne', when: 'Sat 11:00',
    going: 89, cap: null, emoji: '📚',
    hostStats: { rate: 93, hosted: 28 }, access: ['step-free', 'kid-friendly'], code: 'RLY-BOOKS-11',
  },
  {
    id: 'r_15', kind: 'gig', radius: 'public',
    title: 'Free open-air set, the gardens',
    blurb: 'Local DJs, golden hour, bring a blanket and someone who needed getting out of the house.',
    host: 'RALLY', area: 'Kongens Have', when: 'Fri 19:30',
    going: 205, cap: null, emoji: '🎶',
    hostStats: { rate: 95, hosted: 33 }, access: ['step-free'], code: 'RLY-OPENAIR',
  },
  // ---- CIVIC / CAUSE -----------------------------------------------------
  // The gathering is the point — turns out it’s the point for the city too.
  // Same religion, pointed at something that needs doing. Show up, do a bit,
  // stay for the coffee. Nobody saved a harbour alone.
  {
    id: 'r_16', kind: 'civic', radius: 'community',
    title: 'Harbour cleanup + breakfast after',
    blurb: 'Grab a bag, walk the quay, fish out what shouldn’t be there. An hour’s graft, then bacon rolls on us. The harbour we swim in, we keep.',
    host: 'Astrid', area: 'Islands Brygge', when: 'Sat 09:30',
    going: 27, cap: 60, emoji: '🤝',
    hostStats: { rate: 92, hosted: 15 }, access: ['step-free', 'kid-friendly'], code: 'RLY-HARBOUR',
  },
  {
    id: 'r_17', kind: 'civic', radius: 'local',
    title: 'Friday food bank, Nørrebro',
    blurb: 'Pack boxes, share a laugh, send food where it’s needed before the weekend. Bring tinned, bring time, bring yourself — all three count the same.',
    host: 'Mariam', area: 'Nørrebro', when: 'Fri 16:00',
    going: 19, cap: 40, emoji: '🤝',
    hostStats: { rate: 99, hosted: 47 }, access: ['step-free', 'quiet-corner'], code: 'RLY-FOODBANK',
  },
  {
    id: 'r_18', kind: 'civic', radius: 'public',
    title: 'New-neighbours meet, the library',
    blurb: 'Just landed in the city and the flat’s still in boxes? Come meet the street before you’ve unpacked the kettle. Coffee’s free, the welcome’s warmer.',
    host: 'RALLY', area: 'Vesterbro', when: 'Sun 15:00',
    going: 54, cap: null, emoji: '🤝',
    hostStats: { rate: 96, hosted: 30 }, access: ['step-free', 'hearing-loop', 'kid-friendly'], code: 'RLY-NEIGHBOURS',
  },
  // ---- LONERS CLUB (more substance) -------------------------------------
  {
    id: 'r_19', kind: 'loners', radius: 'circle',
    title: 'Solo-but-social Sunday walk',
    blurb: 'Came on your own? Good — so did everyone here. Easy loop round the lakes, talk if you fancy it, quiet if you don’t. No one walks home alone.',
    host: 'Jonas', area: 'Søerne', when: 'Sun 11:00',
    going: 6, cap: 15, emoji: '🫂',
    hostStats: { rate: 98, hosted: 21 }, access: ['step-free', 'sober-friendly', 'quiet-corner'], code: 'RLY-SOLOWALK',
  },
]

// Nights that already happened — the proof the rally was real. Same shape as
// RALLIES plus `past` and a `recap`: a warm one-liner, who turned up, and an
// emoji standing in for the photo nobody quite got round to taking. NOT in the
// upcoming feed (RALLIES) — these live in your history.
export const PAST_RALLIES = [
  {
    id: 'r_p01', kind: 'match', radius: 'public',
    title: 'England v Denmark, the square',
    blurb: 'Half the city in red and white, the other half pretending they weren’t nervous. One pitch, one screen, one roar.',
    host: 'RALLY', area: 'Rådhuspladsen', when: 'Last Sat 20:00',
    going: 480, cap: 4000, emoji: '⚽',
    hostStats: { rate: 98, hosted: 41 }, access: ['step-free', 'hearing-loop'], code: 'RLY-ENGDEN',
    past: true,
    recap: { line: 'We lost on penalties and stayed an hour anyway — that’s the whole point.', showed: 467, photoEmoji: '🇩🇰' },
  },
  {
    id: 'r_p02', kind: 'dinner', radius: 'local',
    title: 'Midsummer long-table, Jægersborggade',
    blurb: 'One dish each, one chair each, the longest table the street had ever seen. Nobody left a stranger.',
    host: 'Sofie', area: 'Nørrebro', when: 'Last Fri 18:00',
    going: 72, cap: 80, emoji: '🍝',
    hostStats: { rate: 96, hosted: 23 }, access: ['step-free', 'kid-friendly'], code: 'RLY-MIDSUMMER',
    past: true,
    recap: { line: 'Three hours, four encores of someone’s questionable guitar, zero leftovers. Skål.', showed: 68, photoEmoji: '🕯️' },
  },
  {
    id: 'r_p03', kind: 'civic', radius: 'community',
    title: 'Spring beach cleanup, Amager',
    blurb: 'Showed up in the drizzle, left with full bags and a clean shoreline. The weather did its worst; we did better.',
    host: 'Astrid', area: 'Amager Strand', when: 'Last Sun 10:00',
    going: 34, cap: 60, emoji: '🤝',
    hostStats: { rate: 92, hosted: 15 }, access: ['step-free', 'kid-friendly'], code: 'RLY-AMAGER',
    past: true,
    recap: { line: 'Forty bags, one heron watching us judgmentally, hot chocolate to finish. Worth the drizzle.', showed: 31, photoEmoji: '🦢' },
  },
]

export const ralliesByRadius = (key) =>
  key === 'all' || !key ? RALLIES : RALLIES.filter((r) => r.radius === key)

export const rallyById = (id) =>
  RALLIES.find((r) => r.id === id) || PAST_RALLIES.find((r) => r.id === id)

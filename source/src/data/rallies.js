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
}

export const kindMeta = (kind) => KINDS[kind] || { label: kind, emoji: '📍' }

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
  },
  {
    id: 'r_02', kind: 'wellness', radius: 'private',
    title: 'Saturday sauna, just us',
    blurb: 'La Banchina, dawn slot, dip in the harbour after. No phones, no chat — that’s the rule.',
    host: 'Emma', area: 'Christianshavn', when: 'Sat 08:00',
    going: 4, cap: 5, emoji: '🧖',
  },
  // ---- EXTENDED CIRCLE ---------------------------------------------------
  {
    id: 'r_03', kind: 'match', radius: 'circle',
    title: 'Brazil v Morocco, bring a mate',
    blurb: 'Samba on the speaker, midnight kickoff, samba in their boots. Bring one person I’d like.',
    host: 'Lucas', area: 'Refshaleøen', when: 'Sat 23:00',
    going: 9, cap: 14, emoji: '⚽',
  },
  {
    id: 'r_04', kind: 'gig', radius: 'circle',
    title: 'Loft party + whoever you vouch for',
    blurb: 'Vinyl only, lights low, one rule: if you bring them, you’re responsible for them. Skål.',
    host: 'Mathias', area: 'Nørrebro', when: 'Fri 22:00',
    going: 18, cap: 30, emoji: '🎶',
  },
  {
    id: 'r_05', kind: 'trip', radius: 'circle',
    title: 'Møn cliffs day-trip, +1s welcome',
    blurb: 'Early train, white cliffs, one cold swim that we’ll all regret and remember. Pack a sandwich.',
    host: 'Ingrid', area: 'Hovedbanegården', when: 'Sun 08:15',
    going: 7, cap: 12, emoji: '🚆',
  },
  // ---- COMMUNITY ---------------------------------------------------------
  {
    id: 'r_06', kind: 'run', radius: 'community',
    title: 'Tuesday run club — all paces',
    blurb: 'The lakes loop, then coffee. No one gets dropped, that’s the whole point. Back by eight.',
    host: 'Nadia', area: 'Søerne', when: 'Tue 18:30',
    going: 22, cap: null, emoji: '🏃',
  },
  {
    id: 'r_07', kind: 'match', radius: 'community',
    title: 'Five-a-side lot, screen at the bryghus',
    blurb: 'Same shirts off the pitch as on it. We lost 6–1 Sunday — we’ll win the night anyway.',
    host: 'Diego', area: 'Nørrebro', when: 'Wed 20:00',
    going: 11, cap: 16, emoji: '⚽',
  },
  {
    id: 'r_08', kind: 'social', radius: 'community',
    title: 'Danish class kickoff drinks',
    blurb: 'Hold 3, you survived the present tense, now order a beer in it. Round one’s on the teacher.',
    host: 'Yuki', area: 'Indre By', when: 'Thu 17:30',
    going: 14, cap: 20, emoji: '🍻',
  },
  // ---- LOCAL -------------------------------------------------------------
  {
    id: 'r_09', kind: 'swap', radius: 'local',
    title: 'Nørrebro clothes swap',
    blurb: 'Bring what you’ve stopped wearing, leave with someone else’s favourite. Nothing changes hands but a smile.',
    host: 'Freja', area: 'Nørrebro', when: 'Sat 14:00',
    going: 31, cap: null, emoji: '♻️',
  },
  {
    id: 'r_10', kind: 'dinner', radius: 'local',
    title: 'Street long-table, Jægersborggade',
    blurb: 'Everyone brings one dish, one chair, one neighbour they’ve never met. The street does the rest.',
    host: 'Sofie', area: 'Nørrebro', when: 'Sun 13:00',
    going: 46, cap: 80, emoji: '🍝',
  },
  {
    id: 'r_11', kind: 'loners', radius: 'local',
    title: 'Came-alone table, Bjørg’s',
    blurb: 'New to the city, just moved, didn’t know who to ask? Sit here. We saved you the seat on purpose.',
    host: 'Oliver', area: 'Indre By', when: 'Tonight 19:00',
    going: 8, cap: 12, emoji: '🫂',
  },
  // ---- PUBLIC ------------------------------------------------------------
  {
    id: 'r_12', kind: 'match', radius: 'public',
    title: 'Opening night, the big square',
    blurb: 'Mexico v South Africa on the giant screen. Zero titles between them, a hundred percent vibes. Come find us.',
    host: 'RALLY', area: 'Rådhuspladsen', when: 'Tonight 21:00',
    going: 312, cap: 4000, emoji: '⚽',
  },
  {
    id: 'r_13', kind: 'run', radius: 'public',
    title: 'Harbour parkrun, 5k, no excuses',
    blurb: 'Walk it, jog it, or pretend you’re chasing a bus — nobody’s timing your dignity. Saturdays, free, the whole city’s invited.',
    host: 'RALLY', area: 'Islands Brygge', when: 'Sat 09:00',
    going: 140, cap: null, emoji: '🏃',
  },
  {
    id: 'r_14', kind: 'swap', radius: 'public',
    title: 'City book giveaway, the lakes',
    blurb: 'Take one, leave one, no money, no rules. The best library in town runs on a park bench.',
    host: 'RALLY', area: 'Søerne', when: 'Sat 11:00',
    going: 89, cap: null, emoji: '📚',
  },
  {
    id: 'r_15', kind: 'gig', radius: 'public',
    title: 'Free open-air set, the gardens',
    blurb: 'Local DJs, golden hour, bring a blanket and someone who needed getting out of the house.',
    host: 'RALLY', area: 'Kongens Have', when: 'Fri 19:30',
    going: 205, cap: null, emoji: '🎶',
  },
]

export const ralliesByRadius = (key) =>
  key === 'all' || !key ? RALLIES : RALLIES.filter((r) => r.radius === key)

export const rallyById = (id) => RALLIES.find((r) => r.id === id)

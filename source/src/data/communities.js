// ---------------------------------------------------------------------------
// communities.js — Layer 3 of the Social Radius: the clubs you belong to (S2.3).
//
// A community is a standing crew with a shared badge — a run club, a five-a-side
// lot, the internationals who all arrived knowing no one. Rallies hang off it.
// Pure demo data; a real `communities` + `community_members` table swaps in
// behind hasSupabase later (docs/RALLY-HEKLA-schema.md). rallyIds reference the
// seeded RALLIES in rallies.js; members reference USERS in mockData.js.
// ---------------------------------------------------------------------------

export const COMMUNITIES = [
  {
    id: 'c_int',
    name: 'Internationals Copenhagen',
    emoji: '🌍',
    area: 'Citywide',
    blurb: 'New in town, leaving with a crew. The soft landing nobody told you to look for.',
    accent: 'purple',
    memberCount: 1240,
    memberIds: ['u_me', 'u_003', 'u_004', 'u_008', 'u_011', 'u_012'],
    rallyIds: ['r_08', 'r_11', 'r_18'],
  },
  {
    id: 'c_run',
    name: 'Nørrebro Runners',
    emoji: '🏃',
    area: 'Nørrebro',
    blurb: 'No one gets dropped, that’s the whole point. Lakes loop, then coffee.',
    accent: 'lime',
    memberCount: 318,
    memberIds: ['u_me', 'u_008', 'u_001', 'u_010', 'u_006'],
    rallyIds: ['r_06', 'r_13'],
  },
  {
    id: 'c_5aside',
    name: 'CPH Five-a-side',
    emoji: '⚽',
    area: 'Citywide',
    blurb: 'Same shirts off the pitch as on it. We lose, we laugh, we go again.',
    accent: 'pink',
    memberCount: 86,
    memberIds: ['u_005', 'u_003', 'u_002', 'u_009'],
    rallyIds: ['r_07'],
  },
]

export const communityById = (id) => COMMUNITIES.find((c) => c.id === id) || null

// The communities u_me belongs to (membership derived from memberIds).
export const MY_ID = 'u_me'
export const myCommunities = () => COMMUNITIES.filter((c) => c.memberIds.includes(MY_ID))
export const isMember = (community, userId = MY_ID) =>
  !!community && community.memberIds.includes(userId)

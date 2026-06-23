// ---------------------------------------------------------------------------
// social.js — the friend graph + "who you know is going" (project HEKLA, S2.2).
//
// A feed becomes a reason to show up when you can see your people in it. This is
// the demo-mode graph: who u_me is friends with, who's in the crew for each
// seeded rally, and the derivation that turns those into "Sofie & Freja going".
// Pure — no React, no backend. A real `friendships` table + plan_participants
// swap in behind hasSupabase later (docs/RALLY-HEKLA-schema.md); the shape holds.
// ---------------------------------------------------------------------------
import { userById } from '../data/mockData.js'

export const MY_ID = 'u_me'

// Who you're friends with (one hop — the Extended Circle radius made concrete).
export const FRIEND_IDS = ['u_001', 'u_003', 'u_004', 'u_006', 'u_010']
const _friendSet = new Set(FRIEND_IDS)

export const isFriend = (id) => _friendSet.has(id)
export const myFriends = () => FRIEND_IDS.map(userById).filter(Boolean)

// Demo crew: who's already going to each seeded rally. Created rallies have none
// yet (just you). Ids reference USERS in mockData.js.
export const RALLY_CREW = {
  r_01: ['u_001', 'u_004'],
  r_03: ['u_003', 'u_005', 'u_011'],
  r_04: ['u_002', 'u_006', 'u_007', 'u_012'],
  r_05: ['u_010', 'u_004'],
  r_06: ['u_008', 'u_001', 'u_010'],
  r_07: ['u_005', 'u_003'],
  r_08: ['u_012', 'u_004', 'u_006'],
  r_09: ['u_006', 'u_001'],
  r_10: ['u_001', 'u_004', 'u_009', 'u_010'],
  r_11: ['u_009', 'u_003'],
  r_12: ['u_002', 'u_005', 'u_006', 'u_011', 'u_001'],
  r_16: ['u_008', 'u_010'],
  r_18: ['u_001', 'u_009'],
}

export const crewOf = (rallyId) => RALLY_CREW[rallyId] || []

// The friends among a rally's crew — the people whose presence changes your mind.
export const friendsGoing = (rallyId) =>
  crewOf(rallyId).filter(isFriend).map(userById).filter(Boolean)

// A short, warm summary line. "" when no friends are going (caller hides the row).
//   1 → "Sofie's going"
//   2 → "Sofie & Freja going"
//   3+ → "Sofie, Freja +2 going"
export const friendsGoingLabel = (rallyId) => {
  const f = friendsGoing(rallyId)
  if (f.length === 0) return ''
  if (f.length === 1) return `${f[0].name}’s going`
  if (f.length === 2) return `${f[0].name} & ${f[1].name} going`
  return `${f[0].name}, ${f[1].name} +${f.length - 2} going`
}

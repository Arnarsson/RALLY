// Contract tests for the Layer-3 communities seed. Pure data.
import { describe, it, expect } from 'vitest'
import { COMMUNITIES, communityById, myCommunities, isMember, MY_ID } from './communities.js'
import { userById } from './mockData.js'
import { rallyById } from './rallies.js'

const BRAND_ACCENTS = ['cream', 'blue', 'purple', 'lime', 'pink', 'flame']

describe('COMMUNITIES seed', () => {
  it('has at least three communities, each well-formed', () => {
    expect(COMMUNITIES.length).toBeGreaterThanOrEqual(3)
    for (const c of COMMUNITIES) {
      expect(c.id).toBeTruthy()
      expect(c.name).toBeTruthy()
      expect(c.blurb).toBeTruthy()
      expect(c.emoji).toBeTruthy()
      expect(BRAND_ACCENTS).toContain(c.accent)
      expect(Number.isInteger(c.memberCount)).toBe(true)
      expect(Array.isArray(c.memberIds)).toBe(true)
      expect(Array.isArray(c.rallyIds)).toBe(true)
    }
  })
  it('community ids are unique', () => {
    expect(new Set(COMMUNITIES.map((c) => c.id)).size).toBe(COMMUNITIES.length)
  })
  it('every member id resolves to a real user', () => {
    for (const c of COMMUNITIES) {
      for (const id of c.memberIds) expect(userById(id)).toBeTruthy()
    }
  })
  it('every linked rally id resolves to a real rally', () => {
    for (const c of COMMUNITIES) {
      for (const id of c.rallyIds) expect(rallyById(id)).toBeTruthy()
    }
  })
  it('memberCount is never smaller than the seeded member list', () => {
    for (const c of COMMUNITIES) {
      expect(c.memberCount).toBeGreaterThanOrEqual(c.memberIds.length)
    }
  })
})

describe('membership', () => {
  it('communityById resolves and misses cleanly', () => {
    expect(communityById(COMMUNITIES[0].id)).toBe(COMMUNITIES[0])
    expect(communityById('nope')).toBeNull()
  })
  it('myCommunities are exactly the ones u_me is a member of', () => {
    const mine = myCommunities()
    for (const c of mine) expect(c.memberIds).toContain(MY_ID)
    for (const c of COMMUNITIES) {
      expect(mine.includes(c)).toBe(c.memberIds.includes(MY_ID))
    }
  })
  it('isMember reflects the member list and guards null', () => {
    expect(isMember(COMMUNITIES[0])).toBe(COMMUNITIES[0].memberIds.includes(MY_ID))
    expect(isMember(null)).toBe(false)
  })
})

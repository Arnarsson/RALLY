// Tests for the friend graph + "friends going" derivation. Pure, no React.
import { describe, it, expect } from 'vitest'
import {
  FRIEND_IDS, isFriend, myFriends, crewOf, friendsGoing, friendsGoingLabel, RALLY_CREW,
} from './social.js'
import { userById } from '../data/mockData.js'

describe('the friend graph', () => {
  it('friend ids all resolve to real users', () => {
    for (const id of FRIEND_IDS) expect(userById(id)).toBeTruthy()
  })
  it('isFriend is true for friends, false otherwise', () => {
    expect(isFriend('u_001')).toBe(true)
    expect(isFriend('u_002')).toBe(false)   // Mathias is crew, not a friend
    expect(isFriend('nope')).toBe(false)
  })
  it('myFriends returns the resolved friend users', () => {
    expect(myFriends().map((u) => u.id)).toEqual(FRIEND_IDS)
  })
})

describe('crew + friendsGoing', () => {
  it('crewOf returns [] for an unknown rally', () => {
    expect(crewOf('r_nope')).toEqual([])
  })
  it('every crew id references a real user', () => {
    for (const ids of Object.values(RALLY_CREW)) {
      for (const id of ids) expect(userById(id)).toBeTruthy()
    }
  })
  it('friendsGoing keeps only friends from the crew', () => {
    // r_04 crew is u_002,u_006,u_007,u_012 → only u_006 (Freja) is a friend.
    expect(friendsGoing('r_04').map((u) => u.id)).toEqual(['u_006'])
  })
  it('friendsGoing is empty for a rally with no crew', () => {
    expect(friendsGoing('r_07b_nope')).toEqual([])
  })
  it('friendsGoing picks the single friend out of a mixed crew', () => {
    expect(friendsGoing('r_07').map((u) => u.id)).toEqual(['u_003'])   // u_005,u_003 → Lucas
  })
})

describe('friendsGoingLabel', () => {
  it('is empty when no friends are going', () => {
    expect(friendsGoingLabel('r_nope')).toBe('')
  })
  it('names one friend', () => {
    expect(friendsGoingLabel('r_04')).toBe('Freja’s going')   // only Freja
  })
  it('names two friends with an ampersand', () => {
    // r_01 crew u_001,u_004 → Sofie & Emma (both friends)
    expect(friendsGoingLabel('r_01')).toBe('Sofie & Emma going')
  })
  it('summarises three or more with a +N', () => {
    // r_10 crew u_001,u_004,u_009,u_010 → friends: Sofie, Emma, Ingrid (u_009 not a friend)
    expect(friendsGoingLabel('r_10')).toBe('Sofie, Emma +1 going')
  })
})

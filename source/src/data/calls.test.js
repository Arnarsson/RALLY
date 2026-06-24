// Tests for the personal "call it" record. Pure; reuses mockData result helpers.
import { describe, it, expect } from 'vitest'
import { callRecord, callStreak, callBlurb, callerBoard, POINTS_PER_HIT, CALL_CHOICES } from './calls.js'

// Minimal match fixtures: a completed A-win, a completed draw, a pending one.
const M = [
  { id: 'm1', kickoff: '2026-06-11T21:00', team_a: 'Mexico', team_b: 'South Africa', score_a: 2, score_b: 0 },
  { id: 'm2', kickoff: '2026-06-12T21:00', team_a: 'Spain', team_b: 'Italy', score_a: 1, score_b: 1 },
  { id: 'm3', kickoff: '2026-06-13T21:00', team_a: 'Brazil', team_b: 'Morocco', score_a: null, score_b: null },
]

describe('callRecord', () => {
  it('tallies hits, misses, pending and points', () => {
    const calls = { m1: 'team_a', m2: 'draw', m3: 'team_a' } // hit, hit, pending
    const r = callRecord(calls, M)
    expect(r.made).toBe(3)
    expect(r.settled).toBe(2)
    expect(r.pending).toBe(1)
    expect(r.hits).toBe(2)
    expect(r.misses).toBe(0)
    expect(r.points).toBe(2 * POINTS_PER_HIT)
    expect(r.accuracy).toBe(100)
  })
  it('counts a wrong call as a miss', () => {
    const r = callRecord({ m1: 'team_b' }, M)   // called South Africa, Mexico won
    expect(r).toMatchObject({ settled: 1, hits: 0, misses: 1, points: 0, accuracy: 0 })
  })
  it('ignores unknown matches and invalid picks', () => {
    const r = callRecord({ nope: 'team_a', m1: 'banana' }, M)
    expect(r.made).toBe(0)
    expect(r.accuracy).toBeNull()   // nothing settled
  })
  it('handles an empty/missing calls map', () => {
    expect(callRecord({}, M).made).toBe(0)
    expect(callRecord(undefined, M).made).toBe(0)
  })
})

describe('callStreak', () => {
  it('counts consecutive hits in kickoff order, resetting on a miss', () => {
    expect(callStreak({ m1: 'team_a', m2: 'draw' }, M)).toBe(2)          // hit, hit
    expect(callStreak({ m1: 'team_b', m2: 'draw' }, M)).toBe(1)          // miss then hit → 1
    expect(callStreak({ m1: 'team_a', m2: 'team_a' }, M)).toBe(0)        // hit then miss → 0
  })
  it('ignores pending calls', () => {
    expect(callStreak({ m1: 'team_a', m3: 'team_a' }, M)).toBe(1)        // m3 pending
  })
})

describe('callBlurb', () => {
  it('is empty without a pick', () => {
    expect(callBlurb(M[0], null)).toBe('')
  })
  it('speaks in voice for pending / right / wrong', () => {
    expect(callBlurb(M[2], 'team_a')).toMatch(/called it: Brazil/)        // pending
    expect(callBlurb(M[0], 'team_a')).toMatch(/Take the bow/)             // right
    expect(callBlurb(M[0], 'team_b')).toMatch(/pitch disagreed/)          // wrong
  })
})

describe('callerBoard', () => {
  const users = [
    { id: 'u_me', name: 'You', flag: '🇩🇰' },
    { id: 'u_001', name: 'Sofie', flag: '🇩🇰' },
    { id: 'u_002', name: 'Mathias', flag: '🇩🇰' },
  ]
  it('ranks callers by points (desc), only those who have called', () => {
    const board = callerBoard(M, users, { m1: 'team_a' }, 'u_me')   // You: 1 hit
    expect(board.length).toBeGreaterThan(0)
    // sorted by points descending
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].record.points).toBeGreaterThanOrEqual(board[i].record.points)
    }
    // You are present with a real record (1 call made)
    const me = board.find((b) => b.user.id === 'u_me')
    expect(me.record.made).toBe(1)
    expect(typeof me.streak).toBe('number')   // each entry carries its hit streak
  })
  it('drops users with no calls and is deterministic', () => {
    const a = callerBoard(M, users, {}, 'u_me')
    const b = callerBoard(M, users, {}, 'u_me')
    expect(a.map((x) => x.user.id)).toEqual(b.map((x) => x.user.id))   // stable order
    expect(a.find((x) => x.user.id === 'u_me')).toBeUndefined()        // You made no calls → absent
  })
})

describe('constants', () => {
  it('exposes the pick choices in order', () => {
    expect(CALL_CHOICES).toEqual(['team_a', 'draw', 'team_b'])
  })
})

// Tests for the group-standings core. Pure; only finished matches count.
import { describe, it, expect } from 'vitest'
import { parseGroup, groupOf, buildStandings, groupTable } from './standings.js'

const M = [
  // Group A: Mexico beat South Africa 2–1; Mexico draw France 1–1
  { team_a: 'Mexico', flag_a: '🇲🇽', team_b: 'South Africa', flag_b: '🇿🇦', stage: 'Group A · Opening match', score_a: 2, score_b: 1 },
  { team_a: 'France', flag_a: '🇫🇷', team_b: 'Mexico', flag_b: '🇲🇽', stage: 'Group A', score_a: 1, score_b: 1 },
  // Group B: one finished, one not-yet-played (null scores → ignored)
  { team_a: 'Canada', flag_a: '🇨🇦', team_b: 'Bosnia', flag_b: '🇧🇦', stage: 'Group B', score_a: 1, score_b: 0 },
  { team_a: 'Canada', flag_a: '🇨🇦', team_b: 'France', flag_b: '🇫🇷', stage: 'Group B', score_a: null, score_b: null },
  // Non-group + generic stage → never grouped
  { team_a: 'X', team_b: 'Y', stage: 'Round of 32', score_a: 3, score_b: 0 },
  { team_a: 'P', team_b: 'Q', stage: 'Group Stage', score_a: 1, score_b: 0 },
]

describe('parseGroup', () => {
  it('extracts A–L, ignores non-group stages', () => {
    expect(parseGroup('Group A · Opening match')).toBe('A')
    expect(parseGroup('Group G')).toBe('G')
    expect(parseGroup('Group Stage')).toBeNull()   // no letter
    expect(parseGroup('Round of 32')).toBeNull()
    expect(parseGroup('')).toBeNull()
    expect(groupOf({ stage: 'Group D' })).toBe('D')
  })
})

describe('buildStandings', () => {
  const table = buildStandings(M)
  it('builds only the lettered groups with finished matches', () => {
    expect(Object.keys(table).sort()).toEqual(['A', 'B'])   // not "Group Stage" / Round of 32
  })
  it('tallies points/GD and orders the group correctly', () => {
    // Group A: Mexico W+D = 4 pts (GF3 GA2 GD+1); France D = 1; South Africa L = 0
    const A = table.A
    expect(A.map((r) => r.team)).toEqual(['Mexico', 'France', 'South Africa'])
    expect(A[0]).toMatchObject({ team: 'Mexico', P: 2, W: 1, D: 1, L: 0, GF: 3, GA: 2, GD: 1, Pts: 4 })
    expect(A.find((r) => r.team === 'South Africa')).toMatchObject({ P: 1, L: 1, Pts: 0 })
  })
  it('ignores not-yet-played matches (null scores)', () => {
    // Group B only counts Canada 1–0 Bosnia; the Canada–France fixture is pending
    const B = table.B
    expect(B.find((r) => r.team === 'Canada')).toMatchObject({ P: 1, W: 1, Pts: 3 })
    expect(B.find((r) => r.team === 'France')).toBeUndefined()   // not played in group B yet
  })
})

describe('groupTable', () => {
  it('returns the table for a stage’s group, [] when not a group', () => {
    expect(groupTable(M, 'Group A').map((r) => r.team)[0]).toBe('Mexico')
    expect(groupTable(M, 'Round of 32')).toEqual([])
    expect(groupTable(M, 'Group Stage')).toEqual([])
  })
})

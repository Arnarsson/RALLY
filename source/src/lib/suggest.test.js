// Tests for the next-rally suggestion core. Pure, deterministic, no React.
import { describe, it, expect } from 'vitest'
import { suggestNextRally } from './suggest.js'
import { kindMeta } from '../data/rallies.js'

const community = { id: 'c_run', name: 'Nørrebro Runners', area: 'Nørrebro' }

describe('suggestNextRally', () => {
  it('returns null without a community', () => {
    expect(suggestNextRally(null, [])).toBeNull()
  })

  it('picks the signature kind + area from history', () => {
    const rallies = [
      { kind: 'run', area: 'Nørrebro', cap: 30 },
      { kind: 'run', area: 'Nørrebro', cap: 30 },
      { kind: 'social', area: 'Indre By', cap: 20 },
    ]
    const s = suggestNextRally(community, rallies)
    expect(s.draft.kind).toBe('run')          // most common kind
    expect(s.draft.area).toBe('Nørrebro')     // most common area
    expect(s.draft.radius).toBe('community')
    expect(s.draft.emoji).toBe(kindMeta('run').emoji)
    expect(s.draft.cap).toBe(30)              // typical headcount
    expect(s.headline).toContain('Nørrebro Runners')
    expect(s.reason).toBeTruthy()
  })

  it('carries a recurring cadence + its slot into the next instance', () => {
    const rallies = [
      { kind: 'run', area: 'Søerne', cap: null, recurrence: 'weekly', when: 'Tue 18:30' },
      { kind: 'run', area: 'Søerne', cap: null },
    ]
    const s = suggestNextRally(community, rallies)
    expect(s.draft.recurrence).toBe('weekly')
    expect(s.draft.when).toBe('Tue 18:30')
    expect(s.reason.toLowerCase()).toContain('weekly')
  })

  it('falls back gracefully for a brand-new community with no rallies', () => {
    const s = suggestNextRally(community, [])
    expect(s.draft.kind).toBe('social')       // sensible default
    expect(s.draft.area).toBe('Nørrebro')     // community.area fallback
    expect(s.draft.recurrence).toBe('none')
    expect(s.draft.cap).toBe('')              // open by default
    expect(s.reason).toContain('quiet')
  })

  it('produces a CreateRallyScreen-shaped draft (all fields present)', () => {
    const s = suggestNextRally(community, [{ kind: 'gig', area: 'Vesterbro' }])
    for (const key of ['kind', 'radius', 'title', 'blurb', 'area', 'when', 'cap', 'access', 'emoji', 'recurrence']) {
      expect(s.draft).toHaveProperty(key)
    }
    expect(Array.isArray(s.draft.access)).toBe(true)
    expect(s.draft.title).toContain('Nørrebro Runners')
  })
})

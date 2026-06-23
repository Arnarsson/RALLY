// Contract tests for the Social Radius demo data (project HEKLA). Pure data, no
// React — same spirit as mockData.test.js. These guard the shape RalliesScreen
// (and, later, a real `rallies` table) leans on: five radii, valid keys, and a
// filter that partitions the feed cleanly.
import { describe, it, expect } from 'vitest'
import {
  RADII, RALLIES, KINDS,
  radiusByKey, ralliesByRadius, rallyById, kindMeta,
} from './rallies.js'

const RADIUS_KEYS = ['private', 'circle', 'community', 'local', 'public']
// Brand tokens that actually exist as Tailwind colours (see tailwind.config.js).
const BRAND_TOKENS = ['cream', 'blue', 'purple', 'lime', 'pink', 'flame']

describe('RADII (the five layers)', () => {
  it('has exactly five layers, in invite-reach order', () => {
    expect(RADII.map((r) => r.key)).toEqual(RADIUS_KEYS)
  })
  it('every layer has a label, a SOUL-voice hint, an example and a real brand accent', () => {
    for (const r of RADII) {
      expect(r.label).toBeTruthy()
      expect(r.hint).toBeTruthy()
      expect(r.example).toBeTruthy()
      expect(BRAND_TOKENS).toContain(r.accent)
    }
  })
  it('radiusByKey resolves known keys and is null otherwise', () => {
    expect(radiusByKey('public').label).toBe('Public')
    expect(radiusByKey('nope')).toBeNull()
  })
})

describe('RALLIES (the feed)', () => {
  it('has at least a dozen rallies', () => {
    expect(RALLIES.length).toBeGreaterThanOrEqual(12)
  })
  it('every rally is well-formed and sits in a valid radius/kind', () => {
    for (const r of RALLIES) {
      expect(r.id).toBeTruthy()
      expect(RADIUS_KEYS).toContain(r.radius)
      expect(KINDS[r.kind]).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.blurb).toBeTruthy()
      expect(r.host).toBeTruthy()
      expect(r.area).toBeTruthy()
      expect(r.when).toBeTruthy()
      expect(typeof r.going).toBe('number')
      expect(r.cap === null || typeof r.cap === 'number').toBe(true)
      expect(r.emoji).toBeTruthy()
    }
  })
  it('rally ids are unique', () => {
    expect(new Set(RALLIES.map((r) => r.id)).size).toBe(RALLIES.length)
  })
  it('going never exceeds a stated cap', () => {
    for (const r of RALLIES) {
      if (r.cap !== null) expect(r.going).toBeLessThanOrEqual(r.cap)
    }
  })
  it('every radius is represented in the feed', () => {
    for (const key of RADIUS_KEYS) {
      expect(RALLIES.some((r) => r.radius === key)).toBe(true)
    }
  })
})

describe('ralliesByRadius (the filter)', () => {
  it("'all' (or empty) returns the whole feed", () => {
    expect(ralliesByRadius('all')).toHaveLength(RALLIES.length)
    expect(ralliesByRadius()).toHaveLength(RALLIES.length)
  })
  it('filtering by each layer partitions the feed without loss or overlap', () => {
    const total = RADIUS_KEYS.reduce((sum, key) => {
      const slice = ralliesByRadius(key)
      slice.forEach((r) => expect(r.radius).toBe(key))
      return sum + slice.length
    }, 0)
    expect(total).toBe(RALLIES.length)
  })
})

describe('lookups', () => {
  it('rallyById finds a known rally and misses cleanly', () => {
    expect(rallyById(RALLIES[0].id)).toBe(RALLIES[0])
    expect(rallyById('nope')).toBeUndefined()
  })
  it('kindMeta falls back gracefully for an unknown kind', () => {
    expect(kindMeta('match').label).toBe('Match night')
    expect(kindMeta('???').emoji).toBe('📍')
  })
})

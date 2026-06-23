// Contract tests for the Social Radius demo data (project HEKLA). Pure data, no
// React — same spirit as mockData.test.js. These guard the shape RalliesScreen
// (and, later, a real `rallies` table) leans on: five radii, valid keys, and a
// filter that partitions the feed cleanly.
import { describe, it, expect } from 'vitest'
import {
  RADII, RALLIES, KINDS, ACCESS_TAGS, PAST_RALLIES,
  radiusByKey, ralliesByRadius, rallyById, kindMeta, accessMeta,
} from './rallies.js'

const RADIUS_KEYS = ['private', 'circle', 'community', 'local', 'public']
// Brand tokens that actually exist as Tailwind colours (see tailwind.config.js).
const BRAND_TOKENS = ['cream', 'blue', 'purple', 'lime', 'pink', 'flame']
const ACCESS_KEYS = ACCESS_TAGS.map((t) => t.key)

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
  it('every rally has valid host stats (show-up rate 0-100, hosted count)', () => {
    for (const r of RALLIES) {
      expect(r.hostStats).toBeTruthy()
      expect(Number.isInteger(r.hostStats.rate)).toBe(true)
      expect(r.hostStats.rate).toBeGreaterThanOrEqual(0)
      expect(r.hostStats.rate).toBeLessThanOrEqual(100)
      expect(Number.isInteger(r.hostStats.hosted)).toBe(true)
      expect(r.hostStats.hosted).toBeGreaterThanOrEqual(0)
    }
  })
  it('every rally access is an array of valid ACCESS_TAGS keys', () => {
    for (const r of RALLIES) {
      expect(Array.isArray(r.access)).toBe(true)
      for (const key of r.access) expect(ACCESS_KEYS).toContain(key)
    }
  })
  it('every rally has a non-empty, unique invite code', () => {
    for (const r of RALLIES) {
      expect(typeof r.code).toBe('string')
      expect(r.code.length).toBeGreaterThan(0)
    }
    expect(new Set(RALLIES.map((r) => r.code)).size).toBe(RALLIES.length)
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

describe('ACCESS_TAGS (the welcome, said out loud)', () => {
  it('is the fixed set in the fixed order', () => {
    expect(ACCESS_TAGS.map((t) => t.key)).toEqual([
      'step-free', 'hearing-loop', 'quiet-corner', 'kid-friendly', 'sober-friendly',
    ])
  })
  it('every tag has a key, label and emoji', () => {
    for (const t of ACCESS_TAGS) {
      expect(t.key).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.emoji).toBeTruthy()
    }
  })
  it('accessMeta resolves known keys and falls back for unknown', () => {
    expect(accessMeta('step-free').label).toBe('Step-free')
    const fallback = accessMeta('???')
    expect(fallback.key).toBe('???')
    expect(fallback.label).toBe('???')
    expect(fallback.emoji).toBe('•')
  })
})

describe('KINDS (civic / cause)', () => {
  it('has the civic kind', () => {
    expect(KINDS.civic).toBeTruthy()
    expect(KINDS.civic.label).toBe('Civic / cause')
    expect(KINDS.civic.emoji).toBe('🤝')
  })
  it('keeps the existing social kind', () => {
    expect(KINDS.social).toBeTruthy()
  })
  it('civic is represented in the feed', () => {
    expect(RALLIES.some((r) => r.kind === 'civic')).toBe(true)
  })
})

describe('PAST_RALLIES (the proof it was real)', () => {
  it('has rallies, none of which leak into the upcoming feed', () => {
    expect(PAST_RALLIES.length).toBeGreaterThanOrEqual(3)
    const upcomingIds = new Set(RALLIES.map((r) => r.id))
    for (const r of PAST_RALLIES) expect(upcomingIds.has(r.id)).toBe(false)
  })
  it('every past rally is flagged past and carries a full recap', () => {
    for (const r of PAST_RALLIES) {
      expect(r.past).toBe(true)
      expect(r.recap).toBeTruthy()
      expect(r.recap.line).toBeTruthy()
      expect(Number.isInteger(r.recap.showed)).toBe(true)
      expect(r.recap.photoEmoji).toBeTruthy()
    }
  })
  it('every past rally still has the full base shape (hostStats/access/code)', () => {
    for (const r of PAST_RALLIES) {
      expect(r.hostStats).toBeTruthy()
      expect(Array.isArray(r.access)).toBe(true)
      expect(typeof r.code).toBe('string')
    }
  })
})

describe('lookups', () => {
  it('rallyById finds a known rally and misses cleanly', () => {
    expect(rallyById(RALLIES[0].id)).toBe(RALLIES[0])
    expect(rallyById('nope')).toBeUndefined()
  })
  it('rallyById also finds a past rally', () => {
    expect(rallyById(PAST_RALLIES[0].id)).toBe(PAST_RALLIES[0])
  })
  it('kindMeta falls back gracefully for an unknown kind', () => {
    expect(kindMeta('match').label).toBe('Match night')
    expect(kindMeta('???').emoji).toBe('📍')
  })
})

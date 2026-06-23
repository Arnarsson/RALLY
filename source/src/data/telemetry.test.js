// Contract tests for the GDPR-clean telemetry stub. Pure module, in-memory.
// These guard the three hard rules: opt-in only, known user-initiated events
// only, and never — ever — location.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  EVENT_KINDS, setConsent, hasConsent, logEvent, getLog, clearLog,
} from './telemetry.js'

beforeEach(() => {
  setConsent(false)
  clearLog()
})

describe('EVENT_KINDS', () => {
  it('is exactly the expected set, in order', () => {
    expect(EVENT_KINDS).toEqual([
      'rally_view', 'rally_join', 'rally_leave', 'rally_share', 'rally_invite', 'arrive',
    ])
  })
})

describe('consent (opt-in only)', () => {
  it('defaults OFF', () => {
    expect(hasConsent()).toBe(false)
  })
  it('logEvent no-ops and returns false without consent', () => {
    expect(logEvent('rally_view', { rallyId: 'r_01' })).toBe(false)
    expect(getLog()).toHaveLength(0)
  })
  it('logs and returns true once consented', () => {
    setConsent(true)
    expect(logEvent('rally_join', { rallyId: 'r_01' })).toBe(true)
    const log = getLog()
    expect(log).toHaveLength(1)
    expect(log[0].kind).toBe('rally_join')
    expect(log[0].rallyId).toBe('r_01')
    expect(typeof log[0].at).toBe('number')
  })
})

describe('never location', () => {
  it('strips geo-shaped keys from the stored event', () => {
    setConsent(true)
    logEvent('arrive', {
      rallyId: 'r_12',
      lat: 55.67, lng: 12.56, longitude: 12.56,
      coords: {}, gpsFix: true, geoHash: 'abc', userLat: 1,
    })
    const event = getLog()[0]
    expect(event.rallyId).toBe('r_12')
    expect(event.lat).toBeUndefined()
    expect(event.lng).toBeUndefined()
    expect(event.longitude).toBeUndefined()
    expect(event.coords).toBeUndefined()
    expect(event.gpsFix).toBeUndefined()
    expect(event.geoHash).toBeUndefined()
    expect(event.userLat).toBeUndefined()
  })
})

describe('never location — even nested', () => {
  it('strips geo keys inside sub-objects and arrays of objects', () => {
    setConsent(true)
    logEvent('rally_join', {
      rallyId: 'r_07',
      meta: { lat: 55.6, lng: 12.5, note: 'keep me' },
      points: [{ lat: 1, label: 'a' }, { gps: 'x', label: 'b' }],
    })
    const event = getLog()[0]
    expect(event.rallyId).toBe('r_07')
    expect(event.meta).toEqual({ note: 'keep me' })       // geo gone, rest kept
    expect(event.points).toEqual([{ label: 'a' }, { label: 'b' }])
  })
  it('keeps innocent keys that merely contain a geo substring', () => {
    setConsent(true)
    logEvent('rally_view', {
      rallyId: 'r_01', latency: 42, translation: 'da', relation: 'friend', category: 'gig',
    })
    const event = getLog()[0]
    expect(event.latency).toBe(42)
    expect(event.translation).toBe('da')
    expect(event.relation).toBe('friend')
    expect(event.category).toBe('gig')
  })
})

describe('unknown kinds', () => {
  it('returns false and records nothing for an unrecognised kind', () => {
    setConsent(true)
    expect(logEvent('mystery_ping', { rallyId: 'r_01' })).toBe(false)
    expect(getLog()).toHaveLength(0)
  })
})

describe('the log', () => {
  it('getLog returns a copy, not the live array', () => {
    setConsent(true)
    logEvent('rally_view', { rallyId: 'r_01' })
    const a = getLog()
    a.push({ tampered: true })
    expect(getLog()).toHaveLength(1)
  })
  it('clearLog empties it', () => {
    setConsent(true)
    logEvent('rally_view', { rallyId: 'r_01' })
    clearLog()
    expect(getLog()).toHaveLength(0)
  })
})

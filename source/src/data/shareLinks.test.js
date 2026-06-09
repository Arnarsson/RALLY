// Unit tests for the SHARE LOOP pure helpers — link building + the guest-join
// param parsing that the bootstrap relies on. No DOM, no Supabase.
import { describe, it, expect } from 'vitest'
import {
  parseShareParams, planShareUrl, planCardUrl, shareText, SHARE_ORIGIN,
} from './shareLinks.js'

describe('parseShareParams', () => {
  it('reads the clean path form /p/<id>', () => {
    expect(parseShareParams({ pathname: '/p/abc123', search: '' }))
      .toEqual({ planId: 'abc123', ref: null })
  })
  it('reads the query form ?p=<id>', () => {
    expect(parseShareParams({ pathname: '/', search: '?p=abc123' }))
      .toEqual({ planId: 'abc123', ref: null })
  })
  it('captures ?ref alongside the plan id (for §2)', () => {
    expect(parseShareParams({ pathname: '/p/xyz', search: '?ref=SVEN10' }))
      .toEqual({ planId: 'xyz', ref: 'SVEN10' })
  })
  it('prefers the explicit ?p query over the path', () => {
    expect(parseShareParams({ pathname: '/p/frompath', search: '?p=fromquery' }).planId)
      .toBe('fromquery')
  })
  it('returns nulls when there is no plan in the location', () => {
    expect(parseShareParams({ pathname: '/', search: '' }))
      .toEqual({ planId: null, ref: null })
  })
  it('is null-safe for a missing location', () => {
    expect(parseShareParams(null)).toEqual({ planId: null, ref: null })
  })
})

describe('planShareUrl', () => {
  it('builds the clean shareable link', () => {
    expect(planShareUrl('abc')).toBe(`${SHARE_ORIGIN}/p/abc`)
  })
  it('round-trips through parseShareParams', () => {
    const url = planShareUrl('round-trip-id')
    const { pathname } = new URL(url)
    expect(parseShareParams({ pathname, search: '' }).planId).toBe('round-trip-id')
  })
  it('appends ?ref when given', () => {
    expect(planShareUrl('abc', 'CODE')).toBe(`${SHARE_ORIGIN}/p/abc?ref=CODE`)
  })
  it('falls back to the origin with no id', () => {
    expect(planShareUrl(null)).toBe(SHARE_ORIGIN)
  })
})

describe('planCardUrl', () => {
  it('points at the poster route with planId + going', () => {
    expect(planCardUrl('wc_1', 'p_9', 6))
      .toBe(`${SHARE_ORIGIN}/api/poster/wc_1.png?planId=p_9&going=6`)
  })
  it('omits going when not provided', () => {
    expect(planCardUrl('wc_1', 'p_9'))
      .toBe(`${SHARE_ORIGIN}/api/poster/wc_1.png?planId=p_9`)
  })
  it('is safe with no match id', () => {
    expect(planCardUrl(null)).toBe(`${SHARE_ORIGIN}/`)
  })
})

describe('shareText', () => {
  it('writes a SOUL-voice invitation with the venue', () => {
    const { title, text } = shareText({ teamA: 'Brazil', teamB: 'Morocco', venue: 'Reffen' })
    expect(title).toMatch(/RALLY/)
    expect(text).toContain('Brazil v Morocco')
    expect(text).toContain('at Reffen')
    expect(text).toMatch(/find your people/i)
  })
  it('degrades gracefully without a venue', () => {
    expect(shareText({ teamA: 'USA', teamB: 'Paraguay' }).text).toContain('USA v Paraguay')
  })
})

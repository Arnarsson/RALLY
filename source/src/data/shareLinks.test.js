// Unit tests for the SHARE LOOP pure helpers — link building + the guest-join
// param parsing that the bootstrap relies on. No DOM, no Supabase.
import { describe, it, expect } from 'vitest'
import {
  parseShareParams, planShareUrl, planCardUrl, shareText, SHARE_ORIGIN,
  referralCodeFor, referralLink,
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

describe('referralCodeFor (§2 — stable, deterministic referral code)', () => {
  it('is deterministic for the same id (stable across devices)', () => {
    const id = '8c0e1d2f-aaaa-bbbb-cccc-1234567890ab'
    expect(referralCodeFor(id)).toBe(referralCodeFor(id))
  })
  it('has the RALLY-XXXXXX shape (6 uppercase alnum chars)', () => {
    expect(referralCodeFor('some-user-id')).toMatch(/^RALLY-[A-Z0-9]{6}$/)
  })
  it('differs for different ids (low collision)', () => {
    expect(referralCodeFor('user-a')).not.toBe(referralCodeFor('user-b'))
  })
  it('is null-safe (demo mode / pre-auth)', () => {
    expect(referralCodeFor(null)).toBeNull()
    expect(referralCodeFor(undefined)).toBeNull()
    expect(referralCodeFor('')).toBeNull()
  })
})

describe('referralLink (§2 — plan link carrying the sharer code)', () => {
  it('appends the sharer’s ?ref code', () => {
    const code = referralCodeFor('host-1')
    expect(referralLink('p_42', 'host-1')).toBe(`${SHARE_ORIGIN}/p/p_42?ref=${code}`)
  })
  it('round-trips: parseShareParams reads back the planId + ref', () => {
    const url = referralLink('p_99', 'host-2')
    const { pathname, search } = new URL(url)
    const { planId, ref } = parseShareParams({ pathname, search })
    expect(planId).toBe('p_99')
    expect(ref).toBe(referralCodeFor('host-2'))
  })
  it('falls back to a plain plan link when there is no user (demo mode)', () => {
    expect(referralLink('p_7', null)).toBe(`${SHARE_ORIGIN}/p/p_7`)
  })
})

describe('shareText', () => {
  it('writes a SOUL-voice invitation with the venue', () => {
    const { title, text } = shareText({ teamA: 'Brazil', teamB: 'Morocco', venue: 'Reffen' })
    expect(title).toMatch(/RALLY/)
    expect(text).toContain('Brazil v Morocco')
    expect(text).toContain('at Reffen')
    expect(text).toMatch(/don’t watch it alone/i)
  })
  it('degrades gracefully without a venue', () => {
    expect(shareText({ teamA: 'USA', teamB: 'Paraguay' }).text).toContain('USA v Paraguay')
  })
})

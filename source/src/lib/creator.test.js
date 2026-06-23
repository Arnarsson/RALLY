// Tests for the host-tools core: recurrence + capacity unlock. Pure, no React.
import { describe, it, expect } from 'vitest'
import {
  RECURRENCE, recurrenceLabel, isRecurring, spawnNextDraft,
  CAP_UNLOCKS, unlockByKey, nextCapTier, applyCapUnlock,
} from './creator.js'

describe('recurrence', () => {
  it('labels known keys and falls back to One-off', () => {
    expect(recurrenceLabel('weekly')).toBe('Weekly')
    expect(recurrenceLabel('monthly')).toBe('Monthly')
    expect(recurrenceLabel('???')).toBe('One-off')
    expect(RECURRENCE[0].key).toBe('none')
  })
  it('isRecurring is false for one-off / missing, true otherwise', () => {
    expect(isRecurring({ recurrence: 'none' })).toBe(false)
    expect(isRecurring({})).toBe(false)
    expect(isRecurring(null)).toBe(false)
    expect(isRecurring({ recurrence: 'weekly' })).toBe(true)
  })
  it('spawnNextDraft carries the plan and copies (not shares) the access array', () => {
    const rally = { kind: 'run', radius: 'community', title: 'Tue run', blurb: 'b',
      area: 'Søerne', when: 'Tue 18:30', cap: 30, access: ['step-free'], emoji: '🏃',
      recurrence: 'weekly', going: 22, id: 'r_06' }
    const d = spawnNextDraft(rally)
    expect(d).toEqual({ kind: 'run', radius: 'community', title: 'Tue run', blurb: 'b',
      area: 'Søerne', when: 'Tue 18:30', cap: 30, access: ['step-free'], emoji: '🏃', recurrence: 'weekly' })
    expect(d.access).not.toBe(rally.access)   // copied, not the same ref
    expect(d.id).toBeUndefined()              // a fresh instance gets a new id
    expect(d.going).toBeUndefined()
  })
})

describe('capacity unlock (flat fee, never per-head)', () => {
  it('tiers ascend in cap and price, and the free tier is 0', () => {
    expect(CAP_UNLOCKS[0]).toMatchObject({ key: 'free', price: 0 })
    for (let i = 1; i < CAP_UNLOCKS.length; i++) {
      expect(CAP_UNLOCKS[i].cap).toBeGreaterThan(CAP_UNLOCKS[i - 1].cap)
      expect(CAP_UNLOCKS[i].price).toBeGreaterThan(CAP_UNLOCKS[i - 1].price)
    }
  })
  it('unlockByKey resolves and misses cleanly', () => {
    expect(unlockByKey('max').cap).toBe(100)
    expect(unlockByKey('nope')).toBeNull()
  })
  it('nextCapTier finds the next step up, null at the ceiling or when open', () => {
    expect(nextCapTier({ cap: 20 }).key).toBe('plus')
    expect(nextCapTier({ cap: 60 }).key).toBe('max')
    expect(nextCapTier({ cap: 500 })).toBeNull()
    expect(nextCapTier({ cap: null })).toBeNull()   // already unlimited
  })
  it('applyCapUnlock raises the cap immutably and stamps the tier', () => {
    const rally = { id: 'r1', cap: 20, going: 18 }
    const out = applyCapUnlock(rally, 'max')
    expect(out.cap).toBe(100)
    expect(out.capTier).toBe('max')
    expect(rally.cap).toBe(20)               // input untouched
  })
  it('refuses a tier that would not grow the cap', () => {
    const rally = { id: 'r1', cap: 100 }
    expect(applyCapUnlock(rally, 'plus')).toBe(rally)   // 50 <= 100 → no-op
  })
})

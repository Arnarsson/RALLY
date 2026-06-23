// Tests for the rally → Miinto reward mint. Pure, no React, fixed `now`.
import { describe, it, expect } from 'vitest'
import { makeRallyReward, rewardCodeFor, hasRewardFor, REWARD_PCT, REWARD_PARTNER } from './rewards.js'

const NOW = 1_750_000_000_000   // fixed instant for deterministic codes/dates

describe('rewardCodeFor', () => {
  it('derives a shoutable code from the rally code + time salt', () => {
    expect(rewardCodeFor('RLY-LASAGNE', NOW)).toBe('MIINTO15-SAGNE-0000')
  })
  it('is stable for the same inputs and tolerant of junk', () => {
    expect(rewardCodeFor('RLY-LASAGNE', NOW)).toBe(rewardCodeFor('RLY-LASAGNE', NOW))
    expect(rewardCodeFor(null, NOW)).toMatch(/^MIINTO15-RLY-/)
  })
})

describe('makeRallyReward', () => {
  it('builds a discount row in the myDiscounts() shape', () => {
    const r = makeRallyReward('RLY-SAUNA-08', NOW)
    expect(r.partner).toBe(REWARD_PARTNER)
    expect(r.pct).toBe(REWARD_PCT)
    expect(r.redeemed).toBe(false)
    expect(r.source).toBe('rally')
    expect(r.rallyCode).toBe('RLY-SAUNA-08')
    expect(typeof r.code).toBe('string')
    expect(r.created_at).toBe(new Date(NOW).toISOString())
    expect(new Date(r.expires_at).getTime()).toBeGreaterThan(new Date(r.created_at).getTime())
  })
})

describe('hasRewardFor (one reward per rally)', () => {
  const minted = [makeRallyReward('RLY-LASAGNE', NOW)]
  it('is true once a rally has minted, false otherwise', () => {
    expect(hasRewardFor(minted, 'RLY-LASAGNE')).toBe(true)
    expect(hasRewardFor(minted, 'RLY-OTHER')).toBe(false)
  })
  it('guards empty/missing inputs and ignores non-rally codes', () => {
    expect(hasRewardFor([], 'RLY-LASAGNE')).toBe(false)
    expect(hasRewardFor(minted, null)).toBe(false)
    expect(hasRewardFor([{ code: 'X', partner: 'Miinto' }], 'RLY-LASAGNE')).toBe(false)
  })
})

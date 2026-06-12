// Unit tests for the pure data-layer logic that everything else leans on:
// team-pair matching, the form-based win-prob fallback, and Supabase row
// mapping. No network, no Supabase — hasSupabase is false in the test env, so
// the loaders return the mock arrays.
import { describe, it, expect } from 'vitest'
import {
  _key, _formProb, _mapMatchRow,
  loadMatches, loadVenues, loadPlans, loadPlan,
  MATCHES, VENUES, PLANS,
  playerSlug, ratePlayer, unratePlayer, matchRatings, myRatings,
  myReferralCode, ensureReferral, claimReferral, myDiscounts,
  demoPrediction, demoPredictionsForMatch, predictionLabel, matchWinner, predictionOutcome,
} from './mockData.js'
import { activeCategories, isCategoryActive, RATING_CATEGORIES, MAX_PICKS_PER_CATEGORY } from './ratingConfig.js'

describe('_key (team-pair matching)', () => {
  it('is order-independent', () => {
    expect(_key('Mexico', 'South Africa')).toBe(_key('South Africa', 'Mexico'))
  })
  it('strips punctuation/case/spacing so variants collide', () => {
    expect(_key('Bosnia & Herz.', 'Canada')).toBe(_key('bosnia herz', 'CANADA'))
  })
  it('keeps distinct pairings distinct', () => {
    expect(_key('Brazil', 'Morocco')).not.toBe(_key('Brazil', 'Mexico'))
  })
})

describe('_formProb (win-prob fallback)', () => {
  it('returns null when form is missing (bar falls back elsewhere)', () => {
    expect(_formProb('', 'WWW')).toBeNull()
    expect(_formProb('WWW', null)).toBeNull()
  })
  it('produces a normalised distribution that sums to ~1', () => {
    const p = _formProb('WWDLW', 'LDLWD')
    const sum = p.a + p.draw + p.b
    expect(sum).toBeGreaterThan(0.98)
    expect(sum).toBeLessThan(1.02)
  })
  it('gives the stronger recent form the higher win prob', () => {
    const p = _formProb('WWWWW', 'LLLLL')
    expect(p.a).toBeGreaterThan(p.b)
  })
  it('holds the draw weight constant at 0.26', () => {
    expect(_formProb('WWW', 'LLL').draw).toBe(0.26)
  })
})

describe('_mapMatchRow (Supabase row → UI shape)', () => {
  it('maps kickoff_local → kickoff', () => {
    const row = _mapMatchRow({ kickoff_local: '2026-06-11T21:00', form_a: 'W', form_b: 'L' })
    expect(row.kickoff).toBe('2026-06-11T21:00')
  })
  it('fills the form-based prob when the model prob is absent', () => {
    const row = _mapMatchRow({ prob_a: null, prob_b: null, form_a: 'WWW', form_b: 'LLL' })
    expect(row.prob_a).toBeGreaterThan(row.prob_b)
    expect(row.prob_source).toBe('form')
  })
  it('keeps a real model prob untouched', () => {
    const row = _mapMatchRow({ prob_a: 0.5, prob_draw: 0.3, prob_b: 0.2, prob_source: 'dixon_coles' })
    expect(row.prob_a).toBe(0.5)
    expect(row.prob_source).toBe('dixon_coles')
  })
})

describe('loaders fall back to mock data with no Supabase configured', () => {
  it('loadMatches returns the merged MATCHES array', async () => {
    const m = await loadMatches()
    expect(m).toBe(MATCHES)
    expect(m.length).toBeGreaterThan(0)
  })
  it('loadVenues returns the 10 seed venues', async () => {
    const v = await loadVenues()
    expect(v).toBe(VENUES)
    expect(v.length).toBe(10)
  })
  it('loadPlans returns plans carrying participant_ids[]', async () => {
    const plans = await loadPlans()
    expect(Array.isArray(plans)).toBe(true)
    expect(Array.isArray(plans[0].participant_ids)).toBe(true)
  })
  it('loadPlan resolves one seed plan with its match + venue (guest-join)', async () => {
    const seed = PLANS[0]
    const p = await loadPlan(seed.id)
    expect(p).not.toBeNull()
    expect(p.id).toBe(seed.id)
    expect(Array.isArray(p.participant_ids)).toBe(true)
    expect(p.match?.id).toBe(seed.match_id)
    expect(p.venue?.id).toBe(seed.venue_id)
  })
  it('loadPlan returns null for an unknown / missing id', async () => {
    expect(await loadPlan('does-not-exist')).toBeNull()
    expect(await loadPlan(null)).toBeNull()
  })
})

describe('match ratings — player_id slug', () => {
  it('is deterministic — case/spacing-insensitive on (name, team)', () => {
    expect(playerSlug('Pedri Gonzalez', 'Spain')).toBe(playerSlug('pedri  gonzalez', 'SPAIN'))
  })
  it('separates same-name players on different teams', () => {
    expect(playerSlug('Diego Costa', 'Spain')).not.toBe(playerSlug('Diego Costa', 'Brazil'))
  })
})

describe('match ratings — loaders are no-ops without Supabase', () => {
  it('ratePlayer refuses on the demo path', async () => {
    expect(await ratePlayer('m1', 'France', 'p1', 'hot')).toEqual({ ok: false, reason: 'demo' })
  })
  it('unratePlayer refuses on the demo path', async () => {
    expect(await unratePlayer('m1', 'p1', 'hot')).toEqual({ ok: false, reason: 'demo' })
  })
  it('matchRatings / myRatings return null on the demo path', async () => {
    expect(await matchRatings('m1')).toBeNull()
    expect(await myRatings('m1')).toBeNull()
  })
})

describe('§2 referral loaders — degrade cleanly without Supabase (demo mode)', () => {
  it('myReferralCode returns null on the demo path (no backend)', () => {
    // hasSupabase is false in the test env → stub, even with a plausible id.
    expect(myReferralCode('some-auth-uid')).toBeNull()
    expect(myReferralCode(null)).toBeNull()
  })
  it('ensureReferral is a no-op that resolves to null', async () => {
    await expect(ensureReferral('uid')).resolves.toBeNull()
    await expect(ensureReferral(null)).resolves.toBeNull()
  })
  it('claimReferral never throws and resolves to null', async () => {
    await expect(claimReferral('RALLY-ABC123', 'RALLY-SELF00')).resolves.toBeNull()
    await expect(claimReferral(null)).resolves.toBeNull()
  })
  it('claimReferral guards self-referral (same code in and out → null)', async () => {
    await expect(claimReferral('RALLY-SAME00', 'RALLY-SAME00')).resolves.toBeNull()
  })
  it('myDiscounts returns an empty array (reward surface renders clean)', async () => {
    await expect(myDiscounts('uid')).resolves.toEqual([])
    await expect(myDiscounts(null)).resolves.toEqual([])
  })
})

describe('rating kill-switch (ratingConfig)', () => {
  it('all three DB-valid categories are present', () => {
    expect(RATING_CATEGORIES.map((c) => c.id).sort()).toEqual(['best_dressed', 'coolness', 'hot'])
  })
  it('cap is 3', () => {
    expect(MAX_PICKS_PER_CATEGORY).toBe(3)
  })
  it('disabling a category drops it from activeCategories', () => {
    const hot = RATING_CATEGORIES.find((c) => c.id === 'hot')
    expect(isCategoryActive('hot')).toBe(true)
    hot.enabled = false
    expect(isCategoryActive('hot')).toBe(false)
    expect(activeCategories().some((c) => c.id === 'hot')).toBe(false)
    hot.enabled = true   // restore for other tests
  })
})

describe('match-night pick loop (data shape)', () => {
  const pre = { id: 'm1', team_a: 'Brazil', team_b: 'Spain', score_a: null, score_b: null }
  const aWin = { ...pre, score_a: 2, score_b: 1 }
  const draw = { ...pre, score_a: 1, score_b: 1 }

  it('demoPrediction is deterministic per (match, user)', () => {
    expect(demoPrediction(pre, 'u-7')).toEqual(demoPrediction(pre, 'u-7'))
  })
  it('demoPrediction yields a valid outcome pick', () => {
    expect(['team_a', 'draw', 'team_b']).toContain(demoPrediction(pre, 'u-7').pick)
  })
  it('matchWinner reads scores (and is null pre-match)', () => {
    expect(matchWinner(pre)).toBeNull()
    expect(matchWinner(aWin)).toBe('team_a')
    expect(matchWinner(draw)).toBe('draw')
  })
  it('predictionOutcome is pending until the result lands, then right/wrong', () => {
    expect(predictionOutcome(pre, 'team_a')).toBe('pending')
    expect(predictionOutcome(aWin, 'team_a')).toBe('right')
    expect(predictionOutcome(aWin, 'draw')).toBe('wrong')
  })
  it('predictionLabel maps a pick to a human label', () => {
    expect(predictionLabel(pre, 'draw')).toBe('Draw')
    expect(predictionLabel(pre, 'team_a')).toBe('Brazil')
    expect(predictionLabel(pre, 'team_b')).toBe('Spain')
  })
  it('demoPredictionsForMatch always includes ME and dedupes participants', () => {
    const rows = demoPredictionsForMatch(pre, ['u-1', 'u-1', 'u-2'])
    const ids = rows.map((r) => r.user_id)
    expect(new Set(ids).size).toBe(ids.length)          // no dupes
    expect(rows.every((r) => r.user)).toBe(true)        // every row resolves a user for the tally
  })
})

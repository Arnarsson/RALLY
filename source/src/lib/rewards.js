// ---------------------------------------------------------------------------
// rewards.js — the rally → Miinto reward mint (project HEKLA, S3.3).
//
// The football loop already minting today: share a plan → a new person joins →
// the sharer earns one single-use 15% Miinto code (referrals + discount_codes +
// the claim_referral RPC, all in mockData.js). This points that SAME loop at
// rallies: bringing a friend to a rally earns the same reward.
//
// Pure helpers only. In live mode the real mint happens server-side via
// claim_referral (RLS-safe); here we shape the demo reward and de-dupe it so a
// host can't farm codes by re-tapping. A reward's `source:'rally'` + `rallyCode`
// tag it so the rewards surface can say where it came from.
// ---------------------------------------------------------------------------

export const REWARD_PARTNER = 'Miinto'
export const REWARD_PCT = 15

// Stable, shoutable reward code derived from the rally's invite code + a time
// salt (so two rallies don't collide). Pure given (rallyCode, now).
export const rewardCodeFor = (rallyCode, now) => {
  const stem = String(rallyCode || 'RLY').replace(/[^A-Z0-9]/gi, '').slice(-5).toUpperCase() || 'RLY'
  return `MIINTO15-${stem}-${String(now).slice(-4)}`
}

// Build a demo discount row in the SAME shape myDiscounts() returns, so the
// existing rewards surface (Outfit) renders it with no special-casing.
export const makeRallyReward = (rallyCode, now) => ({
  code: rewardCodeFor(rallyCode, now),
  partner: REWARD_PARTNER,
  pct: REWARD_PCT,
  redeemed: false,
  created_at: new Date(now).toISOString(),
  expires_at: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  source: 'rally',
  rallyCode: rallyCode || null,
})

// One reward per rally — has this rally already minted one for the user?
export const hasRewardFor = (discounts, rallyCode) =>
  Array.isArray(discounts) && !!rallyCode &&
  discounts.some((d) => d.source === 'rally' && d.rallyCode === rallyCode)

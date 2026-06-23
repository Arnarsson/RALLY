// ---------------------------------------------------------------------------
// creator.js — host tools: recurring rallies + capacity unlock (HEKLA, S3.1/S3.2).
//
// Hosts are the supply side. Two tools, both pure:
//   1. RECURRENCE — turn a one-off into a standing thing (weekly five-a-side,
//      monthly quiz). spawnNextDraft() makes the next instance's draft.
//   2. CAP_UNLOCK — lift the headcount cap with a FLAT fee, never per-head. This
//      is the monetisation rule from the brief: charge for scale, never for
//      inviting people.
// No React, no backend. A real recurrence rule + host_subscriptions table swap
// in behind hasSupabase later (docs/RALLY-HEKLA-schema.md).
// ---------------------------------------------------------------------------

// --- Recurrence -----------------------------------------------------------
export const RECURRENCE = [
  { key: 'none',        label: 'One-off' },
  { key: 'weekly',      label: 'Weekly' },
  { key: 'fortnightly', label: 'Every 2 weeks' },
  { key: 'monthly',     label: 'Monthly' },
]

export const recurrenceLabel = (key) =>
  (RECURRENCE.find((r) => r.key === key) || RECURRENCE[0]).label

export const isRecurring = (rally) =>
  !!rally && !!rally.recurrence && rally.recurrence !== 'none'

// The draft for the next instance of a recurring rally — same plan, fresh crew.
// Returns a plain draft (feed it to makeRally); never mutates the source.
export const spawnNextDraft = (rally) => ({
  kind: rally.kind,
  radius: rally.radius,
  title: rally.title,
  blurb: rally.blurb,
  area: rally.area,
  when: rally.when,
  cap: rally.cap,
  access: Array.isArray(rally.access) ? [...rally.access] : [],
  emoji: rally.emoji,
  recurrence: rally.recurrence,
})

// --- Capacity unlock (flat fee, never per-head) ---------------------------
export const CAP_UNLOCKS = [
  { key: 'free', cap: 20,  price: 0,   label: 'Free' },
  { key: 'plus', cap: 50,  price: 19,  label: '50 people' },
  { key: 'max',  cap: 100, price: 49,  label: '100 people' },
  { key: 'mega', cap: 500, price: 199, label: '500 people' },
]

export const unlockByKey = (key) => CAP_UNLOCKS.find((u) => u.key === key) || null

// The next tier up from a rally's current cap (null when already at the top).
// A null/open cap is treated as already unlimited → no upsell.
export const nextCapTier = (rally) => {
  if (!rally || rally.cap == null) return null
  return CAP_UNLOCKS.find((u) => u.cap > rally.cap) || null
}

// Apply an unlock: raise the cap to the tier and stamp the tier. Pure — returns
// a new rally. Ignores a tier that wouldn't grow the cap.
export const applyCapUnlock = (rally, tierKey) => {
  const tier = unlockByKey(tierKey)
  if (!rally || !tier) return rally
  if (rally.cap != null && tier.cap <= rally.cap) return rally
  return { ...rally, cap: tier.cap, capTier: tier.key }
}

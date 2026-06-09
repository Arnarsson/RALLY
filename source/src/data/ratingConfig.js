// Match-ratings config + KILL-SWITCH.
// -----------------------------------------------------------------------------
// Every rate-the-match category is declared here. Flip `enabled: false` (or set
// the env var below) to pull a category from the UI instantly — no code surgery,
// no DB change. The DB still accepts the value (the check constraint keeps all
// three valid); the category just stops being offered/tallied in the app.
//
// 'hot' is the sensitive one — it can be disabled fast via either path.
//
// Env override (build-time, optional): VITE_RATINGS_DISABLED="hot,coolness"
// — a comma list of category ids to force-disable regardless of `enabled`.
//
// GUARDRAILS: ratings are of ADULT PRO PLAYERS from the squad layer only. Display
// is aggregate/anonymous. Gender (opt-in) only segments aggregates.

const _disabledEnv = (import.meta.env?.VITE_RATINGS_DISABLED || '')
  .split(',').map((s) => s.trim()).filter(Boolean)

// id MUST match the DB check constraint: 'hot' | 'best_dressed' | 'coolness'.
export const RATING_CATEGORIES = [
  { id: 'hot', label: 'Hot', emoji: '🔥', enabled: true },
  { id: 'best_dressed', label: 'Best dressed', emoji: '👔', enabled: true },
  { id: 'coolness', label: 'Coolest', emoji: '😎', enabled: true },
]

// Max picks a user may make per (match, category). Enforced in the UI and in
// the ratePlayer loader (refuses the 4th).
export const MAX_PICKS_PER_CATEGORY = 3

// The live, kill-switch-respecting list the UI should read.
export const activeCategories = () =>
  RATING_CATEGORIES.filter((c) => c.enabled && !_disabledEnv.includes(c.id))

export const isCategoryActive = (id) => activeCategories().some((c) => c.id === id)

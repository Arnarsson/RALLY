// ---------------------------------------------------------------------------
// standings.js — World Cup group tables, computed from real results.
//
// No invented data: a group letter is parsed from each match's `stage`
// ("Group A · Opening match" → "A"), and the table is built only from matches
// that have actually finished (a real score). Early in the tournament a group
// shows "the table so far" — exactly what you'd want on opening weekend. Pure;
// a real standings endpoint could replace this with identical output.
// ---------------------------------------------------------------------------

// Parse the group letter (A–L for the 48-team, 12-group format) from a stage
// string. Returns null for non-group stages ("Round of 32", "Group Stage", …).
export const parseGroup = (stage) => {
  const m = /group\s+([a-l])\b/i.exec(stage || '')
  return m ? m[1].toUpperCase() : null
}

export const groupOf = (match) => parseGroup(match?.stage)

const isFinished = (m) => m && m.score_a != null && m.score_b != null

const blankRow = (team, flag) => ({ team, flag, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 })

// Apply one finished match to the rows map (mutates the working copy only).
const applyMatch = (rows, m) => {
  const a = (rows[m.team_a] ||= blankRow(m.team_a, m.flag_a))
  const b = (rows[m.team_b] ||= blankRow(m.team_b, m.flag_b))
  const sa = Number(m.score_a), sb = Number(m.score_b)
  a.P++; b.P++
  a.GF += sa; a.GA += sb
  b.GF += sb; b.GA += sa
  if (sa > sb) { a.W++; b.L++; a.Pts += 3 }
  else if (sa < sb) { b.W++; a.L++; b.Pts += 3 }
  else { a.D++; b.D++; a.Pts++; b.Pts++ }
  a.GD = a.GF - a.GA
  b.GD = b.GF - b.GA
}

// Sort a group: points, then goal difference, then goals for, then name.
const sortRows = (rows) =>
  rows.sort((x, y) => (y.Pts - x.Pts) || (y.GD - x.GD) || (y.GF - x.GF) || x.team.localeCompare(y.team))

// All groups: { [letter]: sortedRows }. Only finished matches count.
export const buildStandings = (matches) => {
  const groups = {}
  for (const m of matches || []) {
    const g = groupOf(m)
    if (!g || !isFinished(m)) continue
    const rows = (groups[g] ||= {})
    applyMatch(rows, m)
  }
  const out = {}
  for (const g of Object.keys(groups).sort()) out[g] = sortRows(Object.values(groups[g]))
  return out
}

// The table for the group a given stage belongs to (or [] if not a group / none
// finished yet). Convenience for a single match's contextual table.
export const groupTable = (matches, stage) => {
  const g = parseGroup(stage)
  if (!g) return []
  return buildStandings(matches)[g] || []
}

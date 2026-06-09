// =============================================================================
// RALLY — Theme system
// Two palettes: 'classic' (current look, faithful to the existing tokens) and
// 'floodlight' (brighter neon system on deep ink).
//
// ACTIVE_THEME is the single toggle. Flip 'floodlight' → 'classic' to revert.
// =============================================================================

export const ACTIVE_THEME = 'floodlight'

// Classic palette — faithful capture of the current App.jsx / tailwind.config.js values.
// These match tailwind.config.js exactly so the 'classic' theme restores today's look.
const classic = {
  '--bg':        '#0B0B0B',   // night (page bg)
  '--card':      '#161616',   // panel (card bg)
  '--card2':     '#1F1F1F',   // panel2 (raised/selected)
  '--line':      '#2A2A2A',   // line (borders)
  '--text':      '#F4F2EC',   // cream (foreground text)
  '--muted':     '#8a8a82',   // cream/40 equivalent
  '--lime':      '#8ACE00',   // lime hero
  '--pink':      '#FF3E9A',   // pink accent
  '--blue':      '#2A5BFF',   // blue accent
  '--purple':    '#7B3FF2',   // purple accent
  '--flame':     '#FF5A1F',   // flame accent
  '--cyan':      '#2A5BFF',   // same as blue in classic
  '--violet':    '#7B3FF2',   // same as purple in classic
  '--paper':     '#F4F2EC',   // same as cream
  // background gradient (none in classic — plain dark)
  '--bg-gradient': 'none',
  // card gradient (none in classic — flat panel)
  '--card-gradient': 'none',
  // match card spine (none in classic)
  '--card-spine-width': '0px',
  // neon glow multiplier (0 = off in classic)
  '--lime-glow': '0',
  '--pink-glow-blur': '0px',
  '--cyan-opacity': '0',
}

// Floodlight palette — brighter neon system on deep ink.
// Per-match accents (--teamA / --teamB) are set dynamically per card in App.jsx.
const floodlight = {
  '--bg':        '#0B0B0B',
  '--card':      '#121212',
  '--card2':     '#1a1a1a',
  '--line':      '#242424',
  '--text':      '#F5F5F1',
  '--muted':     '#9b9b93',
  '--lime':      '#A8FF00',
  '--pink':      '#FF2D7A',
  '--blue':      '#2A5BFF',
  '--purple':    '#7B61FF',
  '--flame':     '#FF5A1F',
  '--cyan':      '#00C2FF',
  '--violet':    '#7B61FF',
  '--paper':     '#F3F0E8',
  // page-level ambient gradient
  '--bg-gradient':
    'radial-gradient(1200px 600px at 80% -10%, rgba(168,255,0,.07), transparent 60%), ' +
    'radial-gradient(900px 500px at -10% 20%, rgba(123,97,255,.08), transparent 55%)',
  // card base gradient
  '--card-gradient': 'linear-gradient(180deg, #121212, #0B0B0B)',
  // left spine
  '--card-spine-width': '5px',
  // glow flags
  '--lime-glow': '1',
  '--pink-glow-blur': '18px',
  '--cyan-opacity': '1',
}

const PALETTES = { classic, floodlight }

/**
 * Returns a flat { varName: value } object for the active theme.
 */
export function getActiveVars() {
  return PALETTES[ACTIVE_THEME] || PALETTES.classic
}

/**
 * Returns just the theme name string (for data-theme attribute / CSS selectors).
 */
export function getThemeName() {
  return ACTIVE_THEME
}

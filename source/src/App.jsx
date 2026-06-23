import { Component, useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import {
  VIBES, USERS, ME, userById, FLAGS,
  venueById,
  MATCHES, matchById,
  PLANS as SEED_PLANS,
  hasSupabase, ensureAuth, saveProfile, hydrateFromSupabase,
  loadPlans, loadPlan, subscribeRealtime, joinPlan, leavePlan, createPlanRow,
  myReferralCode, ensureReferral, claimReferral, myDiscounts,
} from './data/mockData.js'
import { parseShareParams, planShareUrl, planCardUrl, shareText, referralLink } from './data/shareLinks.js'
import { FLAG_PNG } from './data/flags.js'
import { HERO_IMG, HERO_GENERIC } from './data/heroImages.js'
import { rallyById, RALLIES } from './data/rallies.js'
import { communityById } from './data/communities.js'
import { makeRally, applyToggleJoin } from './lib/rallyState.js'
import { SPLASH_IMG } from './data/splashImage.js'
import { ACTIVE_THEME } from './theme.js'
import PosterCard from './components/PosterCard'
import { pushSupported, pushStatus, enablePush } from './lib/push'
import { followMatch, unfollowMatch, loadMyFollows } from './lib/follows'

// Code-split: every screen past Tonight is lazy. The initial chunk only carries
// the splash + onboarding + Tonight (MatchesScreen), so the critical mobile
// download that gates first paint stays small. These chunks fetch on demand when
// you navigate into a match / plan / outfit / leaders. (The standalone single-
// file build re-inlines them all via vite-plugin-singlefile — see vite.config.)
const MatchScreen = lazy(() => import('./screens/MatchScreen.jsx'))
const PlanScreen = lazy(() => import('./screens/PlanScreen.jsx'))
const CreateScreen = lazy(() => import('./screens/CreateScreen.jsx'))
const OutfitScreen = lazy(() => import('./screens/OutfitScreen.jsx'))
const LeadersScreen = lazy(() => import('./screens/LeadersScreen.jsx'))
const RalliesScreen = lazy(() => import('./screens/RalliesScreen.jsx'))
const RallyScreen = lazy(() => import('./screens/RallyScreen.jsx'))
const CreateRallyScreen = lazy(() => import('./screens/CreateRallyScreen.jsx'))
const CommunityScreen = lazy(() => import('./screens/CommunityScreen.jsx'))

// A dropped chunk or a render error must never white-screen a guest arriving on
// a shared link. Catch it, keep the lights on, offer the retry. A stale chunk
// after a redeploy needs a full reload so the new chunk refetches.
const isChunkError = (err) => err && (err.name === 'ChunkLoadError'
  || /Loading chunk|Failed to fetch dynamically imported module/.test(err.message || ''))

export class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[rally] render error', error, info?.componentStack) }
  retry = () => {
    if (isChunkError(this.state.error)) { location.reload(); return }
    this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-[70vh] w-full flex flex-col items-center justify-center text-center px-8 bg-night text-cream">
        <div className="font-display text-3xl uppercase tracking-tight text-lime leading-none">Lost the feed</div>
        <p className="flourish text-xl text-cream/70 mt-3">even the best grounds drop the signal. run it back.</p>
        <button onClick={this.retry}
          className="mt-7 rounded-full bg-lime text-night font-bold uppercase tracking-widest px-8 py-3.5 active:scale-[0.98] transition">
          Run it back
        </button>
      </div>
    )
  }
}

// ===========================================================================
// RALLY — editorial football-culture design system, DARK (white on black).
// Archivo Black headlines, Instrument Serif italic accents (.flourish),
// Inter body, lime/pink/blue/purple pop palette.
//
// Theme: ACTIVE_THEME is imported from theme.js — 'floodlight' (default) or
// 'classic'. CSS variables are applied by main.jsx at startup. Match cards
// use flCard*/flPhoto* helpers below for Floodlight-specific visual treatment.
// ===========================================================================

export const NIGHT = '#0B0B0B'
const IS_FLOODLIGHT = ACTIVE_THEME === 'floodlight'

// ---------------------------------------------------------------------------
// Floodlight match card helpers
// These return inline-style objects that power the Floodlight card treatment:
// left team-colour spine, dual corner glow, halftone photo overlay, neon pills.
// Classic theme: all these return empty objects / null.
// ---------------------------------------------------------------------------

/** Outer card container: team-colour spine + box shadow + gradient bg */
function flCardStyle(colorA, colorB) {
  if (!IS_FLOODLIGHT) return {}
  const a = colorA || '#8ACE00'
  const b = colorB || '#2A5BFF'
  return {
    background: 'linear-gradient(180deg, #121212, #0B0B0B)',
    borderColor: 'var(--line, #242424)',
    boxShadow: `0 0 0 1px rgba(168,255,0,0.04), 0 18px 40px -24px rgba(0,0,0,0.9)`,
  }
}

/** Pseudo-spine element: a 5px left strip with teamA→teamB gradient */
function FlSpine({ colorA, colorB }) {
  if (!IS_FLOODLIGHT) return null
  const a = colorA || '#8ACE00'
  const b = colorB || '#2A5BFF'
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, zIndex: 3,
        background: `linear-gradient(180deg, ${a}, ${b})`,
        borderTopLeftRadius: 24, borderBottomLeftRadius: 24,
      }}
    />
  )
}

/** Photo shade overlay: fade to ink + dual team-colour corner glow */
function flPhotoShadeStyle(colorA, colorB) {
  if (!IS_FLOODLIGHT) return { background: 'linear-gradient(180deg, rgba(11,11,11,0) 35%, #161616 100%)' }
  const a = colorA || '#8ACE00'
  const b = colorB || '#2A5BFF'
  return {
    background: [
      'linear-gradient(180deg, rgba(11,11,11,0) 28%, #0B0B0B 96%)',
      `linear-gradient(115deg, color-mix(in srgb, ${a} 55%, transparent), transparent 42%)`,
      `linear-gradient(245deg, color-mix(in srgb, ${b} 50%, transparent), transparent 42%)`,
    ].join(', '),
  }
}

/** Halftone overlay for photo area (Floodlight only) */
function FlHalftone() {
  if (!IS_FLOODLIGHT) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, opacity: 0.16, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 0.7px, transparent 0.8px)',
        backgroundSize: '4px 4px',
        mixBlendMode: 'overlay',
      }}
    />
  )
}

/** TV chip inline style (Floodlight: cyan, borderless bg) */
function flTvChipStyle() {
  if (!IS_FLOODLIGHT) return {}
  return {
    color: 'var(--cyan, #00C2FF)',
    borderColor: 'color-mix(in srgb, #00C2FF 40%, transparent)',
    background: 'transparent',
  }
}

/** LIVE pill inline style (Floodlight: neon pink + glow) */
function flLivePillStyle() {
  if (!IS_FLOODLIGHT) return {}
  return {
    background: 'var(--pink, #FF2D7A)',
    color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 0 18px rgba(255,45,122,0.5)',
  }
}

/** Kickoff time inline style (Floodlight: lime + subtle glow) */
function flKickStyle() {
  if (!IS_FLOODLIGHT) return {}
  return { textShadow: '0 0 16px rgba(168,255,0,0.45)' }
}

/** CSS variables to set on a per-card container for teamA/teamB */
function flTeamVars(colorA, colorB) {
  if (!IS_FLOODLIGHT) return {}
  return {
    '--teamA': colorA || '#8ACE00',
    '--teamB': colorB || '#2A5BFF',
  }
}

const UserCtx = createContext(userById)
export const useResolve = () => useContext(UserCtx)

// Placeholder photography. Real shots (brand shoots / Miinto feed) drop in here.
// Grayscale to match the brand's B&W documentary look; reliable, no API key.
const photo = (seed, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}?grayscale`

export function Img({ seed, h = 'h-full', gradient = true, className = '' }) {
  return (
    <div className={'relative overflow-hidden bg-panel ' + h + ' ' + className}>
      <img src={photo(seed)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'rgba(138,206,0,0.10)', mixBlendMode: 'overlay' }} />
      {gradient && <div className="absolute inset-0 bg-gradient-to-t from-night via-night/35 to-night/5" />}
    </div>
  )
}

// --- helpers ---------------------------------------------------------------
export function Avatar({ user, size = 32, ring = true }) {
  return (
    <div
      className={'relative flex items-center justify-center rounded-full font-bold text-white shrink-0 ' + (ring ? 'ring-2 ring-night' : '')}
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.42 }}
      title={user.name}
    >
      {user.id === 'u_me' ? '★' : user.name[0]}
      <span className="absolute -bottom-1 -right-1 text-[11px]" style={{ lineHeight: 1 }}>{user.flag}</span>
    </div>
  )
}

export function AvatarStack({ ids, max = 5, size = 30 }) {
  const resolve = useResolve()
  const shown = ids.slice(0, max)
  const extra = ids.length - shown.length
  return (
    <div className="flex items-center">
      <div className="flex" style={{ marginRight: extra > 0 ? 6 : 0 }}>
        {shown.map((id, i) => (
          <div key={id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
            <Avatar user={resolve(id)} size={size} />
          </div>
        ))}
      </div>
      {extra > 0 && <span className="text-xs font-bold text-cream/50">+{extra}</span>}
    </div>
  )
}

export function VibeTag({ vibe, small = false }) {
  const v = VIBES[vibe]
  if (!v) return null
  const txt = v.color === '#8ACE00' ? NIGHT : '#FFFFFF'
  return (
    <span
      className={'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ' + (small ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]')}
      style={{ background: v.color, color: txt }}
    >
      {v.label}
    </span>
  )
}

// Where to watch a channel live (Danish streaming services).
function watchURL(name) {
  if (!name) return null
  if (/^DR/i.test(name)) return 'https://www.dr.dk/drtv/kategorier/sport/fodbold'
  if (/TV ?2/i.test(name)) return 'https://play.tv2.dk'
  return null
}

export function TvChips({ tv, small = false }) {
  if (!tv || !tv.length) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tv.map((c) => {
        const url = watchURL(c.name)
        // Floodlight: free channels get cyan pill; paid get ghost with cyan text.
        // Classic: free get lime pill; paid get ghost.
        const clsBase = 'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ' +
          (small ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]')
        const clsVariant = IS_FLOODLIGHT
          ? 'border border-current/25 text-current opacity-90'
          : (c.free ? 'bg-lime text-night' : 'border border-current/25 text-current opacity-80')
        const cls = clsBase + ' ' + clsVariant
        const chipStyle = IS_FLOODLIGHT ? flTvChipStyle() : {}
        const text = `${c.name}${c.free ? ' · free' : ''}`
        if (!url) return <span key={c.name} className={cls} style={chipStyle}>{url ? <span aria-hidden className="text-[0.8em] leading-none">▶</span> : null}{text}</span>
        return (
          <a key={c.name} href={url} target="_blank" rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cls + ' active:scale-95 transition'} style={chipStyle} title={'Watch live · ' + c.name}>
            <span aria-hidden className="text-[0.8em] leading-none">▶</span>{text}
          </a>
        )
      })}
    </div>
  )
}

// --- live status (real-time data) -----------------------------------------
// Recent form, e.g. "WWWDD" -> coloured pips.
const FORM_COLOR = { W: '#8ACE00', D: '#8a8a8a', L: '#FF5A1F' }
const FORM_LABEL = { W: 'Win', D: 'Draw', L: 'Loss' }
export function FormPips({ form }) {
  if (!form) return null
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {form.split('').slice(0, 5).map((r, i) => (
        <span key={i} title={FORM_LABEL[r] || r} className="w-1.5 h-1.5 rounded-full" style={{ background: FORM_COLOR[r] || '#555' }} />
      ))}
    </span>
  )
}
export function FormLegend() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[8px] uppercase tracking-wide text-cream/30">
      {['W', 'D', 'L'].map((r) => (
        <span key={r} className="inline-flex items-center gap-0.5" title={FORM_LABEL[r]}>
          <span className="w-1 h-1 rounded-full" style={{ background: FORM_COLOR[r] }} />{r}
        </span>
      ))}
    </span>
  )
}

// Realtime clock for the desktop phone-frame status bar (hidden on real phones).
function Clock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 20000); return () => clearInterval(id) }, [])
  return <span>{t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
}

// Kickoff time, or live score + minute, or full-time score — right side of a card.
function KickClock({ m }) {
  if (m.status === 'in') return (
    <div className="text-right shrink-0">
      <div className="flex items-center justify-end gap-1 text-pink text-[10px] font-bold uppercase tracking-wide"
        style={IS_FLOODLIGHT ? flLivePillStyle() : {}}>
        <span className="w-1.5 h-1.5 rounded-full bg-pink animate-pulse" />LIVE {m.clock}
      </div>
      <div className="font-display text-3xl leading-none">{m.score_a}–{m.score_b}</div>
    </div>
  )
  if (m.status === 'post' || m.completed) return (
    <div className="text-right shrink-0">
      <div className="text-[10px] font-bold uppercase tracking-wide text-cream/40">Full time</div>
      <div className="font-display text-3xl leading-none">{m.score_a}–{m.score_b}</div>
    </div>
  )
  return (
    <div className="text-right shrink-0">
      <div className="font-display text-3xl leading-none text-lime" style={flKickStyle()}>{m.kickoff.slice(11, 16)}</div>
      <div className="text-[10px] uppercase tracking-wide text-lime/90 mt-0.5"><Countdown to={m.kickoff_utc} max={72} /></div>
    </div>
  )
}

// One-line match status for detail headers.
export function MatchStatusLine({ m }) {
  if (m.status === 'in') return <span className="text-pink">● LIVE {m.score_a}–{m.score_b} · {m.clock}</span>
  if (m.status === 'post' || m.completed) return <span>full time · {m.score_a}–{m.score_b}</span>
  return <span>kickoff {m.kickoff.slice(11, 16)}</span>
}

// Match artwork built from the actual teams — national colours +
// flags. Always matches the game on screen, never a random stock photo.
// Crisp flag images (flagcdn) from a flag emoji — sharper than emoji and
// consistent across platforms (emoji flags don't render on Windows).
function flagURL(emoji, team) {
  // Prefer the bundled flag (no network); fall back to the CDN, then emoji.
  if (emoji === '🏴') {
    const t = (team || '').toLowerCase()
    const k = t.includes('scot') ? 'gb-sct' : t.includes('wal') ? 'gb-wls' : 'gb-eng'
    return FLAG_PNG[k] || `https://flagcdn.com/h40/${k}.png`
  }
  const cp = [...(emoji || '')].map((c) => c.codePointAt(0))
  if (cp.length === 2 && cp[0] >= 0x1F1E6 && cp[0] <= 0x1F1FF) {
    const iso = String.fromCharCode(cp[0] - 0x1F1E6 + 97) + String.fromCharCode(cp[1] - 0x1F1E6 + 97)
    return FLAG_PNG[iso] || `https://flagcdn.com/h40/${iso}.png`
  }
  return null
}
export function FlagImg({ emoji, team, size = 20, className = '' }) {
  const url = flagURL(emoji, team)
  if (!url) return <span style={{ fontSize: size }}>{emoji}</span>
  return <img src={url} alt="" loading="lazy" className={'inline-block rounded-[2px] object-cover align-middle ' + className}
    style={{ height: size, width: 'auto' }} />
}

export function MatchArt({ m, className = '', credit = false }) {
  const a = m.color_a || '#8ACE00'
  const b = m.color_b || '#2A5BFF'
  // 1) Real archive photo of this fixture — B&W, grained, faintly team-tinted.
  if (m.archive) {
    return (
      <div className={'relative overflow-hidden bg-night ' + className}>
        <img src={m.archive.src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.opacity = 0 }}
          style={{ filter: IS_FLOODLIGHT ? 'grayscale(1) contrast(1.05) brightness(0.80)' : 'grayscale(1) contrast(1.06) brightness(0.82)' }} />
        <div className="absolute inset-0 grain opacity-30" />
        {/* Floodlight: dual team-corner glow replaces the simple gradient tint */}
        {IS_FLOODLIGHT ? (
          <div className="absolute inset-0" style={flPhotoShadeStyle(a, b)} />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: `linear-gradient(112deg, ${a} 0%, transparent 45%, ${b} 100%)`, mixBlendMode: 'overlay', opacity: 0.45 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-night via-night/35 to-night/5" />
          </>
        )}
        {IS_FLOODLIGHT && <FlHalftone />}
        {credit && m.archive.credit && (
          <div className="absolute top-1.5 right-2 text-[8px] uppercase tracking-wide text-cream/40">{m.archive.credit}</div>
        )}
      </div>
    )
  }
  // 2) No photo (or first-ever meeting) — a DARK editorial panel that lives in
  // the same moody, grained family as the B&W photos. Team colours appear only
  // as faint glows; crisp flags carry the identity. No bright gradient.
  return (
    <div className={'relative overflow-hidden bg-night ' + className}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 120% at 0% 0%, ${a} 0%, transparent 50%), radial-gradient(120% 120% at 100% 100%, ${b} 0%, transparent 50%)`, opacity: IS_FLOODLIGHT ? 0.30 : 0.22 }} />
      <div className="absolute inset-0 grain opacity-45" />
      {IS_FLOODLIGHT && <FlHalftone />}
      <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-4 pt-5">
        <FlagImg emoji={m.flag_a} team={m.team_a} size={40} className="-rotate-3 shadow-2xl ring-1 ring-white/10" />
        <span className="font-display text-cream/35 text-sm leading-none">v</span>
        <FlagImg emoji={m.flag_b} team={m.team_b} size={40} className="rotate-3 shadow-2xl ring-1 ring-white/10" />
      </div>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(11,11,11,0.92) 0%, rgba(11,11,11,0.35) 46%, transparent 76%)' }} />
    </div>
  )
}

// Self-ticking countdown to kickoff (only shows within `max` hours).
function Countdown({ to, max = 72 }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t) }, [])
  if (!to) return null
  const diff = new Date(to) - new Date()
  if (diff <= 0 || diff > max * 3.6e6) return null
  const h = Math.floor(diff / 3.6e6), mm = Math.floor((diff % 3.6e6) / 6e4), d = Math.floor(h / 24)
  return <span>{d >= 1 ? `in ${d}d ${h % 24}h` : h >= 1 ? `in ${h}h ${mm}m` : `in ${mm}m`}</span>
}

export function Pill({ children, onClick, color = 'lime', className = '' }) {
  const map = {
    lime: 'bg-lime text-night',
    ghost: 'bg-panel2 text-cream border border-line',
    pink: 'bg-pink text-white',
  }
  return (
    <button onClick={onClick} className={'rounded-full font-bold py-3.5 px-6 active:scale-[0.98] transition ' + map[color] + ' ' + className}>
      {children}
    </button>
  )
}

// Goal-alerts opt-in. Hidden entirely where web push can't work (file:// /
// unsupported). Reflects the live permission state; lime when on, ghost to opt in.
export function GoalAlertsPill({ myId, className = '' }) {
  const [status, setStatus] = useState(() => pushStatus())
  if (!pushSupported() || status === 'denied') return null // nothing tasteful to show
  const on = status === 'granted'
  const enable = async () => {
    if (on) return
    const r = await enablePush(myId)
    setStatus(pushStatus())
    return r
  }
  return (
    <button
      onClick={enable}
      disabled={on}
      className={'rounded-full font-bold text-[11px] uppercase tracking-[0.12em] py-2 px-3.5 active:scale-[0.98] transition '
        + (on ? 'bg-lime text-night' : 'bg-night/40 text-cream border border-cream/25 backdrop-blur-sm ') + className}>
      {on ? 'Goal alerts on ✓' : '🔔 Goal alerts'}
    </button>
  )
}

// --- AI rundown ------------------------------------------------------------
export function Rundown({ text }) {
  const [playing, setPlaying] = useState(false)
  const [open, setOpen] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  const toggle = () => {
    if (!supported) { setOpen(true); return }
    const synth = window.speechSynthesis
    if (playing) { synth.cancel(); setPlaying(false); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.07; u.pitch = 1.1
    const voices = synth.getVoices() || []
    const pick = voices.find((v) => /Daniel|Arthur|Aaron|Fred|Gordon/i.test(v.name)) ||
      voices.find((v) => /en-GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang))
    if (pick) u.voice = pick
    u.onend = () => setPlaying(false)
    u.onerror = () => setPlaying(false)
    synth.speak(u); setPlaying(true)
  }

  return (
    <div className="rounded-2xl bg-panel border border-line p-4 mb-5">
      <div className="flex items-center gap-3">
        <button onClick={toggle}
          className={'w-12 h-12 rounded-full flex items-center justify-center text-lg shrink-0 active:scale-90 transition ' +
            (playing ? 'bg-pink text-white' : 'bg-lime text-night')}>
          {playing ? '◼' : '▶'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flourish text-xl leading-none text-lime">the lowdown</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream/45 mt-1">30-sec AI hype · both teams</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-[10px] uppercase tracking-wide text-cream/45 underline shrink-0">{open ? 'hide' : 'script'}</button>
      </div>
      {open && <p className="text-sm text-cream/75 leading-relaxed mt-3 border-t border-line pt-3">{text}</p>}
      {!supported && <p className="text-[11px] text-cream/40 mt-2">Audio needs a modern browser — script shown above.</p>}
    </div>
  )
}

// ===========================================================================
// App
// ===========================================================================
export default function App() {
  const [profile, setProfile] = useState(ME)
  const [onboarded, setOnboarded] = useState(false)
  const [plans, setPlans] = useState(SEED_PLANS)
  // The rally coordination loop (demo mode): the feed lives in state so created
  // rallies + join/leave count changes show instantly. rallyStatus maps a rally
  // id → 'in' | 'waitlist' for the current user. A real rallies table swaps in
  // behind hasSupabase later (docs/RALLY-HEKLA-schema.md) — same shape.
  const [rallies, setRallies] = useState(RALLIES)
  const [rallyStatus, setRallyStatus] = useState({})
  const [stack, setStack] = useState([{ name: 'matches' }])
  const [tab, setTab] = useState('tonight')
  const [share, setShare] = useState(null)
  const [beer, setBeer] = useState(false)
  const [splash, setSplash] = useState(true)
  const [, setRev] = useState(0)            // bump to re-render after live hydration
  // §2 REFERRAL — the user's earned Miinto rewards + a one-time nudge toast when
  // a fresh reward lands (someone joined their RALLY).
  const [discounts, setDiscounts] = useState([])
  const [referralNudge, setReferralNudge] = useState(null)
  // ADD-TO-HOME-SCREEN — one-time iOS-Safari install hint (see InstallHint).
  const [installHint, setInstallHint] = useState(false)
  // FOLLOW — match ids the user has starred to get goal alerts (no party needed).
  // A Set, loaded from match_follows after auth (live) or kept local (demo).
  // `followNudge` flashes a one-line in-voice toast on toggle ('on' | 'off').
  const [follows, setFollows] = useState(() => new Set())
  const [followNudge, setFollowNudge] = useState(null)

  // SHARE LOOP — a guest arriving via a shared link (/p/<id> or ?p=<id>). We
  // capture the planId once on mount and route straight to that plan after
  // onboarding (no account wall). ?ref is stashed for §2 referrals (no logic).
  const [guestPlanId] = useState(() => {
    try { return parseShareParams(window.location).planId } catch { return null }
  })

  // Identity: the Supabase auth uid once signed in, else the mock "me".
  const myId = profile?.id || ME.id

  // Stash any ?ref code for §2 (referral credit) — capture only, no logic here.
  useEffect(() => {
    try {
      const { ref } = parseShareParams(window.location)
      if (ref) localStorage.setItem('rally_ref', ref)
    } catch { /* no-op (file:// / no localStorage) */ }
  }, [])

  // A guest arriving on a shared link gets a shorter — but still visible — splash
  // so the brand moment lands before we route them to the invite. (600ms flashed
  // by so fast it read as "no splash"; 1500ms is perceptible yet still snappy.)
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), guestPlanId ? 1500 : 2200)
    return () => clearTimeout(t)
  }, [guestPlanId])

  // Backend bootstrap — no-op on the standalone demo (hasSupabase === false).
  // Anonymous auth → profile, hydrate the live arrays in place, then subscribe
  // to realtime so scores + going-counts stay live across devices.
  useEffect(() => {
    if (!hasSupabase) return
    let unsub = () => {}
    let alive = true
    ;(async () => {
      const auth = await ensureAuth()
      if (auth && alive) setProfile((p) => ({ ...p, id: auth.id, ...(auth.profile || {}) }))
      // FOLLOW — pull the user's starred matches so the stars render in the
      // followed state across devices/sessions.
      if (auth?.id) {
        const f = await loadMyFollows(auth.id)
        if (alive) setFollows(f)
      }
      const res = await hydrateFromSupabase()
      if (res && alive) { setPlans(res.plans); setRev((r) => r + 1) }
      // Guest-join: make sure the shared plan is present even if it's brand-new
      // (created after this device's last hydrate).
      if (guestPlanId && alive) {
        const has = (res?.plans || []).some((p) => p.id === guestPlanId)
        if (!has) {
          const gp = await loadPlan(guestPlanId)
          if (gp && alive) setPlans((ps) => (ps.some((p) => p.id === gp.id) ? ps : [gp, ...ps]))
        }
      }
      // §2 REFERRAL — close the viral loop, all guarded behind a real auth uid.
      if (auth?.id && alive) {
        // (a) Sharer side: ensure a pending referral row exists for MY code so a
        //     future invitee's claim_referral(code) can find it.
        ensureReferral(auth.id)
        // (b) Invitee side: if a ?ref was stashed by §1 (and isn't my own code),
        //     redeem it ONCE via the RPC, then clear it so it can't re-fire.
        try {
          const stashed = localStorage.getItem('rally_ref')
          if (stashed) {
            const claimed = await claimReferral(stashed, myReferralCode(auth.id))
            localStorage.removeItem('rally_ref')
            if (claimed && alive) setReferralNudge('joined')   // welcome the invitee
          }
        } catch { /* no localStorage (file://) — nothing to claim */ }
        // (c) Reward surface + nudge: load my earned codes; if a brand-new one
        //     landed since last app load, nudge the sharer ("someone joined").
        const codes = await myDiscounts(auth.id)
        if (alive) {
          setDiscounts(codes)
          try {
            const top = codes[0]?.code
            const seen = localStorage.getItem('rally_reward_seen')
            if (top && top !== seen) {
              localStorage.setItem('rally_reward_seen', top)
              // Only nudge the SHARER here (the invitee already got their welcome).
              setReferralNudge((n) => n || 'rewarded')
            }
          } catch { /* no localStorage — skip the nudge, codes still show */ }
        }
      }
      unsub = subscribeRealtime(async (kind) => {
        if (!alive) return
        if (kind === 'plans') setPlans(await loadPlans())
        else { await hydrateFromSupabase(); setRev((r) => r + 1) }
      })
    })()
    return () => { alive = false; unsub() }
  }, [])

  // Open every pushed view at the top (so a match detail never starts mid-page).
  useEffect(() => {
    const el = document.getElementById('rally-scroll')
    if (el) el.scrollTo({ top: 0 })
  }, [stack])

  // SHARE LOOP — once a guest is onboarded and the shared plan is loaded, route
  // the view-stack straight to that plan's detail (with the one-tap Join CTA).
  // Runs once. On the demo path the plan comes from the seed PLANS so /p/ links
  // still open the prototype.
  const [guestRouted, setGuestRouted] = useState(false)
  useEffect(() => {
    if (!guestPlanId || guestRouted || splash || !onboarded) return
    const target = plans.find((p) => p.id === guestPlanId)
    if (!target) return
    setStack([{ name: 'matches' }, { name: 'plan', planId: guestPlanId }])
    setGuestRouted(true)
  }, [guestPlanId, guestRouted, splash, onboarded, plans])

  // ADD-TO-HOME-SCREEN — surface the install hint only once the user is actually
  // in the app (past splash + onboarding), and only for iOS Safari users who
  // aren't already installed. The short delay keeps it from popping in mid-render
  // so it reads as a gentle nudge, not a jarring banner ad.
  useEffect(() => {
    if (splash || !onboarded || !shouldShowA2HS()) return
    const t = setTimeout(() => setInstallHint(true), 2500)
    return () => clearTimeout(t)
  }, [splash, onboarded])
  const dismissInstallHint = () => {
    setInstallHint(false)
    try { localStorage.setItem(A2HS_KEY, '1') } catch { /* file:// — fine, it just re-checks next session */ }
  }

  const resolve = (id) => (id === myId ? profile : (userById(id) || profile))
  const view = stack[stack.length - 1]
  const push = (v) => setStack((s) => [...s, v])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const resetTo = (v) => setStack([v])
  const goTab = (t) => { setTab(t); resetTo(t === 'tonight' ? { name: 'matches' } : t === 'rallies' ? { name: 'rallies' } : t === 'outfit' ? { name: 'outfit' } : { name: 'leaders' }) }

  const isJoined = (plan) => plan.participant_ids.includes(myId)
  const toggleJoin = (planId) => {
    // Decide intent from the current snapshot (NOT inside the setState updater —
    // StrictMode double-invokes updaters, which would flip willJoin on the 2nd
    // pass and break the side-effects below).
    const cur = plans.find((p) => p.id === planId)
    if (!cur) return
    const willJoin = !cur.participant_ids.includes(myId)
    const nextPlan = {
      ...cur,
      participant_ids: willJoin
        ? [...cur.participant_ids, myId]
        : cur.participant_ids.filter((id) => id !== myId),
    }
    setPlans((ps) => ps.map((p) => (p.id === planId ? nextPlan : p)))
    if (hasSupabase) (willJoin ? joinPlan : leavePlan)(planId, myId)   // realtime echoes to others
    // SHARE LOOP — going is the moment to recruit: surface the share sheet so
    // every "I'm going" can pull a friend in. (Only on join, not on leave.)
    if (willJoin) setShare(nextPlan)
  }
  // FOLLOW — star/unstar a match for goal alerts (no party join required).
  // Optimistic: flip the Set immediately, then persist. On the FIRST-ever follow
  // we also ask for push permission so the alert can actually land — but a
  // denied/unsupported prompt never blocks the follow (the row still gets
  // written; they just won't get the push until they enable it elsewhere).
  const toggleFollow = (matchId) => {
    if (!matchId) return
    const willFollow = !follows.has(matchId)
    const wasEmpty = follows.size === 0
    setFollows((prev) => {
      const next = new Set(prev)
      if (willFollow) next.add(matchId)
      else next.delete(matchId)
      return next
    })
    setFollowNudge(willFollow ? 'on' : 'off')
    if (hasSupabase) (willFollow ? followMatch : unfollowMatch)(matchId, myId)
    // First follow of the session → make sure they can receive the alert.
    if (willFollow && wasEmpty) enablePush(myId)   // fails soft; never blocks
  }
  const createPlan = ({ match_id, venue_id, time, vibe, note }) => {
    const id = 'p_' + Math.random().toString(36).slice(2, 7)
    const plan = { id, match_id, venue_id, host_id: myId, time, vibe, note: note || '', participant_ids: [myId], capacity_hint: 30 }
    setPlans((ps) => [plan, ...ps])
    if (hasSupabase) {
      createPlanRow({ match_id, venue_id, host_id: myId, time, vibe, note, capacity_hint: 30 })
        .then((realId) => {
          if (!realId) return
          setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, id: realId } : p)))
          // Re-point the open stack + share sheet at the persisted id so the
          // shared link resolves for guests.
          setStack((s) => s.map((v) => (v.name === 'plan' && v.planId === id ? { ...v, planId: realId } : v)))
          setShare((sh) => (sh && sh.id === id ? { ...sh, id: realId } : sh))
        })
    }
    resetTo({ name: 'matches' }); push({ name: 'match', matchId: match_id }); push({ name: 'plan', planId: id })
    // SHARE LOOP — surface the share sheet on create success so a new plan
    // immediately recruits people.
    setShare(plan)
    return plan
  }

  // Rally coordination loop (demo). Resolve from state first so created rallies
  // and live counts win; fall back to the static data (covers PAST_RALLIES).
  const findRally = (id) => rallies.find((r) => r.id === id) || rallyById(id)
  const createRally = (draft) => {
    const r = makeRally(draft)
    setRallies((rs) => [r, ...rs])
    setRallyStatus((s) => ({ ...s, [r.id]: 'in' }))   // the host is in by default
    resetTo({ name: 'rallies' }); push({ name: 'rally', rallyId: r.id })
    return r
  }
  const toggleJoinRally = (rallyId) => {
    const { rallies: next, statusById } = applyToggleJoin(rallies, rallyStatus, rallyId)
    setRallies(next); setRallyStatus(statusById)
  }

  if (splash) return <PhoneFrame hideNav><SplashScreen onSkip={() => setSplash(false)} /></PhoneFrame>
  if (!onboarded) {
    return (
      <PhoneFrame hideNav>
        <ProfileSetup onDone={(p) => { if (p) { const next = { ...profile, ...p }; setProfile(next); saveProfile(myId, next) } setOnboarded(true) }} />
      </PhoneFrame>
    )
  }

  let screen
  if (view.name === 'matches') {
    screen = <MatchesScreen plans={plans} flag={profile.flag} myId={myId} follows={follows} onToggleFollow={toggleFollow} onOpenMatch={(m) => push({ name: 'match', matchId: m.id })} />
  } else if (view.name === 'match') {
    screen = <MatchScreen match={matchById(view.matchId)} plans={plans} myId={myId} following={follows.has(view.matchId)} onToggleFollow={toggleFollow} onBack={back}
      onOpenPlan={(p) => push({ name: 'plan', planId: p.id })} onCreate={() => push({ name: 'create', matchId: view.matchId })} />
  } else if (view.name === 'plan') {
    const plan = plans.find((p) => p.id === view.planId)
    screen = <PlanScreen plan={plan} joined={isJoined(plan)} onBack={back} onToggleJoin={() => toggleJoin(plan.id)} onShare={() => setShare(plan)} />
  } else if (view.name === 'create') {
    screen = <CreateScreen match={matchById(view.matchId)} onBack={back} onCreate={createPlan} />
  } else if (view.name === 'rallies') {
    screen = <RalliesScreen rallies={rallies} myStatusById={rallyStatus}
      onOpenRally={(r) => push({ name: 'rally', rallyId: r.id })}
      onCreateRally={() => push({ name: 'create-rally' })}
      onOpenCommunity={(c) => push({ name: 'community', communityId: c.id })} />
  } else if (view.name === 'rally') {
    const r = findRally(view.rallyId)
    const st = r ? rallyStatus[r.id] : null
    screen = <RallyScreen rally={r} onBack={back}
      joined={st === 'in'} waitlisted={st === 'waitlist'} waiting={r?.waiting || 0}
      onToggleJoin={r ? () => toggleJoinRally(r.id) : undefined} />
  } else if (view.name === 'create-rally') {
    screen = <CreateRallyScreen onBack={back} onCreate={createRally} />
  } else if (view.name === 'community') {
    const c = communityById(view.communityId)
    const members = c ? c.memberIds.map(userById).filter(Boolean) : []
    const cRallies = c ? c.rallyIds.map(findRally).filter(Boolean) : []
    screen = <CommunityScreen community={c} members={members} rallies={cRallies}
      onOpenRally={(r) => push({ name: 'rally', rallyId: r.id })} onBack={back} />
  } else if (view.name === 'outfit') {
    screen = <OutfitScreen discounts={discounts} />
  } else if (view.name === 'leaders') {
    screen = <LeadersScreen plans={plans} onBuyBeer={() => setBeer(true)} />
  }

  return (
    <UserCtx.Provider value={resolve}>
      <PhoneFrame tab={tab} onTab={goTab} footer={<>
        {share && <ShareModal plan={share} refCode={myReferralCode(myId)} onClose={() => setShare(null)} />}
        {beer && <BuyBeerModal onClose={() => setBeer(false)} />}
        {referralNudge && <ReferralNudge kind={referralNudge} onClose={() => setReferralNudge(null)} />}
        {followNudge && !referralNudge && <FollowNudge kind={followNudge} onClose={() => setFollowNudge(null)} />}
        {installHint && !referralNudge && !followNudge && <InstallHint onClose={dismissInstallHint} />}
      </>}>
        {/* Keyed by view so navigating away from a broken screen retries cleanly. */}
        <ErrorBoundary key={view.name + ':' + (view.matchId || view.planId || view.rallyId || view.communityId || '')}>
          <Suspense fallback={<div className="min-h-[40vh]" />}>{screen}</Suspense>
        </ErrorBoundary>
      </PhoneFrame>
    </UserCtx.Provider>
  )
}

// --- phone frame -----------------------------------------------------------
function PhoneFrame({ children, tab, onTab, hideNav = false, footer = null }) {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center sm:py-6">
      <div className="relative w-full sm:max-w-[400px] h-[100dvh] sm:h-[860px] sm:max-h-[calc(100dvh-3rem)] bg-night grain text-cream overflow-hidden sm:rounded-[42px] sm:border-[10px] sm:border-black sm:shadow-2xl flex flex-col">
        <div className="hidden sm:flex items-center justify-between px-6 pt-3 pb-1 text-[12px] text-cream/60 font-semibold shrink-0">
          <Clock /><span className="tracking-widest">●●●●</span>
        </div>
        <div id="rally-scroll" className="flex-1 overflow-y-auto no-scrollbar">{children}</div>
        {!hideNav && (
          <nav className="shrink-0 grid grid-cols-4 border-t border-line bg-panel">
            <TabButton active={tab === 'tonight'} onClick={() => onTab('tonight')} label="Tonight" />
            <TabButton active={tab === 'rallies'} onClick={() => onTab('rallies')} label="Rallies" />
            <TabButton active={tab === 'outfit'} onClick={() => onTab('outfit')} label="Outfit" />
            <TabButton active={tab === 'leaders'} onClick={() => onTab('leaders')} label="Leaders" />
          </nav>
        )}
      </div>
      {footer}
    </div>
  )
}

function TabButton({ active, onClick, label }) {
  return (
    <button onClick={onClick} className="py-3.5 flex flex-col items-center gap-1">
      <span className={'text-sm font-bold uppercase tracking-wide whitespace-nowrap ' + (active ? 'text-cream' : 'text-cream/30')}>{label}</span>
      <span className={'h-1 w-6 rounded-full ' + (active ? 'bg-lime' : 'bg-transparent')} />
    </button>
  )
}

// --- splash ----------------------------------------------------------------
function SplashScreen({ onSkip }) {
  // The room as hero: the Denmark Euro ’92 crowd, full-bleed grainy B&W, RALLY lit
  // lime on top. A whole nation watching together — "we rally for it."
  return (
    <button onClick={onSkip} className="relative h-full w-full flex flex-col items-center justify-center bg-night text-cream text-center px-8 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${SPLASH_IMG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 28%',
          filter: 'grayscale(1) contrast(1.1) brightness(0.62)',
        }}
      />
      {/* gentle top/bottom scrims so the status bar + footer stay legible */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,11,11,0.55) 0%, rgba(11,11,11,0.08) 24%, rgba(11,11,11,0.08) 66%, rgba(11,11,11,0.82) 100%)' }} />
      <div className="absolute inset-0 grain opacity-[0.1] mix-blend-overlay" />

      <div className="relative animate-pop -mt-6">
        <div className="font-display text-7xl tracking-tight text-lime leading-none drop-shadow-[0_2px_24px_rgba(0,0,0,0.8)]">RALLY</div>
        <div className="flourish text-2xl text-cream/90 mt-3 drop-shadow">Find your game.<br />Find your people.</div>
      </div>

      <div className="absolute bottom-10 px-8">
        <div className="font-display text-[15px] uppercase tracking-wide leading-tight text-cream/70 drop-shadow">
          We don’t just watch the game.<br /><span className="text-lime">We rally for it.</span>
        </div>
      </div>
    </button>
  )
}

// --- onboarding ------------------------------------------------------------
// Optional gender self-select — used ONLY to segment aggregate match-rating
// insights (never shown per-user). Default 'na'; fully skippable.
const GENDERS = [
  { id: 'f', label: '♀' },
  { id: 'm', label: '♂' },
  { id: 'x', label: '⚧' },
]
function ProfileSetup({ onDone }) {
  const [name, setName] = useState('')
  const [flag, setFlag] = useState('🇩🇰')
  const [gender, setGender] = useState('na')
  return (
    <div className="flex flex-col h-full px-6 py-3">
      <div className="pt-2">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-cream/40">Welcome to RALLY</div>
        <h1 className="font-display text-[30px] leading-[0.92] uppercase mt-2">
          Find your<br /><span className="flourish lowercase text-[36px] text-purple">game.</span> Find<br />your <span className="flourish lowercase text-[36px] text-pink">people.</span>
        </h1>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Your name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tjalli"
            className="mt-2 w-full bg-transparent border-b-2 border-cream/20 focus:border-cream outline-none py-2 text-2xl font-display uppercase text-cream placeholder:text-cream/20 placeholder:normal-case placeholder:font-sans" />
        </div>
        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Where are you from?</label>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {FLAGS.map((f) => (
              <button key={f} onClick={() => setFlag(f)}
                className={'aspect-square rounded-2xl text-2xl flex items-center justify-center border-2 transition ' +
                  (flag === f ? 'border-lime bg-lime/15' : 'border-line bg-panel')}>{f}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">
            Gender <span className="text-cream/25 normal-case tracking-normal font-normal">· optional, for match insights</span>
          </label>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {GENDERS.map((g) => (
              <button key={g.id} onClick={() => setGender((cur) => cur === g.id ? 'na' : g.id)}
                className={'rounded-2xl py-2.5 text-xl flex items-center justify-center border-2 transition ' +
                  (gender === g.id ? 'border-lime bg-lime/15' : 'border-line bg-panel')}>{g.label}</button>
            ))}
            <button onClick={() => setGender('na')}
              className={'rounded-2xl py-2.5 text-[12px] font-bold uppercase flex items-center justify-center border-2 transition ' +
                (gender === 'na' ? 'border-lime bg-lime/15 text-cream' : 'border-line bg-panel text-cream/45')}>Skip</button>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-panel border border-line p-3">
          <Avatar user={{ id: 'u_me', name: name || 'You', flag, color: '#8ACE00' }} size={44} />
          <div>
            <div className="font-bold">{name || 'You'} {flag}</div>
            <div className="text-xs text-cream/40">How friends will see you</div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4 space-y-1.5">
        <Pill onClick={() => onDone({ name: name.trim() || 'You', flag, gender })} className="w-full text-lg">Let’s go →</Pill>
        <button onClick={() => onDone(null)} className="w-full text-cream/40 text-sm py-1.5">Skip for now</button>
      </div>
    </div>
  )
}

// --- matches home ----------------------------------------------------------
function MatchesScreen({ plans, onOpenMatch, flag, myId, follows, onToggleFollow }) {
  const statsFor = (matchId) => {
    const ps = plans.filter((p) => p.match_id === matchId)
    return { planCount: ps.length, people: ps.reduce((n, p) => n + p.participant_ids.length, 0) }
  }
  const days = [...new Set(MATCHES.map((m) => m.day))]
  const topPlan = plans && plans.length ? [...plans].sort((a, b) => b.participant_ids.length - a.participant_ids.length)[0] : null
  const topVenue = topPlan && venueById(topPlan.venue_id)
  const topMatch = topPlan && matchById(topPlan.match_id)
  return (
    <div className="pb-6">
      <header className="relative mb-6">
        <div className="relative h-[330px] overflow-hidden bg-night">
          <img src={HERO_IMG[flag] || HERO_GENERIC} alt="" className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: 'grayscale(1) contrast(1.05) brightness(0.78)' }}
            onError={(e) => { if (e.currentTarget.src !== HERO_GENERIC) e.currentTarget.src = HERO_GENERIC }} />
          <div className="absolute inset-0 grain opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-night/10" />
          {/* Floodlight: use brighter lime (A8FF00) for corner accent; classic: #8ACE00 */}
          <div className="absolute inset-0" style={{ background: IS_FLOODLIGHT
            ? 'radial-gradient(120% 80% at 0% 100%, rgba(168,255,0,0.22), transparent 55%)'
            : 'radial-gradient(120% 80% at 0% 100%, rgba(138,206,0,0.18), transparent 55%)' }} />
        </div>
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.18em] uppercase text-cream/80">
            <span>📍 Copenhagen</span>
            <div className="flex items-center gap-2 normal-case tracking-normal">
              <GoalAlertsPill myId={myId} />
              <span className="tracking-[0.18em]">World Cup ’26</span>
            </div>
          </div>
          <h1 className="font-display text-[44px] leading-[0.86] uppercase drop-shadow">
            Who’s<br />watching<br /><span className="flourish lowercase text-[48px] text-lime">tonight?</span>
          </h1>
        </div>
      </header>
      <div className="px-5">

      {topPlan && topVenue && topMatch && (
        <button onClick={() => onOpenMatch(topMatch)} className="w-full text-left mb-4 rounded-2xl bg-lime text-night p-4 active:scale-[0.98] transition">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-night animate-pulse" />Busiest tonight
            </div>
            <span className="text-[11px] font-bold">{topPlan.participant_ids.length} going →</span>
          </div>
          <div className="font-display uppercase text-2xl leading-none mt-2">{topVenue.emoji} {topVenue.name}</div>
          <div className="text-[12px] font-bold mt-1 flex items-center gap-1.5">
            <FlagImg emoji={topMatch.flag_a} team={topMatch.team_a} size={13} /> {topMatch.team_a} v {topMatch.team_b} <FlagImg emoji={topMatch.flag_b} team={topMatch.team_b} size={13} /> · {topMatch.kickoff.slice(11, 16)}
          </div>
        </button>
      )}

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-cream/40 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-lime" />{MATCHES.length} fixtures · live schedule
      </div>

      {days.map((day) => (
        <div key={day} className="mb-6">
          <div className="text-[11px] font-bold tracking-[0.18em] text-cream/40 mb-3">{day}</div>
          <div className="space-y-3">
            {MATCHES.filter((m) => m.day === day).map((m) => {
              const { planCount, people } = statsFor(m.id)
              const hot = m.featured || m.marquee
              const border = m.featured ? 'border-lime' : m.marquee ? 'border-pink' : 'border-line'
              // Floodlight: apply card gradient + team CSS vars per card
              const cardStyle = IS_FLOODLIGHT
                ? { ...flCardStyle(m.color_a, m.color_b), ...flTeamVars(m.color_a, m.color_b) }
                : {}
              return (
                <div key={m.id} role="button" tabIndex={0} onClick={() => onOpenMatch(m)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenMatch(m) }}
                  className={'relative overflow-hidden w-full text-left rounded-3xl p-5 border text-cream cursor-pointer active:scale-[0.98] transition ' + (hot ? '' : 'bg-panel ') + border}
                  style={cardStyle}>
                  {/* Floodlight spine: team-colour left strip */}
                  {IS_FLOODLIGHT && <FlSpine colorA={m.color_a} colorB={m.color_b} />}
                  {hot ? (
                    // Featured / marquee: prominent photo, light scrim — this is the hero.
                    <><div className="absolute inset-0"><MatchArt m={m} className="w-full h-full" /></div><div className="absolute inset-0 bg-night/55" /></>
                  ) : m.archive ? (
                    // Every other card with a real photo: show it, but faint behind a heavy
                    // scrim so it never competes with the opening match.
                    <><div className="absolute inset-0 opacity-[0.5]"><MatchArt m={m} className="w-full h-full" /></div><div className="absolute inset-0 bg-night/65" /></>
                  ) : null}
                  <div className="relative" style={IS_FLOODLIGHT ? { paddingLeft: 8 } : {}}>
                    {m.featured && <div className="text-[10px] font-bold tracking-[0.2em] text-lime mb-3">★ OPENING MATCH</div>}
                    {m.marquee && <div className="text-[10px] font-bold tracking-[0.2em] text-pink mb-3">★ BIG ONE</div>}
                    <div className="flex items-end justify-between gap-3">
                      <div className="font-display uppercase leading-[0.95] text-xl">
                        <div className="flex items-center gap-2"><FlagImg emoji={m.flag_a} team={m.team_a} size={17} /> {m.team_a}</div>
                        {IS_FLOODLIGHT
                          ? <div className="flourish lowercase text-cream/50 text-sm my-0.5" style={{ fontStyle: 'italic', fontFamily: "'Instrument Serif', serif", fontSize: 15 }}>v</div>
                          : <div className="text-cream/40 text-xs my-0.5">versus</div>}
                        <div className="flex items-center gap-2"><FlagImg emoji={m.flag_b} team={m.team_b} size={17} /> {m.team_b}</div>
                      </div>
                      <div className="flex items-start gap-1">
                        <KickClock m={m} />
                        <StarToggle on={follows?.has(m.id)} onToggle={() => onToggleFollow(m.id)} size={18} className="-mr-1 -mt-1" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <TvChips tv={m.tv} small />
                      {planCount > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
                          {people} going · {planCount} {planCount === 1 ? 'spot' : 'spots'}
                        </div>
                      ) : <div className="text-xs text-cream/40">be the first →</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <p className="flourish text-center text-lg text-cream/30 mt-2">find your game. find your people.</p>
      </div>
    </div>
  )
}

// --- §2 referral nudge -----------------------------------------------------
// A one-time toast. Two voices: 'joined' welcomes a fresh INVITEE; 'rewarded'
// tells the SHARER someone joined their RALLY and points them at their reward.
function ReferralNudge({ kind, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])
  const joined = kind === 'joined'
  const head = joined ? 'Welcome to the RALLY' : 'Someone joined your RALLY'
  const body = joined
    ? 'You came in on a mate’s invite — good shout. Now go find your people.'
    : 'Nice work, connector — 15% off at Miinto is waiting on the Outfit tab.'
  return (
    <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[360px] rounded-2xl border-2 border-lime/60 bg-panel/95 backdrop-blur p-3.5 flex items-start gap-3 animate-pop shadow-xl"
        onClick={onClose}>
        <span className="text-xl leading-none mt-0.5">{joined ? '👋' : '🎟️'}</span>
        <div className="flex-1">
          <div className="font-display text-sm uppercase tracking-wide text-lime">{head}</div>
          <div className="text-xs text-cream/70 mt-0.5 leading-snug">{body}</div>
        </div>
      </div>
    </div>
  )
}

// --- follow (star) toggle --------------------------------------------------
// A small star a user taps to follow a match for goal alerts WITHOUT joining a
// watch party. Outline when off, filled lime when on. On a match card it must
// not trigger the card's open-match navigation, so we stopPropagation. Exported
// so the lazy MatchScreen header can reuse the exact same control.
export function StarToggle({ on, onToggle, size = 22, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Following — tap to stop goal alerts' : 'Follow this match for goal alerts'}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={'inline-flex items-center justify-center rounded-full active:scale-90 transition shrink-0 ' + className}
      style={{ width: size + 14, height: size + 14 }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden
        fill={on ? '#A8FF00' : 'none'} stroke={on ? '#A8FF00' : 'currentColor'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        className={on ? 'drop-shadow' : 'text-cream/55'}>
        <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
      </svg>
    </button>
  )
}

// --- follow nudge ----------------------------------------------------------
// A one-line in-voice toast when a star is toggled. Same shape as ReferralNudge.
function FollowNudge({ kind, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose, kind])
  const on = kind === 'on'
  const head = on ? 'On the radar' : 'Off the radar'
  const body = on
    ? 'We’ll ping you the second they score. No need to pick a spot.'
    : 'No more pings from this one. Your call.'
  return (
    <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[360px] rounded-2xl border-2 border-lime/60 bg-panel/95 backdrop-blur p-3.5 flex items-start gap-3 animate-pop shadow-xl"
        onClick={onClose}>
        <span className="text-xl leading-none mt-0.5">{on ? '⭐' : '☆'}</span>
        <div className="flex-1">
          <div className="font-display text-sm uppercase tracking-wide text-lime">{head}</div>
          <div className="text-xs text-cream/70 mt-0.5 leading-snug">{body}</div>
        </div>
      </div>
    </div>
  )
}

// --- add-to-home-screen hint ----------------------------------------------
// iOS Safari shows NO native install prompt, so most users never "Add to Home
// Screen" and PWA adoption dies on the vine. This is a tasteful, one-time, in-
// voice nudge that only fires for iOS Safari users who aren't already installed.
// Dismissal is remembered in localStorage so it never nags twice.
const A2HS_KEY = 'rally_a2hs_dismissed'

// True only when: iOS device + actual Safari (not Chrome/Firefox-on-iOS, which
// use CriOS/FxiOS and can't "Add to Home Screen" the same way) + NOT already
// running as an installed standalone app.
function shouldShowA2HS() {
  try {
    if (localStorage.getItem(A2HS_KEY)) return false
  } catch { /* no localStorage (file://) — fall through, still gate on UA */ }
  const ua = window.navigator.userAgent || ''
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)   // exclude in-app/other browsers
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  return isIOS && isSafari && !standalone
}

// The iOS share glyph (square with an up-arrow) — the exact icon users tap.
function ShareGlyph({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden className={className}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M6 12H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1" />
    </svg>
  )
}

function InstallHint({ onClose }) {
  return (
    <div className="fixed inset-x-0 bottom-24 z-[55] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-[360px] rounded-2xl border-2 border-lime/60 bg-panel/95 backdrop-blur p-3.5 flex items-start gap-3 animate-pop shadow-xl">
        <span className="shrink-0 mt-0.5 text-lime"><ShareGlyph /></span>
        <div className="flex-1">
          <div className="font-display text-sm uppercase tracking-wide text-lime">Keep us on you</div>
          <div className="text-xs text-cream/70 mt-0.5 leading-snug">
            Tap <ShareGlyph className="inline-block align-text-bottom text-cream" /> then
            {' '}<span className="text-cream font-semibold">Add to Home Screen</span> — one tap to the match, every night. We’ll save you a seat.
          </div>
        </div>
        <button onClick={onClose} aria-label="Dismiss"
          className="shrink-0 -mt-1 -mr-1 h-7 w-7 grid place-items-center rounded-full text-cream/40 hover:text-cream/80 text-lg leading-none">
          ×
        </button>
      </div>
    </div>
  )
}

// --- share modal -----------------------------------------------------------
// SHARE LOOP — the share sheet. Renders the branded event PosterCard, builds the
// real guest-join link (rally.futbol/p/<id>) + the event-card image URL, and
// fires navigator.share when available with a copy-link fallback. Sharing a
// watch-party is how RALLY recruits new people.
function ShareModal({ plan, refCode, onClose }) {
  const venue = venueById(plan.venue_id)
  const match = matchById(plan.match_id)
  const [copied, setCopied] = useState(false)

  const going = plan.participant_ids?.length || 0
  // §2 — the sharer's link carries THEIR referral code, so a new joiner earns
  // them 15% at Miinto. Demo mode (no code) just hands out the plain plan link.
  const link = refCode ? planShareUrl(plan.id, refCode) : planShareUrl(plan.id)
  const cardUrl = planCardUrl(plan.match_id, plan.id, going)
  const { title, text } = shareText({ teamA: match?.team_a, teamB: match?.team_b, venue: venue?.name })

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link) } catch { /* clipboard blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ url: link, title, text }); return } catch { /* cancelled → fall through */ }
    }
    copyLink()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4 text-cream" onClick={onClose}>
      <div className="w-full sm:max-w-[380px] animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center">
          <PosterCard match={match} plan={{ ...plan, venue }} planId={plan.id} width={260} />
        </div>

        <div className="mt-4 flex items-center gap-2 bg-panel border border-line rounded-2xl p-2 pl-4">
          <span className="flex-1 truncate text-sm text-cream/70">{link}</span>
          <button onClick={copyLink} className="shrink-0 rounded-xl bg-panel2 border border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wide active:scale-95 transition">
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>

        <button onClick={nativeShare}
          className="w-full mt-3 rounded-full bg-lime text-night font-bold uppercase tracking-widest py-3.5 active:scale-[0.98] transition">
          Share the rally
        </button>
        {refCode && (
          <p className="text-center text-[11px] text-cream/45 mt-2 px-4 leading-snug">
            Pull a new face in and we’ll sort you <span className="text-lime font-bold">15% off at Miinto</span>. Dress the part on us.
          </p>
        )}
        <button onClick={() => window.open(cardUrl, '_blank')}
          className="w-full mt-2 text-center text-cream/50 text-xs uppercase tracking-widest py-2">
          Open the event card
        </button>
        <button onClick={onClose} className="w-full text-center text-cream/60 text-sm mt-1 py-2">Close</button>
      </div>
    </div>
  )
}

// --- beer modal ------------------------------------------------------------
function BuyBeerModal({ onClose }) {
  const [amount, setAmount] = useState(35)
  const [done, setDone] = useState(null)
  const amounts = [20, 35, 50, 100]
  const methods = [{ label: 'MobilePay', note: 'DK' }, { label: 'Vipps', note: 'NO' }, { label: 'Swish', note: 'SE' }, { label: 'Card', note: 'Stripe' }]
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4 text-cream" onClick={onClose}>
      <div className="w-full sm:max-w-[380px] bg-panel border border-line rounded-3xl p-5 animate-pop" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">🍻</div>
            <div className="font-display text-2xl uppercase">Skål!</div>
            <div className="text-sm text-cream/50 mt-1">{amount} kr via {done}. You’re a legend.</div>
            <Pill onClick={onClose} className="mt-5 w-full">Close</Pill>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="text-5xl mb-2">🍺</div>
              <div className="font-display text-2xl uppercase">Buy us a beer</div>
              <div className="flourish text-lg text-cream/60 mt-1">if RALLY found you your people tonight, cheers.</div>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-5">
              {amounts.map((a) => (
                <button key={a} onClick={() => setAmount(a)}
                  className={'py-2.5 rounded-2xl font-display border-2 transition ' + (amount === a ? 'border-lime bg-lime/10 text-cream' : 'border-line bg-panel text-cream/60')}>
                  {a}<span className="text-[10px] font-sans font-normal"> kr</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {methods.map((m) => (
                <button key={m.label} onClick={() => setDone(m.label)} className="flex items-center justify-center gap-2 bg-panel2 border border-line rounded-2xl py-3 active:scale-95 transition">
                  <span className="font-bold text-sm">{m.label}</span><span className="text-[10px] text-cream/35">{m.note}</span>
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-full text-center text-cream/40 text-sm mt-4 py-2">Maybe later</button>
          </>
        )}
      </div>
    </div>
  )
}

// --- bits ------------------------------------------------------------------
export function StickyBar({ children }) {
  return (
    <div className="absolute bottom-[60px] left-0 right-0 px-5 pb-3 pt-8 bg-gradient-to-t from-night via-night to-transparent">{children}</div>
  )
}

export function TopBar({ onBack, title }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 sticky top-0 bg-night/90 backdrop-blur z-10">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-panel border border-line flex items-center justify-center active:scale-90 transition">‹</button>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-cream/50">{title}</span>
    </div>
  )
}

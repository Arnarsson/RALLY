import { useState, useEffect, createContext, useContext } from 'react'
import {
  VIBES, USERS, ME, userById, FLAGS,
  VENUES, venueById,
  MATCHES, matchById,
  PLANS as SEED_PLANS,
  OUTFITS,
} from './data/mockData.js'
import { OUTFIT_IMG } from './data/outfitImages.js'

// ===========================================================================
// RALLY — editorial football-culture design system, DARK (white on black).
// Archivo Black headlines, Instrument Serif italic accents (.flourish),
// Inter body, lime/pink/blue/purple pop palette.
// ===========================================================================

const NIGHT = '#0B0B0B'
const UserCtx = createContext(userById)
const useResolve = () => useContext(UserCtx)

// Placeholder photography. Real shots (brand shoots / Miinto feed) drop in here.
// Grayscale to match the brand's B&W documentary look; reliable, no API key.
const photo = (seed, w = 800, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}?grayscale`

function Img({ seed, h = 'h-full', gradient = true, className = '' }) {
  return (
    <div className={'relative overflow-hidden bg-panel ' + h + ' ' + className}>
      <img src={photo(seed)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'rgba(138,206,0,0.10)', mixBlendMode: 'overlay' }} />
      {gradient && <div className="absolute inset-0 bg-gradient-to-t from-night via-night/35 to-night/5" />}
    </div>
  )
}

// --- helpers ---------------------------------------------------------------
function Avatar({ user, size = 32, ring = true }) {
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

function AvatarStack({ ids, max = 5, size = 30 }) {
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

function VibeTag({ vibe, small = false }) {
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

function TvChips({ tv, small = false }) {
  if (!tv || !tv.length) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tv.map((c) => {
        const url = watchURL(c.name)
        const cls = 'inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wide ' +
          (small ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]') + ' ' +
          (c.free ? 'bg-lime text-night' : 'border border-current/25 text-current opacity-80')
        const text = `${c.name}${c.free ? ' · free' : ''}`
        if (!url) return <span key={c.name} className={cls}>{text}</span>
        return (
          <a key={c.name} href={url} target="_blank" rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cls + ' active:scale-95 transition'} title={'Watch live · ' + c.name}>
            <span aria-hidden className="text-[0.8em] leading-none">▶</span>{text}
          </a>
        )
      })}
    </div>
  )
}

// --- live status (real ESPN data) -----------------------------------------
// Recent form, e.g. "WWWDD" -> coloured pips.
const FORM_COLOR = { W: '#8ACE00', D: '#8a8a8a', L: '#FF5A1F' }
const FORM_LABEL = { W: 'Win', D: 'Draw', L: 'Loss' }
function FormPips({ form }) {
  if (!form) return null
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {form.split('').slice(0, 5).map((r, i) => (
        <span key={i} title={FORM_LABEL[r] || r} className="w-1.5 h-1.5 rounded-full" style={{ background: FORM_COLOR[r] || '#555' }} />
      ))}
    </span>
  )
}
function FormLegend() {
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

// Kickoff time, or live score + minute, or full-time score — right side of a card.
function KickClock({ m }) {
  if (m.status === 'in') return (
    <div className="text-right shrink-0">
      <div className="flex items-center justify-end gap-1 text-pink text-[10px] font-bold uppercase tracking-wide">
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
      <div className="font-display text-3xl leading-none">{m.kickoff.slice(11, 16)}</div>
      <div className="text-[10px] uppercase tracking-wide text-lime/90 mt-0.5"><Countdown to={m.kickoff_utc} max={72} /></div>
    </div>
  )
}

// One-line match status for detail headers.
function MatchStatusLine({ m }) {
  if (m.status === 'in') return <span className="text-pink">● LIVE {m.score_a}–{m.score_b} · {m.clock}</span>
  if (m.status === 'post' || m.completed) return <span>full time · {m.score_a}–{m.score_b}</span>
  return <span>kickoff {m.kickoff.slice(11, 16)}</span>
}

// Match artwork built from the actual teams — national colours (from ESPN) +
// flags. Always matches the game on screen, never a random stock photo.
// Crisp flag images (flagcdn) from a flag emoji — sharper than emoji and
// consistent across platforms (emoji flags don't render on Windows).
function flagURL(emoji, team) {
  if (emoji === '🏴') {
    const t = (team || '').toLowerCase()
    if (t.includes('scot')) return 'https://flagcdn.com/h80/gb-sct.png'
    if (t.includes('wal')) return 'https://flagcdn.com/h80/gb-wls.png'
    return 'https://flagcdn.com/h80/gb-eng.png'
  }
  const cp = [...(emoji || '')].map((c) => c.codePointAt(0))
  if (cp.length === 2 && cp[0] >= 0x1F1E6 && cp[0] <= 0x1F1FF) {
    const iso = String.fromCharCode(cp[0] - 0x1F1E6 + 97) + String.fromCharCode(cp[1] - 0x1F1E6 + 97)
    return `https://flagcdn.com/h80/${iso}.png`
  }
  return null
}
function FlagImg({ emoji, team, size = 20, className = '' }) {
  const url = flagURL(emoji, team)
  if (!url) return <span style={{ fontSize: size }}>{emoji}</span>
  return <img src={url} alt="" loading="lazy" className={'inline-block rounded-[2px] object-cover align-middle ' + className}
    style={{ height: size, width: 'auto' }} />
}

function MatchArt({ m, className = '', credit = false }) {
  const a = m.color_a || '#8ACE00'
  const b = m.color_b || '#2A5BFF'
  // 1) Real archive photo of this fixture — B&W, grained, faintly team-tinted.
  if (m.archive) {
    return (
      <div className={'relative overflow-hidden bg-night ' + className}>
        <img src={m.archive.src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'grayscale(1) contrast(1.06) brightness(0.82)' }} />
        <div className="absolute inset-0 grain opacity-30" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(112deg, ${a} 0%, transparent 45%, ${b} 100%)`, mixBlendMode: 'overlay', opacity: 0.45 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-night via-night/35 to-night/5" />
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
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 120% at 0% 0%, ${a} 0%, transparent 50%), radial-gradient(120% 120% at 100% 100%, ${b} 0%, transparent 50%)`, opacity: 0.22 }} />
      <div className="absolute inset-0 grain opacity-45" />
      <div className="absolute inset-0 flex items-center justify-between px-9">
        <FlagImg emoji={m.flag_a} team={m.team_a} size={54} className="-rotate-3 shadow-2xl ring-1 ring-white/10" />
        <FlagImg emoji={m.flag_b} team={m.team_b} size={54} className="rotate-3 shadow-2xl ring-1 ring-white/10" />
      </div>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(135% 95% at 50% 0%, transparent 30%, rgba(11,11,11,0.80))' }} />
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

function Pill({ children, onClick, color = 'lime', className = '' }) {
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

// --- AI rundown ------------------------------------------------------------
function Rundown({ text }) {
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
  const [stack, setStack] = useState([{ name: 'matches' }])
  const [tab, setTab] = useState('tonight')
  const [share, setShare] = useState(null)
  const [beer, setBeer] = useState(false)
  const [splash, setSplash] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 2200)
    return () => clearTimeout(t)
  }, [])

  const resolve = (id) => (id === ME.id ? profile : (userById(id) || profile))
  const view = stack[stack.length - 1]
  const push = (v) => setStack((s) => [...s, v])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const resetTo = (v) => setStack([v])
  const goTab = (t) => { setTab(t); resetTo(t === 'tonight' ? { name: 'matches' } : t === 'outfit' ? { name: 'outfit' } : { name: 'leaders' }) }

  const isJoined = (plan) => plan.participant_ids.includes(ME.id)
  const toggleJoin = (planId) => setPlans((ps) => ps.map((p) => {
    if (p.id !== planId) return p
    const joined = p.participant_ids.includes(ME.id)
    return { ...p, participant_ids: joined ? p.participant_ids.filter((id) => id !== ME.id) : [...p.participant_ids, ME.id] }
  }))
  const createPlan = ({ match_id, venue_id, time, vibe, note }) => {
    const id = 'p_' + Math.random().toString(36).slice(2, 7)
    const plan = { id, match_id, venue_id, host_id: ME.id, time, vibe, note: note || '', participant_ids: [ME.id], capacity_hint: 30 }
    setPlans((ps) => [plan, ...ps])
    resetTo({ name: 'matches' }); push({ name: 'match', matchId: match_id }); push({ name: 'plan', planId: id })
    return plan
  }

  if (splash) return <PhoneFrame hideNav><SplashScreen onSkip={() => setSplash(false)} /></PhoneFrame>
  if (!onboarded) {
    return (
      <PhoneFrame hideNav>
        <ProfileSetup onDone={(p) => { if (p) setProfile({ ...ME, ...p }); setOnboarded(true) }} />
      </PhoneFrame>
    )
  }

  let screen
  if (view.name === 'matches') {
    screen = <MatchesScreen plans={plans} onOpenMatch={(m) => push({ name: 'match', matchId: m.id })} />
  } else if (view.name === 'match') {
    screen = <MatchScreen match={matchById(view.matchId)} plans={plans} onBack={back}
      onOpenPlan={(p) => push({ name: 'plan', planId: p.id })} onCreate={() => push({ name: 'create', matchId: view.matchId })} />
  } else if (view.name === 'plan') {
    const plan = plans.find((p) => p.id === view.planId)
    screen = <PlanScreen plan={plan} joined={isJoined(plan)} onBack={back} onToggleJoin={() => toggleJoin(plan.id)} onShare={() => setShare(plan)} />
  } else if (view.name === 'create') {
    screen = <CreateScreen match={matchById(view.matchId)} onBack={back} onCreate={createPlan} />
  } else if (view.name === 'outfit') {
    screen = <OutfitScreen />
  } else if (view.name === 'leaders') {
    screen = <LeadersScreen plans={plans} onBuyBeer={() => setBeer(true)} />
  }

  return (
    <UserCtx.Provider value={resolve}>
      <PhoneFrame tab={tab} onTab={goTab} footer={<>
        {share && <ShareModal plan={share} onClose={() => setShare(null)} />}
        {beer && <BuyBeerModal onClose={() => setBeer(false)} />}
      </>}>
        {screen}
      </PhoneFrame>
    </UserCtx.Provider>
  )
}

// --- phone frame -----------------------------------------------------------
function PhoneFrame({ children, tab, onTab, hideNav = false, footer = null }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center sm:py-6">
      <div className="relative w-full sm:max-w-[400px] h-[100dvh] sm:h-[860px] bg-night grain text-cream overflow-hidden sm:rounded-[42px] sm:border-[10px] sm:border-black sm:shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[12px] text-cream/60 font-semibold shrink-0">
          <span>21:47</span><span className="tracking-widest">●●●●</span>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">{children}</div>
        {!hideNav && (
          <nav className="shrink-0 grid grid-cols-3 border-t border-line bg-panel">
            <TabButton active={tab === 'tonight'} onClick={() => onTab('tonight')} label="Tonight" />
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
      <span className={'text-sm font-bold uppercase tracking-wide ' + (active ? 'text-cream' : 'text-cream/30')}>{label}</span>
      <span className={'h-1 w-6 rounded-full ' + (active ? 'bg-lime' : 'bg-transparent')} />
    </button>
  )
}

// --- splash ----------------------------------------------------------------
function SplashScreen({ onSkip }) {
  return (
    <button onClick={onSkip} className="h-full w-full flex flex-col items-center justify-center bg-night text-cream text-center px-8 -mt-6">
      <div className="animate-pop">
        <div className="font-display text-7xl tracking-tight text-lime leading-none">RALLY</div>
        <div className="flourish text-2xl text-cream/90 mt-3">Find your game.<br />Find your people.</div>
      </div>
      <div className="absolute bottom-10 px-8">
        <div className="font-display text-[15px] uppercase tracking-wide leading-tight text-cream/70">
          We don’t just watch the game.<br /><span className="text-lime">We rally for it.</span>
        </div>
      </div>
    </button>
  )
}

// --- onboarding ------------------------------------------------------------
function ProfileSetup({ onDone }) {
  const [name, setName] = useState('')
  const [flag, setFlag] = useState('🇩🇰')
  return (
    <div className="flex flex-col h-full px-6 py-4">
      <div className="pt-5">
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-cream/40">Welcome to RALLY</div>
        <h1 className="font-display text-[34px] leading-[0.92] uppercase mt-3">
          Find your<br /><span className="flourish lowercase text-[40px] text-purple">game.</span> Find<br />your <span className="flourish lowercase text-[40px] text-pink">people.</span>
        </h1>
      </div>

      <div className="mt-7 space-y-6">
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
        <div className="flex items-center gap-3 rounded-2xl bg-panel border border-line p-3">
          <Avatar user={{ id: 'u_me', name: name || 'You', flag, color: '#8ACE00' }} size={44} />
          <div>
            <div className="font-bold">{name || 'You'} {flag}</div>
            <div className="text-xs text-cream/40">How friends will see you</div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-6 space-y-2">
        <Pill onClick={() => onDone({ name: name.trim() || 'You', flag })} className="w-full text-lg">Let’s go →</Pill>
        <button onClick={() => onDone(null)} className="w-full text-cream/40 text-sm py-2">Skip for now</button>
      </div>
    </div>
  )
}

// --- matches home ----------------------------------------------------------
function MatchesScreen({ plans, onOpenMatch }) {
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
        <Img seed="rally-cph-night-crowd" h="h-[330px]" />
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.18em] uppercase text-cream/80">
            <span>📍 Copenhagen</span><span>World Cup ’26</span>
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
              return (
                <div key={m.id} role="button" tabIndex={0} onClick={() => onOpenMatch(m)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenMatch(m) }}
                  className={'relative overflow-hidden w-full text-left rounded-3xl p-5 border text-cream cursor-pointer active:scale-[0.98] transition ' + (hot ? '' : 'bg-panel ') + border}>
                  {hot && (<><div className="absolute inset-0"><MatchArt m={m} className="w-full h-full" /></div><div className="absolute inset-0 bg-night/55" /></>)}
                  <div className="relative">
                    {m.featured && <div className="text-[10px] font-bold tracking-[0.2em] text-lime mb-3">★ OPENING MATCH</div>}
                    {m.marquee && <div className="text-[10px] font-bold tracking-[0.2em] text-pink mb-3">★ BIG ONE</div>}
                    <div className="flex items-end justify-between gap-3">
                      <div className="font-display uppercase leading-[0.95] text-xl">
                        <div className="flex items-center gap-2"><FlagImg emoji={m.flag_a} team={m.team_a} size={17} /> {m.team_a}</div>
                        <div className="text-cream/40 text-xs my-0.5">versus</div>
                        <div className="flex items-center gap-2"><FlagImg emoji={m.flag_b} team={m.team_b} size={17} /> {m.team_b}</div>
                      </div>
                      <KickClock m={m} />
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

// --- match (plans) ---------------------------------------------------------
function MatchScreen({ match, plans, onBack, onOpenPlan, onCreate }) {
  const matchPlans = plans.filter((p) => p.match_id === match.id).sort((a, b) => b.participant_ids.length - a.participant_ids.length)
  return (
    <div className="pb-28">
      <TopBar onBack={onBack} title={match.stage} />
      <div className="relative">
        <MatchArt m={match} className="h-56" credit />
        <div className="absolute inset-0 flex flex-col items-center justify-end text-center px-5 pb-4">
          <div className="font-display uppercase text-2xl leading-[0.95] drop-shadow">
            {match.flag_a} {match.team_a} <span className="text-cream/60 text-base">v</span> {match.flag_b} {match.team_b}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-cream/80 mt-2"><MatchStatusLine m={match} /></div>
          {match.venue && <div className="text-[11px] text-cream/55 mt-1">📍 {match.venue}</div>}
          {(match.form_a || match.form_b) && (
            <div className="mt-3 inline-flex items-center gap-4 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-cream/55">
              <span className="flex items-center gap-1.5">{match.team_a} <FormPips form={match.form_a} /></span>
              <FormLegend />
              <span className="flex items-center gap-1.5"><FormPips form={match.form_b} /> {match.team_b}</span>
            </div>
          )}
          <div className="mt-3"><TvChips tv={match.tv} /></div>
        </div>
      </div>
      <div className="px-5 pt-5">

        {match.commentary && <Rundown text={match.commentary} />}

        {match.fun_fact && (
          <div className="mb-6 border-l-2 border-pink pl-4">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-pink mb-1">did you know</div>
            <p className="flourish text-xl leading-snug text-cream/80">{match.fun_fact}</p>
          </div>
        )}

        <HeadToHead match={match} m={match} />
        <WinProbBar m={match} />

        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-2xl uppercase leading-none">Spots</h2>
          <span className="text-[11px] uppercase tracking-wide text-cream/40">{matchPlans.length} plans</span>
        </div>

        <div className="space-y-3">
          {matchPlans.map((p) => {
            const venue = venueById(p.venue_id)
            return (
              <button key={p.id} onClick={() => onOpenPlan(p)} className="w-full text-left rounded-2xl bg-panel border border-line p-4 active:scale-[0.98] transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-lg"><span className="text-xl">{venue.emoji}</span>{venue.name}</div>
                  <VibeTag vibe={p.vibe} small />
                </div>
                <div className="text-sm text-cream/45 mt-1">{venue.area} · from {p.time}</div>
                <div className="flex items-center justify-between mt-3">
                  <AvatarStack ids={p.participant_ids} />
                  <span className="text-sm font-bold">{p.participant_ids.length} going →</span>
                </div>
              </button>
            )
          })}
          {matchPlans.length === 0 && <div className="text-center text-cream/40 py-10 text-sm">No spots yet. Start one and share it →</div>}
        </div>
      </div>

      <StickyBar><Pill onClick={onCreate} className="w-full">+ Start a watch plan</Pill></StickyBar>
    </div>
  )
}

// Win-probability bar — model output (penaltyblog in production). Renders only
// when probabilities exist, so it's dormant until the prediction worker fills them.
function WinProbBar({ m }) {
  if (m.prob_a == null || m.prob_b == null) return null
  const pa = Math.round(m.prob_a * 100)
  const pd = m.prob_draw != null ? Math.round(m.prob_draw * 100) : 0
  const pb = Math.round(m.prob_b * 100)
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-cream/40 mb-1.5">
        <span>Win probability</span>
        <span className="text-cream/30">{m.prob_source === 'illustrative' ? 'model · illustrative' : m.prob_source === 'form' ? 'based on form' : 'model'}</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden">
        <div style={{ width: pa + '%', background: m.color_a || '#8ACE00' }} />
        <div style={{ width: pd + '%', background: '#3a3a3a' }} />
        <div style={{ width: pb + '%', background: m.color_b || '#2A5BFF' }} />
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold mt-1.5 text-cream/70">
        <span>{m.team_a} {pa}%</span><span className="text-cream/40">Draw {pd}%</span><span>{pb}% {m.team_b}</span>
      </div>
    </div>
  )
}

// Head-to-head — the teams' shared history (from the API's H2H endpoint).
// Falls back to a "first meeting" line so it always says something.
function HeadToHead({ m }) {
  if (!m.h2h && !m.first_meeting) return null
  return (
    <div className="mb-6 border-l-2 pl-4" style={{ borderColor: '#2A5BFF' }}>
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1" style={{ color: '#2A5BFF' }}>head to head</div>
      {m.h2h ? (
        <p className="flourish text-xl leading-snug text-cream/80">
          Last met at {m.h2h.last} — {m.flag_a} <span className="not-italic font-display">{m.h2h.score}</span> {m.flag_b}{m.h2h.note ? `, ${m.h2h.note}.` : '.'}
        </p>
      ) : (
        <p className="flourish text-xl leading-snug text-cream/80">First-ever meeting. New history tonight.</p>
      )}
    </div>
  )
}

// --- plan detail -----------------------------------------------------------
function PlanScreen({ plan, joined, onBack, onToggleJoin, onShare }) {
  const resolve = useResolve()
  const venue = venueById(plan.venue_id)
  const match = matchById(plan.match_id)
  const host = resolve(plan.host_id)
  return (
    <div className="pb-28">
      <TopBar onBack={onBack} title="Watch plan" />
      <div className="relative">
        <Img seed={'rally-' + venue.id} h="h-52" />
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-cream/80">
            {match.flag_a} {match.team_a} v {match.team_b} {match.flag_b} · {match.kickoff.slice(11, 16)}
          </div>
          <h1 className="font-display text-4xl uppercase leading-[0.9] drop-shadow">{venue.name}</h1>
          <div className="text-sm text-cream/80 mt-1">{venue.area} · from {plan.time}</div>
        </div>
      </div>
      <div className="px-5 pt-4">

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <VibeTag vibe={plan.vibe} />
          {venue.big_screen && <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-panel2 border border-line text-cream/80">📺 Big screen</span>}
          <TvChips tv={match.tv} />
        </div>

        {plan.note && <p className="flourish text-xl leading-snug text-cream/80 mt-4">“{plan.note}”</p>}

        <div className="flex items-center gap-2 mt-5 text-sm text-cream/60">
          <Avatar user={host} size={26} /><span>Hosted by <span className="font-bold text-cream">{host.name}</span></span>
        </div>

        <div className="rounded-2xl bg-panel border border-line p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-xl uppercase">{plan.participant_ids.length} going</span>
            <span className="text-[11px] uppercase tracking-wide text-cream/40">~{plan.capacity_hint} spots</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {plan.participant_ids.map((id) => {
              const u = resolve(id)
              return (
                <div key={id} className="flex flex-col items-center gap-1 w-12">
                  <Avatar user={u} size={40} />
                  <span className="text-[11px] text-cream/60 truncate w-full text-center">{u.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <StickyBar>
        <div className="flex gap-3">
          <Pill onClick={onToggleJoin} color={joined ? 'ghost' : 'lime'} className="flex-1">{joined ? '✓ You’re in' : 'Join this plan'}</Pill>
          <Pill onClick={onShare} color="pink" className="px-7">Share</Pill>
        </div>
      </StickyBar>
    </div>
  )
}

// --- create ----------------------------------------------------------------
function CreateScreen({ match, onBack, onCreate }) {
  const [venue_id, setVenue] = useState(VENUES[0].id)
  const [time, setTime] = useState(match.kickoff.slice(11, 16))
  const [vibe, setVibe] = useState('chill')
  const [note, setNote] = useState('')
  return (
    <div className="pb-28">
      <TopBar onBack={onBack} title="Start a plan" />
      <div className="px-5 space-y-6">
        <div className="rounded-2xl bg-panel border border-line p-4 text-center">
          <div className="font-display uppercase text-xl">{match.flag_a} {match.team_a} v {match.team_b} {match.flag_b}</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-cream/50 mt-1">kickoff {match.kickoff.slice(11, 16)}</div>
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Where?</label>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {VENUES.map((v) => (
              <button key={v.id} onClick={() => setVenue(v.id)}
                className={'flex items-center gap-3 rounded-2xl p-3 border-2 text-left transition ' +
                  (venue_id === v.id ? 'border-lime bg-lime/10' : 'border-line bg-panel')}>
                <span className="text-xl">{v.emoji}</span>
                <div className="flex-1"><div className="font-bold">{v.name}</div><div className="text-xs text-cream/40">{v.area}</div></div>
                {venue_id === v.id && <span className="font-bold text-lime">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Meet from</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-2 w-full bg-panel border-2 border-line rounded-2xl p-3 font-display text-xl text-cream [color-scheme:dark]" />
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Vibe</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.keys(VIBES).map((k) => {
              const on = vibe === k
              const txt = VIBES[k].color === '#8ACE00' ? NIGHT : '#fff'
              return (
                <button key={k} onClick={() => setVibe(k)}
                  className={'rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide border-2 transition ' + (on ? 'border-transparent' : 'border-line bg-panel text-cream/50')}
                  style={on ? { background: VIBES[k].color, color: txt } : {}}>{VIBES[k].label}</button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40">Note <span className="normal-case font-normal text-cream/30">(optional)</span></label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Pre-drinks from 19:00, look for the green RALLY flag"
            className="mt-2 w-full bg-panel border-2 border-line rounded-2xl p-3 text-cream placeholder:text-cream/30 resize-none" />
        </div>
      </div>

      <StickyBar><Pill onClick={() => onCreate({ match_id: match.id, venue_id, time, vibe, note })} className="w-full">Create & share</Pill></StickyBar>
    </div>
  )
}

// --- outfit (Style for the game · Miinto-ready) ----------------------------
function OutfitScreen() {
  const looks = [
    { img: OUTFIT_IMG.women, who: 'Women', title: 'Matchday looks', price: 'fr. 749 kr' },
    { img: OUTFIT_IMG.men, who: 'Men', title: 'Matchday looks', price: 'fr. 899 kr' },
  ]
  return (
    <div className="pb-6">
      <header className="relative mb-5">
        <div className="relative h-[300px] overflow-hidden bg-night">
          <img src={OUTFIT_IMG.hero} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-night/10" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.18em] uppercase text-cream/80">
            <span>Style for the game</span><span>Unisex</span>
          </div>
          <h1 className="font-display text-[42px] leading-[0.86] uppercase drop-shadow">
            Dress<br />for the<br /><span className="flourish lowercase text-[46px] text-lime">occasion.</span>
          </h1>
        </div>
      </header>

      <div className="px-5">
        <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40 mb-3">The looks</div>
        <div className="grid grid-cols-2 gap-3">
          {looks.map((l) => (
            <button key={l.who} className="relative rounded-2xl overflow-hidden text-left active:scale-[0.98] transition h-56">
              <img src={l.img} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-night/90 via-night/15 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-3">
                <div className="text-[9px] font-bold uppercase tracking-wide text-lime">{l.who}</div>
                <div className="font-display uppercase text-lg leading-none drop-shadow">{l.title}</div>
                <div className="text-xs text-cream/80 mt-1">{l.price}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-cream/40 mt-6 mb-3">Essentials</div>
        <button className="relative w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition">
          <img src={OUTFIT_IMG.essentials} alt="" className="w-full h-44 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/10 to-transparent" />
          <div className="absolute bottom-3 left-3">
            <div className="font-display uppercase text-lg leading-none drop-shadow">Jerseys · caps · bags</div>
            <div className="text-xs text-cream/80 mt-1">from 199 kr</div>
          </div>
        </button>

        <div className="rounded-2xl border-2 border-line p-4 mt-6 text-center">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cream/50">Shop the looks · powered by</div>
          <div className="font-display text-2xl uppercase mt-1">{OUTFITS.partner}</div>
          <div className="text-xs text-cream/40 mt-1">Live product feed · tap any item to shop</div>
        </div>
        <p className="flourish text-center text-lg text-cream/30 mt-5">look the part. find your people.</p>
      </div>
    </div>
  )
}

// --- leaders ---------------------------------------------------------------
function LeadersScreen({ plans, onBuyBeer }) {
  const resolve = useResolve()
  const reach = {}; plans.forEach((p) => { reach[p.host_id] = (reach[p.host_id] || 0) + p.participant_ids.length })
  const builder = Object.entries(reach).sort((a, b) => b[1] - a[1])[0]
  const counts = {}; plans.forEach((p) => { counts[p.host_id] = (counts[p.host_id] || 0) + 1 })
  const host = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const cards = [
    { title: 'Community Builder', sub: 'Brings the most people together', color: '#8ACE00', user: resolve(builder[0]), metric: builder[1] + ' people gathered' },
    { title: 'Social Host', sub: 'Hosts the most watch plans', color: '#FF3E9A', user: resolve(host[0]), metric: host[1] + ' plans hosted' },
    { title: 'Super Predictor', sub: 'Best match predictions', color: '#2A5BFF', user: resolve('u_005'), metric: '7 / 9 correct' },
  ]
  return (
    <div className="px-5 pb-6">
      <header className="pt-2 pb-4">
        <h1 className="font-display text-[42px] leading-[0.88] uppercase">The<br /><span className="flourish lowercase text-[46px] text-lime">leaders</span></h1>
        <p className="text-sm text-cream/55 mt-3">For the people who bring the city together — not points, not likes. Real-world coordination.</p>
      </header>

      <div className="space-y-3">
        {cards.map((c) => {
          const txt = c.color === '#8ACE00' ? NIGHT : '#fff'
          return (
            <div key={c.title} className="rounded-2xl p-4" style={{ background: c.color, color: txt }}>
              <div className="flex items-center justify-between">
                <div className="font-display uppercase text-lg leading-none">{c.title}</div>
                <span className="text-2xl">🏆</span>
              </div>
              <div className="text-[11px] uppercase tracking-wide opacity-70 mt-1">{c.sub}</div>
              <div className="flex items-center gap-3 mt-3">
                <Avatar user={c.user} size={44} />
                <div><div className="font-bold">{c.user.name} {c.user.flag}</div><div className="text-sm font-bold opacity-90">{c.metric}</div></div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border-2 border-line p-4 mt-5 text-center">
        <div className="text-[11px] uppercase tracking-[0.18em] text-cream/50">Prizes powered by</div>
        <div className="font-display text-2xl uppercase mt-1">Unisport</div>
        <div className="text-xs text-cream/40 mt-1">Top 3 in each category win official kit</div>
      </div>

      <button onClick={onBuyBeer} className="w-full mt-3 rounded-2xl bg-panel border border-line p-4 flex items-center gap-3 active:scale-[0.98] transition">
        <span className="text-2xl">🍺</span>
        <div className="text-left flex-1"><div className="font-bold">Buy the makers a beer</div><div className="text-xs text-cream/45">RALLY is free & built by two people.</div></div>
        <span className="font-bold">→</span>
      </button>
    </div>
  )
}

// --- share modal -----------------------------------------------------------
function ShareModal({ plan, onClose }) {
  const venue = venueById(plan.venue_id)
  const match = matchById(plan.match_id)
  const [copied, setCopied] = useState(false)
  const channels = [{ label: 'WhatsApp', emoji: '💬' }, { label: 'iMessage', emoji: '📱' }, { label: 'Instagram', emoji: '📸' }, { label: 'Copy link', emoji: '🔗' }]
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-4 text-cream" onClick={onClose}>
      <div className="w-full sm:max-w-[380px] animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-3xl overflow-hidden bg-lime text-night p-6 text-center">
          <div className="font-display text-2xl uppercase tracking-tight">RALLY</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-night/60">Copenhagen</div>
          <div className="text-6xl my-3">{venue.emoji}</div>
          <div className="font-display uppercase text-xl leading-[0.95]">I’m watching<br />{match.flag_a} {match.team_a} v {match.team_b} {match.flag_b}</div>
          <div className="flourish text-2xl mt-2">at {venue.name}</div>
          <div className="text-xs text-night/60 uppercase tracking-wide mt-1">{venue.area} · from {plan.time}</div>
          <div className="mt-4 flex items-center justify-center gap-2"><AvatarStack ids={plan.participant_ids} size={28} /><span className="text-sm font-bold">join us 👇</span></div>
          <div className="mt-4 inline-block bg-night text-lime font-bold text-sm px-4 py-2 rounded-full">rally.app/p/{plan.id.replace('p_', '')}</div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {channels.map((c) => (
            <button key={c.label} onClick={() => { if (c.label === 'Copy link') { setCopied(true); setTimeout(() => setCopied(false), 1500) } }}
              className="flex flex-col items-center gap-1 bg-panel border border-line rounded-2xl py-3 active:scale-95 transition">
              <span className="text-2xl">{c.emoji}</span><span className="text-[10px] uppercase tracking-wide text-cream/60">{c.label}</span>
            </button>
          ))}
        </div>
        {copied && <div className="text-center text-lime text-sm font-bold mt-2">Link copied ✓</div>}
        <button onClick={onClose} className="w-full text-center text-cream/60 text-sm mt-4 py-2">Close</button>
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
function StickyBar({ children }) {
  return (
    <div className="fixed sm:absolute bottom-[60px] left-0 right-0 px-5 pb-3 pt-8 bg-gradient-to-t from-night via-night to-transparent">{children}</div>
  )
}

function TopBar({ onBack, title }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 sticky top-0 bg-night/90 backdrop-blur z-10">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-panel border border-line flex items-center justify-center active:scale-90 transition">‹</button>
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-cream/50">{title}</span>
    </div>
  )
}

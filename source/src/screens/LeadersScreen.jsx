// Leaders — lazy-loaded. Shared primitives come back from App.jsx.
import { Avatar, useResolve, NIGHT } from '../App.jsx'

export default function LeadersScreen({ plans, onBuyBeer }) {
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

// Plan detail — lazy-loaded. Shared primitives come back from App.jsx (safe
// circular import: only loaded via dynamic import()).
import { venueById, matchById } from '../data/mockData.js'
import {
  TopBar, Img, VibeTag, TvChips, Avatar, StickyBar, Pill, useResolve,
} from '../App.jsx'

export default function PlanScreen({ plan, joined, onBack, onToggleJoin, onShare }) {
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

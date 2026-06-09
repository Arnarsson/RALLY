// Outfit — lazy-loaded. The brand-board crops (OUTFIT_IMG) are large data URIs,
// so keeping this off the initial chunk is a real payload win for Tonight.
import { useState } from 'react'
import { OUTFITS } from '../data/mockData.js'
import { OUTFIT_IMG } from '../data/outfitImages.js'

// §2 reward card — the connector's reward. Renders earned single-use Miinto
// codes as a small gift; returns null when there are none (always [] in demo).
function RewardCard({ discounts = [] }) {
  const [copied, setCopied] = useState(null)
  const live = discounts.filter((d) => !d.redeemed)
  if (!live.length) return null

  const fmtDate = (s) => {
    try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
    catch { return null }
  }
  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code) } catch { /* clipboard blocked */ }
    setCopied(code); setTimeout(() => setCopied(null), 1600)
  }

  return (
    <div className="rounded-2xl border-2 border-lime/60 bg-lime/[0.06] p-4 mt-6">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">Your reward · for the connectors</div>
        <span className="text-lg">🎟️</span>
      </div>
      <p className="text-sm text-cream/70 mt-1 leading-snug">
        You pulled someone into a RALLY. Here’s <span className="font-bold text-cream">15% off at Miinto</span> — dress the part on us.
      </p>
      <div className="mt-3 space-y-2">
        {live.map((d) => {
          const exp = fmtDate(d.expires_at)
          return (
            <div key={d.code} className="flex items-center gap-2 bg-night/40 border border-line rounded-xl p-2 pl-3">
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg uppercase tracking-wide truncate">{d.code}</div>
                <div className="text-[10px] uppercase tracking-wide text-cream/40">
                  {d.pct}% · {d.partner || 'Miinto'} · single-use{exp ? ` · ends ${exp}` : ''}
                </div>
              </div>
              <button onClick={() => copy(d.code)}
                className="shrink-0 rounded-lg bg-lime text-night px-3 py-2 text-[11px] font-bold uppercase tracking-wide active:scale-95 transition">
                {copied === d.code ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OutfitScreen({ discounts = [] }) {
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

        {/* §2 REFERRAL — the connector's reward. Earned 15% Miinto codes surface
            here as a small gift, never a coupon dump. Hidden when there are none. */}
        <RewardCard discounts={discounts} />

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

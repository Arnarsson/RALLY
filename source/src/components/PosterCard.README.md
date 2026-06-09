# PosterCard — matchday poster / share card

## What this is

`PosterCard.jsx` is the in-app React component that renders the 9:16 matchday
poster. It is the same visual as the `api/poster/[id].png.js` serverless
endpoint (which renders via `@vercel/og` / satori).

Both share the same design language: dark ink base, team-colour dual glow,
halftone texture, Archivo Black team names, Instrument Serif italic "versus",
flags, lowdown/TV/going pills, JOIN THE RALLY footer.

---

## Endpoint URL shape

```
GET /api/poster/<matchId>.png

Examples:
  /api/poster/wc_760415.png
  /api/poster/wc_760415.png?planId=reffen
  /api/poster/wc_760415.png?planId=reffen&going=6
  /api/poster/wc_760415.png?lowdown=Group+A+opener...&tv=DR1
```

Query params (all optional):

| param     | description                                     |
|-----------|-------------------------------------------------|
| `planId`  | venue slug for the footer (`rally.futbol/p/...`)|
| `going`   | number of attendees for the GOING pill          |
| `lowdown` | override the lowdown/commentary line            |
| `tv`      | override the TV channel label                   |

Response: `image/png`, `Cache-Control: public, max-age=3600`.

---

## Where to mount the in-app share button

NOTE: Do not edit `App.jsx` directly — another agent owns it. The snippet
below shows where and how to wire this in once App.jsx is ready for integration.

```jsx
// In App.jsx — inside the MatchDetail or PlanDetail screen render,
// where you want a "Share" / "Share this match" button:

import PosterCard from './components/PosterCard'

// ... inside the component ...

// 1. State to toggle the share sheet
const [showPoster, setShowPoster] = React.useState(false)

// 2. The share button (add to the action row near the existing "Join" CTA):
<button
  onClick={() => setShowPoster(true)}
  className="pill bg-lime text-ink font-bold uppercase tracking-widest"
>
  Share
</button>

// 3. The share sheet overlay (add at the bottom of the screen, inside the
//    same view stack):
{showPoster && (
  <div
    style={{
      position: 'fixed', inset: 0, zIndex: 99,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 24,
    }}
    onClick={() => setShowPoster(false)}
  >
    <PosterCard
      match={match}       // current match object
      plan={plan}         // current plan object (optional)
      planId={plan?.id}   // for footer URL
      width={300}
    />
    <button
      style={{ /* pill style */ }}
      onClick={async (e) => {
        e.stopPropagation()
        const url = `/api/poster/${match.id}.png${plan ? `?planId=${plan.id}` : ''}`
        if (navigator.share) {
          await navigator.share({ url: `https://rally.futbol${url}`, title: `${match.team_a} vs ${match.team_b}` })
        } else {
          window.open(url, '_blank')
        }
      }}
    >
      Download / Share
    </button>
  </div>
)}
```

---

## vercel.json cron line (add later — do not edit vercel.json now)

Add this entry to the `"crons"` array in `source/vercel.json` when you want
the daily poster to be pre-rendered and posted to social channels:

```json
{
  "path": "/api/poster/cron",
  "schedule": "0 7 * * *"
}
```

This fires daily at 07:00 UTC (09:00 Copenhagen / CEST). You would create a
separate `source/api/poster/cron.js` handler that:
1. Reads all matches with `status = "pre"` and `kickoff` date = today from Supabase.
2. Hits `/api/poster/<id>.png` for each to warm the CDN cache.
3. Optionally POSTs the image URL to the Instagram / TikTok scheduling API.

The poster endpoint itself does not need to change — just point the social
pipeline at the same URL.

---

## Props reference

| prop     | type   | default   | description                               |
|----------|--------|-----------|-------------------------------------------|
| `match`  | object | `{}`      | Fixture/match from fixtures.json / MATCHES|
| `plan`   | object | —         | Plan object with `venue.name`, `participants` |
| `planId` | string | —         | Plan slug for footer URL                  |
| `width`  | number | `340`     | Width in px (height is auto 9:16)         |
| `style`  | object | —         | Extra inline styles on the root element   |

Match fields used (all with fallbacks):
`team_a`, `team_b`, `flag_a`, `flag_b`, `color_a`, `color_b`, `kickoff`,
`day`, `status`, `clock`, `archive.src`, `lowdown`, `commentary`, `h2h`,
`prob_a`, `prob_b`, `prob_draw`, `tv`, `venue`.

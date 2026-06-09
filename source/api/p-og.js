// Vercel Serverless Function — /api/p-og?planId=<id>
//
// Crawler-facing HTML for a shared watch-plan link. The Edge Middleware rewrites
// /p/<id> here ONLY for link-preview bots; humans pass straight to the SPA. We
// fetch the plan + match + venue + live going-count and emit per-plan OG/Twitter
// tags in RALLY's voice (SOUL.md), with the match-specific landscape poster as
// the share image. Bots don't run JS, so meta tags are all they need — but we
// also add a refresh + link to the real /p/<id> for any human that lands here.
//
// Resilient by design: any missing data degrades to the site-wide brand card
// rather than 500ing.

const ORIGIN = 'https://rally.futbol'

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function sb(path) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!r.ok) return null
    return r.json()
  } catch { return null }
}

async function goingCount(planId) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const r = await fetch(
      `${url}/rest/v1/plan_participants?plan_id=eq.${encodeURIComponent(planId)}&select=user_id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' } },
    )
    const cr = r.headers.get('content-range') || ''
    const total = cr.split('/')[1]
    return total && total !== '*' ? Number(total) : null
  } catch { return null }
}

function whenWord(match) {
  try {
    if (match && match.kickoff) {
      const now = new Date()
      const k = new Date(match.kickoff)
      if (k.getFullYear() === now.getFullYear() && k.getMonth() === now.getMonth() && k.getDate() === now.getDate()) {
        return 'tonight'
      }
    }
  } catch { /* fall through */ }
  return (match && match.day) ? String(match.day).toLowerCase() : 'this week'
}

// SOUL-voice description for the unfurl — "the burn": forwardable, from the bar.
function describe({ teamA, teamB, venue, host, going, when }) {
  const at = venue ? ` at ${venue}` : ''
  const tail = "Get down here — don't watch it alone."
  if (going != null && going > 1) {
    return `${going} already in${at} for ${teamA} v ${teamB} ${when}. Grab a spot — don't watch it alone.`
  }
  if (host) {
    return `${host}'s rounding up a crew for ${teamA} v ${teamB}${at} ${when}. ${tail}`
  }
  return `A spot's open for ${teamA} v ${teamB}${at} ${when}. ${tail}`
}

function page({ title, description, image, canonical }) {
  const t = esc(title), d = esc(description), img = esc(image), url = esc(canonical)
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="RALLY" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${t}" />
<meta property="og:locale" content="en_DK" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0; url=${url}" />
</head><body style="margin:0;background:#0B0B0B;color:#F5F1E6;font-family:system-ui,sans-serif">
<p style="padding:24px">Taking you to the rally… <a href="${url}" style="color:#A8FF00">${url}</a></p>
</body></html>`
}

export default async function handler(req, res) {
  const q = req.query || {}
  const planId = q.planId || null
  const ref = q.ref || null
  const canonical = planId
    ? `${ORIGIN}/p/${encodeURIComponent(planId)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`
    : `${ORIGIN}/`

  // Brand-default fallback (used when we can't resolve the plan).
  let title = "RALLY — the best seat isn't the stadium"
  let description = "It's a packed bar with your lot. Find tonight's match in Copenhagen, grab a spot, get down there. We don't just watch the game — we rally for it."
  let image = `${ORIGIN}/og-image.png`

  const debug = q.debug ? { env: { url: !!process.env.SUPABASE_URL, key: !!process.env.SUPABASE_SERVICE_ROLE_KEY } } : null

  try {
    if (planId) {
      const planRows = await sb(`plans?id=eq.${encodeURIComponent(planId)}&select=id,match_id,venue_id,host_id,time&limit=1`)
      if (debug) debug.planRows = planRows
      const plan = Array.isArray(planRows) && planRows.length ? planRows[0] : null
      if (plan && plan.match_id) {
        const [matchRows, venueRows, hostRows, going] = await Promise.all([
          sb(`matches?id=eq.${encodeURIComponent(plan.match_id)}&select=team_a,team_b,kickoff,day,status&limit=1`),
          plan.venue_id ? sb(`venues?id=eq.${encodeURIComponent(plan.venue_id)}&select=name&limit=1`) : Promise.resolve(null),
          plan.host_id ? sb(`profiles?id=eq.${encodeURIComponent(plan.host_id)}&select=name&limit=1`) : Promise.resolve(null),
          goingCount(planId),
        ])
        const match = Array.isArray(matchRows) && matchRows.length ? matchRows[0] : null
        if (match && match.team_a && match.team_b) {
          const venue = Array.isArray(venueRows) && venueRows.length ? venueRows[0].name : null
          const host = Array.isArray(hostRows) && hostRows.length ? hostRows[0].name : null
          const teamA = match.team_a, teamB = match.team_b
          title = `${teamA} v ${teamB}${venue ? ` · ${venue}` : ''}`
          description = describe({ teamA, teamB, venue, host, going, when: whenWord(match) })
          const qs = new URLSearchParams({ format: 'og', planId })
          if (going != null && going > 0) qs.set('going', String(going))
          image = `${ORIGIN}/api/poster/${encodeURIComponent(plan.match_id)}.png?${qs.toString()}`
        }
      }
    }
  } catch (err) { if (debug) debug.error = String(err && err.message) }

  if (debug) {
    debug.resolved = { title, image }
    res.setHeader('Content-Type', 'application/json')
    res.status(200).send(JSON.stringify(debug, null, 2))
    return
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400')
  res.status(200).send(page({ title, description, image, canonical }))
}

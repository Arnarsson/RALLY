// Vercel Serverless Function — /api/push/goal
//
// Fired by a Postgres trigger on `matches` (via pg_net) the moment a live score
// changes or a match goes to full time. Composes the alert in RALLY's voice and
// web-pushes it to subscribers. Secret-gated so only the DB trigger can call it.
//
// Body (from the trigger): { match_id, team_a, team_b, score_a, score_b,
//   old_score_a, old_score_b, clock, status }
//
// TARGETED, not spammy: a goal only pings people who actually have a plan for
// that match (the plan's host + everyone "going"). No plan for the match → no
// push. The whole point is "get to YOUR people", not buzz the whole city for
// every goal in the tournament.

import webpush from 'web-push'

const VAPID_PUBLIC = 'BOW1RuIFqOJJ6WjNjzPDwI5UHZmqCKBecoFUo9JsM6l7bViluVA8fBK9c7NCOVNyjPGgH6uEz1SjdGGkYnZcfGQ'

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  let raw = ''
  for await (const c of req) raw += c
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

// Only the people with a plan for THIS match: the plan host(s) + everyone
// "going". Returns their push subscriptions. No plan → empty → nobody buzzed.
async function getSubsForMatch(matchId) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !matchId) return []
  const H = { apikey: key, Authorization: `Bearer ${key}` }
  const j = async (path) => { const r = await fetch(`${url}/rest/v1/${path}`, { headers: H }); return r.ok ? r.json() : [] }

  const plans = await j(`plans?match_id=eq.${encodeURIComponent(matchId)}&select=id,host_id`)
  if (!plans.length) return []
  const planIds = plans.map((p) => p.id)
  const hostIds = plans.map((p) => p.host_id).filter(Boolean)
  const parts = await j(`plan_participants?plan_id=in.(${planIds.join(',')})&select=user_id`)
  const userIds = [...new Set([...hostIds, ...parts.map((p) => p.user_id).filter(Boolean)])]
  if (!userIds.length) return []
  return j(`push_subscriptions?user_id=in.(${userIds.join(',')})&select=endpoint,p256dh,auth`)
}

async function pruneStale(endpoint) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    await fetch(`${url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
      method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
  } catch { /* best effort */ }
}

// RALLY voice — the cooldown / hook gears. A goal is a shout; full time is the
// reaction. Never neutral, never "score update".
function compose(m) {
  const a = Number(m.score_a) || 0, b = Number(m.score_b) || 0
  const oa = Number(m.old_score_a) || 0, ob = Number(m.old_score_b) || 0
  const line = `${m.team_a} ${a}–${b} ${m.team_b}`
  const clock = m.clock ? `${String(m.clock).replace(/'$/, '')}'` : 'LIVE'

  if (m.status === 'post') {
    const tail = a === b ? 'Shared the spoils — and the night.' : 'Get the next round in.'
    return { title: `FULL TIME · ${line}`, body: `That's that. ${tail} You didn't watch it alone — that's the whole point.`, url: '/' }
  }
  const scorer = a > oa ? m.team_a : (b > ob ? m.team_b : null)
  const title = scorer ? `⚽ GOAL — ${scorer}!` : '⚽ GOAL!'
  return { title, body: `${line} · ${clock}. It's kicking off — find your people, don't watch it alone.`, url: '/' }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ ok: false, error: 'method not allowed' }); return }
  const secret = req.headers['x-rally-secret']
  if (!secret || secret !== process.env.CRON_SECRET) { res.status(401).json({ ok: false, error: 'unauthorized' }); return }

  const m = await readBody(req)
  if (!m.team_a || !m.team_b) { res.status(400).json({ ok: false, error: 'missing match fields' }); return }

  // Guard: only fire for a real goal (total increased) or a fresh full-time.
  const gained = ((Number(m.score_a) || 0) + (Number(m.score_b) || 0)) - ((Number(m.old_score_a) || 0) + (Number(m.old_score_b) || 0))
  const isGoal = m.status === 'in' && gained > 0
  const isFT = m.status === 'post'
  if (!isGoal && !isFT) { res.status(200).json({ ok: true, skipped: 'no goal / not full time' }); return }

  try {
    webpush.setVapidDetails(process.env.PUSH_VAPID_SUBJECT, VAPID_PUBLIC, process.env.PUSH_VAPID_PRIVATE)
  } catch (e) { res.status(500).json({ ok: false, error: 'vapid: ' + e.message }); return }

  const payload = JSON.stringify(compose(m))
  const subs = await getSubsForMatch(m.match_id)
  let sent = 0, failed = 0, removed = 0
  await Promise.all(subs.map(async (s) => {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
    try { await webpush.sendNotification(sub, payload); sent++ }
    catch (err) {
      const code = err && err.statusCode
      if (code === 404 || code === 410) { await pruneStale(s.endpoint); removed++ }
      else failed++
    }
  }))
  res.status(200).json({ ok: true, kind: isGoal ? 'goal' : 'full_time', sent, failed, removed })
}

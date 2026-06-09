// Vercel Serverless Function — POST /api/push/send
//
// Fan-out Web-Push to stored subscriptions. This is the "send a test
// notification" / match-night broadcast path. It is privileged: a caller must
// present the shared CRON_SECRET, so it can be driven by a cron job or an admin
// curl, but never by an anonymous client.
//
// Request (JSON body):
//   {
//     token:   string,           // MUST equal process.env.CRON_SECRET
//     title:   string,           // notification title
//     body:    string,           // notification body text
//     url?:    string,           // deep-link opened on click (default '/')
//     userId?: string | null,    // if set, only notify this user's devices
//   }
//
// Response:
//   200  { sent, failed, removed }   — counts across all targeted subscriptions
//   400  { ok: false, error }        — missing title/body, or invalid json
//   401  { ok: false, error }        — bad/missing token
//   405  { ok: false, error }        — non-POST
//   500  { ok: false, error }        — config or storage error
//
// Subscriptions live in the Supabase `push_subscriptions` table; we read them via
// the REST API with the service-role key. For each one we call
// webpush.sendNotification(); when a push service reports the subscription is
// gone (404 / 410), we DELETE that stale row so the list stays clean.
//
// VAPID: the PUBLIC key is hardcoded below (it is public by definition — it ships
// to every browser). The PRIVATE key and the mailto: subject come from env.

import webpush from 'web-push'

// VAPID public key — public by design (the browser holds it too). Safe to commit.
const VAPID_PUBLIC = 'BOW1RuIFqOJJ6WjNjzPDwI5UHZmqCKBecoFUo9JsM6l7bViluVA8fBK9c7NCOVNyjPGgH6uEz1SjdGGkYnZcfGQ'

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return null }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  if (!chunks.length) return null
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return null }
}

// Load subscriptions (optionally filtered to one user) from Supabase REST.
async function loadSubscriptions(url, key, userId) {
  let q = `${url}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth`
  if (userId) q += `&user_id=eq.${encodeURIComponent(userId)}`
  const r = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) throw new Error(`load failed (${r.status})`)
  const rows = await r.json()
  return Array.isArray(rows) ? rows : []
}

// Remove a stale subscription row by endpoint (best-effort).
async function deleteSubscription(url, key, endpoint) {
  try {
    await fetch(
      `${url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' } },
    )
  } catch { /* swallow — cleanup is opportunistic */ }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, error: 'method not allowed' })
    return
  }

  let body
  try { body = await readJsonBody(req) }
  catch { res.status(400).json({ ok: false, error: 'invalid json' }); return }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'invalid json' })
    return
  }

  // Auth — token must match CRON_SECRET. Also accept an Authorization: Bearer
  // header so a cron runner can supply it the conventional way.
  const secret = process.env.CRON_SECRET
  const headerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  const token = (typeof body.token === 'string' && body.token) || headerToken
  if (!secret || !token || token !== secret) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  const clickUrl = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : '/'
  const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null

  if (!title || !text) {
    res.status(400).json({ ok: false, error: 'missing title or body' })
    return
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { res.status(500).json({ ok: false, error: 'storage not configured' }); return }

  const privateKey = process.env.PUSH_VAPID_PRIVATE
  const subject = process.env.PUSH_VAPID_SUBJECT
  if (!privateKey || !subject) { res.status(500).json({ ok: false, error: 'vapid not configured' }); return }

  try {
    webpush.setVapidDetails(subject, VAPID_PUBLIC, privateKey)
  } catch (err) {
    res.status(500).json({ ok: false, error: 'vapid setup failed: ' + (err && err.message) })
    return
  }

  let subs
  try { subs = await loadSubscriptions(url, key, userId) }
  catch (err) { res.status(500).json({ ok: false, error: (err && err.message) || 'load failed' }); return }

  const payload = JSON.stringify({ title, body: text, url: clickUrl })

  let sent = 0
  let failed = 0
  const staleEndpoints = []

  await Promise.all(
    subs.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      }
      try {
        await webpush.sendNotification(subscription, payload)
        sent++
      } catch (err) {
        failed++
        // 404 Not Found / 410 Gone → the subscription is dead; mark for removal.
        const code = err && (err.statusCode || err.status)
        if (code === 404 || code === 410) staleEndpoints.push(row.endpoint)
      }
    }),
  )

  // Clean up dead subscriptions.
  await Promise.all(staleEndpoints.map((ep) => deleteSubscription(url, key, ep)))

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ sent, failed, removed: staleEndpoints.length })
}

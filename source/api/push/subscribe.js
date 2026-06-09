// Vercel Serverless Function — POST /api/push/subscribe
//
// Stores (or refreshes) a browser Web-Push subscription so RALLY can later send
// match-night notifications to this device. Called from the service-worker
// registration flow on the client after the user grants Notification permission.
//
// Request (JSON body):
//   {
//     subscription: { endpoint: string, keys: { p256dh: string, auth: string } },
//     userId?:  string | null,   // anon Supabase user id, when known
//     ua?:      string,          // navigator.userAgent, for debugging
//   }
//
// Response:
//   200  { ok: true }
//   400  { ok: false, error: 'missing endpoint|keys' }   — invalid body
//   405  { ok: false, error: 'method not allowed' }       — non-POST
//   500  { ok: false, error: '...' }                      — Supabase write failed
//
// Storage: UPSERT into the Supabase `push_subscriptions` table via the REST API
// using the service-role key (server-side only). `endpoint` is UNIQUE, so we
// upsert on conflict(endpoint) and merge — re-subscribing the same device just
// refreshes its keys / user_id / ua / timestamp rather than duplicating rows.
//
// SECURITY: no client auth — the table's RLS allows anon insert, and the
// service-role write here is equivalent. The endpoint stores only push routing
// data; there is nothing sensitive to leak back.

// Read the JSON body whether Vercel parsed it (req.body) or handed us a stream.
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return null }
  }
  // Fall back to draining the raw request stream.
  const chunks = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  if (!chunks.length) return null
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return null }
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

  const sub = body.subscription || {}
  const endpoint = typeof sub.endpoint === 'string' ? sub.endpoint.trim() : ''
  const keys = sub.keys || {}
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : ''
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : ''

  if (!endpoint) { res.status(400).json({ ok: false, error: 'missing endpoint' }); return }
  if (!p256dh || !auth) { res.status(400).json({ ok: false, error: 'missing keys' }); return }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { res.status(500).json({ ok: false, error: 'storage not configured' }); return }

  const userId = typeof body.userId === 'string' && body.userId.trim() ? body.userId.trim() : null
  const ua = typeof body.ua === 'string' ? body.ua.slice(0, 512) : null

  const row = {
    user_id: userId,
    endpoint,
    p256dh,
    auth,
    ua,
  }

  try {
    // Upsert on the UNIQUE endpoint column. Prefer: resolution=merge-duplicates
    // updates the existing row in place; return=minimal keeps the body empty.
    const r = await fetch(
      `${url}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(row),
      },
    )
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      res.status(500).json({ ok: false, error: `store failed (${r.status})`, detail: detail.slice(0, 300) })
      return
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'store failed: ' + (err && err.message) })
    return
  }

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true })
}

// ---------------------------------------------------------------------------
// RALLY — live-scores Edge Function (Deno).
//
// Polls API-Football for in-play fixtures and upserts live status/score/clock
// into `matches`. Scheduled by pg_cron every minute; each invocation polls a
// few times ~20s apart so freshness is ~20s without a long-running host.
// Everything runs on Supabase — no Coolify / Fly / Vercel cron.
//
// Secrets (supabase secrets set ...):
//   API_FOOTBALL_KEY   — api-sports.io key (the live data source)
//   CRON_SECRET        — shared secret; pg_cron sends it as x-cron-secret
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected by the runtime.
//
// Dormant until API_FOOTBALL_KEY is set: logs and exits 200, never errors.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("API_FOOTBALL_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const POLLS = 3;           // polls per invocation
const GAP_MS = 20_000;     // ~20s apart → ~40s of coverage per minute

// API-Football team names → our match names (same reconciliation as worker/live.mjs)
const ALIAS: Record<string, string> = {
  "korea republic": "south korea", "czech republic": "czechia",
  "turkey": "türkiye", "cabo verde": "cape verde", "ivory coast": "ivory coast",
  "côte d'ivoire": "ivory coast", "usa": "usa", "united states": "usa",
};
const norm = (s: string) =>
  (ALIAS[(s ?? "").toLowerCase().trim()] ?? (s ?? "").toLowerCase())
    .replace(/[^a-z]/g, "");
const pairKey = (a: string, b: string) => [norm(a), norm(b)].sort().join("-");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sbFetch(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function loadPairMap(): Promise<Record<string, string>> {
  const r = await sbFetch("matches?select=id,team_a,team_b");
  const rows = await r.json();
  const map: Record<string, string> = {};
  for (const m of rows) map[pairKey(m.team_a, m.team_b)] = m.id;
  return map;
}

// Only spend an API call when a match is actually near/live: kickoff within the
// last ~2.5h or the next 5min. Keeps us under API-Football's free 100/day cap
// even with an every-minute cron (most invocations exit here, zero API cost).
async function inMatchWindow(): Promise<boolean> {
  const now = Date.now();
  const lo = new Date(now - 150 * 60_000).toISOString();
  const hi = new Date(now + 5 * 60_000).toISOString();
  const r = await sbFetch(
    `matches?select=id&completed=eq.false&kickoff_utc=gte.${lo}&kickoff_utc=lte.${hi}&limit=1`,
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function pollOnce(pairMap: Record<string, string>): Promise<number> {
  const r = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: { "x-apisports-key": API_KEY },
  });
  if (!r.ok) { console.error(`api-football ${r.status}`); return 0; }
  const body = await r.json();
  let updated = 0;
  for (const fx of body.response ?? []) {
    const home = fx.teams?.home?.name, away = fx.teams?.away?.name;
    const id = pairMap[pairKey(home, away)];
    if (!id) continue; // non-WC or alias gap
    const elapsed = fx.fixture?.status?.elapsed;
    const short = fx.fixture?.status?.short; // 1H,HT,2H,FT...
    const done = ["FT", "AET", "PEN"].includes(short);
    const patch = {
      status: done ? "post" : "in",
      score_a: fx.goals?.home ?? 0,
      score_b: fx.goals?.away ?? 0,
      clock: elapsed != null ? `${elapsed}'` : null,
      completed: done,
    };
    const up = await sbFetch(`matches?id=eq.${id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (up.ok) updated++;
  }
  return updated;
}

Deno.serve(async (req) => {
  // shared-secret guard (pg_cron sends x-cron-secret)
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (!API_KEY) {
    console.log("live-scores: dormant (no API_FOOTBALL_KEY set)");
    return Response.json({ ok: true, dormant: true });
  }
  if (!(await inMatchWindow())) {
    console.log("live-scores: no match window — skipping API call");
    return Response.json({ ok: true, idle: true });
  }
  const pairMap = await loadPairMap();
  let total = 0;
  for (let i = 0; i < POLLS; i++) {
    total += await pollOnce(pairMap);
    if (i < POLLS - 1) await sleep(GAP_MS);
  }
  console.log(`live-scores: ${total} updates across ${POLLS} polls`);
  return Response.json({ ok: true, updated: total });
});

// ---------------------------------------------------------------------------
// RALLY — live-scores Edge Function (Deno).
//
// Polls a live-score feed for in-play fixtures and upserts live status/score/
// clock into `matches`. Scheduled by pg_cron every minute; each invocation polls
// a few times ~20s apart so freshness is ~20s without a long-running host.
// Everything runs on Supabase — no Coolify / Fly / Vercel cron.
//
// Secrets (supabase secrets set ...):
//   LIVE_FEED_URL      — default source: a free public scoreboard, no key/quota
//   API_FOOTBALL_KEY   — OPTIONAL upgrade; used instead of the feed if present
//   CRON_SECRET        — shared secret; pg_cron sends it as x-cron-secret
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected by the runtime.
//
// Idle when no match is in window; no-op if neither source is configured.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("API_FOOTBALL_KEY") ?? "";
// Live feed endpoint is supplied via secret, never hardcoded — the provider is
// not named anywhere in this repo or surfaced to clients.
const FEED_URL = Deno.env.get("LIVE_FEED_URL") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const POLLS = 3;           // polls per invocation
const GAP_MS = 20_000;     // ~20s apart → ~40s of coverage per minute

// Feed team names → our match names (same reconciliation as the schedule loader)
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
// last ~2.5h or the next 5min. Keeps polling polite (and, if the optional keyed
// upgrade is used, well under its free daily cap) — most invocations exit here.
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

async function updateMatch(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const up = await sbFetch(`matches?id=eq.${id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  return up.ok;
}

// FREE / NO KEY / NO QUOTA — a public scoreboard feed (URL from LIVE_FEED_URL
// secret). Returns live state, score and the match clock with no auth. Default
// live source (zero keys). Server-side only; provider never named or surfaced.
async function pollFeed(pairMap: Record<string, string>): Promise<number> {
  const r = await fetch(FEED_URL, { headers: { "User-Agent": "rally-live/1.0" } });
  if (!r.ok) { console.error(`feed ${r.status}`); return 0; }
  const data = await r.json();
  let updated = 0;
  for (const ev of data.events ?? []) {
    const comp = ev.competitions?.[0]; if (!comp) continue;
    const t = comp.status?.type ?? {};
    if (t.state === "pre") continue; // nothing live to write yet
    const home = comp.competitors?.find((c: any) => c.homeAway === "home") ?? comp.competitors?.[0];
    const away = comp.competitors?.find((c: any) => c.homeAway === "away") ?? comp.competitors?.[1];
    if (!home || !away) continue;
    const id = pairMap[pairKey(
      home.team?.shortDisplayName ?? home.team?.name,
      away.team?.shortDisplayName ?? away.team?.name,
    )];
    if (!id) continue;
    const done = t.state === "post" || !!t.completed;
    if (await updateMatch(id, {
      status: done ? "post" : "in",
      score_a: Number(home.score ?? 0),
      score_b: Number(away.score ?? 0),
      clock: comp.status?.displayClock ?? null,
      completed: done,
    })) updated++;
  }
  return updated;
}

// OPTIONAL UPGRADE — API-Football (richer events), used only if a key is set.
async function pollApiFootball(pairMap: Record<string, string>): Promise<number> {
  const r = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
    headers: { "x-apisports-key": API_KEY },
  });
  if (!r.ok) { console.error(`api-football ${r.status}`); return 0; }
  const body = await r.json();
  let updated = 0;
  for (const fx of body.response ?? []) {
    const id = pairMap[pairKey(fx.teams?.home?.name, fx.teams?.away?.name)];
    if (!id) continue;
    const short = fx.fixture?.status?.short;
    const done = ["FT", "AET", "PEN"].includes(short);
    const elapsed = fx.fixture?.status?.elapsed;
    if (await updateMatch(id, {
      status: done ? "post" : "in",
      score_a: fx.goals?.home ?? 0,
      score_b: fx.goals?.away ?? 0,
      clock: elapsed != null ? `${elapsed}'` : null,
      completed: done,
    })) updated++;
  }
  return updated;
}

Deno.serve(async (req) => {
  // shared-secret guard (pg_cron sends x-cron-secret)
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (!API_KEY && !FEED_URL) {
    console.log("live-scores: no live source configured");
    return Response.json({ ok: true, unconfigured: true });
  }
  if (!(await inMatchWindow())) {
    console.log("live-scores: no match window — skipping");
    return Response.json({ ok: true, idle: true });
  }
  const pairMap = await loadPairMap();
  const poll = API_KEY ? pollApiFootball : pollFeed; // free public feed, no key/quota
  const source = API_KEY ? "api-football" : "live";
  let total = 0;
  for (let i = 0; i < POLLS; i++) {
    total += await poll(pairMap);
    if (i < POLLS - 1) await sleep(GAP_MS);
  }
  console.log(`live-scores: ${total} updates via ${source}`);
  return Response.json({ ok: true, updated: total, source });
});

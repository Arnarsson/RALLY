// ---------------------------------------------------------------------------
// RALLY — squads Edge Function (Deno).
//
// Pulls every nation's squad (players + positions + coach) from a free public
// feed and upserts into `squads`. Keyed by the SAME team name the `matches`
// rows use (shortDisplayName, normalised) so the UI joins by team cleanly.
// Run on demand / occasionally — squads are near-static during a tournament.
//
// Secrets: SQUAD_FEED_BASE (feed base URL — provider never named in repo),
//          CRON_SECRET. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY auto-injected.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FEED_BASE = Deno.env.get("SQUAD_FEED_BASE") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
// Feed's team name → the name `matches` uses, so squad keys line up for join.
const KEY_ALIAS: Record<string, string> = {
  bosniaherzegovina: "bosniaherz",
  unitedstates: "usa",
};
const feed = (path: string) =>
  fetch(`${FEED_BASE}${path}`, { headers: { "User-Agent": "rally-squads/1.0" } });

async function sbUpsert(rows: unknown[]) {
  return fetch(`${SUPABASE_URL}/rest/v1/squads?on_conflict=team_key`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
}

function mapRoster(data: any) {
  const t = data.team ?? {};
  const name = t.shortDisplayName ?? t.displayName ?? t.name;
  if (!name) return null;
  const key = norm(name);
  const players = (data.athletes ?? []).map((a: any) => ({
    name: a.fullName ?? a.displayName,
    pos: a.position?.abbreviation ?? null,
    no: a.jersey ?? null,
  })).filter((p: any) => p.name);
  const c = Array.isArray(data.coach) ? data.coach[0] : data.coach;
  const coach = c ? `${(c.firstName ?? "").trim()} ${(c.lastName ?? "").trim()}`.trim() : null;
  return {
    team_key: KEY_ALIAS[key] ?? key, team: name,
    flag: t.abbreviation ?? null, players, coach: coach || null,
  };
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (!FEED_BASE) return Response.json({ ok: true, unconfigured: true });

  const listR = await feed("/teams");
  if (!listR.ok) return Response.json({ ok: false, error: `teams ${listR.status}` }, { status: 502 });
  const list = await listR.json();
  const teams = list.sports?.[0]?.leagues?.[0]?.teams ?? [];

  const rows: unknown[] = [];
  for (const entry of teams) {
    const id = entry.team?.id;
    if (!id) continue;
    const rR = await feed(`/teams/${id}/roster`);
    if (!rR.ok) { console.error(`roster ${id} ${rR.status}`); continue; }
    const row = mapRoster(await rR.json());
    if (row && row.players.length) rows.push(row);
  }
  if (rows.length) {
    const up = await sbUpsert(rows);
    if (!up.ok) return Response.json({ ok: false, error: await up.text() }, { status: 500 });
  }
  console.log(`squads: upserted ${rows.length} teams`);
  return Response.json({ ok: true, teams: rows.length });
});

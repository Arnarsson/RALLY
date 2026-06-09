// ---------------------------------------------------------------------------
// RALLY — sync-fixtures Edge Function (Deno).
//
// Daily schedule refresh from football-data.org (competition WC). Maps to the
// `matches` columns and upserts. Scheduled by pg_cron once a day. Replaces the
// Vercel cron — the whole pipeline lives on Supabase.
//
// Secrets: FOOTBALL_DATA_TOKEN (the schedule source), CRON_SECRET.
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.
// Dormant (200, no-op) until FOOTBALL_DATA_TOKEN is set.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FD_TOKEN = Deno.env.get("FOOTBALL_DATA_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const TZ = "Europe/Copenhagen";

const FLAG: Record<string, string> = {
  MEX: "🇲🇽", RSA: "🇿🇦", KOR: "🇰🇷", CZE: "🇨🇿", CAN: "🇨🇦", BIH: "🇧🇦", USA: "🇺🇸",
  PAR: "🇵🇾", QAT: "🇶🇦", SUI: "🇨🇭", BRA: "🇧🇷", MAR: "🇲🇦", ARG: "🇦🇷", FRA: "🇫🇷",
  ESP: "🇪🇸", ENG: "🏴", GER: "🇩🇪", POR: "🇵🇹", NED: "🇳🇱", BEL: "🇧🇪", CRO: "🇭🇷",
  URU: "🇺🇾", COL: "🇨🇴", JPN: "🇯🇵", SEN: "🇸🇳", SRB: "🇷🇸", POL: "🇵🇱", NOR: "🇳🇴",
};
const cphLocal = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso)).reduce((a: Record<string, string>, x) => (a[x.type] = x.value, a), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
};
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short" })
    .format(new Date(iso)).toUpperCase().replace(",", "");
const statusOf = (s: string) =>
  s === "FINISHED" ? "post" : (s === "IN_PLAY" || s === "PAUSED") ? "in" : "pre";

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (!FD_TOKEN) {
    console.log("sync-fixtures: dormant (no FOOTBALL_DATA_TOKEN set)");
    return Response.json({ ok: true, dormant: true });
  }
  const r = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": FD_TOKEN },
  });
  if (!r.ok) { console.error(`football-data ${r.status}`); return Response.json({ ok: false }, { status: 502 }); }
  const data = await r.json();
  const rows = (data.matches ?? []).map((m: any) => {
    const home = m.homeTeam ?? {}, away = m.awayTeam ?? {};
    return {
      id: "wc_" + m.id,
      team_a: home.shortName ?? home.name ?? home.tla,
      flag_a: FLAG[home.tla] ?? "🏴", logo_a: home.crest ?? null,
      team_b: away.shortName ?? away.name ?? away.tla,
      flag_b: FLAG[away.tla] ?? "🏴", logo_b: away.crest ?? null,
      kickoff_utc: m.utcDate, kickoff_local: cphLocal(m.utcDate), day: dayLabel(m.utcDate),
      stage: (m.stage ?? "GROUP_STAGE").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
      venue: m.venue ?? null,
      status: statusOf(m.status), completed: m.status === "FINISHED",
      score_a: m.score?.fullTime?.home ?? null, score_b: m.score?.fullTime?.away ?? null,
    };
  });
  const up = await fetch(`${SUPABASE_URL}/rest/v1/matches?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!up.ok) { console.error(`upsert ${up.status}: ${await up.text()}`); return Response.json({ ok: false }, { status: 500 }); }
  console.log(`sync-fixtures: upserted ${rows.length}`);
  return Response.json({ ok: true, upserted: rows.length });
});

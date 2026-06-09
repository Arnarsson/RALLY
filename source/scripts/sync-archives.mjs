// ---------------------------------------------------------------------------
// RALLY — sync-archives.mjs
//
// One-shot data sync: pushes per-match archive photos from the generated
// src/data/fixtures.json into the live Supabase `matches.archive` column.
//
// Why this exists: `npm run archive` writes per-fixture archive objects into
// fixtures.json (used by the standalone build), but the LIVE app reads
// `matches.archive` from Supabase at runtime. Without this sync the deployed
// match-detail heroes fall back to the dark editorial panel because Supabase
// only had a handful of stale/generic archive rows.
//
// Shape: the UI (App.jsx → MatchArt) reads `m.archive.src` and
// `m.archive.credit`. fixtures.json already stores archive as an object in
// exactly that shape ({ src, credit, license, source, kind }), so we upsert it
// verbatim — no string-wrapping needed.
//
// Idempotent: upserts by `id` with merge-duplicates, only touching `archive`.
// The daily sync-fixtures edge function does NOT include `archive` in its
// payload, so it will not clobber these values.
//
// Run:  set -a; . ./source/.env; set +a; node source/scripts/sync-archives.mjs
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  console.error("Load them: set -a; . ./source/.env; set +a");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = resolve(__dirname, "../src/data/fixtures.json");
const { fixtures } = JSON.parse(readFileSync(fixturesPath, "utf8"));

const rows = fixtures
  .filter((f) => f && f.id && f.archive && f.archive.src)
  .map((f) => ({ id: f.id, archive: f.archive }));

console.log(
  `fixtures: ${fixtures.length} total, ${rows.length} with an archive photo to sync.`
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Upsert by id. Only `id` + `archive` are in the payload, so merge-duplicates
// leaves every other column untouched.
const { data, error } = await supabase
  .from("matches")
  .upsert(rows, { onConflict: "id", ignoreDuplicates: false })
  .select("id");

if (error) {
  console.error("Upsert failed:", error);
  process.exit(1);
}

console.log(`Synced archive for ${data.length} matches.`);

// Receipt: how many rows now carry a non-null archive.
const { count, error: countErr } = await supabase
  .from("matches")
  .select("id", { count: "exact", head: true })
  .not("archive", "is", null);

if (countErr) {
  console.error("Count check failed:", countErr);
  process.exit(1);
}
console.log(`matches with non-null archive in Supabase: ${count}`);

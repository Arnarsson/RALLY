-- RALLY — Supabase / Postgres schema
-- ---------------------------------------------------------------------------
-- Column names mirror the UI's mock objects (source/src/data/mockData.js) and
-- the data-pipeline output (source/src/data/fixtures.json) so the front-end
-- port is mechanical — the app reads the same shape from these tables.
--
-- Apply:
--   psql "$DATABASE_URL" -f supabase/schema.sql
--   (or paste into the Supabase Studio → SQL editor and run)
--
-- The whole script is idempotent / re-runnable: tables use
-- `create table if not exists`, functions `create or replace`, policies are
-- dropped before (re)create, and publication changes are guarded so a second
-- run never errors on a duplicate object.
-- ---------------------------------------------------------------------------

-- gen_random_uuid() lives in pgcrypto (present by default on Supabase).
create extension if not exists pgcrypto;

-- ===========================================================================
-- profiles — 1:1 with auth.users (the signed-in person)
-- ===========================================================================
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null,
  flag       text,                          -- emoji or ISO code
  color      text default '#8ACE00',
  created_at timestamptz default now()
);

-- ===========================================================================
-- venues — places to watch (matches VENUES fields in mockData.js)
-- ===========================================================================
create table if not exists venues (
  id          text primary key,            -- e.g. v_08
  name        text not null,
  area        text,
  emoji       text,
  vibe_tags   text[] default '{}',
  capacity    int,
  big_screen  bool default false,
  lat         double precision,
  lng         double precision
);

-- ===========================================================================
-- matches — real fixtures + the hand-authored EDITORIAL overlay.
-- Live fields (status/score/clock/...) are fed by the workers; editorial
-- fields (commentary/fun_fact/featured/marquee/h2h) keep the hero cards alive.
-- ===========================================================================
create table if not exists matches (
  id            text primary key,          -- e.g. wc_760415
  -- teams
  team_a        text, flag_a text, logo_a text, color_a text, form_a text,
  team_b        text, flag_b text, logo_b text, color_b text, form_b text,
  -- schedule
  kickoff_utc   timestamptz,
  kickoff_local text,                       -- pre-formatted local string
  day           text,                       -- day-group label, e.g. "THU 11 JUN"
  stage         text,
  venue         text,
  espn_id       text,                       -- upstream id (ESPN migration aid)
  tv            jsonb,                       -- [{name, free, watch_url}]
  -- live status
  status        text default 'pre',         -- pre | in | post
  status_detail text,                        -- e.g. "Scheduled", "Half Time"
  score_a       int, score_b int,
  clock         text,
  completed     bool default false,
  -- win probability (form-based fallback, or model via predictions)
  prob_a        real, prob_draw real, prob_b real,
  prob_source   text,                        -- illustrative | form | model
  -- media + context
  archive       jsonb,                       -- {src, credit, license, source}
  h2h           jsonb,                       -- {last, score, note}
  -- editorial overlay
  featured      bool default false,
  marquee       bool default false,
  commentary    text,
  fun_fact      text
);

-- ===========================================================================
-- plans — a structured intention to watch a match at a venue
-- ===========================================================================
create table if not exists plans (
  id            uuid primary key default gen_random_uuid(),
  match_id      text references matches(id) on delete cascade,
  venue_id      text references venues(id),
  host_id       uuid references profiles(id),
  time          text,
  vibe          text,
  note          text,
  capacity_hint int,
  created_at    timestamptz default now()
);

-- ===========================================================================
-- plan_participants — who's "going" (join table; live count via Realtime)
-- ===========================================================================
create table if not exists plan_participants (
  plan_id   uuid references plans(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (plan_id, user_id)
);

-- ===========================================================================
-- predictions — penaltyblog model output (powers win-prob + Super Predictor)
-- ===========================================================================
create table if not exists predictions (
  match_id   text primary key references matches(id) on delete cascade,
  prob_a     real, prob_draw real, prob_b real,
  model      text,
  updated_at timestamptz default now()
);

-- ===========================================================================
-- Row Level Security
-- profiles / plans / plan_participants : user-writable with owner checks.
-- matches / venues / predictions       : public read, writes via service_role
--   only (no anon/authenticated write policy → those roles cannot write;
--   the service_role key bypasses RLS entirely).
-- ===========================================================================
alter table profiles          enable row level security;
alter table venues            enable row level security;
alter table matches           enable row level security;
alter table plans             enable row level security;
alter table plan_participants enable row level security;
alter table predictions       enable row level security;

-- profiles: anyone may read; you may only write your own row -----------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (true);

drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- venues: public read-only (writes only via service_role) --------------------
drop policy if exists venues_select on venues;
create policy venues_select on venues
  for select using (true);

-- matches: public read-only (writes only via service_role) -------------------
drop policy if exists matches_select on matches;
create policy matches_select on matches
  for select using (true);

-- predictions: public read-only (writes only via service_role) ---------------
drop policy if exists predictions_select on predictions;
create policy predictions_select on predictions
  for select using (true);

-- plans: anyone may read; host may create/update/delete their own ------------
drop policy if exists plans_select on plans;
create policy plans_select on plans
  for select using (true);

drop policy if exists plans_insert on plans;
create policy plans_insert on plans
  for insert with check (auth.uid() = host_id);

drop policy if exists plans_update on plans;
create policy plans_update on plans
  for update using (auth.uid() = host_id) with check (auth.uid() = host_id);

drop policy if exists plans_delete on plans;
create policy plans_delete on plans
  for delete using (auth.uid() = host_id);

-- plan_participants: anyone may read; you may only add/remove yourself -------
drop policy if exists plan_participants_select on plan_participants;
create policy plan_participants_select on plan_participants
  for select using (true);

drop policy if exists plan_participants_insert on plan_participants;
create policy plan_participants_insert on plan_participants
  for insert with check (auth.uid() = user_id);

drop policy if exists plan_participants_delete on plan_participants;
create policy plan_participants_delete on plan_participants
  for delete using (auth.uid() = user_id);

-- ===========================================================================
-- Realtime — publish live scores (matches) and "going" counts
-- (plan_participants). Guarded so re-runs don't error if already added.
-- ===========================================================================
do $$
begin
  alter publication supabase_realtime add table matches;
exception when duplicate_object then null;  -- already in the publication
end $$;

do $$
begin
  alter publication supabase_realtime add table plan_participants;
exception when duplicate_object then null;  -- already in the publication
end $$;

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
  ext_id       text,                       -- upstream provider id
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

-- ===========================================================================
-- squads + team records (SG4). Squad list comes from a free public feed via
-- the `squads` edge function (provider URL in the SQUAD_FEED_BASE secret).
-- team_records is curated/editorial (all-time WC record — not a clean API
-- field anywhere; seed it separately). Both public-read, service-role write.
-- ===========================================================================
create table if not exists squads (
  team_key text primary key,        -- normalised team name; joins matches.team_a/b
  team text not null, flag text,
  players jsonb default '[]',       -- [{ name, pos, no }]
  coach text, updated_at timestamptz default now()
);
create table if not exists team_records (
  team_key text primary key, team text not null,
  played int, wins int, draws int, losses int, gf int, ga int,
  updated_at timestamptz default now()
);
alter table squads enable row level security;
alter table team_records enable row level security;
drop policy if exists squads_read on squads;
create policy squads_read on squads for select using (true);
drop policy if exists team_records_read on team_records;
create policy team_records_read on team_records for select using (true);

-- ===========================================================================
-- SOCIAL LAYER (phase 1 foundation). All idempotent: `create table if not
-- exists`, `drop policy if exists` before create, RLS enabled on every table,
-- publication adds guarded in do-blocks. Only §3 (player_ratings) + §4 (gender
-- + rating_insights) are wired into the app today; §1/§2/§5/§6/§7 are laid for
-- the next phases.
--
-- GUARDRAILS (enforced by design, not just convention):
--   * Ratings are of ADULT PRO PLAYERS from the squad layer only — never RALLY
--     users, never minors. player_id is a stable slug of (player name + team).
--   * Display is AGGREGATE / ANONYMOUS only — RLS lets anyone read the rows for
--     tallying, but the UI never surfaces an individual's vote.
--   * gender on profiles is OPT-IN (default 'na') and used solely to segment
--     aggregates (rating_insights view).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- §1 — (share/poster analytics live elsewhere; nothing to add here yet)
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- §2 — referrals + discount_codes (owner-scoped). Laid for a later phase.
-- ===========================================================================
create table if not exists referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid references profiles(id) on delete cascade,
  invitee_id  uuid references profiles(id) on delete set null,
  code        text unique not null,
  status      text default 'pending',        -- pending | joined | rewarded
  created_at  timestamptz default now()
);
create table if not exists discount_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  code       text unique not null,
  partner    text,                            -- e.g. 'miinto'
  pct        int,
  redeemed   bool default false,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table referrals      enable row level security;
alter table discount_codes enable row level security;

drop policy if exists referrals_select on referrals;
create policy referrals_select on referrals
  for select using (auth.uid() = referrer_id or auth.uid() = invitee_id);
drop policy if exists referrals_insert on referrals;
create policy referrals_insert on referrals
  for insert with check (auth.uid() = referrer_id);
drop policy if exists referrals_update on referrals;
create policy referrals_update on referrals
  for update using (auth.uid() = referrer_id) with check (auth.uid() = referrer_id);

drop policy if exists discount_codes_select on discount_codes;
create policy discount_codes_select on discount_codes
  for select using (auth.uid() = user_id);
drop policy if exists discount_codes_insert on discount_codes;
create policy discount_codes_insert on discount_codes
  for insert with check (auth.uid() = user_id);
drop policy if exists discount_codes_update on discount_codes;
create policy discount_codes_update on discount_codes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- §2 RPC — claim_referral(p_code)  ·  the cross-user write the loop needs.
--
-- RLS GOTCHA solved here: referrals_update only allows auth.uid() = referrer_id,
-- so the INVITEE (a different auth user) can neither mark the referral joined nor
-- mint the REFERRER's reward under RLS. This SECURITY DEFINER function runs as
-- the owner (bypassing RLS) but is tightly guarded so it can only ever do the one
-- safe thing: attach the calling invitee to a pending referral and mint exactly
-- one Miinto reward for that referral's referrer.
--
-- Called by the invitee right after they sign in (anon auth) and join, passing
-- the ?ref code stashed in localStorage. Guards:
--   * self-referral blocked (referrer_id <> auth.uid())
--   * only a 'pending' referral is claimable (idempotent: re-calling is a no-op)
--   * exactly one discount_codes row is minted per referral (status flips to
--     'rewarded' in the same statement, so a double-call can't double-mint)
-- Returns the minted/looked-up reward code (text), or null when nothing happened.
-- ---------------------------------------------------------------------------
create or replace function claim_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_ref       referrals%rowtype;
  v_code      text;
  v_existing  text;
begin
  if v_uid is null or p_code is null or length(trim(p_code)) = 0 then
    return null;
  end if;

  -- Find a still-claimable (pending) referral for this code that isn't ours.
  select * into v_ref
  from referrals
  where code = p_code
    and status = 'pending'
    and (referrer_id is distinct from v_uid)
  limit 1
  for update;

  if not found then
    -- Idempotent / already-handled / self-referral / unknown code → no-op.
    -- If WE already claimed this code, surface the reward that was minted so the
    -- caller can still show it (but never mint a second one).
    select dc.code into v_existing
    from referrals r
    join discount_codes dc on dc.user_id = r.referrer_id and dc.partner = 'miinto'
    where r.code = p_code and r.invitee_id = v_uid and r.status = 'rewarded'
    limit 1;
    return v_existing;  -- null when there's nothing to show
  end if;

  -- Mint a single-use, human-ish reward code for the REFERRER.
  v_code := 'RALLY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into discount_codes (user_id, code, partner, pct, expires_at)
  values (v_ref.referrer_id, v_code, 'miinto', 15, now() + interval '60 days');

  -- Attach the invitee + flip straight to 'rewarded' (joined → rewarded in one
  -- step; the row left 'pending' above guarantees this runs at most once).
  update referrals
  set invitee_id = v_uid, status = 'rewarded'
  where id = v_ref.id;

  return v_code;
end;
$$;

revoke all on function claim_referral(text) from public;
grant execute on function claim_referral(text) to anon, authenticated;

-- ===========================================================================
-- §3 — player_ratings (BUILT IN APP). Each row is one user's vote for one
-- squad player in one match, in one category. Unique key prevents dup votes;
-- the app caps it at 3 per (user, match, category). RLS: public read (for the
-- aggregate tally), owner-scoped writes (auth.uid() = user_id).
-- ===========================================================================
create table if not exists player_ratings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  match_id   text references matches(id) on delete cascade,
  team_id    text,                            -- the team name (squad anchor)
  player_id  text not null,                   -- stable slug of (name + team)
  category   text not null check (category in ('hot','best_dressed','coolness')),
  created_at timestamptz default now(),
  unique (user_id, match_id, category, player_id)
);
alter table player_ratings enable row level security;

drop policy if exists player_ratings_select on player_ratings;
create policy player_ratings_select on player_ratings
  for select using (true);                    -- aggregate display only
drop policy if exists player_ratings_insert on player_ratings;
create policy player_ratings_insert on player_ratings
  for insert with check (auth.uid() = user_id);
drop policy if exists player_ratings_update on player_ratings;
create policy player_ratings_update on player_ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists player_ratings_delete on player_ratings;
create policy player_ratings_delete on player_ratings
  for delete using (auth.uid() = user_id);

-- ===========================================================================
-- §4 — gender on profiles (opt-in) + rating_insights view (anonymous).
-- The view joins ratings to the voter's profile and groups by player +
-- category + gender → COUNT. No user_id is exposed; only aggregate counts.
-- ===========================================================================
alter table profiles add column if not exists gender text;

create or replace view rating_insights as
  select
    pr.player_id,
    pr.team_id,
    pr.category,
    coalesce(p.gender, 'na') as voter_gender,
    count(*)                 as votes
  from player_ratings pr
  left join profiles p on p.id = pr.user_id
  group by pr.player_id, pr.team_id, pr.category, coalesce(p.gender, 'na');

-- ===========================================================================
-- §5 — epic_moments (BUILT LATER). User-flagged "epic moment" of a match.
-- ===========================================================================
create table if not exists epic_moments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  match_id   text references matches(id) on delete cascade,
  minute     int,
  kind       text,                            -- goal | save | skill | drama
  note       text,
  created_at timestamptz default now()
);
alter table epic_moments enable row level security;
drop policy if exists epic_moments_select on epic_moments;
create policy epic_moments_select on epic_moments
  for select using (true);
drop policy if exists epic_moments_insert on epic_moments;
create policy epic_moments_insert on epic_moments
  for insert with check (auth.uid() = user_id);
drop policy if exists epic_moments_update on epic_moments;
create policy epic_moments_update on epic_moments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists epic_moments_delete on epic_moments;
create policy epic_moments_delete on epic_moments
  for delete using (auth.uid() = user_id);

-- ===========================================================================
-- §6 — wags + wag_ratings (BUILT LATER). Editorial roster (public read,
-- service-role write); ratings owner-scoped, public-read for aggregate tally.
-- ===========================================================================
create table if not exists wags (
  id        text primary key,                 -- stable slug
  name      text not null,
  partner   text,                             -- the player they're linked to
  team      text,
  photo     text,
  created_at timestamptz default now()
);
create table if not exists wag_ratings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  wag_id     text references wags(id) on delete cascade,
  match_id   text references matches(id) on delete set null,
  category   text not null,                   -- e.g. best_dressed
  created_at timestamptz default now(),
  unique (user_id, wag_id, category)
);
alter table wags        enable row level security;
alter table wag_ratings enable row level security;

drop policy if exists wags_select on wags;
create policy wags_select on wags
  for select using (true);                    -- public read (service-role write)

drop policy if exists wag_ratings_select on wag_ratings;
create policy wag_ratings_select on wag_ratings
  for select using (true);                    -- aggregate display only
drop policy if exists wag_ratings_insert on wag_ratings;
create policy wag_ratings_insert on wag_ratings
  for insert with check (auth.uid() = user_id);
drop policy if exists wag_ratings_delete on wag_ratings;
create policy wag_ratings_delete on wag_ratings
  for delete using (auth.uid() = user_id);

-- ===========================================================================
-- §7 — match_picks + venue_offers (BUILT LATER). User's pre-match pick;
-- venue-published offers (public read, service-role write).
-- ===========================================================================
create table if not exists match_picks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  match_id   text references matches(id) on delete cascade,
  pick       text not null,                   -- a | draw | b
  created_at timestamptz default now(),
  unique (user_id, match_id)
);
create table if not exists venue_offers (
  id         uuid primary key default gen_random_uuid(),
  venue_id   text references venues(id) on delete cascade,
  match_id   text references matches(id) on delete set null,
  title      text not null,
  detail     text,
  active     bool default true,
  created_at timestamptz default now()
);
alter table match_picks  enable row level security;
alter table venue_offers enable row level security;

drop policy if exists match_picks_select on match_picks;
create policy match_picks_select on match_picks
  for select using (true);                    -- aggregate display only
drop policy if exists match_picks_insert on match_picks;
create policy match_picks_insert on match_picks
  for insert with check (auth.uid() = user_id);
drop policy if exists match_picks_update on match_picks;
create policy match_picks_update on match_picks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists match_picks_delete on match_picks;
create policy match_picks_delete on match_picks
  for delete using (auth.uid() = user_id);

drop policy if exists venue_offers_select on venue_offers;
create policy venue_offers_select on venue_offers
  for select using (true);                    -- public read (service-role write)

-- ===========================================================================
-- Realtime — publish the live social tables (same guarded pattern as the
-- matches / plan_participants additions above).
-- ===========================================================================
do $$
begin
  alter publication supabase_realtime add table player_ratings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table epic_moments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table match_picks;
exception when duplicate_object then null;
end $$;

-- ===========================================================================
-- push_subscriptions — web-push (PWA) subscriptions for goal/going alerts
-- ===========================================================================
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null, auth text not null, ua text,
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists push_sub_insert on push_subscriptions;
create policy push_sub_insert on push_subscriptions for insert with check (true);
drop policy if exists push_sub_select on push_subscriptions;
create policy push_sub_select on push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists push_sub_delete on push_subscriptions;
create policy push_sub_delete on push_subscriptions for delete using (auth.uid() = user_id);
grant select, insert, delete on push_subscriptions to anon, authenticated;

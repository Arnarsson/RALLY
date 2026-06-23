# RALLY — HEKLA schema & RLS proposal (PROPOSAL, not applied)

Goal: generalise RALLY from "football match nights in Copenhagen" into a
**real-world coordination layer** organised by a **5-layer Social Radius** model
— **Private → Extended Circle → Community → Local → Public** — *without breaking
the live football product*. The football flow stays exactly as it is today; it
simply becomes **one `kind` of public rally**.

This is a **proposal**. Every block below is SQL you can read, edit, and apply by
hand. **Nothing here is applied automatically, and nothing here drops an existing
table.** Read `CLAUDE.md` and `docs/HANDOFF-backend.md` first — this doc matches
their terminology (data-adapter pattern, same UI shape, RLS owner checks,
Realtime on the count tables, no secrets in the repo, the live-scores provider is
"a free public feed" and is never named).

The hard part is §3 (RLS): the Social Radius is *entirely* a visibility model, so
the radius logic lives in the `SELECT` policies on `rallies`.

---

## 0. The five layers

| # | radius | Who can see it | Today's analogue |
|---|---|---|---|
| 1 | `private` | host + explicitly invited people | a DM ("come over for the game") |
| 2 | `circle` | host + members of the host's chosen circle | a friend group / squad |
| 3 | `community` | members of the linked micro-community | a club / society / league |
| 4 | `local` | any authenticated user within a coarse geo radius | "what's near me tonight" |
| 5 | `public` | anyone, incl. anonymous (`anon`) | **today's plans for a WC match** |

A **football plan today = a `public` rally of `kind='match'` linked to a
`matches` row.** That mapping is the whole backward-compatibility story (§1).

---

## 1. Design principle — generalise `plans` → `rallies`

Today (`HANDOFF-backend.md` §1):

- `plans (id, match_id, venue_id, host_id, time, vibe, note, capacity_hint, created_at)`
- `plan_participants (plan_id, user_id, joined_at, pk(plan_id,user_id))`
- The UI (`mockData.js` `loadPlans`) only ever reads
  `{ id, match_id, venue_id, host_id, time, vibe, note, capacity_hint, participant_ids[] }`.

HEKLA introduces `rallies` / `rally_participants` as the **general** form of the
same idea. A plan is the special case where `kind='match'`, `radius='public'`,
and `match_id` is set. **The UI shape is unchanged** — we add a *non-destructive*
compatibility view so `loadPlans` keeps working with zero edits.

### Migration path (additive, reversible)

1. Create the new enums + `rallies` / `rally_participants` (and the circle /
   community tables). **Keep `plans` and `plan_participants` exactly as they are.**
2. **Backfill** every existing `plans` row into `rallies` as
   `kind='match', radius='public'` (one-time copy, idempotent on a stable id map),
   and every `plan_participants` row into `rally_participants`. Keep a
   `legacy_plan_id` column so the backfill is re-runnable and reversible.
3. Expose a **compatibility view** `plans_compat` that re-projects the football
   subset of `rallies` into the *exact* legacy `plans` shape, plus a
   `rally_participants_compat` view, so the front-end's `from('plans')` /
   `from('plan_participants')` calls can be repointed at the views with **no shape
   change**. (We rename, we never drop: the original tables stay until the cutover
   is proven, then become read-only.)
4. Front-end flips behind the existing `hasSupabase` gate (§6). Demo/`file://`
   build is untouched — `mockData.js` `PLANS` still serves the fallback.

```sql
-- Compatibility view: football rallies re-projected into the legacy plans shape.
-- The UI's loadPlans() can read this verbatim — same column names as today.
create view plans_compat as
select
  r.id,
  r.match_id,
  r.venue_id,
  r.host_id,
  r.starts_local      as time,          -- legacy 'time' was a display string
  r.vibe,
  r.blurb             as note,
  r.capacity          as capacity_hint,
  r.created_at
from rallies r
where r.kind = 'match' and r.radius = 'public';

create view rally_participants_compat as
select
  rp.rally_id  as plan_id,
  rp.profile_id as user_id,
  rp.created_at as joined_at
from rally_participants rp
where rp.status = 'going';
```

> The football product reads/writes `public`/`match` rallies only, so it is
> indistinguishable from today. Everything new (private gatherings, circles,
> communities, local discovery) is opt-in surface area added *around* it.

---

## 2. Core SQL

### 2.1 Enums

```sql
create type rally_kind as enum (
  'match',        -- football (linked to matches.id) — the legacy case
  'watch',        -- any other watch-together (sport, show, esports)
  'hangout',      -- generic gathering / meetup
  'activity',     -- sport/run/climb/etc. you do, not watch
  'meal',         -- dinner / drinks
  'event',        -- ticketed-ish thing (gig, screening)
  'other'
);

create type rally_radius as enum (
  'private',      -- host + invited
  'circle',       -- host's chosen circle
  'community',    -- a linked micro-community
  'local',        -- geo-near authenticated users
  'public'        -- anyone, incl. anon (today's plans)
);

create type participant_status as enum ('going', 'waitlist', 'invited');

create type community_role as enum ('member', 'creator', 'promoter');

create type invite_status as enum ('pending', 'accepted', 'declined', 'revoked');

create type rally_event_kind as enum (
  'create', 'join', 'leave', 'waitlist_join', 'waitlist_promote',
  'invite_sent', 'invite_accepted', 'share', 'arrive', 'cancel'
);
```

### 2.2 `rallies` — the generalised plan

```sql
create table rallies (
  id            uuid primary key default gen_random_uuid(),
  kind          rally_kind   not null default 'hangout',
  radius        rally_radius not null default 'private',
  host_id       uuid not null references profiles(id) on delete cascade,

  title         text not null,
  blurb         text,                       -- legacy 'note'
  vibe          text,                       -- reuse the VIBES keys (party/chill/…)

  venue_id      text references venues(id) on delete set null,
  match_id      text references matches(id) on delete cascade,  -- only for kind='match'

  -- radius scoping: exactly one of these is relevant per radius
  circle_id     uuid references circles(id) on delete cascade,      -- radius='circle'
  community_id  uuid references communities(id) on delete cascade,  -- radius='community'

  -- free-text + coarse geo for the Local radius
  area          text,                       -- e.g. 'Nørrebro' (human label)
  lat           double precision,           -- store ROUNDED (see §3 local)
  lng           double precision,

  starts_at     timestamptz,                -- canonical UTC start
  starts_local  text,                       -- display string (legacy 'time')
  capacity      int,                        -- null = unlimited (legacy capacity_hint)
  going_count   int not null default 0,     -- maintained by trigger (§4)

  legacy_plan_id uuid,                       -- backfill bridge; null for new rallies
  created_at    timestamptz not null default now()
);

create index rallies_radius_idx     on rallies(radius);
create index rallies_match_idx      on rallies(match_id)     where match_id is not null;
create index rallies_community_idx  on rallies(community_id) where community_id is not null;
create index rallies_circle_idx     on rallies(circle_id)    where circle_id is not null;
-- Coarse bounding-box scans for the Local radius (see §3):
create index rallies_geo_idx        on rallies(lat, lng)     where radius = 'local';
create index rallies_starts_idx     on rallies(starts_at);

alter table rallies enable row level security;

-- Integrity: the scoping column must match the radius.
alter table rallies add constraint rallies_scope_ck check (
  (radius = 'circle')    = (circle_id is not null) and
  (radius = 'community') = (community_id is not null) and
  (radius <> 'local'     or (lat is not null and lng is not null)) and
  (kind   <> 'match'     or match_id is not null)
);
```

### 2.3 `rally_participants` — the generalised plan_participants

```sql
create table rally_participants (
  rally_id    uuid not null references rallies(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  status      participant_status not null default 'going',
  created_at  timestamptz not null default now(),
  primary key (rally_id, profile_id)        -- "you're in a rally once"
);

create index rally_participants_profile_idx on rally_participants(profile_id);
alter table rally_participants enable row level security;
```

### 2.4 Circles (Layer 2) and members

```sql
-- An "extended circle" = a user's named friend group (their squad).
create table circles (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
alter table circles enable row level security;

create table circle_members (
  circle_id   uuid not null references circles(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (circle_id, profile_id)
);
create index circle_members_profile_idx on circle_members(profile_id);
alter table circle_members enable row level security;
```

### 2.5 Communities (Layer 3) and members

```sql
-- A Layer-3 micro-community: a club / society / league people belong to.
create table communities (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references profiles(id) on delete cascade,
  name        text not null,
  blurb       text,
  area        text,                          -- optional home area
  is_open     boolean not null default false, -- open join vs invite/approve
  created_at  timestamptz not null default now()
);
alter table communities enable row level security;

create table community_members (
  community_id uuid not null references communities(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  role         community_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (community_id, profile_id)
);
create index community_members_profile_idx on community_members(profile_id);
alter table community_members enable row level security;
```

### 2.6 `rally_invites` (Private + Circle layers)

```sql
create table rally_invites (
  id          uuid primary key default gen_random_uuid(),
  rally_id    uuid not null references rallies(id) on delete cascade,
  inviter_id  uuid not null references profiles(id) on delete cascade,
  invitee_id  uuid not null references profiles(id) on delete cascade,
  status      invite_status not null default 'pending',
  created_at  timestamptz not null default now(),
  unique (rally_id, invitee_id)
);
create index rally_invites_invitee_idx on rally_invites(invitee_id);
create index rally_invites_rally_idx   on rally_invites(rally_id);
alter table rally_invites enable row level security;
```

### 2.7 Telemetry / intent — `rally_events` (the moat)

Append-only, user-initiated **only**. **No passive location, no background
tracking, no device fingerprinting.** Every row is an explicit action the user
took in the UI (join, leave, share, mark-arrived). This is GDPR-clean by
construction: it is the user's own activity log, opt-in, and never derived from
sensors. Rolled up (§5), it becomes **group intent** — "this circle is converging
on Nørrebro at 20:00" — which is the defensible signal RALLY accrues over time.

```sql
create table rally_events (
  id          bigint generated always as identity primary key,
  rally_id    uuid references rallies(id) on delete set null,
  actor_id    uuid references profiles(id) on delete set null,
  kind        rally_event_kind not null,
  -- arrive is the ONLY geo event, and only when the user taps "I'm here";
  -- store ROUNDED coords (§3), never a precise fix.
  lat         double precision,
  lng         double precision,
  meta        jsonb not null default '{}',   -- small, non-PII context
  created_at  timestamptz not null default now()
);
create index rally_events_rally_idx  on rally_events(rally_id);
create index rally_events_actor_idx  on rally_events(actor_id);
create index rally_events_kind_idx   on rally_events(kind, created_at);
alter table rally_events enable row level security;
```

> Consent: writing `rally_events` is gated by a per-profile opt-in
> (`profiles.telemetry_opt_in boolean default false` — add via the additive
> `ALTER` in §6). With opt-in off, the app simply doesn't insert events; the
> product still works.

### 2.8 Monetisation stubs — `capacity_unlocks`, `tickets`

These **extend the existing referral/discount loop** (`referrals`,
`discount_codes`, the `claim_referral(p_code)` SECURITY DEFINER RPC — see
`mockData.js` §2 and `supabase/schema.sql`). We **reference** that loop; we do not
redefine it. A `capacity_unlock` or a `ticket` purchase can *mint or consume* a
`discount_codes` row, but the codes table stays the source of truth.

```sql
-- A host pays (or spends a reward) to raise a rally's capacity past the free cap.
create table capacity_unlocks (
  id            uuid primary key default gen_random_uuid(),
  rally_id      uuid not null references rallies(id) on delete cascade,
  host_id       uuid not null references profiles(id) on delete cascade,
  extra_seats   int not null check (extra_seats > 0),
  -- optional link into the EXISTING discount loop (reward applied at unlock):
  discount_code text references discount_codes(code),
  status        text not null default 'pending',  -- pending | active | refunded
  created_at    timestamptz not null default now()
);
alter table capacity_unlocks enable row level security;

-- A paid/claimed seat for ticketed rallies (kind='event'). The price/payment
-- provider integration is out of scope here — this is the ledger row.
create table tickets (
  id            uuid primary key default gen_random_uuid(),
  rally_id      uuid not null references rallies(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  -- a ticket may have been bought with a code from the existing loop:
  discount_code text references discount_codes(code),
  price_minor   int,                              -- in øre; null = free/comp
  currency      text default 'DKK',
  status        text not null default 'reserved', -- reserved | paid | refunded | void
  created_at    timestamptz not null default now(),
  unique (rally_id, profile_id)
);
alter table tickets enable row level security;
```

---

## 3. RLS — the Social Radius, expressed as SELECT policies

The whole model collapses into: **"who can `SELECT` a `rallies` row depends on its
`radius`."** We write helper functions to keep the policies legible, then one
`SELECT` policy per radius. (`auth.uid()` is the caller; anonymous Supabase Auth
gives every device a real uid per `mockData.js` `ensureAuth`.)

### 3.1 Helper predicates (SECURITY DEFINER, STABLE)

```sql
-- Is the caller a member of the host's chosen circle for this rally?
create or replace function is_in_rally_circle(r rallies) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from circle_members cm
    where cm.circle_id = r.circle_id and cm.profile_id = auth.uid()
  );
$$;

-- Is the caller a member of the rally's community?
create or replace function is_in_rally_community(r rallies) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from community_members m
    where m.community_id = r.community_id and m.profile_id = auth.uid()
  );
$$;

-- Was the caller invited (and not revoked)?
create or replace function is_invited_to_rally(r rallies) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from rally_invites i
    where i.rally_id = r.id and i.invitee_id = auth.uid()
      and i.status in ('pending','accepted')
  );
$$;
```

### 3.2 The five visibility policies on `rallies`

```sql
-- 1) PRIVATE — host + invited only.
create policy rallies_sel_private on rallies for select
  using (
    radius = 'private'
    and (host_id = auth.uid() or is_invited_to_rally(rallies))
  );

-- 2) CIRCLE — host + members of the host's chosen circle.
create policy rallies_sel_circle on rallies for select
  using (
    radius = 'circle'
    and (host_id = auth.uid() or is_in_rally_circle(rallies))
  );

-- 3) COMMUNITY — members of the linked community (host is always a member).
create policy rallies_sel_community on rallies for select
  using (
    radius = 'community'
    and (host_id = auth.uid() or is_in_rally_community(rallies))
  );

-- 4) LOCAL — any AUTHENTICATED user within a coarse bounding box.
--    Requires the caller to pass their rounded location via a session GUC
--    (set by the Edge fn / RPC, never trusted from the client raw). Bounding
--    box, not exact distance — see justification below.
create policy rallies_sel_local on rallies for select
  to authenticated
  using (
    radius = 'local'
    and lat between
        (current_setting('rally.lat', true)::float8 - current_setting('rally.dlat', true)::float8)
      and
        (current_setting('rally.lat', true)::float8 + current_setting('rally.dlat', true)::float8)
    and lng between
        (current_setting('rally.lng', true)::float8 - current_setting('rally.dlng', true)::float8)
      and
        (current_setting('rally.lng', true)::float8 + current_setting('rally.dlng', true)::float8)
  );

-- 5) PUBLIC — anyone, incl. anon. This is exactly today's plans behaviour.
create policy rallies_sel_public on rallies for select
  using (radius = 'public');
```

> **Local — approach & justification.** I pick a **rounded-coordinate bounding
> box** over PostGIS `earthdistance`/`ST_DWithin` for v1, for three reasons:
> (1) **Privacy** — we deliberately store and compare only *coarse* coordinates
> (round lat/lng to ~3 decimals ≈ 100 m, or snap to a grid cell) so the schema
> *cannot* leak a precise location even if abused; a box on rounded coords is the
> honest expression of that. (2) **No extra extension/index** — a plain
> `(lat,lng)` btree + range scan ships on stock Supabase; `earthdistance`/`cube`
> or `postgis` is an upgrade we can take later for true radial distance.
> (3) **Predictable cost** — a box is index-friendly and cheap. The trade-off: a
> box is square, not circular, and gives a slightly looser "near me." We accept
> that — for "what's happening around me tonight," coarse is a *feature*. When we
> want true radius, swap the policy body for
> `earth_box(...) @> ll_to_earth(lat,lng) and earth_distance(...) < :meters`
> behind a `postgis`/`earthdistance` migration; the column shape doesn't change.
> The caller's own location is injected as a GUC by a thin RPC/Edge wrapper so the
> client never gets to widen the box arbitrarily (the wrapper clamps `dlat/dlng`).

### 3.3 INSERT / UPDATE / DELETE on `rallies` — host owns the rally

```sql
create policy rallies_ins on rallies for insert
  with check (host_id = auth.uid());

create policy rallies_upd on rallies for update
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy rallies_del on rallies for delete
  using (host_id = auth.uid());
```

> Note: `going_count` is maintained by a trigger (§4), so even though the host can
> `UPDATE` their rally, the count column is authoritative from the trigger, not
> from client writes.

### 3.4 `rally_participants` — "join what you can see; remove only yourself"

The elegant part: **you may join any rally you are allowed to SELECT**, and
**you may only delete your own row.** We express "can I see it?" by reusing the
exact visibility predicate via an `exists` against `rallies` (RLS on `rallies`
filters that sub-select for us).

```sql
-- SELECT a participant row if you can see its rally (RLS on rallies decides).
create policy rp_sel on rally_participants for select
  using (
    exists (select 1 from rallies r where r.id = rally_id)
  );

-- JOIN: insert only your own row, and only into a rally you can see.
create policy rp_ins on rally_participants for insert
  with check (
    profile_id = auth.uid()
    and exists (select 1 from rallies r where r.id = rally_id)
  );

-- UPDATE your own status only (e.g. waitlist -> going is done by the trigger/Edge
-- fn under service role; users can't promote themselves past capacity).
create policy rp_upd on rally_participants for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- LEAVE: you can only remove YOURSELF.
create policy rp_del on rally_participants for delete
  using (profile_id = auth.uid());
```

> Because RLS on `rallies` is *also* applied to the `exists (... from rallies ...)`
> sub-select, a user simply cannot insert a participant row into a private rally
> they were never invited to — the sub-select returns zero rows and the
> `with check` fails. The radius logic is written once, on `rallies`, and every
> other table inherits it through this pattern.

### 3.5 Supporting-table policies (sketch)

```sql
-- circles: owner manages; members can read circles they're in.
create policy circles_sel on circles for select
  using (owner_id = auth.uid()
         or exists (select 1 from circle_members cm
                    where cm.circle_id = id and cm.profile_id = auth.uid()));
create policy circles_cud on circles for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- circle_members: the circle owner manages membership; you can see your own rows.
create policy cm_sel on circle_members for select
  using (profile_id = auth.uid()
         or exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid()));
create policy cm_ins on circle_members for insert
  with check (exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid()));
create policy cm_del on circle_members for delete
  using (profile_id = auth.uid()  -- leave yourself
         or exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid()));

-- communities: open communities are world-readable (for discovery); closed ones
-- are visible to members. creators/promoters manage; members self-join open ones.
create policy comm_sel on communities for select
  using (is_open = true
         or creator_id = auth.uid()
         or exists (select 1 from community_members m
                    where m.community_id = id and m.profile_id = auth.uid()));
create policy comm_cud on communities for all
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

create policy commm_sel on community_members for select
  using (profile_id = auth.uid()
         or exists (select 1 from communities c where c.id = community_id and c.creator_id = auth.uid()));
create policy commm_ins on community_members for insert
  with check (
    profile_id = auth.uid()  -- you add yourself
    and exists (select 1 from communities c where c.id = community_id and c.is_open = true)
  );  -- closed communities are joined via invite/approve (service-role / RPC)
create policy commm_del on community_members for delete
  using (profile_id = auth.uid()
         or exists (select 1 from communities c where c.id = community_id and c.creator_id = auth.uid()));

-- rally_invites: inviter or invitee can read; host invites; invitee responds.
create policy inv_sel on rally_invites for select
  using (inviter_id = auth.uid() or invitee_id = auth.uid());
create policy inv_ins on rally_invites for insert
  with check (
    inviter_id = auth.uid()
    and exists (select 1 from rallies r where r.id = rally_id and r.host_id = auth.uid())
  );
create policy inv_upd on rally_invites for update      -- invitee accepts/declines
  using (invitee_id = auth.uid()) with check (invitee_id = auth.uid());

-- rally_events: write your own events (and only into rallies you can see);
-- reads are aggregate-only (do them via a SECURITY DEFINER rollup, §5), so we
-- deliberately do NOT grant broad row-level SELECT here.
create policy ev_ins on rally_events for insert
  with check (
    actor_id = auth.uid()
    and (rally_id is null or exists (select 1 from rallies r where r.id = rally_id))
  );
create policy ev_sel_own on rally_events for select
  using (actor_id = auth.uid());   -- a user can see their own activity log (GDPR access)

-- capacity_unlocks / tickets: host (unlocks) / buyer (tickets) owns their rows.
create policy cap_owner on capacity_unlocks for all
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy tic_sel on tickets for select
  using (profile_id = auth.uid()
         or exists (select 1 from rallies r where r.id = rally_id and r.host_id = auth.uid()));
create policy tic_ins on tickets for insert
  with check (profile_id = auth.uid());
```

---

## 4. Realtime + counts

### 4.1 `going_count` trigger (the existing plans pattern, generalised)

Today the UI subscribes to `plan_participants` and recomputes counts client-side.
HEKLA keeps a denormalised `rallies.going_count` maintained by a trigger so the
count is correct and cheap, and so capacity/waitlist logic has a single source of
truth.

```sql
create or replace function rallies_recount() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  rid := coalesce(new.rally_id, old.rally_id);
  update rallies r
     set going_count = (
       select count(*) from rally_participants p
       where p.rally_id = rid and p.status = 'going')
   where r.id = rid;
  return null;
end $$;

create trigger rally_participants_recount
  after insert or update or delete on rally_participants
  for each row execute function rallies_recount();
```

### 4.2 What to expose over Realtime (don't leak private rallies)

- **Keep today's behaviour for the public/match path**: Realtime on
  `rally_participants` drives live "going" counts, and `matches` drives live
  scores (fed by the **free public feed** — never named). The existing
  `subscribeRealtime` in `mockData.js` keeps working against the compat views.
- **Realtime broadcasts bypass table RLS**, so we must **not** put a blanket
  Realtime publication on `rallies`/`rally_participants` for private/circle/
  community radii — that would leak existence + counts to every subscriber.
  Instead:
  - **Public rallies** → a Realtime channel scoped to `radius='public'` (and to a
    given `match_id` for the football screen), exactly like today's "going" feed.
  - **Private / Circle / Community rallies** → push updates over **per-scope
    Realtime channels with authorization** (Supabase Realtime channel
    `private`-mode + an authorization check), or simply have the client
    **re-fetch** the affected rally on a lightweight `broadcast` ping. The
    authoritative read still goes through RLS-protected `SELECT`, so even a
    mis-subscribed client gets nothing it can't already see.
- **Never** broadcast `rally_events` rows over Realtime; they're an internal
  intent log, read only in aggregate (§5).

---

## 5. Edge Functions / cron

Existing functions are **unaffected**: `live-scores` (every minute, match-window
guarded, reads the free public feed), `sync-fixtures` (daily), `sync-squads`
(daily). They write `matches`/`squads` and know nothing about rallies. The
referral RPC `claim_referral(p_code)` is also unchanged.

New functions (Supabase Edge / `pg_cron`):

| Function | Trigger | Does |
|---|---|---|
| `promote-waitlist` | on `rally_participants` change + periodic sweep | when a `going` participant leaves a rally with `capacity`, promote the oldest `waitlist` row to `going` (under service role, so RLS can't be self-gamed). Emits a `waitlist_promote` event. |
| `enforce-capacity` | `BEFORE INSERT` trigger or Edge guard | if `going_count >= capacity`, force the new join to `status='waitlist'` instead of `going`. Capacity may have been raised by an `active` `capacity_unlocks` row — check that. |
| `intent-rollup` | `pg_cron`, every ~10 min | aggregate `rally_events` into anonymised, k-anonymous rollups ("circle X converging on area Y at time Z"), written to a `*_rollups` table read via SECURITY DEFINER. This is the **group-intent** moat surface; only aggregates leave the table. |
| `local-geo-guard` | RPC wrapper for the Local radius | takes the caller's coarse location, clamps the box (`dlat/dlng`), sets the `rally.*` GUCs, runs the read. Keeps box-widening server-side (§3.2). |
| `ticket-settle` | webhook / `pg_cron` | reconcile `tickets.status` and apply/consume a `discount_codes` row via the existing loop. No payment secrets in the repo. |

A `BEFORE INSERT` capacity guard in SQL (so even a direct client insert is safe):

```sql
create or replace function rp_capacity_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare cap int; cur int;
begin
  select capacity, going_count into cap, cur from rallies where id = new.rally_id;
  if cap is not null and new.status = 'going' and cur >= cap then
    new.status := 'waitlist';   -- silently waitlist past capacity
  end if;
  return new;
end $$;

create trigger rp_capacity_before
  before insert on rally_participants
  for each row execute function rp_capacity_guard();
```

---

## 6. Migration checklist (non-destructive, behind `hasSupabase`)

Ordered, reversible, ship-safe. **No `DROP TABLE` anywhere.**

1. **Enums + tables.** Apply §2.1–§2.8 (`create type`, `create table`,
   `enable row level security`). Additive only.
2. **Additive `ALTER`s** to existing tables:
   - `alter table profiles add column telemetry_opt_in boolean not null default false;`
   - (optional) `alter table profiles add column home_area text;`
   These default-safe columns don't touch existing reads.
3. **Helpers + RLS.** Apply §3.1 functions and all §3 policies.
4. **Triggers.** Apply §4.1 (`rallies_recount`), §5 (`rp_capacity_guard`).
5. **Backfill.** One-time, idempotent copy of `plans`→`rallies`
   (`kind='match', radius='public'`, `legacy_plan_id = plans.id`) and
   `plan_participants`→`rally_participants(status='going')`. Re-runnable: upsert on
   `legacy_plan_id`.
6. **Compat views.** Apply §1 `plans_compat` / `rally_participants_compat`.
7. **Realtime.** Add the `radius='public'` Realtime publication for
   `rally_participants` (§4.2); leave private/circle/community off the broadcast.
8. **Edge functions.** Deploy `promote-waitlist`, `intent-rollup`,
   `local-geo-guard`, `ticket-settle` (§5). No secrets in the repo; the live-scores
   provider stays "a free public feed."
9. **Front-end flip (behind `hasSupabase`).** Repoint `mockData.js` `loadPlans` /
   `joinPlan` / `leavePlan` / `createPlanRow` at the compat views (or at `rallies`
   directly with `kind='match', radius='public'`). **UI shape unchanged** — same
   `{ ..., participant_ids[] }`. The `file://` demo build stays on `PLANS` and is
   untouched.
10. **Verify**, then **flip writes** from `plans` to `rallies` for the football
    path. Keep the old tables read-only as a safety net for one release.

### Rollback

- Front-end: revert step 9 (point `loadPlans` back at `plans`). The original
  `plans`/`plan_participants` tables were never dropped, so reads are intact.
- Backend: the migration is purely additive — drop the new policies/views/tables
  in reverse order if needed. No legacy data was mutated (backfill only *copied*
  rows into new tables; `legacy_plan_id` lets you re-sync or discard cleanly).
- The demo/`file://` build never depended on any of this (`hasSupabase` gate), so
  it is unaffected in every scenario.

---

## Appendix — mapping today's UI shape to rallies

| `mockData.js` field | rallies/rally_participants |
|---|---|
| `plan.id` | `rallies.id` |
| `plan.match_id` | `rallies.match_id` (kind='match') |
| `plan.venue_id` | `rallies.venue_id` |
| `plan.host_id` | `rallies.host_id` |
| `plan.time` | `rallies.starts_local` (display) / `starts_at` (UTC) |
| `plan.vibe` | `rallies.vibe` |
| `plan.note` | `rallies.blurb` |
| `plan.capacity_hint` | `rallies.capacity` |
| `participant_ids[]` | `rally_participants.profile_id where status='going'` |
| live "going" count | `rallies.going_count` (trigger-maintained) |

The football product is `radius='public', kind='match'` end-to-end; everything
else (Private → Local) is new surface added *around* it without moving the
existing pieces.
```

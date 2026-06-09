# RALLY 10× — "sticky trio" handoff (for Claude Code)

Goal: make RALLY genuinely **social, live, and sticky** — the three things that
turn a working real-time match app into a habit that spreads. Build on the
backend that already exists; don't rebuild it.

## What already exists (don't redo)

- Supabase schema (`supabase/schema.sql`): `profiles, venues, matches, plans,
  plan_participants, predictions` (+ RLS, realtime publication).
- Anonymous auth + data loaders in `source/src/data/mockData.js`: `ensureAuth()`,
  `joinPlan()`, `leavePlan()`, `createPlanRow()`, `saveProfile()`,
  `hydrateFromSupabase()`, and `subscribeRealtime(onChange)` which opens the
  **`rally-live`** channel on `matches` + `plan_participants` postgres_changes.
- Live workers: `worker/live.mjs` (API-Football → `matches`, every ~15s),
  `worker/predict.py` (penaltyblog → `predictions`).
- PWA: `source/public/sw.js` + `registerSW.js`. Vercel serverless under
  `source/api/`, cron in `source/vercel.json`.
- The UI keeps a **`hasSupabase` fallback** to mock data so the single-file
  standalone still runs offline. **Preserve that pattern for every new feature.**

Apply all DDL below by appending to `supabase/schema.sql` (it's idempotent) and
re-running it. Add RLS for every new table. Add each realtime table to the
`rally-live` channel in `subscribeRealtime`.

---

## 1. Guest join + friend graph  (the growth + retention lever)

**Why.** The share card → deep link → join is the viral loop, but it dead-ends at
signup, and there's no friend graph, so the killer line — "**3 friends are going
to Reffen**" — is impossible. Fix both.

### 1a. Guest join (no-signup RSVP from a shared link)
- The share card already prints `rally.app/p/<planId>`. Wire the route: on load,
  read `?p=<id>` (or path `/p/:id`), push the Plan view, and show a one-tap
  **Join** CTA.
- Not signed in? Call `ensureAuth()` (already does Supabase **anonymous** auth),
  prompt only for name + flag (reuse `ProfileSetup`), `saveProfile()`, then
  `joinPlan()`. No email/password wall.
- Mark guests so they can be nudged to claim later:
  `alter table profiles add column if not exists is_guest bool default false;`
  Claim flow later = `supabase.auth.linkIdentity()` (phone/Apple/Google) which
  upgrades the same uid in place — plans/friends survive.
- Track the loop: stamp `plans` / `plan_participants` with the inviter so you can
  measure k-factor.
  `alter table plan_participants add column if not exists invited_by uuid references profiles(id);`

### 1b. Friend graph
```sql
create table if not exists friendships (
  user_id    uuid references profiles(id) on delete cascade,
  friend_id  uuid references profiles(id) on delete cascade,
  status     text default 'accepted',     -- pending | accepted (start auto-accept on link)
  created_at timestamptz default now(),
  primary key (user_id, friend_id)
);
alter table friendships enable row level security;
drop policy if exists friendships_self on friendships;
create policy friendships_self on friendships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- store both directions on accept so "friends going" is a simple membership test.
```
- Add friends by **share code / link** first (simplest, no contacts permission):
  each profile gets a short code; `rally.app/add/<code>` → mutual `friendships`.
  Phone-contact import (hashed) is a later add.
- New loaders in `mockData.js` (guarded by `hasSupabase`):
  `loadFriends()`, `addFriendByCode(code)`, and `friendsGoing(matchId)` →
  `plan_participants ⋈ friendships` for the current user.
- **UI:** a "**N friends going**" badge on each match card + plan card (lime), a
  tiny avatar stack of friends; a Friends screen (list + "add friends" share
  sheet). This single badge is the reason people open the app on match night.

**DoD:** open a shared plan link on a fresh device → guest-join in 2 taps; add a
friend by code; a match where a friend has a plan shows "1 friend going".

---

## 2. Live match-night "energy"  (reactions + check-ins)

**Why.** Today "Busiest tonight" is computed from mock plan sizes. Make it **live
truth** and give people a reason to keep the app open *during* the game.

### Check-ins (persistent headcount)
```sql
create table if not exists checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  venue_id   text references venues(id),
  match_id   text references matches(id),
  created_at timestamptz default now()
);
alter table checkins enable row level security;
drop policy if exists checkins_read on checkins;
create policy checkins_read on checkins for select using (true);
drop policy if exists checkins_own on checkins;
create policy checkins_own on checkins for insert with check (auth.uid() = user_id);
```
- "**I'm here**" button on the plan/venue. Live count = checkins for that
  venue+match in the last ~3h. Replace the mock `topPlan` "Busiest tonight"
  calc in `MatchesScreen` with `select venue_id, count(*) ... group by` over
  checkins (fallback to the mock when `!hasSupabase`).

### Reactions (ephemeral — use Realtime broadcast, not DB rows)
- For taps like 🔥⚽😱, use **Supabase Realtime broadcast** on a per-venue channel
  (`venue:<id>`) — ephemeral, no DB write storm. Each tap broadcasts
  `{emoji, ts}`; clients render a floating-emoji burst + increment a rolling
  "energy" meter (reactions/min over the last 60–90s).
- "**Reffen is going off — 78'**" = energy meter above a threshold while
  `matches.status='in'`.

### Wiring
- Extend `subscribeRealtime` to also subscribe `checkins` (postgres_changes) so
  headcounts update live; add a separate `useVenueEnergy(venueId)` hook that
  joins the `venue:<id>` broadcast channel for reactions.
- The live worker (`worker/live.mjs`) already flips `matches.status`; the energy
  UI keys off that.

**DoD:** two devices on the same venue see each other's reactions in real time and
the energy meter rise; the Tonight "busiest" banner reflects real check-ins.

---

## 3. Push notifications  (the re-engagement engine)

**Why.** A match-night app with no push is dead between sessions. This closes the
loop: live goals, plan reminders, and social nudges pull people back.

### Subscriptions
```sql
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  prefs      jsonb default '{"goals":true,"reminders":true,"social":true}',
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
- **Web Push** via the existing PWA. Generate VAPID keys; env:
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VITE_VAPID_PUBLIC_KEY` (client).
- Client: after a user's *first* join (not on load — ask in context), request
  permission, `registration.pushManager.subscribe({ applicationServerKey })`,
  POST the subscription to a new `source/api/push-subscribe.js`.
- `source/public/sw.js`: handle `push` → `showNotification`; `notificationclick`
  → focus the app and open the relevant plan/match deep link.

### Triggers (server)
Add a `sendPush(userIds, payload)` util (npm `web-push`) and call it from:
- **Goals / live** — in `worker/live.mjs`, when `score_a/score_b` changes for an
  in-play match, push "GOAL — Brazil 1–0" to users who joined a plan for that
  match (respect `prefs.goals`).
- **Plan reminders** — a Vercel cron (`source/api/push-reminders.js`, add to
  `vercel.json`) that fires "your plan at Reffen starts in 1h" to participants.
- **Social** — when someone joins your plan, or your flag-country plays tonight,
  push (respect `prefs.social`). Trigger off the `plan_participants` insert.

**DoD:** a score change in `matches` delivers a "GOAL" notification on a real
device; tapping it opens that match; reminders fire on schedule; a prefs toggle
silences a category.

---

## Cross-cutting checklist

- [ ] All new tables have RLS; reads public where safe, writes `auth.uid()`-scoped.
- [ ] New realtime tables added to the `rally-live` channel in `subscribeRealtime`.
- [ ] Every feature degrades gracefully when `hasSupabase === false` (standalone
      demo must still build + run).
- [ ] DDL appended to `supabase/schema.sql` (idempotent) and applied.
- [ ] Env added to `source/.env.example`: VAPID keys.
- [ ] Keep the single-file standalone building (`vite-plugin-singlefile`) — guard
      any new browser-only APIs (Notification, pushManager) behind feature checks.

## Sequence
1. Guest-join route + friend graph + "N friends going" badge (growth).
2. Check-ins → real "busiest" + reaction broadcast + energy meter (live).
3. Web push: subscribe → goal pushes from the live worker → reminders + social.

Each ships independently and compounds with the last.

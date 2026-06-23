# RALLY → HEKLA — the rally-point-for-anything plan

*The 10× plan ([RALLY-10x-plan.md](./RALLY-10x-plan.md)) gets us the match-night app
Copenhagen opens on a Tuesday. This doc is the move after that: keep the soul,
widen the excuse. Read [SOUL.md](../SOUL.md) first — every line here still has to
sound like the mate who's saving you a seat.*

We don't just watch the game. We rally for it. Then we rally for everything else.

---

## 1. The shift, in one paragraph

Right now the thing RALLY knows how to do is: pin a **plan** to a **venue** for a
**match**, count who's **going**, and get you into the room. Today that match is
football. But strip the football out and what's left is the whole product — *someone
calls it, a place is named, people show up.* A five-a-side at Fælledparken Sunday
morning, a leaving-do at Charlie Scott's, a board-games night, a protest, a
beach-volleyball pickup, the neighbours' bring-a-dish — every one of them is a
`plan` at a `venue` with a headcount and a host. The football plan was never the
product; it was the **first, sharpest special case** of it. HEKLA is what you get
when you let people rally around anything, keep the same warm, opinionated voice,
and stop pretending the only reason worth leaving the sofa is a kickoff. Same room.
More reasons to be in it.

---

## 2. The Social Radius model

People don't gather in one undifferentiated blob. They gather in **rings** — and the
ring decides who can see it, who can join, and how loud it gets shouted. Five layers,
inner to outer:

| Layer | What it is | Copenhagen example | Maps onto today |
|---|---|---|---|
| **1. Private** | You + named people. Invite-only, never discoverable. | "Dinner at mine Friday, you four." | `plans` with no public listing + `plan_participants` restricted to invitees. **Net-new: a visibility column.** |
| **2. Extended Circle** | Friends-of-friends. Visible to your graph, not the city. | "Anyone want five-a-side Sunday? Bring whoever." | Needs the **social graph** (10× §3 "Friends") — `friendships` table. Net-new. |
| **3. Community** | A named group you belong to: a club, a workplace, an expat network, a uni. | "Internationals Copenhagen — pub quiz Thursday." | Net-new `communities` + `community_members`; a `plan.community_id`. The `vibe_tags` on venues are the seed of this. |
| **4. Local** | Anyone physically near, right now. Geo-bounded, time-boxed. | "Busiest tonight at Reffen, 40 in." | **Already live.** The "Busiest tonight" banner is Local radius for football. Generalise it: `plans` filtered by venue area + time window. |
| **5. Public** | The whole city can see and join. Open by design. | "Fan Zone, Rådhuspladsen — everyone's welcome." | **Already live.** Public `plans` are the default today (`Fan Zone — Rådhuspladsen`, capacity 4000). |

**What already exists:** the object (`plans`), the place (`VENUES` with `capacity`,
`area`, `big_screen`, `vibe_tags`), the headcount (`plan_participants` + live "going"
counts over Realtime), the host (`host_id`), identity (`profiles`), and Layers 4–5
in practice. **What's net-new:** a `visibility` field on plans (the radius dial), a
`friendships` graph (Layer 2), and `communities` (Layer 3). That's three additions,
not a rewrite — the gathering primitive is done.

---

## 3. Phased build sequence (SMART goals)

Dates are relative to **today, 2026-06-23**. Density before geography — every phase
proves the loop in Copenhagen before it widens. Each goal names the files/tables it
touches.

### Phase 1 — Density (now → 2026-09-30)
*Win one city, one ring at a time. The World Cup tail is the trojan horse.*

- **S1.1** Generalise the core object from "match plan" to "rally." Add a `rally_type`
  enum (`match` | `pickup` | `social` | `civic` | `other`) to `plans` and render
  non-match rallies in the Tonight feed without a fixture spine.
  *Files: `source/src/data/mockData.js` (extend `PLANS` shape), `source/src/App.jsx`
  (Tonight feed), `source/src/screens/CreateScreen.jsx`. Table: `plans.rally_type`.*
  **Measurable:** ship by **2026-08-15**; ≥30% of new plans created in September are
  non-`match` type.
- **S1.2** Stand up a `RalliesScreen` so "Tonight" stops being football-only — same
  live-aware card, no score spine when there's no match.
  *Files: new `source/src/screens/RalliesScreen.jsx`, wired into the tab stack in
  `App.jsx`.* **Measurable:** live by **2026-09-01**; 100 real rallies created in CPH
  by **2026-09-30**.
- **S1.3** Make the host the hero: a host name + flag + count on every rally card,
  reusing `host_id` and `USERS`. *Files: `App.jsx` card component, `mockData.js`.*
  **Measurable:** by **2026-09-15**, ≥50 distinct hosts (not just `u_me`).

### Phase 2 — Social Radius live (2026-10-01 → 2026-12-31)
*The radius dial ships. Plans get a "who can see this" choice.*

- **S2.1** Add the `visibility` column (`private`|`circle`|`community`|`local`|`public`)
  and the radius picker in Create. *Files: `CreateScreen.jsx`, `App.jsx` feed
  filtering. Table: `plans.visibility` + RLS policies per radius.*
  **Measurable:** ship by **2026-11-01**; ≥4 of 5 radii used in the wild within 4 weeks.
- **S2.2** Ship the social graph: `friendships` table, invite-by-link, "friends going"
  on cards. *Files: `App.jsx`, new `source/src/lib/social.js`. Tables: `friendships`,
  reuse `plan_participants`.* **Measurable:** by **2026-12-01**, median user has ≥3
  friends; ≥40% of joins come via a friend's rally.
- **S2.3** Ship `communities` (Layer 3) with one seeded group ("Internationals
  Copenhagen"). *Files: new `source/src/screens/CommunityScreen.jsx`. Tables:
  `communities`, `community_members`, `plans.community_id`.* **Measurable:** 3 live
  communities, 200 total members by **2026-12-31**.

### Phase 3 — Creator tools + monetisation (2027-01-01 → 2027-03-31)
*Hosts are the supply side. Give them tools and a reason to keep hosting.*

- **S3.1** Recurring rallies (weekly five-a-side, monthly quiz) — a `recurrence` rule
  that auto-spawns the next instance. *Files: `CreateScreen.jsx`, new
  `source/scripts/spawn-recurring.mjs` (or an Edge Function on `pg_cron`). Table:
  `plans.recurrence`.* **Measurable:** live by **2027-02-01**; ≥25 recurring series.
- **S3.2** Capacity unlock: free rallies cap at the venue's free tier; hosts pay a flat
  fee (not per-head) to lift the cap. *Files: `PlanScreen.jsx`. Tables: `plans.capacity`,
  new `host_subscriptions`.* **Measurable:** by **2027-03-15**, 10 paying hosts, €0
  per-head ever.
- **S3.3** Wire the existing Miinto loop to rallies — "bring a friend" mints a referral
  the same way the football share does. *Files: reuse `shareLinks.js`, `referrals` +
  `discount_codes` tables + `claim_referral` RPC (already live).* **Measurable:** by
  **2027-03-31**, 1 in 5 rallies generates ≥1 referral.

### Phase 4 — AI coordination layer (2027-04-01 → 2027-07-31)
*The "lowdown" voice, pointed at logistics instead of fixtures.*

- **S4.1** Smart rally suggestions: given a community's history, suggest the next rally
  (time, venue, blurb in SOUL voice). *Files: new `source/api/suggest-rally.js` (Vercel
  edge), reuse the lowdown TTS path. Tables: reads `plans`, `community_members`.*
  **Measurable:** by **2027-05-15**, ≥30% of suggested rallies get created.
- **S4.2** Auto-coordinate the messy middle: best time-slot from members' past
  attendance, a nudge in voice ("40 already in, two spots left. Move."). *Files:
  `App.jsx` notifications, `source/api/nudge.js`. Tables: `plan_participants` history.*
  **Measurable:** nudged rallies hit headcount 20% faster than un-nudged by **2027-07-01**.
- **S4.3** Group intent → connector suggestion (see §4/§7): when a rally is set, surface
  a deep-link to book the thing — never execute it. *Files: new
  `source/src/lib/connectors.js`.* **Measurable:** live by **2027-07-31**; ≥3 connector
  categories.

### Phase 5 — Geographic expansion (2027-08-01 → 2027-12-31)
*Only now. Density first, always.*

- **S5.1** De-hardcode Copenhagen: city as a first-class scope on venues and feed.
  *Files: `mockData.js` (`VENUES.city`), `App.jsx` city filter. Table: `venues.city`,
  `profiles.home_city`.* **Measurable:** ship multi-city by **2027-09-01**; launch
  Aarhus + Malmö.
- **S5.2** Seed each new city to a density floor before promoting it — never launch a
  ghost town. *Files: `source/scripts/seed-city.mjs`.* **Measurable:** no city goes
  public below 20 live rallies/week; 2 new cities at floor by **2027-12-31**.
- **S5.3** Localise the voice without losing it — SOUL stays the character, the football
  references flex per city. *Files: `SOUL.md` guidance, lowdown templates.*
  **Measurable:** voice QA pass on each new city before launch.

---

## 4. Revenue architecture (buildable on Supabase + Vercel + the live Miinto loop)

Nothing here needs a new stack. Each line ties to a table that exists or is named above.

| Revenue line | How | Table |
|---|---|---|
| **Capacity unlocks** | Flat host fee to raise a rally's cap past the free tier. **Never per-head** — charging per attendee taxes the gathering, which is the one thing we protect. | new `host_subscriptions`, `plans.capacity` |
| **Event infrastructure fees** | Optional paid add-ons for big public rallies: a custom poster (`/api/poster/[id].png` already renders these), a pinned spot, a branded share card. | `plans`, reuse `api/poster` |
| **Creator economy** | Recurring hosts (clubs, quiz-runners) subscribe for tools: recurrence, member lists, repeat-attendee insight. | `host_subscriptions`, `community_members` |
| **Business SaaS** | Venues claim a profile, post rallies, see headcount and repeat visitors — the venue side from 10× §3, now for any gathering, not just match night. | `venues` (add `claimed_by`), `plan_participants` |
| **Connector revenue** | User-initiated deep-links to book the thing (a pitch, a table, transport). Affiliate/referral only — execution stays external. The Miinto `discount_codes` loop is the working template. | `referrals`, `discount_codes`, new `connectors` |

The Miinto referral loop (`referrals` + `discount_codes` + `claim_referral` RPC) is
**already live and proven** — every other connector copies its shape.

---

## 5. The moat — the real-world intent graph

The 10× moat is the *voice*. The HEKLA moat is the **intent graph**: the only dataset
that knows *who actually shows up, with whom, where, how often, and for what.* Not
clicks, not RSVPs that evaporate — bodies in rooms, repeated. No fixtures API has it.
No social network has it (they have stated interest, not attendance). We earn it one
rally at a time, and it compounds: the more rallies, the better the suggestions
(§4 Phase 4), the stickier the communities.

**Start logging it now — even before HEKLA ships.** GDPR-clean, event-sourced, opt-in:

- `rally_events` — append-only: `created`, `joined`, `left`, `attended` (opt-in
  check-in), `host_changed`. The spine of the graph.
- `co_attendance` — derived: who showed up together (powers "friends going" and
  Extended Circle). Aggregate, never raw-shared.
- `venue_visits` — derived from attended events; powers the business-side insight and
  the "Busiest tonight" generalisation.

Every one of these is a Supabase table written by the same Realtime path that already
moves the "going" count. We don't change *how* we write — we change *what we keep*.

---

## 6. Constraints — the DO / DO NOT, sharpened for this codebase

**DO**
- Keep `plans`/`plan_participants`/`venues` as the spine — extend, never replace.
- Density before geography. No new city below the rally floor (§5 S5.2).
- Connectors are **user-initiated suggestions**: surface a deep-link, let the human
  press it. Execution always stays external.
- Safe-arrival / check-in / location sharing is **opt-in only**, per rally, off by
  default. The `attended` event in §5 is never silent.
- Voice first: every string still passes the SOUL test (§ [SOUL.md](../SOUL.md)).
- Telemetry is event-sourced and aggregate-by-default (§5) — GDPR from row one,
  per the 10× legal note.

**DO NOT**
- **Never charge per-head.** Taxing attendance kills the gathering. Capacity unlocks
  are flat fees only (§4).
- Never make a rally discoverable beyond its `visibility` radius — the dial is a
  promise, enforced in RLS.
- Never auto-add friends or auto-share co-attendance. The graph is opt-in.
- Never execute a booking on the user's behalf via a connector.
- Never break the standalone `file://` demo — `hasSupabase` still gates the backend.
- Never lose the football. It's the sharpest special case, not a phase we delete.

---

## 7. What else we'd add (beyond the brief)

1. **Host reputation / trust badges.** A lightweight, earned score: rallies hosted,
   show-up rate, no-mess history. Newcomers see "Sofie has hosted 12, everyone shows
   up." Trust is what lets a stranger walk into a Private→Community rally. *Table: new
   `host_stats` (derived from `rally_events`); rendered on the card in `App.jsx`.*

2. **The Loners Club — activity-matching as a first-class mode.** Not everyone has a
   ring yet. A mode that matches solo people to an open rally by vibe + radius —
   "first-timer who can't name the offside rule" is exactly who SOUL says is welcome.
   This is the on-ramp for Extended Circle. *Files: new
   `source/src/screens/LonersScreen.jsx`; reuses `VIBES`, `plans`, `co_attendance`.*

3. **Post-rally memory / recap.** After a rally, a warm one-card recap in voice — who
   came, the photo, "same time next week?" — that becomes a share and a re-rally
   trigger. Memory is what turns a one-off into a recurring series. *Files: reuse
   `api/poster`; new `rally_recaps` table.*

4. **Bring-a-friend viral mechanic on the live referral loop.** Every rally invite that
   converts a *new* user mints a Miinto code via the existing `claim_referral` RPC —
   the football referral loop, now firing on every gathering. The cheapest growth we
   have is already built. *Files: `shareLinks.js`, `referrals`, `discount_codes`.*

5. **Offline-first invites.** A rally invite that works as a plain share-link / QR with
   the radius and details baked in, so it survives a dead WhatsApp or a no-signal
   basement bar. The poster route already renders shareable images — extend it to a
   scannable join card. *Files: `api/poster/[id].png`, `middleware.js` (the `/p/<id>`
   crawler route already exists).*

6. **Accessibility as a rally property.** Step-free, hearing-loop, family-friendly,
   quiet-corner flags on `venues` and `plans`, surfaced in filters. "Everyone's welcome
   at the bar" (SOUL) only means something if the room actually lets everyone in.
   *Table: `venues.access_tags`, `plans.access_notes`; filter in `App.jsx`.*

7. **GDPR-clean telemetry by design.** Bake consent and aggregation into the §5 event
   tables from day one: raw co-attendance never leaves the server, users can export and
   wipe, the `attended` check-in is opt-in per rally. Designing this *before* the data
   is valuable is the only honest time to do it. *Tables: `rally_events`,
   `co_attendance` with a `consent` gate; new `source/src/lib/telemetry.js`.*

8. **Civic / cause rallies as a respected radius-5 type.** SOUL says football carries
   real-world weight, handled with respect. A `civic` rally type (cleanups, food banks,
   neighbourhood meets) extends "the gathering as the point" past leisure — and it's the
   most defensible, least-cloneable use of the intent graph. *Files:
   `plans.rally_type='civic'`; surfaced in `RalliesScreen.jsx`.*

---

*Density first. Voice always. The match was just the first thing worth showing up for.*

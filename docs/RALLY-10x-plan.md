# RALLY — the 10× plan

*From a clickable prototype to the app Copenhagen opens on match night.*

Today RALLY is a beautiful front-end running on baked-in data. To 10× it we change
three things: **where the data comes from** (a European football API, not ESPN),
**how live it is** (real-time scores, goals, cards — and real-time "who's going"),
and **what it's worth** (a real social product with a business model, not a demo).

---

## 0. The one architectural idea that makes everything else cheap

Put a **data adapter** between the football API and the app. The app only ever
reads our own shape (`fixtures.json` today, a Supabase table tomorrow). Swapping
ESPN → football-data.org → API-Football becomes a one-file change, never a UI
rewrite. We already proved this works: the app reads `fixtures.json`; only the
fetcher knows about the source.

```
[ Football API ]→ adapter (normalise) → [ Supabase ] → Realtime → [ RALLY app ]
   football-data.org / API-Football        (our shape)              (no API logic)
```

This is the difference between "10× the app" and "rewrite the app." We do the
former.

---

## 1. Data spine — off ESPN, onto Europe (the immediate move)

ESPN is a US network: it carries US broadcasters and has no Danish channel data,
no per-event feed, and no support contract. We move to European providers.

| Source | Role | World Cup | Live depth | Cost | Use it for |
|---|---|---|---|---|---|
| **football-data.org** | Primary (now) | `WC` competition code | Score + status (polled) | **Free** (10 req/min) | Drop-in for our fetcher: fixtures, kickoff, standings, scorers, H2H. The API behind `football-cli`. |
| **API-Football** (api-sports.io) | Power source (10×) | `league=1, season=2026` | **Goals, cards, lineups, stats, predictions, odds — updated every 15s** | Free tier (100/day) → from ~$10/mo | The live match engine and all the smart content. |
| **openfootball/worldcup.json** | Keyless fallback/seed | full bracket JSON | static | Free, no key | Offline seed, schedule scaffold, disaster fallback. |
| Sportmonks / BALLDONTLIE | Optional upgrades | yes | xG, shot maps, momentum | €69+/mo / freemium | Later, if we want xG and shot maps. |

**Plan of record:** ship **football-data.org** now (free, European, `WC`), with
**openfootball.json** as a no-key seed; upgrade the live path to **API-Football**
when we turn on real-time. Keep ESPN only as a disabled fallback adapter.

**Step 1 (small, do first):** `fetch-fixtures.mjs` gets a `--source football-data`
adapter that maps `WC` fixtures into the exact shape we already use. Nothing in the
UI changes. Channels keep coming from the DR/TV 2 matcher we built.

---

## 2. Real-time — the part that earns the name

Two kinds of "live," both powered by the same Realtime layer.

**Live match.** A small worker calls API-Football `/fixtures?live=all` every ~15s
during match windows and writes goals, cards, lineups, score and minute to
Supabase. The app subscribes and updates itself — cards flip to "● LIVE 67' · 2–1"
with no refresh, and we fire push notifications: *"GOAL — Brazil 1–0, 23'."* (The
live-aware card UI and the countdown are already built; this just feeds them real
events.)

**Live social.** "12 going" becomes truly live: when a friend taps **Join**,
everyone watching that plan sees the count tick up instantly (Supabase Realtime on
the `plan_participants` table). This is the heartbeat of a match-night app.

---

## 3. The actual product — RALLY is a *social* app, so build the social core

The prototype fakes accounts, plans and people. 10× means making them real.

- **Auth & identity** — phone / Apple / Google sign-in; the profile we already
  onboard becomes persistent.
- **Plans, venues, joins in Supabase** — the schema already matches our mock, so
  this is wiring, not redesign. Plans persist, survive refresh, and sync across
  devices.
- **Friends & group chat** — a thread per plan ("look for the green RALLY flag");
  invite friends; see which friends are going where.
- **Push notifications** — "3 friends are rallying for Denmark tonight," "Your plan
  at Reffen starts in 1 hour," "GOAL."
- **Venue side** — bars claim a venue, post their plan, see headcount. This is also
  a revenue surface (§6).

---

## 4. Content & intelligence — make the data *say something*

The same European feed that powers scores powers the personality.

- **The AI "lowdown," for real.** Today it's a charming hand-written script read by
  the browser voice. Feed it live data — form, head-to-head, lineups, injuries,
  API-Football **predictions** and **odds** — and generate a genuinely smart,
  funny 30-second hype clip per match, in a custom **ElevenLabs** RALLY voice.
- **Win-probability & momentum.** API-Football predictions/odds → the win-prob bar
  on match detail; live momentum during the game.
- **Predictions that mean something.** Users pick winners; results grade against
  real outcomes → the **Super Predictor** leaderboard becomes legitimate, not
  decorative.
- **Real standings & "what it means."** Live group tables with qualification math
  ("Denmark go through with a draw").

---

## 5. Brand & UX polish — finish the craft

- **Match art from the teams** ✅ (done) — national colours + flags, never a random
  photo.
- **Crisp cross-platform flags** — swap emoji flags (which break on Windows) for
  the API's flag images.
- **Real imagery** — replace placeholder lifestyle shots with brand shoots / a
  curated football-nightlife set; keep the analogue, editorial look from the board.
- **Per-card team accents, motion, haptics** — small, physical, on-brand.
- **PWA → installable**, offline schedule, add-to-home-screen, dark splash. Then a
  thin native wrapper (Expo/Capacitor) for the App Store and real push.

---

## 6. Business model — why this is a company, not a demo

- **Outfit commerce** — the Miinto feed goes live; "Style for the game" earns
  affiliate revenue on every jersey/cap.
- **Sponsorship** — Unisport powers the leaderboard prizes; the fan-zone and
  "lowdown" are sponsorable surfaces.
- **Venue placement** — bars pay to be featured/boosted on match night; promoted
  plans, claimed venues, "RALLY here" partnerships.
- **Viral loop** — the share card + deep links (`rally.app/p/…`) already designed;
  add referral so every shared plan recruits.

---

## 7. Infrastructure

Supabase (Postgres, Auth, **Realtime**, Storage, Edge Functions) · Vercel (web +
cron) · a small live-data worker · push (FCM/APNs) · analytics (PostHog) ·
ElevenLabs (voice) · Expo/Capacitor (native shell). All boring, proven, cheap to
start.

**Legal:** never use "FIFA"/"World Cup" marks or logos in the brand; Danish TV
channels are illustrative until confirmed; GDPR from day one.

---

## 8. Sequenced roadmap

| Phase | Theme | Ships | "10×" you can feel |
|---|---|---|---|
| **A** | European data | football-data.org adapter + openfootball seed; ESPN retired | Same app, real European source, no US dependency |
| **B** | Real-time match | API-Football live worker → Supabase → Realtime; goals/cards/lineups; GOAL push | Cards update themselves; the app is *alive* on match night |
| **C** | Real social | Auth + persistent plans + live "going" counts + plan chat | People actually coordinate in it |
| **D** | Intelligence | Data-driven AI lowdown (ElevenLabs), win-prob, real predictions/standings | It feels smart and personal |
| **E** | Polish & native | Crisp flags, real imagery, PWA → App Store, push | Looks and feels shippable |
| **F** | Business | Miinto feed, venue placement, sponsorship, referral | It makes money and grows itself |

Phases A–B are the unlock; everything after compounds on the Realtime spine.

---

## 9. Recommended next step

Build **Phase A** now: a `football-data.org` adapter for the fetcher (free,
European, `WC`), keeping our shape and the DR/TV 2 channel matcher intact — so the
app instantly runs on European data with zero UI change. Then turn on API-Football
live for Phase B.

---

### Sources
- football-cli (Node, football-data.org `WC`): https://github.com/manrajgrover/football-cli
- world-cup-scoreboards: https://github.com/brenohq/world-cup-scoreboards
- API-Football — WC 2026 guide: https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports
- openfootball/worldcup.json (no key): https://github.com/openfootball/worldcup.json
- soccerdata (Python/FBref): https://soccerdata.readthedocs.io
- Sportmonks World Cup API: https://www.sportmonks.com/football-api/world-cup-api/

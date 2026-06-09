# Kickoff — MVP prototype

*Find where Copenhagen is watching tonight's match, and join them.*

A mobile-first clickable prototype of the core loop. Social data (plans, people,
venues) is still mock, but **fixtures are now real**: the full 2026 World Cup
schedule is pulled live from ESPN's hidden API.

---

## Live fixtures (real data)

`src/data/fixtures.json` holds the real WC2026 schedule — Copenhagen kickoff
times, venues, recent form, and live-status fields (score + minute that
auto-fill once a match kicks off). Refresh it any time:

```bash
npm run fixtures                       # whole group stage
node scripts/fetch-fixtures.mjs 20260611 20260614   # a date window
npm run channels                       # Danish TV channel per match (DR/TV2)
npm run archive                        # CC/PD archive photo per match (Commons)
```

Source: ESPN `site.api.espn.com/.../soccer/fifa.world/scoreboard` — no key, no
scraping. The hand-authored editorial matches (commentary, fun facts, plans)
are merged on top and the rest of the real schedule is appended automatically.

**Production path:** run the fetcher on a backend cron (or the `espn-pp-mcp`
MCP server from the Printing Press `espn` CLI) every ~30s during live windows,
writing into Supabase. The app just reads the table — same JSON, same shape.

---

## Run it (you already have everything installed)

From this folder:

```bash
npm run dev
```

Then open the URL it prints (e.g. `http://localhost:5173`).

**To demo on your phone (recommended for the pitch):**
The terminal also prints a `Network:` URL like `http://192.168.x.x:5173`.
Open that on your phone *while on the same Wi-Fi as your laptop*. It looks and
feels like a real app. Add to Home Screen for full-screen.

On a laptop it renders inside a phone frame automatically.

---

## What's in the demo

The whole core loop works, with realistic Copenhagen data:

1. **Tonight** — today's & upcoming World Cup matches, your team (Denmark) featured, live "X going" counts.
2. **Match → spots** — every venue with a plan: vibe, who's going, headcount.
3. **Plan detail** — host, note, the actual people going, **Join**, **Share**.
4. **Create a plan** — pick venue, time, vibe, note → instantly live + shareable.
5. **Share card** — the growth engine: a branded card "I'm watching X at [bar], join us" for WhatsApp/iMessage/IG.
6. **Leaders** — the simple sponsorship layer: 3 recognition categories, Unisport-branded. No points economy.

Everything is interactive — joining, creating, and sharing all update live in the session.

---

## How this maps to the real build

The mock data in `src/data/mockData.js` is shaped like the Supabase schema from
your spec (`users`, `venues`, `matches`, `plans`, `plan_participants`). When we
go real, those arrays become Supabase queries and the screens shouldn't need to
change much.

**Suggested next steps (post-pitch):**
1. Supabase project + the schema (already drafted in your notes).
2. Seed 20–50 real Copenhagen venues.
3. Wire auth (phone or Google) + real join/create.
4. Real share links that deep-link into a plan.
5. *Then* the AI venue-scraping enrichment layer — cold-start accelerator, not MVP.

## Stack
React + Vite + Tailwind. One screen file (`src/App.jsx`), one data file. Deliberately tiny so it's fast to change.

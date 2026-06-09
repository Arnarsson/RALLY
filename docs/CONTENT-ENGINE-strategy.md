# RALLY Content Engine — strategy

*Distribute the soul. Every day. On autopilot.*

## The thesis

`SOUL.md` says the moat isn't features — it's RALLY having an **opinion** nobody
else has. A voice is only a moat if people *hear* it. So the content engine has
one job: take the voice RALLY already has and broadcast it daily, at zero
marginal effort, on the surfaces where football fans actually scroll.

Every other football account posts plumbing — fixtures, line-ups, final scores.
RALLY posts a *take*. That's the entire differentiation, and it's free, because
the inputs already exist:

- **The photo** — a real historic B&W shot of the two nations, sourced by the
  **wikimedia CLI** and already stored per fixture (`archive.src`).
- **The frame** — the matchday poster generator (`PosterCard` / `/api/poster`),
  already built, re-colours to each match.
- **The words** — a caption written to `SOUL.md`: the cocky-but-warm football mate.

The engine just bolts those three together and spits out a finished post.

## How it runs (generate-only)

No auto-publishing, no credentials, no scheduler to babysit. Each morning the
engine drops a **ready-to-post pack** into a dated folder; you post it in two
minutes from your phone.

```
                         ┌─ wikimedia CLI ──► historic B&W photo (already in fixtures.json)
  today's fixtures ──────┤
   (fixtures.json)       ├─ PosterCard ─────► 1080×1920 poster PNG  (IG/TikTok/FB)
                         │
                         └─ SOUL.md ────────► caption + hooks + hashtags (per platform)
                                   │
                                   ▼
                       /social/2026-06-11/
                         ├─ mexico-south-africa.png
                         ├─ mexico-south-africa.txt   (caption, IG/TikTok/FB variants)
                         ├─ slate-digest.png
                         └─ slate-digest.txt
```

You open the folder, post, done. When you're ready to remove even that step, the
same pack pipes into a scheduler (Ayrshare / Buffer / Meta Graph) — but that's a
later switch, not a dependency.

## What gets posted

Two formats daily (your pick: per-match **and** the digest):

1. **Matchday poster — one per fixture.** The historic photo + team colours + a
   SOUL hook. The workhorse: fills the calendar, every match its own post.
2. **The daily slate digest — one per day.** "Tonight in Copenhagen" — every
   match on one graphic + where the city's watching. The match-night briefing as
   an image. One strong anchor post a day.

### Platform cuts (same soul, different gear)

- **Instagram** — poster to the feed; the hook line as the caption opener; digest
  to Stories. The visual home of the B&W-history aesthetic.
- **TikTok** — the poster as a static-with-motion cover today; the **auto-video**
  (photo + captions + the robotic-but-funny VO) when you green-light it. Best
  top-of-funnel discovery for the banter.
- **Facebook** — same poster via the Meta family; lean the caption slightly
  warmer/longer for the older Copenhagen + venue-tagging crowd.

## The voice rules for captions (this is the whole game)

Captions are written **to `SOUL.md`**, not freestyled. The non-negotiables:

- **Lead with a take, never a fixture.** "Mexico vs South Africa, 21:00" is dead
  on arrival. Open with the opinion.
- **One screenshot-worthy line up top**, then the details (time, venue, channel)
  underneath where they belong.
- **Warm under the cocky.** Roast lands on love. Punch up, never down.
- **Texts, not essays.** IG/TikTok: 1–2 lines + a tag question. FB: a touch
  longer.
- **End on the loop:** "find your people" / "who's rallying?" — pull them toward
  the app, not just the like button.
- **Hashtags are minimal and real:** the two nations, #WorldCup2026-adjacent tags
  (no FIFA marks), #RALLY, #København. No hashtag soup.

Run every caption through SOUL's test: *would the cocky-but-warm mate text this?*
If you'd screenshot it to the group chat, ship it.

## Content pillars (so it's not just matchday)

Matchday posters are the spine, but the voice has more to say. Rotate in:

- **On this day** — a historic WC moment from the archive, RALLY's take on it.
- **The cooldown** — a post-match reaction graphic (peak emotion, peak shares).
- **Group-chat bait** — a spicy one-liner card with no photo, pure voice.
- **Where Copenhagen's watching** — venue spotlights (ties content → the product).
- **The model, roasted** — RALLY editorialising the win-prob, daring you to
  disagree → funnels toward predictions later.

## Cadence

- **Daily:** 1 slate digest (anchor) + 1 poster per fixture that day.
- **Match nights:** + 1 cooldown after the headline game.
- **Off-days (rare in the group stage):** 1 "on this day" or group-chat-bait post
  so the account never goes quiet.

Roughly 2–5 assets/day in the group stage, all generated, all on-voice — a volume
no solo founder could sustain by hand, which is the point.

## Measure what matters

Not vanity likes — **the loop**. Track: saves + shares (does the voice travel?),
profile→app taps (does it convert?), and which *kind* of line gets screenshotted
(feed it back into the caption prompt). The goal is reach that turns into people
in rooms, not a follower count.

## Build roadmap

**Already done:** wikimedia image sourcing (in `fixtures.json`), the poster
generator (`PosterCard` + `/api/poster`), and now `SOUL.md` (the caption spec).

**To build (small):**
1. `scripts/social-pack.mjs` — for a given date: pull the day's fixtures, render
   each poster PNG, render the digest, and write SOUL-voiced caption files (the
   caption text is generated against `SOUL.md`). Output the dated `/social/` pack.
2. A caption generator step — feeds match facts + `SOUL.md` to an LLM, returns the
   per-platform caption + hooks + hashtags. (Human-glance approval = the
   generate-only gate.)
3. *Later:* swap "open the folder and post" for a scheduler hand-off, and add the
   auto-video for TikTok.

**This is the distribution arm of the brand.** The app is where people rally;
the content engine is how they find out RALLY exists — in RALLY's own voice,
every single day.

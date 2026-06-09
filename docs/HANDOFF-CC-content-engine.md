# CC handoff — RALLY Content Engine (static + video)

Build the daily content engine that distributes RALLY's voice. **Generate-only**:
each morning it drops a dated pack of finished assets + captions; Sven posts them
by hand to Instagram, TikTok, Facebook. No auto-publishing, no social credentials,
no scheduler — that's a later switch, not a dependency.

Strategy + voice spec live alongside this: `CONTENT-ENGINE-strategy.md` (the why)
and `SOUL.md` (the voice every caption + script is written to). Read both first —
they are the source of truth for tone. This doc is the build brief.

## What already exists (don't rebuild)

- **Historic photos** — sourced by the wikimedia CLI, stored per fixture in
  `source/src/data/fixtures.json` as `archive.src` (+ `credit`, `license`,
  `source`). Commons, commercial-OK. Attribution must ride along.
- **The poster** — `source/src/components/PosterCard.jsx` + `/api/poster/[id].png`
  render the 9:16 matchday card, recoloured per team. Reuse it as the static post
  and as the video's cover/outro frame.
- **The voice** — `SOUL.md`. Captions and the video script are written to it.
- **Match data** — fixtures.json carries team colours, flags, kickoff, venue, TV,
  win-prob, H2H — everything a caption or script needs.

## Outputs (per Sven's choices)

Platforms: **Instagram, TikTok, Facebook**. Mode: **generate-only**. Cadence:
**one poster per fixture + one daily slate digest**, plus **video for TikTok/Reels**.

Each run writes a dated folder:

```
/social/2026-06-11/
  mexico-south-africa.png        ← poster (static post: IG feed, FB)
  mexico-south-africa.mp4        ← 9:16 video (TikTok, IG Reels, FB)
  mexico-south-africa.txt        ← captions: IG / TikTok / FB variants + hashtags
  slate-digest.png               ← the day's matches on one graphic
  slate-digest.txt               ← digest caption
  manifest.json                  ← what was made, per-asset status, attribution, cost
```

## Pipeline

```
 today's fixtures (fixtures.json)
        │
        ├── STATIC ─────────────────────────────────────────────
        │     PosterCard / /api/poster  ─►  poster.png (1080×1920)
        │     SOUL.md + match facts     ─►  caption.txt (IG/TikTok/FB)
        │
        └── VIDEO (TikTok/Reels) ───────────────────────────────
              archive.src photo
                 │
                 ├─ Higgsfield image→video  ─►  3–6s motion shot(s)
                 │     (Grok Imagine 1.5 / Kling 3.0 / Seedance 2.0)
                 │
                 └─ assemble: cover → motion shot(s) → SOUL captions
                    burned in → brand frame → robotic VO of the lowdown
                    → outro poster  ─►  video.mp4 (15–30s, 9:16)
```

### 1. Caption + script generator (the core)

A step that takes one fixture's facts + `SOUL.md` and returns:
- **3 captions** (IG / TikTok / FB) — lead with a take, one screenshot-worthy line
  up top, details below, end on the loop ("who's rallying?"). FB slightly longer.
- **Hashtags** — minimal, real (the two nations, #RALLY, #København; **no FIFA /
  "World Cup" marks** — trademark).
- **The 20–25s video script** — the lowdown, in SOUL voice, as VO + on-screen
  caption beats.

Implementation: an LLM call with `SOUL.md` as the system spec and the fixture as
input. Gate = Sven glancing at the pack before posting (that's the "generate-only"
approval). Keep the worst-case off-voice line from ever auto-publishing — there is
no auto-publish.

### 2. Static poster

Render `PosterCard` (or hit `/api/poster/[id].png`) to a 1080×1920 PNG. Already
built — just call it per fixture and for the digest (digest = a multi-match layout;
new small template, same poster styling).

### 3. Video via Higgsfield (the new part)

Use the Higgsfield MCP/API (`generate_video`). Recommended models for "bring the
B&W photo to life," all 9:16:

| Model | Use | Notes |
|---|---|---|
| **Grok Imagine 1.5** (`grok_video_v15`) | Animate one still → cinematic motion | image-to-video, exactly one `start_image`, 2–15s, native audio direction. Best default for the single historic photo. |
| **Kling 3.0** (`kling3_0`) | More dynamic / multi-shot | start+end image, motion transfer, audio, 3–15s, 9:16. Use for hero fixtures. |
| **Seedance 2.0** (`seedance_2_0`) | Identity-consistent, reference-driven | 4–15s, image/video/audio refs. |
| **Marketing Studio** (`marketing_studio_video`) | Polished TikTok/Reels ad-style cut | 4–15s, audio, hooks/settings. Use when you want a slicker "ad" feel over raw photo-motion. |

Flow per video:
1. Feed `archive.src` as the `start_image` with a prompt for **subtle, tasteful**
   motion (slow push-in, parallax, grain drift — it's archival footage, not a
   music video). Generate a 4–6s clip; chain 2–3 clips for a 15–30s runtime if
   wanted.
2. Generate audio **off** on the model — RALLY supplies its own **robotic TTS VO**
   of the SOUL script (voice stays robotic for now, per Sven) so the brand voice is
   consistent and free.
3. Assemble: poster cover (0.5s) → motion shot(s) → SOUL captions burned in, beat-
   synced → brand frame (lime spine, RALLY mark) → outro = the poster with "find
   your people · rally.futbol". Assembly tool: **Remotion** (React video, fits the
   stack) or **ffmpeg**. Keep the brand frame deterministic in the assembler, not
   gen-AI.
4. **Cost control:** call `generate_video` with `get_cost: true` to preflight
   credits; cap clips/day; cache by fixture id so a video is made once. Log spend
   into `manifest.json`.

**Alternatives** (if Higgsfield credits/quality aren't right): Runway Gen-3, Pika,
or Luma for the image→video shot; or a **fully deterministic fallback** — a Ken-
Burns pan/zoom on the still via ffmpeg + Remotion captions, no gen-AI at all. The
assembler should treat the "motion shot" as a pluggable provider so the engine
runs even with the gen-AI step disabled.

## Build order (for CC)

1. `scripts/social-pack.mjs <date>` — gather the day's fixtures, render posters +
   digest, write the dated `/social/` folder + `manifest.json`. (Static first; it's
   the 80%.)
2. Caption/script generator step (LLM + `SOUL.md`) → the `.txt` files.
3. Video step: Higgsfield image→video provider + Remotion/ffmpeg assembler +
   robotic VO, behind a provider interface with the deterministic fallback.
4. A daily trigger (Vercel cron or a scheduled task) that runs the pack for
   "today" and notifies Sven the folder's ready.

**Definition of done:** running `social-pack.mjs 2026-06-11` produces, on voice and
on brand, the opener's poster + a 9:16 video + IG/TikTok/FB captions + the slate
digest, with Commons attribution preserved and a cost line in the manifest — and
nothing is published anywhere automatically.

## Constraints

- **Voice:** every word to `SOUL.md`. Run the "would the cocky-but-warm mate text
  this?" test. No corporate, no neutral plumbing.
- **Legal:** no FIFA / "World Cup" marks or logos; keep Commons attribution on any
  archival image used in stills or video frames (it's in `archive.credit/source`).
- **Generate-only:** never wire auto-publish in this phase. The output is a folder.
- **Budget:** preflight Higgsfield cost, cap per day, cache per fixture, and make
  the gen-AI motion step optional (deterministic fallback) so a dry credit balance
  never breaks the daily pack.
- **Env:** add `HIGGSFIELD_API_KEY` (or MCP creds) to `source/.env.example`; the
  robotic VO needs no key (browser/library TTS); captions reuse the existing LLM
  access.

This is the brand's distribution arm: the app is where people rally; this engine is
how Copenhagen finds out RALLY exists — in RALLY's own voice, every day, on
autopilot, with a human glance before it goes live.

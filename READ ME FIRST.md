# RALLY — prototype (for Sven)

## 👀 Just want to look? (no setup, ~30 sec)
Double-click **“RALLY — open me.html”** → it opens in your browser.
- Use **Chrome** if you can. Needs **internet** (loads fonts + photos).
- It’s a phone app, shown inside a phone frame on desktop.
- Try this: bottom tabs **Tonight / Outfit / Leaders** → open a match → **Join** a plan → hit **Share** → press **▶ the 30-sec rundown** (turn your **sound on**) → check the **Outfit** tab.

## What it is
**RALLY — find your game, find your people.** Find where people are watching the
World Cup in Copenhagen and show up together. This is a clickable prototype to feel
the product and the brand — not a finished app.

## Heads up — it’s a prototype
- **Photos are placeholders** (real ones = our own shoots / a Miinto product feed).
- **The AI “rundown” uses your computer’s built-in voice** (production = a custom funny voice via ElevenLabs).
- **No real accounts/backend yet** — plans, people and venues are mock data and reset on refresh.
- **Fixtures are now REAL** — the full 72-match World Cup group stage is pulled live from ESPN’s API (real teams, Copenhagen kickoff times, venues, recent form). Cards flip to a live score + minute the moment a match kicks off, and full-time scores after. (Danish TV channels are still illustrative.)
- Want to refresh the schedule? In `source/`: `npm run fixtures`. See `source/README.md`.

## 🛠 Want to run / change the code?
Everything’s in `source/`:
1. Install **Node.js** from nodejs.org (if you don’t have it).
2. In Terminal: `cd source` → `npm install` → `npm run dev`
3. Open the printed `localhost` link.

## 📦 In the box
- **RALLY — open me.html** — the standalone app (just open it)
- **source/** — full source code (React + Vite + Tailwind)
- **docs/** — pitch script (PITCH-Sven.md), app-store listing, brand guidelines
- **icon-512.png** — the app icon

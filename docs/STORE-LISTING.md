# RALLY — App Store & Google Play listing

**Brand / legal app name:** `RALLY` (this is the permanent identity — never tie it to one tournament).
**Tagline:** *Find your crowd* (primary) · *Where fans become friends* (secondary).
**Positioning line:** "Find where people are watching the match in your city, and join them."

The tournament words live in **store metadata** (title, subtitle, keywords, description) — not the brand — so the listing can be rebranded each tournament without touching the product.

---

## ⚠️ Read first — two practical limits

**1. Character limits (your draft copy is over on some fields).** Apple/Google enforce these:

| Field | Apple App Store | Google Play |
|---|---|---|
| App name / title | **30 chars** | **30 chars** |
| Subtitle / short description | 30 chars (subtitle) | 80 chars (short desc) |
| Promotional text | 170 chars | — |
| Keywords | 100 chars total | (no field — uses description) |
| Description | 4000 chars | 4000 chars |

Your line *"RALLY \| World Cup 2026 Watch Parties"* is 36 chars — too long for the 30-char name field. Trimmed versions below fit.

**2. "World Cup" + "FIFA" are trademarks.** *(Not legal advice.)* FIFA polices these hard, including app-store metadata and icons. Using **"World Cup"** in your title/keywords carries real takedown risk; using **"FIFA"** or any official logo/emblem is a clear no. Safer, still-high-traffic alternatives: *"2026 football"*, *"soccer tournament"*, *"matchday"*, *"watch party"*, *"fan zone"*. Below I give a **safer** set and a **higher-risk** set — your call.

---

## Apple App Store

**App Name** (≤30) — *pick one:*
- `RALLY: Football Watch Party` ✅ safer (27)
- `RALLY: World Cup Watch Party` ⚠️ trademark risk (28)

**Subtitle** (≤30) — *pick one:*
- `Find your crowd & meet up` (25)
- `Never watch the match alone` (27)

**Promotional text** (≤170, editable anytime):
> Heading to the 2026 tournament season? Find where fans are watching near you, join a group, and never watch alone. Watch parties, fan zones & new friends.

**Keywords** (≤100, comma-separated):
- Safer: `watch party,football,soccer,fans,bars,matchday,meetup,sports bar,fan zone,groups,nearby,2026`
- Higher-traffic ⚠️: `world cup,watch party,football,soccer,fans,matchday,fan zone,meetup,bars,2026,groups`

---

## Google Play

**Title** (≤30): `RALLY: Football Watch Party` (or the World Cup variant ⚠️)

**Short description** (≤80):
> Find watch parties, join groups & never watch alone.  *(52 chars ✅)*

---

## Full description (both stores, ≤4000)

> **Never watch the match alone again.**
>
> RALLY shows you where people in your city are watching live football — tonight. Find a watch party near you, see who's going and the vibe, and join in one tap. Or start your own and share it to your group chat.
>
> People don't watch the big tournaments for the football alone. They watch to go out, meet people, feel part of something, and not be alone. RALLY is the layer that gets fans into the same room.
>
> ⚽ **See tonight's matches** — every game, kickoff times in your timezone, and which channel it's on.
> 📍 **Find watch parties near you** — bars, fan zones, student screens. Filter by vibe: party, chill, student, expat, hardcore.
> 👥 **Join in one tap** — see exactly who's going before you show up.
> ➕ **Start your own plan** — pick a venue, set the time, share the card.
> 📣 **Share to your group chat** — every plan is a card your friends can tap and join.
> 🎙️ **30-second hype rundowns** — a quick, funny AI lowdown on both teams before kickoff.
> 🏆 **Get recognised** — the fans who bring the most people together win prizes from our partners.
>
> Launching in Copenhagen for the 2026 season, rolling out to more cities.
>
> Find your crowd. Show up together.

---

## Assets included (in `app/public/`)
- `icon.svg` — master vector icon
- `icon-512.png`, `icon-192.png` — store / PWA icons (full-bleed; stores apply the rounded mask)
- `apple-touch-icon.png` (180px), `favicon-32.png`
- In-app **splash screen** = RALLY wordmark + "Find your crowd"

*Icon = bold "R" on RALLY green with a pink accent + energy arcs. For the real store submission you'll also want screenshots (use the running app) and a 1024×1024 icon — say the word and I'll export that size too.*

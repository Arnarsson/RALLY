# Pitching Kickoff to Sven — demo script

Goal of the meeting: get Sven to feel the product and agree it's worth building
for real (Supabase + Copenhagen seed). Don't over-explain. **Let the phone do the talking.**

---

## Setup (2 min before)
- `npm run dev` in the `app/` folder.
- Open the `Network:` URL on your phone, add to Home Screen, full screen.
- Hand Sven the phone at the right moment — feeling it beats watching it.

---

## The one-liner (say this first)
> "People don't go to World Cup games for football. They go to not be alone.
> Kickoff is where you find where everyone's watching tonight — and join them."

## The killer angle (Denmark didn't qualify — use it)
> "Denmark isn't even in this World Cup. And the bars in Copenhagen will *still*
> be packed every night. That's the whole thesis: it was never about Denmark
> playing — it's about going out together. Expats watching their teams, students,
> friends, the opening night on Rådhuspladsen. Kickoff is the layer that finds them each other."

This is genuinely strong — it kills the "this only works if the home team is winning" objection before it's raised.

---

## The 90-second demo (follow the loop)
0. **Profile setup** — quick: type a name, tap a flag, "Let's go." "First open, you're in 10 seconds — no friction."
1. **Tonight screen** — "Opening night, Mexico v South Africa, 20+ people already going across 4 spots. And it shows which channel each game's on — DR1, free." Scroll. *The city is alive even though Denmark's not playing.*
2. **Open the opening match** — "Every spot is a real plan someone made: the fan zone party, a student big screen, a chill bar for first-timers." Point at vibes + faces + the **fun fact** card ("nice little conversation starter — it's a social app, not a stats app").
   - **Hit ▶ on the 30-sec rundown** — "AI commentator hypes both teams before kickoff. Right now it's the phone's voice; production uses a custom funny voice (ElevenLabs). This is the kind of thing people screenshot and share." (Make sure your Mac isn't on silent.)
3. **Open a plan** — "You see exactly who's going, the vibe, where to meet, what channel. One tap to join." → tap **Join**. "Now I'm in."
4. **Create a plan** — back out, hit *Start a watch plan*. Pick a bar, vibe, note. "Took 15 seconds. It's live."
5. **Share** — hit **Share**. "*This* is the growth engine. Every plan is a card you drop in your group chat. Your friends tap, they're in, they show up. Real-world density."
6. **Leaders tab** — "And the business: a dead-simple recognition layer. Three categories, Unisport branding. The people who bring crowds together get kit. No points economy, no gaming."

> Note: fixtures, kickoff times (Copenhagen) and Danish TV channels are real. The
> people/plans are seeded mock data. Real signup/accounts is the one thing not
> wired yet — deliberately, it's backend work and isn't needed to show the vision.

---

## The why-now / why-us
- World Cup 2026 is a **concentrated, time-boxed demand spike** in Copenhagen. Perfect launch wedge.
- The moat isn't the app — it's the **real-world attendance graph**: who goes where, with whom. Compounds across tournaments → concerts, festivals, NYE.
- We can have a working seeded version live for the **first match night**.

---

## What I'm asking Sven for
*(pick what's true)*
- A go / no-go on building the real version (Supabase + Copenhagen seed).
- Help / intros for **bar outreach** (20–50 venues) — the seed list is the hard part.
- Whether he wants in on the Unisport-style sponsor conversation.

---

## If he pushes back — honest answers ready
- **"Why not just a WhatsApp group?"** → Groups don't help strangers find each other, don't scale past your friends, and give us zero data. Kickoff turns private plans into public, joinable, shareable ones.
- **"Cold start?"** → We seed Copenhagen manually first (the venue list), plus the share card means every user pulls in their group chat. AI scraping comes *later* to scale to new cities.
- **"Is this a dating app / another social network?"** → No. No feed, no swiping, no follows. It's coordination. You open it to answer one question: *where do I go tonight?*

---

## Keep in your back pocket (don't lead with these)
- The 4-day build order: Supabase schema → venue seed → plan create/join → share cards → (later) AI scraping.
- Success metrics that matter: plans per match, avg attendees per plan, % users who join a plan, repeat usage. **Not** downloads/likes/time-in-app.

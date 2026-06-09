# RALLY → iPhone: the goal-loop launch plan

How we take RALLY (live web app + Supabase) to a real iPhone app on the App
Store — **without rewriting the UI**. Structured per the `goal-loop` skill: one
**final goal**, five sequenced **subgoals**, each a measurable **loop** with a
verifiable exit number and the human-in-the-loop gates marked.

**Approach:** wrap the existing Vite build in **Capacitor** (the UI runs in a
WKWebView; one codebase serves web + iOS). We add the native bits a watch-party
app actually needs — push, deep links, share. No React Native rewrite.

**The hard external gates (name them up front):**
- **macOS + Xcode** to build/sign — Sven is on Arch. Solved with **CI macOS**
  (Codemagic free tier or GitHub Actions `macos` runners). No Mac on the desk.
- **Apple Developer account ($99/yr)** + signing certs — only Sven can create
  these. SG3 STOPS and asks for them.
- **App Store review** — Apple's timeline, out of our control. The final goal is
  drawn at **submission-ready**; "Ready for Sale" is the post-goal human step.

---

## FINAL GOAL

> RALLY is a TestFlight-distributed iPhone app built from the existing web app: a
> **signed `.ipa` uploaded to TestFlight via CI**, the app **launches to the
> Tonight screen on a real device**, **web→native push** fires on goal/going
> events, **Universal Links** open `rally.futbol/p/<id>` in-app, and the App
> Store listing is **submission-ready**. UI unchanged, 50/50 tests green, the
> Vercel web build still works as-is.

Set it as the active umbrella goal; it references this file for its subgoals:
```bash
python3 ~/.claude/skills/goal/scripts/claude_goal.py invoke '--tokens 1.5M FINAL: ship RALLY as a submission-ready TestFlight iPhone app per docs/iOS-LAUNCH-plan.md — signed .ipa on TestFlight, launches to Tonight on device, web→native push + Universal Links for /p/<id> working, App Store listing ready to submit. Drive the subgoals in order; do not rewrite the UI; keep 50/50 tests and the Vercel web build working. STOP and ask Sven at the Apple-account/cert gate (SG3).'
```

Done when the SG1–SG4 audits pass **and** SG5 is submission-ready.

---

## SUBGOAL LOOPS (run in order; each is a `/goal-loop`)

Each block is paste-ready. Run one, loop it to its number, pass its audit, then
advance. Baselines marked "measure first" must be measured before the target is
trusted.

### SG1 — Web app is App-Store-grade (no Apple needed; start here)
**Exit test:** Lighthouse **mobile Performance ≥ 90** on the live Tonight list
and a Match-detail page (measured on a `vercel deploy` PREVIEW); the PWA is
installable (Lighthouse installability checks pass); web push registers and a
test notification is delivered (Android/desktop). 50/50 tests, no visual
regression.
**Baseline:** measure first — `npx lighthouse <preview-url> --only-categories=performance,pwa --form-factor=mobile --quiet --output=json`.
**Lever:** bundle is already 227KB gzip; next likely wins = render-blocking
resources, lazy-loading offscreen images, main-thread work on the Tonight list,
caching headers. Wire web push to the goal/"N going" events `live-scores`
already detects.
```bash
python3 ~/.claude/skills/goal/scripts/claude_goal.py invoke '--tokens 250K SG1: get RALLY mobile Lighthouse Performance >= 90 on the live Tonight list and a Match-detail page (measured on a vercel deploy preview), PWA installable, and web push delivering a test notification — with 50/50 vitest tests and no visual regression on Tonight/Match/Plan. Measure the baseline first; attack render-blocking + offscreen images + main-thread before guessing.'
```

### SG2 — Capacitor wrap runs in the Simulator
**Exit test:** `@capacitor/core` + `@capacitor/ios` added, `npx cap init`
(webDir=dist), `npx cap add ios`, `npm run build && npx cap sync`; the app
**builds and launches to the Tonight screen in the iOS Simulator** (screenshot
proof) — or, with no local Mac, a **green `xcodebuild` in CI**. App.jsx
untouched, 50/50 tests.
**Env:** Simulator needs macOS; if none, the CI build is the proof.
```bash
python3 ~/.claude/skills/goal/scripts/claude_goal.py invoke '--tokens 300K SG2: wrap the existing Vite build in Capacitor (@capacitor/core + @capacitor/ios, cap init webDir=dist, cap add ios, build+sync) so the app builds and launches to the Tonight screen — proof = a Simulator screenshot or a green xcodebuild in CI. Do NOT rewrite App.jsx; keep 50/50 tests and the Vercel web build untouched.'
```

### SG3 — CI signing → TestFlight  ⛔ HUMAN GATE
**Exit test:** a Codemagic (or GitHub Actions macOS) workflow produces a
**signed `.ipa`** and **uploads it to TestFlight** — a build number appears in
App Store Connect.
**Human-in-the-loop:** needs the **Apple Developer account + signing cert +
provisioning profile** as CI secrets. The loop STOPS and asks Sven for these;
it does not spin.
```bash
python3 ~/.claude/skills/goal/scripts/claude_goal.py invoke '--tokens 300K SG3: stand up a CI macOS workflow (Codemagic or GitHub Actions) that builds, signs, and uploads a RALLY .ipa to TestFlight — exit = a build number visible in App Store Connect. STOP and ask Sven for the Apple Developer account, signing certificate, and provisioning profile when you reach the signing step; pause the goal until provided.'
```

### SG4 — Native integrations
**Exit test:** **APNs push** delivered to a device on a goal/"N going" event
(wire to `live-scores`); **Universal Link** `rally.futbol/p/<id>` opens the app
to the plan; native **share sheet** via `@capacitor/share`. Proof: a push
screenshot + a link-open screenshot from a device on the TestFlight build.
**Env:** needs the device/TestFlight build from SG3.
```bash
python3 ~/.claude/skills/goal/scripts/claude_goal.py invoke '--tokens 350K SG4: ship native integrations on the TestFlight build — APNs push delivered to a device on a goal/going event (wired to live-scores, device tokens stored in Supabase), Universal Links so rally.futbol/p/<id> opens the app to that plan, and @capacitor/share for the native sheet. Proof = push + deep-link screenshots from a real device. Keep the web build working.'
```

### SG5 — Submission-ready
**Exit test:** App Store Connect listing complete — name, **screenshots** (from
Simulator/device), **description in SOUL voice**, **privacy nutrition labels**,
**age rating** (predictions = banter, NOT gambling), build attached, **"Submit
for Review" enabled**. (Apple's "Ready for Sale" is the post-goal human step.)
```bash
python3 ~/.claude/skills/goal/scripts/claude_goal.py invoke '--tokens 200K SG5: make the App Store Connect listing submission-ready — name, device screenshots, SOUL-voice description, privacy nutrition labels, age rating (predictions are banter not gambling), build attached, Submit-for-Review enabled. Flag anything only Sven can fill (bank/tax for paid, final submit click).'
```

---

## Sequencing & gates

```
SG1 (web grade) ─▶ SG2 (Capacitor runs) ─▶ SG3 (CI sign→TestFlight) ─▶ SG4 (native) ─▶ SG5 (submit-ready)
   no Apple              Mac/CI               ⛔ Apple acct + certs        device           Apple review
   needed                                       (Sven provides)
```

- **SG1 starts now** — fully drivable, no Apple dependency, and it doubles as the
  perf work.
- **SG3 is the gate.** Everything before it I can drive solo; SG3 needs Sven's
  Apple account + certs. The loop pauses there and asks.
- **App Store review** after SG5 is Apple's clock — not part of the goal.

## Per-loop discipline (from the skill)
Every subgoal: measure the baseline before trusting the target · attack the
biggest lever first · re-measure against the exit test each iteration · commit at
each win to a draft PR · run the completion audit (number AND guardrails) before
`claude_goal.py complete` · advance to the next subgoal.

## Risks
- **No local Mac** → CI macOS is load-bearing; if Codemagic free minutes run out,
  fall back to GH Actions `macos` runners.
- **Apple review rejection** — pre-empt the usual three: minimum-functionality
  (lead with push + offline + deep links, not "it's a website"), trademark (no
  FIFA/"World Cup" marks), gambling (predictions clearly banter).
- **iOS web push quirks** (SG1) — only installed PWAs get push on iOS 16.4+; treat
  Android/desktop delivery as the SG1 proof, real iOS push lands properly in SG4
  via APNs.

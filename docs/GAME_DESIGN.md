# MINISTER OF CAMMELOT - Game Design Document

> **Status:** Draft v1.0 for review - 2026-08-04
> **Owner:** Simone Cammel
> **Companion docs:** CLAUDE.md (sim context), BACKLOG.md (Epics 22/23/25 feed this), CODEBASE_MAP.md
> **Research basis:** 4 deep-research passes (policy-sim design, virality mechanics, NL healthcare incidents, ChipSoft/Embargo 2026) - citations inline.

---

## 1. Vision

Cammelot today is a watch-only stress-test of Dutch healthcare. **Minister of Cammelot** turns the visitor into the experiment: you get the town, a scaled IZA transformation budget, and 10 simulated years. Every playthrough is a hypothesis test, which closes the loop cammelot.org already promises ("tell me which intervention to stress-test") but does not yet deliver self-serve.

**Player fantasy:** You are the Minister of Health of a town of 5,000. Can you avert the zorginfarct before it averts you?

**Tone:** playful on the surface, research-grade underneath. 16-bit SNES aesthetic, Gazette headlines with Dutch bureaucratic irony, but every number traceable to CBS/RIVM/NZa/IZA sources. Humor is the permission slip for dark material (Two Point Hospital lesson).

**Positioning:** a separate `minister.html`, linked from cammelot.org. `world.html` stays the neutral research instrument; the game is the participatory layer on top of the same engine.

---

## 2. Design pillars (and the SimHealth warning)

SimHealth (Maxis, 1994) is the only prior healthcare policy sim, and it failed: 152 sliders, no emotional hook, no humor, win conditions that rewarded extremism, and a contested model that satisfied neither experts nor novices. Anti-goals for us. Pillars:

1. **Design for guilt, not comprehension.** The player learns because Jan de Vries died from their EHR choice, not because a tooltip explained path-dependence.
2. **Every dilemma has a defensibly wrong answer.** The best decisions feel right for five years and wrong in year eight. No quiz questions.
3. **No disclaimers mid-game.** Play first, explain after (Nicky Case pattern; also exactly the cammelot.org essay structure). The "what really happened" data reveal comes at the end screen, never during play.
4. **Three knobs that cannot all be maxed:** Efficiency / Equity / Resilience. The trade-off IS the curriculum.
5. **Failure is the product.** Losing generates the best share moment ("I failed to save the healthcare system") and the strongest lesson.

---

## 3. Core loop

One quarter = one decision beat (~60-90 sec). One run = 40 quarters (10 years, matching the 200-run methodology). Target session: 10-25 minutes.

```
QUARTER START
  |- Gazette ticker: 1-line headline reflecting actual sim state (Plague Inc pattern)
  |- MANDATORY dilemma popup - cannot advance without choosing (Democracy 4)
  |- Allocation screen: spend budget on interventions (3-5 visible options)
  |- 1-in-4 quarters: named-citizen event (Papers, Please pattern)
  |- Policy tree: optional one-way law available? (Frostpunk Book of Laws)
  |- Event deck draw: probability weighted by Tech Dependence & season
QUARTER END
  |- Dual-axis update: Community Trust + System Fragility
  |- Sim advances (existing engine: HP drain, queues, Markov progression)
[x40] -> ENDING JUDGMENT SCREEN: narrates YOUR specific choices back (Frostpunk)
```

---

## 4. Core systems

### 4.1 Currencies (two, not one)
- **Budget:** EUR 780K over 10 years. Grounding: IZA EUR 2.8B transformatiegelden scaled to 5,000 inhabitants (2.8B x 5000/18M). Some interventions have recurring costs.
- **Trust (political capital):** earned by transparency, keeping promises, surviving events gracefully; spent by scandals, deaths, secret negotiations. Gate: at low Trust, parliament blocks your next tech rollout (SyRI/toeslagenaffaire precedent, see 5.9).

### 4.2 Dual sentiment axes (Frostpunk Hope/Discontent adaptation)
- **Community Trust:** did outcomes match promises? Drops on ghost deaths, data breaches, opaque AI decisions.
- **System Fragility:** how close is the system to cascade failure? Rises with tech dependence, staff burnout, queue length.
- They are NOT inverses. High-tech runs can have high Trust and high Fragility simultaneously. Breach either threshold for 3 consecutive quarters = lose condition.

### 4.3 The three-knob tension
Every intervention shifts at least two of:
- **Efficiency** (C_eff formula, already in engine)
- **Equity** (bias tracker, already in engine)
- **Resilience** (new: inverse of Tech Dependence, hardened by resilience investments)

### 4.4 Policy ratchet tree (one-way doors)
Frostpunk's Book of Laws, translated: passing a policy unlocks the next escalation and CANNOT be repealed (vendor lock-in is real).

Example track (Digitalisering): `Cloud EHR (cheap, +Dependence)` -> `AI triage at GP gate` -> `AI-gated specialist access`. Each node: efficiency up, but the EMBARGO event card gets scarier and Equity drifts unless audited.
Example track (Menskracht): `Locum pool` -> `Regional GP recruitment` -> `Task differentiation (POH++)`.
Player feels the ratchet: small normalizations compound.

### 4.5 Tech Dependence & Resilience
Every tech intervention adds Dependence points. Event probability AND impact scale with the score. Counters (backup power, offline fallback protocols, security hardening, multi-vendor strategy) cost budget and slow you down. Strategy space: all-in AI = maximum efficiency, glass jaw; balanced portfolio = resilient but may not beat the zorginfarct in time. This is the honest "AI is not a universal fix" thesis from cammelot.org, made playable.

### 4.6 Named recurring citizens
3-4 scripted residents recur across quarters among the procedural 45. They already exist in the engine (e.g. Hendrik Veenstra, 70, I25+E11). Example beat: "Hendrik Veenstra needs a referral. Your AI-gated system requires DigiD. He has none." Players who chose the tech track earlier feel it personally. Ghost deaths of named citizens hit the ending screen by name.

### 4.7 The Gazette (Epic 22, upgraded to quarterly report)
"De Cammelotse Courant": one screen per quarter. Procedural headlines from actual sim state + event flavor. Doubles as the game's shareable artifact (see 7).

### 4.8 Interventions catalogue (v1)
| Intervention | Cost | Effect | Hidden risk | Grounding |
|---|---|---|---|---|
| Ambient AI scribes | 100K | Admin 30%->12% (tier 2 -> 5%) | Admin Paradox: throughput up, specialist queues grow; +Dependence | Autoscriber (30+ NL hospitals, HiX integration), Juvoly, Dragon Copilot NL - all real vendors, verified Aug 2026 |
| Hire specialist/locum | 80K/yr | +capacity one specialty | Recurring; price rises yearly (301K shortage) | IZA/ABF projections |
| A2A referral mesh | 60K | Referral weeks -> days | Forged-card infiltration event unlocked; +Dependence | CLAUDE.md red-team scenario 8.2 |
| Digital twin monitoring | 120K | Earlier, milder presentation | Alert flood = new GP bottleneck; +Dependence | Sim engine digital twins |
| Fairness audit | 20K | Resets bias drift | Temporary; drift returns without guardrails | Bias tracker in engine |
| MTVP (longer consults) | 3.23/patient/quarter | Better outcomes, slower throughput | Short-term queue pressure | NZa tariff (real) |
| Resilience pack: backup power + offline protocols | 25K | Halves outage impact | Pure cost if no event fires (insurance psychology) | Netcongestie/UMCG context |
| Security hardening | 40K | Halves ransomware duration/impact | Ditto | ChipSoft/Maastricht cases |
| On-premise EHR (vs cloud) | +50% EHR cost | Immune to supply-chain cloud events | Slower interop, worse efficiency | ChipSoft HiX 365 vs on-premise split (verified: on-premise unaffected April 2026) |

### 4.9 Ending judgment screen
Not a score screen first - a mirror (Frostpunk). Narrates the run back: "You digitized everything by 2029. Efficiency peaked. Then EMBARGO came. Mevrouw de Wit, 81, was invisible to your AI triage for six weeks. 3 preventable deaths. Parliament demanded your resignation in 2033. Budget unspent: EUR 40K." THEN the scorecard, THEN the "what really happened in the Netherlands" data reveal with sources (play-first-explain-later).

Score = delta vs a seeded IST twin-run (same RNG seed, no interventions): lives saved, Treeknorm compliance, admin waste avoided, final Equity, final Resilience, budget efficiency. Never "EUR per life".

---

## 5. Event deck (grounded in real NL events)

Probability weighting: base rate + Tech Dependence scaling + policy-tree triggers. Each card: playful title, real citation on the flip side (end-screen bibliography).

| # | Card | Real basis (verified) | Mechanic |
|---|---|---|---|
| 5.1 | **EMBARGO** (flagship) | ChipSoft/HiX 365 ransomware, Apr 2026: Embargo group, ~100GB patient data, Oogziekenhuis + GPs hit, on-premise unaffected, secret negotiations, "data destroyed", Kamerbrief Sterk | Hits ALL cloud-connected practices simultaneously (supply chain, not local). Dilemma: negotiate (data "destroyed", Trust hit for secrecy) vs refuse (leak, citizen panic, bigger Trust hit). On-premise players largely immune |
| 5.2 | **Stroomstoring / Vol Net** | Netcongestie: NZa/ACM warning 2023; care institutions refused grid connections | If no backup power: all AI multipliers -> 1.0 for a quarter, paper chaos. Expansion projects delayed unless battery investment |
| 5.3 | **DDoS-golf** | Killnet on UMCG/Amsterdam UMC/LUMC/Erasmus MC, 27 Jan 2023; portals down hours, no clinical impact | Minor early-game event: portal down 12h, Trust dip, cheap mitigation available. Teaches the difference between nuisance and catastrophe |
| 5.4 | **Gijzelsoftware + Bitcoin-meevaller** | Maastricht University Dec 2019: EUR 197K ransom paid; police recovered crypto sold ~EUR 500K in 2022 | Pay ransom now; 3 years later a windfall event MAY return 2.5x. Delayed consequence with a twist |
| 5.5 | **Lab plat** | Synnovis/London NHS, Jun 2024: 1,133 ops cancelled, O-neg blood emergency (benchmark for operational impact) | Pathology partner down: no diagnostics, elective ops halt, HP drain accelerates for waiting patients |
| 5.6 | **Code Zwart dreigt** | NL IC crisis Nov 2021, LCPS transfers narrowly avoided formal code zwart | Flu/pandemic wave: IC demand > capacity. Choose: overwork staff (+burnout, +Fragility) or transfer patients (delays, -outcomes) |
| 5.7 | **Geneesmiddelentekort** | KNMP record shortage notifications 2023-2025 (~2,300/yr); 80% APIs from Asia | Substitution (GP time + adverse-event risk) vs emergency import (budget) vs rationing (Trust) |
| 5.8 | **SEH-nachtsluiting regio** | Gelre Zutphen night closure, HMC Bronovo, Treant consolidations; GP shortage Zeeland/Groningen | Neighboring region closes ED at night: your queues +20% for 3 quarters. Nothing you did caused it. Systems are coupled |
| 5.9 | **Algoritme-wantrouwen** | SyRI verdict 5 Feb 2020 (ECHR art. 8); toeslagenaffaire toppled Rutte III, 15 Jan 2021 | If you deploy AI triage while Trust < threshold or without transparency policy: parliament blocks it, investment frozen. The Dutch algorithm-distrust precedent as a game rule |
| 5.10 | **EPD-erfenis** | Eerste Kamer unanimously rejected national EPD, 5 Apr 2011; LSP opt-in restart reached ~1M consents by 2013 | Scenario modifier: interoperability starts LOW because history. Raising it costs Trust unless done opt-in (slower) |
| 5.11 | **Huisarts stopt** | 25+ practices seeking successors in Groningen 2024-2025; Zeeland structural shortage | A GP retires; patients redistribute; queues spike. Recruit (expensive, slow) or task-shift |
| 5.12 | **Verified-vendor flavor** | Autoscriber/Juvoly/Dragon Copilot real NL deployments | AI-scribe go-live: admin drops, but draw a Data Governance Audit card; without privacy officer: Trust -1 |

Absurdist flavor naming (Two Point Hospital license): "Wachtlijstpandemie", "Indicatiegriep", "Formulierenkoorts" for minor recurring ailments in the Gazette.

---

## 6. Scenarios, difficulty, replayability

- **Campaign scenarios:** "Nederland 2026" (default), "Zeeland" (hard: start with GP shortage), "Code Zwart" (start mid-crisis), "Groene Weide" (sandbox: double budget, no events - for education demos)
- **Difficulty tiers:** Easy = generous budget, events telegraphed. Normal = as designed. "Ministersproef" = tight budget + Trust starts low + event deck stacked
- **Daily scenario:** epoch-day seeded (see 7.1) - everyone worldwide plays the same crisis that day
- **Seeded RNG everywhere:** deterministic runs enable twin-run scoring, replays, challenge links, and academic reproducibility (the 200-run methodology applies to the game too)

---

## 7. Shareability (no backend required)

1. **Daily seed** (Wordle model): `dayIndex = floor((now - launchDate)/86400000)` -> seeded PRNG -> scenario. Streak in localStorage. ~20 lines of JS.
2. **Emoji trail share text** (spoiler-free): per-year outcome row, e.g. `Minister van Cammelot #47 | 🏥🟩 ⚖️🟥 💶🟨 🔌🟩 | Score 68` - native text posts, works everywhere, LinkedIn suppresses links so text+emoji wins.
3. **The "I failed" post** (highest viral ceiling for professionals): one-click pre-filled post: "Ik probeerde 10 jaar lang de zorg te redden. In jaar 8 ging het mis..." Vulnerability outperforms achievement on LinkedIn; question at the end drives comment threads.
4. **Challenge links:** `minister.html#seed=347&score=68` (hash fragment, no backend, not indexed). Opens the same scenario with the challenger's score as target. Optional `&path=` for full replay.
5. **Canvas share card:** 1200x630 PNG generated client-side (raw Canvas API, not html2canvas); Web Share API on mobile (~20% share uplift per web.dev), download fallback on desktop.
6. **Assumption check** (NYT You Draw It pattern): pre-game single question ("Hoeveel % van huisartsentijd gaat op aan administratie?"), post-game reveal of their guess vs NZa reality. The gap is the share moment.
7. **Post-game data reveal:** "what really happened in NL" per event card with sources - shares the insight, not just the game.
8. **Aggregate social proof (Phase G5, needs backend):** "64% van de spelers koos ook voor bezuinigen op preventie."

### 7b. Devlog content plan (for cammelot.org)

The game's development itself is content. Planned posts, matching the site's research-chapter format:
1. **"I turned my simulation into a game (and why that's a research method)"** - launch post; participatory stress-testing, play-first-explain-later.
2. **"What a failed 1994 Maxis game taught me about healthcare policy"** - the SimHealth autopsy; design for guilt, not comprehension.
3. **"Designing EMBARGO"** - how a real 2026 supply-chain ransomware incident became the flagship event card; single-vendor dependency as game mechanic.
4. **"Can you beat the zorginfarct?"** - results post after launch: aggregate player strategies vs the IST/SOLL baselines (needs G5 data or manual collection).

---

## 8. Build phases

| Phase | Delivers | Effort |
|---|---|---|
| **G0: Foundations** | Seeded RNG module; extract game-state layer; `minister.html` skeleton (title screen, quarter clock, budget HUD); twin-run scoring harness; ADR for sim/game split | 1-2 sessions |
| **G1: Playable core** | Interventions (4.8), quarterly mandatory dilemma, budget + Trust currencies, dual-axis meters, win/lose, ending judgment screen v1, IST twin-run scoring | 2-3 sessions |
| **G2: Narrative + events** | Event deck 5.1-5.12 with Dependence weighting, policy ratchet tree, named recurring citizens, Gazette quarterly report, absurdist flavor layer | 2-3 sessions |
| **G3: Replayability** | Scenarios + difficulty tiers, daily seed + streaks, localStorage leaderboard, challenge links (#seed/#score/#path) | 2 sessions |
| **G4: Ship + share** | Emoji trail, "I failed" post generator, canvas share card, assumption check, post-game data reveal with bibliography, cammelot.org integration ("Kun jij het zorginfarct afwenden?"), mobile pass | 2 sessions |
| **G4b: Audio** | Chiptune/SNES sound layer: title theme, council sting, law gong, LOCKSTEP klaxon, death bell, verdict themes. Extend the engine's existing WebAudio helpers (playUIClick, playRecoveryChime) and sound toggle | 1 session |
| **G5 "Game Feel" (added 2026-08-04 after playtest critique: no live points, dead time between councils, zero visual identity, no juice):** | | |
| **G5a: Points & feedback** | Live score in HUD ticking per quarter; lives-saved counter vs baseline; floating +/- popups on every trust/budget/score change; yearly objectives ("keep deaths <=1 this year" -> bonus) | 1 session |
| **G5b: Pacing & flash decisions** | Quarter down to ~10s of sim time; mid-quarter flash decisions (citizen at the door, 8s timer, ignoring is also a choice) | 1 session |
| **G5c: Visual identity** | Pixel-art minister portrait with moods (confident/sweating/disgraced), event cards as retro card art, verdict screens with art, visible world effects per intervention (queues shrink on screen, red glitch overlay during LOCKSTEP) | 1-2 sessions |
| **G5d: Audio** | Merges G4b: chiptune title theme, council sting, death bell, LOCKSTEP klaxon, verdict themes, mute toggle | 1 session |
| **G6 "Command & Clarity" (2026-08-04): declutter (16->7 stats, research chrome hidden), Ministry dashboard pane (budget/trust/waits/deaths/effects/speed), stakeholder trust Citizens-Doctors-Parliament with own drivers and lose conditions | | DONE |
| **G7 "First Minutes" (2026-08-04, after critical playtest):** scenario setups that bite from tick 1 (Sprint: 14w waits + preloaded queues; Code Black: damaged patients; Zeeland: GP Bakker out), Situation Report briefing (situation/stats/threats/mandate -> TAKE OFFICE), 5-step game onboarding replacing sim tour, flow picker->briefing->assumption->tour->play, load screen rebrand, To-council skip button | | DONE |
| **G8 "SNES Polish" (2026-08-04):** full SNES design system (blue windows, pixel borders, Press Start 2P/VT323), 14 hand-drawn pixel icons, newspaper Gazette with masthead + procedural pixel front-page scenes, pixel scenario thumbnails, verdict stamp + staged reveal + score count-up, CRT scanlines toggle | | DONE |
| **G9 "Make it Thrilling" (2026-08-05, after math audit found high-dependence runs got SAFER late-game):** a) risk engine: repeatable cyber events (rotating groups, cooldowns), impact scales with dependence, DFI doom track with named bands (SAFE/EXPOSED/FRAGILE/CRITICAL) in Ministry pane; b) tension arc: 3 acts with event pressure x1/x1.5/x2, quiet quarters guaranteed every 4th, aging-town creep (+4%/yr drain, prevention dampens), telegraphed Great Flu finale at T-4 hitting at T-1; c) democracy: manifesto (pick 2 of 5 promises) after tour, midterm election judges them (0 kept = fired, 'election' ending; 2 kept = +150 & mandate boost), confidence-vote near-miss at trustP<25 (promise/sacrifice/defy); d) cascade chains (doctor exodus, digital rot) arming in Act II with Gazette warnings, 2 stages, break conditions; e) prevention programme intervention (long-game payoff); f) Gazette 2.0: citizen quote of the quarter from live agents, satirical classified ads, flu/election art scenes, dilemma pool 10->20, flash pool 5->12 | | DONE |
| **G5: Backend (later)** | Aggregate stats ("64% chose..."), shared leaderboard, community scenario submissions, run archive for research | TBD |

Each phase ships something playable. G1 alone is a game.

---

## 9. Decisions (locked 2026-08-04)

1. **UI language: English.** Consistent with the site and README rule ("all UI text in English"). Dutch terms stay where they carry meaning (zorginfarct, Treeknorm) with inline glossing.
2. **Fictional vendor names, English, abstract** (no direct ChipSoft pun). Real names only in the end-screen bibliography. In-game naming set:
   | Real basis | In-game name |
   |---|---|
   | ChipSoft / HiX 365 | **Halcyon Health Systems** / cloud platform **Halcyon One** (runs "most of the region") |
   | Embargo ransomware group | **LOCKSTEP** |
   | Ambient AI scribe vendors | **EchoScribe** |
   | Digital twin platform | **Mirrorware** |
   | Grid operator | **GridWacht** |
3. **Session length: both.** Full campaign = 40 quarters (~20 min), the core experience. Daily seed uses a **12-quarter Crisis Sprint** variant (~5-7 min): one scripted crisis arc, same engine, low friction for the viral loop. Campaign ships in G1; Sprint variant lands with the daily seed in G3.
4. **Map reuse: fork the world.html canvas engine into minister.html.** The living town view (citizens queueing, ghosts appearing) is the emotional core - a dashboard-only layout would lose the "watch the invisible grow" hook. Game HUD replaces the research side panels. Accept engine duplication for v1 (consistent with ADR-001's known trade-off; world.html stays untouched and stable as the research instrument); extract a shared sim core module later once game mechanics stabilize.

---

## 10. Research bibliography (game design)

- Frostpunk (11 bit studios 2018): Book of Laws, Hope/Discontent, ending judgment
- Democracy 4 (Positech 2022): policy web, mandatory dilemmas
- Plague Inc (Ndemic 2012): news ticker, three-knob trade-off; CDC engagement 2013
- Papers, Please (Lucas Pope 2013): named individuals, day rhythm, budget screen
- Two Point Hospital (Sega 2018): humor as permission slip
- SimHealth (Maxis 1994): the cautionary tale (CGW 6/1994; Paul Starr, The American Prospect)
- Wordle share mechanics; Nicky Case explorables (ncase.me); FT Uber Game; NYT You Draw It
- NL incidents: ChipSoft/Embargo Apr 2026 (Skipr, Kamerbrief 21-04-2026); Killnet Jan 2023; Maastricht Dec 2019 (Fox-IT); Synnovis Jun 2024; EPD 5 Apr 2011; SyRI 5 Feb 2020; toeslagenaffaire; KNMP shortages; netcongestie NZa/ACM 2023; Autoscriber/Juvoly/Dragon Copilot NL (verified Aug 2026)
## 11. G24: Cabinet Crisis and political survival

- **Cabinet Crisis** is the 8-quarter, roughly 3-minute route. It defaults to 4x speed and ends with a confidence gate based on trust, preventable deaths, and active collapse cascades.
- Full terms require three manifesto promises. Two delivered promises plus healthy trust can produce a bruised survival; a true win requires all promises, strong trust, zero preventable deaths, and no stage-three collapse.
- Doctor dissatisfaction now escalates from work-to-rule to strike and cabinet collapse. Citizen dissatisfaction escalates from care avoidance to household relocation, protest, and removal from office.
- Purchases, laws, and council decisions generate named reactions in citizen/clinician speech bubbles and the mobile-safe Town Reaction feed.
- Score remains useful for comparison, but political survival gates victory.

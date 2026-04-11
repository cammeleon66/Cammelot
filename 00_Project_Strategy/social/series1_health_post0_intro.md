# Series 1 — Health Sector | Post 0: Series Introduction

**Status:** Draft v1
**Target:** LinkedIn
**Publish:** First — before all other posts
**Tags:** #HealthcareAI #AppliedResearch #Zorginfarct #AgenticAI #Cammelot #Netherlands

---

## Post

I built a tiny Dutch town and gave it a healthcare crisis.

[📸 Hero image: The Cammelot pixel town — SNES aerial view, citizens walking between GP practices and hospital]

**Cammelot** is a 16-bit simulation of 5,000 inhabitants navigating the Dutch healthcare system. Citizens age. They develop diabetes, COPD, heart disease, dementia — all drawn from real RIVM prevalence data. They visit GPs who spend 30% of their time on paperwork. They enter specialist queues that breach legal waiting norms. Some of them don't make it.

When they die, they become ghost sprites. Grey. Transparent. Floating above the tile where they ran out of time.

It looks like a retro video game. It runs on real CBS, RIVM, and NZa data. And it asks the question nobody in the healthcare AI debate is asking with enough precision:

**What exactly breaks — and for whom — when the system runs out of capacity?**

---

**Why a simulation?**

Because the Dutch healthcare system is heading for a wall, and the arguments on both sides are made with vibes:

*"AI will save healthcare"* — How, exactly? Which interventions? In what sequence? With what equity impact?

*"AI is overhyped"* — Compared to what alternative? The status quo that's already failing?

I wanted numbers. Not predictions — **outputs**. Run the model 10 times, average the results, show your methodology, publish the code. Applied research, not marketing.

[📸 Screenshot: The research runner terminal output — 10 runs, averaged results]

---

**Over the next 5 posts, I'm publishing what I found:**

📌 **Post 1: "I killed 8 people last week"**
The launch. Meet the simulation, the ghost sprites, and the question that started it all.

📌 **Post 2: "My simulated GP burned out in 600 cycles"**
The Admin Tax. €13,611/year in wasted GP capacity. An 81% burnout reduction from a workflow change.

📌 **Post 3: "93.9% of elderly patients died in a fair queue"**
The Waiting List Is Not Neutral. Same rules, 25× mortality difference between youngest and oldest.

📌 **Post 4: "I built an AI that discriminated against the elderly"**
Does AI Make Inequality Worse? Yes — until you build a fairness guardrail. It fired in 30% of runs.

📌 **Post 5: "418 alerts. Each one a patient who didn't know they were deteriorating"**
The Digital Twin Triage Bet. Proactive care pays for itself — but only if you solve admin burden first.

---

**What this series is NOT:**

❌ Not a product launch. Cammelot isn't for sale.
❌ Not a policy recommendation. I'm a technologist, not a health economist.
❌ Not deterministic. 45 agents, stochastic Markov chains, 10-run averages. Directional findings, not clinical evidence.

**What it IS:**

✅ An open-source applied research tool — fork it, change the parameters, run your own hypotheses
✅ Every number traceable to its CBS/RIVM/NZa source
✅ A framework for asking better questions about AI in healthcare

[📸 Screenshot: Side-by-side — IST mode (ghosts, queues) vs SOLL mode (alerts, low burnout)]

---

**The uncomfortable findings so far:**

| Finding | Number |
|---------|--------|
| GP admin waste (status quo) | **€13,611/GP/year** |
| Admin waste after AI scribes | **€2,268/GP/year** |
| GP burnout reduction | **81%** |
| 80+ mortality in "fair" FIFO queue | **93.9%** |
| 80+ mortality with severity triage | **57.1%** |
| AI fairness guardrail triggered | **3 out of 10 runs** |
| Proactive Digital Twin alerts | **418 per run** |
| Ketenzorg interventions | **189 per run** (+627%) |

Some of these numbers are uncomfortable. The 93.9% elderly mortality in a FIFO queue. The guardrail firing 30% of the time. The fact that AI triage barely moved the equity score (8%). Good. Applied research should make you uncomfortable.

---

Every post includes methodology notes, data sources, and named simulation agents whose stories you can follow across the series. You'll meet Nico Kok, Karel de Groot, Dr. Bakker, Truus de Groot, and Diana Hendriks. They're pixel people. Their problems are very real.

**The code is on GitHub. The simulation runs in a browser. The research runner outputs JSON in 500ms.**

I'm looking for healthcare professionals, researchers, policy people, and skeptics who want to stress-test these findings — or run their own.

What would you test in Cammelot?

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

[📸 Logo: Cammelot pixel logo — castle + health cross, SNES style]

---

## Visual Assets Needed

### Must-have for this post:
1. **Hero image** — Aerial screenshot of the Cammelot pixel town in browser (vibrant SNES colors, citizens moving, buildings visible). This IS the LinkedIn preview image.
2. **Cammelot logo** — Pixel-art logo (castle silhouette + health cross, "Press Start 2P" font). Create as SVG/PNG, place in `assets/branding/`.
3. **IST vs SOLL side-by-side** — Split screenshot: left=IST (ghosts in queue, red indicators, burnout climbing), right=SOLL (green indicators, alerts, low burnout).
4. **The summary table** — Can be text in LinkedIn, but a designed graphic version would be shareable.

### Nice-to-have:
5. **Terminal output** — Screenshot of `node scripts/research_run.cjs IST 3000` running with JSON output (the "this is real code" credibility shot).
6. **Character lineup** — Pixel sprites of the named characters (Nico, Karel, Truus, Dr. Bakker, Diana) in a row, like a cast of characters.

---

## Screenshot Checklist (Across All 6 Posts)

These are ALL the screenshots needed for the entire series. Take them in one browser session:

### Setup
- Open `src/frontend/v4.html` in Chrome
- Set window to 1280×720 for consistent framing
- Use browser DevTools screenshot (Ctrl+Shift+P → "Capture screenshot")

### IST Mode Shots:
| # | What to capture | For Post |
|---|----------------|----------|
| 1 | Full town aerial view (zoomed out, citizens moving) | Post 0 (hero) |
| 2 | Ghost sprite on the map (after a death event) | Post 1 |
| 3 | Top bar showing GP burnout climbing (around cycle 600) | Post 2 |
| 4 | Admin waste 💰 counter in top bar | Post 2 |
| 5 | Karel de Groot's agent panel (click elderly patient with COPD) | Post 3 |
| 6 | Gazette entry showing a death with wait details | Post 3 |

### SOLL Mode Shots:
| # | What to capture | For Post |
|---|----------------|----------|
| 7 | Same town view but with alert notifications visible | Post 0 (side-by-side) |
| 8 | Top bar showing burnout at 3-4% (flat) | Post 2 (side-by-side) |
| 9 | Age mortality chart from QA/bias panel | Post 3 |
| 10 | Agent with low digitalLiteracy visible in panel | Post 4 |
| 11 | Bias panel showing guardrail activation | Post 4 |
| 12 | Proactive alert toast notification (🔔) | Post 5 |
| 13 | Diana Hendriks' agent panel (survived, 100 HP) | Post 5 |
| 14 | Weekly report with ketenzorg section | Post 5 |

### Design Assets (to create):
| # | What to create | For Post |
|---|---------------|----------|
| 15 | Cammelot pixel logo (SVG + PNG) | Post 0, all posts |
| 16 | Series banner (logo + "Applied Research Series 1: Healthcare") | Post 0 |

---

## Publishing Order

1. **Post 0** (this intro) — with hero image + logo + summary table
2. **Post 1** — "I killed 8 people" — 2-3 days later
3. **Post 2** — "GP burned out in 600 cycles" — 3-4 days later
4. **Post 3** — "93.9% died in a fair queue" — 3-4 days later
5. **Post 4** — "AI that discriminated on purpose" — 3-4 days later
6. **Post 5** — "418 alerts" — 3-4 days later

Each post should link back to Post 0 for series context.
Total series duration: ~3 weeks.

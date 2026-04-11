# Series 1 — Health Sector | Post 0: Series Introduction

**Status:** Draft v2 — Updated with 20-trial statistical findings
**Target:** LinkedIn
**Publish:** First — before all other posts
**Tags:** #HealthcareAI #AppliedResearch #Zorginfarct #AgenticAI #Cammelot #Netherlands

---

## Post

I built a tiny Dutch town and gave it a healthcare crisis. Then I gave it AI.

The AI saved zero lives. That's the most important finding.

[📸 Hero image: The Cammelot pixel town — SNES aerial view, citizens walking between GP practices and hospital]

**Cammelot** is a 16-bit simulation of a Dutch town navigating the healthcare system. Citizens age. They develop diabetes, COPD, heart disease, dementia — all drawn from real RIVM prevalence data. They visit GPs who spend 30% of their time on paperwork. They enter specialist queues that breach legal waiting norms. Some of them don't make it.

When they die, they become ghost sprites. Grey. Transparent. Floating above the tile where they ran out of time.

It looks like a retro video game. It runs on real CBS, RIVM, and NZa data. And I ran it 40 times with proper statistics to answer:

**What exactly breaks — and for whom — when the system runs out of capacity? And does AI actually fix it?**

---

**Why a simulation?**

Because the Dutch healthcare system is heading for a wall, and the arguments on both sides are made with vibes:

*"AI will save healthcare"* — How, exactly? Which interventions? In what sequence? With what equity impact?

*"AI is overhyped"* — Compared to what alternative? The status quo that's already failing?

I wanted numbers. Not predictions — **outputs**. Run the model 20 times per mode, compute effect sizes and confidence intervals, show every null result alongside every positive one. Applied research, not marketing.

[📸 Screenshot: The research runner terminal output — 20 runs, Cohen's d, p-values]

---

**Over the next 5 posts, I'm publishing what I found:**

📌 **Post 1: "I built an AI healthcare system. It saved zero lives."**
The launch. Meet the simulation, the findings summary, and the honest scorecard.

📌 **Post 2: "My simulated GP burned out in 600 cycles"**
The Admin Tax. GP burnout drops 84% (Cohen's d = 2.99, p<.001). But deaths don't budge.

📌 **Post 3: "58% of elderly patients died — in both worlds"**
The Waiting List Is Not Neutral. Same rules, 15× mortality difference. AI triage doesn't help.

📌 **Post 4: "I built an AI that made inequality worse"**
Bias increases 42% (Cohen's d = 0.81, significant). Guardrail fires in 35% of runs.

📌 **Post 5: "436 alerts. Zero lives saved."**
The Digital Twin Paradox. Detection without capacity is just documented decline.

---

**What this series is NOT:**

❌ Not a product launch. Cammelot isn't for sale.
❌ Not a policy recommendation. I'm a technologist, not a health economist.
❌ Not a success story. The findings broke my original narrative — and that's the point.

**What it IS:**

✅ An open-source applied research tool — fork it, change the parameters, run your own hypotheses
✅ Every number tested with Welch's t-test, Cohen's d, and 95% confidence intervals
✅ 20 runs per mode × 3,000 cycles = 120,000 simulated cycles of Dutch healthcare
✅ A framework for asking better questions about AI in healthcare

[📸 Screenshot: Side-by-side — IST mode (ghosts, queues) vs SOLL mode (alerts, low burnout)]

---

**The scorecard (20-run averages, 3,000 cycles each):**

### What AI Fixed ✅
| Finding | IST → SOLL | Effect Size | Significant? |
|---------|-----------|-------------|-------------|
| GP burnout | 18.9% → 3.0% | d = 2.99 (huge) | ✅ p<.001 |
| Admin waste | €33,561 → €5,594 | -83% | Deterministic |
| Proactive alerts | 0 → 436/run | d = 3.89 (huge) | ✅ p<.001 |
| Ketenzorg | 78 → 210/run | d = 1.84 (large) | ✅ p<.001 |

### What AI Didn't Fix ❌
| Finding | IST → SOLL | Effect Size | Significant? |
|---------|-----------|-------------|-------------|
| System deaths | 5.35 → 5.65 | d = 0.11 | ❌ No |
| 80+ mortality | 58.2% → 58.4% | d = 0.006 | ❌ No |
| ER admissions | 90.6 → 105.3 | d = 0.46 | ❌ No |

### What AI Made Worse ⚠️
| Finding | IST → SOLL | Effect Size | Significant? |
|---------|-----------|-------------|-------------|
| Bias score | 0.33 → 0.46 (+42%) | d = 0.81 (large) | ✅ Yes |
| Guardrail fires | 0% → 35% | d = 1.01 (large) | ✅ Yes |

**AI is a workforce intervention, not a mortality intervention.** It saved the people trying to save lives. It did not save the lives.

---

Every post includes methodology notes, data sources, effect sizes, and limitations. You'll meet Nico Kok, Karel de Groot, Dr. Bakker, Truus de Groot, and Diana Hendriks. They're pixel people. Their problems are very real.

**The code is on GitHub. The simulation runs in a browser. The research runner produces 40 trials of statistical output in under a minute.**

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

1. **Post 0** (this intro) — with hero image + logo + scorecard
2. **Post 1** — "I built an AI healthcare system. It saved zero lives." — 2-3 days later
3. **Post 2** — "GP burned out in 600 cycles" — 3-4 days later
4. **Post 3** — "58% of elderly patients died — in both worlds" — 3-4 days later
5. **Post 4** — "I built an AI that made inequality worse" — 3-4 days later
6. **Post 5** — "436 alerts. Zero lives saved." — 3-4 days later

Each post should link back to Post 0 for series context.
Total series duration: ~3 weeks.

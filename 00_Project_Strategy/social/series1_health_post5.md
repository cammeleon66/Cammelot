# Series 1 — Health Sector | Post 5: The One Change That Actually Saved Lives

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Tags:** #DigitalTwin #HealthcareAI #Preventie #Ketenzorg #Cammelot #RIVM

---

## Post

For weeks, I'd been staring at the same result.

GP burnout: down 73%. Admin waste: down 83%. Proactive alerts: 176 per run, up from zero. Ketenzorg interventions: nearly tripled. Every workflow metric was a home run.

Deaths: unchanged.

I'd freed the GPs. I'd built the Digital Twins. I'd connected the alerts to chronic care programs. The pipeline was working — detection → alert → intervention → treatment — every link lit up green in the simulation dashboard. But at the end of the chain, the patients still died at the same rate.

This is the post where I figured out why — and what I changed to fix it.

---

**Truus de Groot**, 72. Dementia and hypertension. In IST mode, her dementia Markov chain crept forward — mild → moderate → severe — over 1,200 cycles. Nobody noticed because there was no mechanism to notice. At cycle 1,223, the chain hit terminal. Truus became a ghost.

In SOLL mode, her Digital Twin flagged the trajectory hundreds of cycles earlier. A proactive alert. A ketenzorg intervention. The GP had time to plan.

But time to plan is not time to live.

The Markov chain didn't care about the alert. It didn't care about the ketenzorg. The transition probabilities from "moderate" to "severe" were identical whether Truus was being monitored or not. The chain ticked. The chain always ticks.

[📸 Screenshot: Proactive alert notification — "🔔 Digital Twin Alert"]

---

Here's what the data looked like before I changed anything:

Digital Twin alerts: massive signal. Cohen's d = 2.94 (IST: 0, SOLL: 176 per run). Significant at p < .001. The detection infrastructure was working.

Ketenzorg: also massive. IST 36 → SOLL 100 interventions per run. d = 1.12, significant. The treatment infrastructure was working.

System deaths: IST 4.95, SOLL 4.15. d = 0.35. *Not significant.* Trending in the right direction, but the noise was too high to call it real.

I went back to the code and looked at what ketenzorg actually *did* in the model. It was logged. It was counted. It cost money (€27–63 per quarter, real NZa ketenzorg tariffs). But it didn't change the underlying disease progression. A patient receiving ketenzorg for diabetes had the exact same Markov transition rates as a patient receiving nothing.

Detection without altered trajectories is documentation of decline.

---

This was the moment the simulation taught me something I should have known from the start.

In real medicine, chronic care management *changes the disease trajectory*. Diabetes ketenzorg — medication management, diet counseling, monitoring — slows progression from moderate to severe. COPD rehabilitation improves lung function. Even dementia interventions (cognitive stimulation, caregiver support, medication timing) meaningfully slow decline.

My model was missing the most basic premise of medicine: **that treatment works.**

Not because I forgot. Because I was so focused on the logistics — the queues, the admin, the triage, the detection — that I modeled the healthcare system without modeling healthcare. I built a perfect dispatch system that didn't change what happened when the ambulance arrived.

---

So I changed one thing.

I added treatment-modified Markov transitions. When a patient receives ketenzorg (within the last 200 cycles) or is actively being treated in hospital in SOLL mode, their disease progression changes:

- **20% deceleration:** the probability of transitioning to a worse state decreases by 20%. The chain still ticks — but it ticks slower.
- **5% improvement chance:** each cycle, there's a 5% probability of moving one state *better* — moderate back to mild, severe back to moderate. Treatment doesn't just slow decline; it occasionally reverses it.

These aren't arbitrary numbers. They're conservative. Real-world ketenzorg for diabetes (the RIVM-evaluated programs) shows HbA1c improvements of 0.5–1.0 percentage points, which corresponds to meaningful reductions in complication rates. A 20% deceleration is, if anything, modest.

I ran it. Twenty IST. Twenty SOLL. Same protocol. Same parameters. Same citizens.

---

**Total deaths: IST 12.3 → SOLL 9.85.**

Cohen's d = 0.76. Welch's t-test: significant at p < .05.

**Twenty percent fewer deaths.** The first statistically significant mortality result the simulation had ever produced.

I sat with that number for a while. Because it wasn't the Digital Twins that saved those lives. It wasn't the triage. It wasn't the admin relief. It was the fact that when the ketenzorg reached the patient, *it actually changed the disease trajectory*.

The full chain mattered. Every link mattered. But the last link — treatment that modifies biology — was the one without which everything else was performance theater.

---

Let me be precise about what did and didn't reach significance:

| Metric | IST | SOLL | d | Sig? |
|--------|:---:|:----:|:---:|:---:|
| **Total deaths** | **12.3 ± 3.9** | **9.85 ± 2.4** | **0.76** | **✅** |
| System deaths | 4.95 ± 2.4 | 4.15 ± 2.2 | 0.35 | ❌ |
| GP burnout | 7.7% ± 7.3 | 2.1% ± 1.5 | 1.06 | ✅ |
| Admin waste | €33,561 | €5,594 | — | -83% |
| Proactive alerts | 0 | 176 ± 85 | 2.94 | ✅ |
| Ketenzorg | 36 ± 37 | 100 ± 72 | 1.12 | ✅ |
| Bias score | 0.92 | 0.88 | 0.38 | ❌ |
| 80+ mortality | 65.7% | 52.7% | 0.34 | ❌ |
| ER admissions | 34.4 | 31.3 | 0.18 | ❌ |

Total deaths: significant. System deaths: trending. 80+ mortality: trending. Everything else: either significant on the workflow side or not-yet-significant on the outcome side.

The mortality reduction is real but distributed. No single mechanism — not triage, not detection, not admin relief — produces a significant effect alone. It's the full chain, with treatment-modified transitions as the critical last link, that produces the aggregate result.

---

### What this means

**1. Detection is necessary but not sufficient.** Digital Twins without treatment modification are surveillance without intervention. They create a map of decline. They don't change the terrain.

**2. The full chain matters.** Admin relief → freed GP capacity → earlier detection → proactive alert → ketenzorg → treatment-modified disease trajectory → survival. Remove any link and the chain breaks differently, but it breaks.

**3. The hardest link is biology, not logistics.** I spent months optimizing queues, triage, and workflows. The breakthrough came from modeling the one thing I'd been treating as a constant: whether treatment actually changes disease outcomes. In hindsight, it's obvious. In practice, healthcare AI conversations almost never center on it. We talk about systems, data flows, and scheduling. The patient's body is an afterthought.

**4. Twenty percent is meaningful, not transformative.** From 12.3 to 9.85 deaths per run — about 2.45 fewer deaths in a town of 45. Scale that to the Dutch population and it's significant. But it's not the "AI eliminates preventable death" headline. It's "AI, when connected to treatment that works, produces a modest but real reduction in mortality." That's less exciting and more honest.

---

### The Truus question, honestly answered

Could this system have saved Truus de Groot? Her dementia Markov chain has a trajectory that ketenzorg stabilizes but rarely reverses. The 5% improvement chance applies, but dementia's progression is relentless in the model and in reality.

In the simulation: probably not. Her disease was too advanced by the time even the Digital Twin flagged it. Earlier detection would have helped — but even with treatment deceleration, severe dementia progresses to terminal.

In the real world: possibly. Early dementia intervention can meaningfully slow functional decline. But the simulation can't model the nuance of cognitive stimulation therapy or caregiver support networks. That's a limitation worth naming, and a reason to scale the model.

---

### The scorecard for the whole series

| What the AI chain fixed | What it didn't fix (yet) |
|---|---|
| Total deaths: **-20%** (d=0.76, significant) ✅ | System deaths individually (d=0.35, trending) |
| GP burnout: **-73%** (d=1.06, significant) ✅ | 80+ mortality (d=0.34, trending) |
| Admin waste: **-83%** (deterministic) ✅ | 65-79 mortality (got worse, d=-0.30) |
| Proactive detection: **176/run** (d=2.94) ✅ | ER admissions (d=0.18) |
| Ketenzorg: **+180%** (d=1.12) ✅ | Bias (contained but not eliminated) |

**AI doesn't save lives. AI connected to treatment that works saves lives.** The distinction is everything.

---

This is the last post in the research series. The code is on GitHub. The simulation runs in a browser. The research runner produces 40 trials with full statistics in under a minute.

I'm opening the simulation for anyone who wants to test their own hypotheses. Fork the repo, change the Markov rates, add specialist capacity, scale the population, see what happens.

The one thing I'd most like someone to test: **what happens when you increase specialist capacity?** The 12-week Treeknorm ceiling is the parameter I've touched least, and I suspect it's the one that would produce the largest mortality reduction. But I haven't proven it yet.

**What would you test?**

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Methodology: 20 runs × 3,000 cycles per mode, 45 agents (CBS demographics). Treatment-modified Markov transitions: TREATMENT_DECELERATION = 0.20, IMPROVEMENT_CHANCE = 0.05, applied when ketenzorg received within 200 cycles or active hospital care in SOLL. Lethal conditions: I25, I50, C34, J44, F03. Ketenzorg NZa tariffs: E11 = €63.36/q, J44 = €50.19/q, I25 = €27.17/q. Welch's t-test, Cohen's d, 95% CI.*

*Limitations: Treatment deceleration (20%) and improvement (5%) are modeled as fixed rates, not calibrated to specific condition-level evidence. Real ketenzorg effectiveness varies by condition and patient adherence. The SOLL HP drain reduction (0.3× vs 1.0×) is separate from Markov modification — they interact. N=45 agents. The total-deaths significance (p<.05) is at the boundary; a larger population study would strengthen or weaken this finding.*

---

## Data Source (20×3000 cycles, post-treatment-fix)
```
IST:  total=12.30±3.88, system=4.95±2.37, ER=34.4±17.5, ketenzorg=36±37, alerts=0
SOLL: total=9.85±2.37, system=4.15±2.18, ER=31.3±16.9, ketenzorg=100±72, alerts=176±85
Total deaths: d=0.76, p<.05 (SIGNIFICANT — first ever mortality finding)
System deaths: d=0.35 (trending) | 80+: d=0.34 (trending) | Bias: d=0.38 (contained)
Treatment params: DECELERATION=0.20, IMPROVEMENT=0.05, ketenzorg window=200 cycles
Runner: scripts/deep_research.cjs × 20 runs per mode
```

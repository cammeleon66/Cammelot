# Series 1 — Health Sector | Post 5: The One Change That Actually Moved the System

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Tags:** #DigitalTwin #HealthcareAI #Preventie #Ketenzorg #Cammelot #RIVM

---

## Post

For weeks, I kept coming back to the same result.

Average GP burnout: down 76%. Peak burnout: down 54%. Admin waste: down 83.3%. Proactive alerts: 316 per run, up from zero. Ketenzorg interventions: up 172%. Every workflow metric looked great.

Deaths: unchanged.

I'd freed the GPs. I'd built the Digital Twins. I'd connected the alerts to chronic care programs. The full pipeline was working: detection, alert, intervention, treatment. Every link lit up green in the simulation dashboard. But at the end of the chain, the patients still died at the same rate.

This is the post where I figured out why — and what I changed, even though the mortality claim still would not clear the statistical bar.

---

**Truus de Groot**, 72. Dementia and hypertension. In IST mode, her dementia Markov chain crept forward — mild → moderate → severe — over 1,200 cycles. Nobody noticed because there was no mechanism to notice. At cycle 1,223, the chain hit terminal. Truus became a ghost.

In SOLL mode, her Digital Twin flagged the trajectory hundreds of cycles earlier. A proactive alert. A ketenzorg intervention. The GP had time to plan.

The GP had time to plan. That didn't give Truus more time to live.

The Markov chain didn't care about the alert. It didn't care about the ketenzorg. The transition probabilities from "moderate" to "severe" were identical whether Truus was being monitored or not. The chain ticked. The chain always ticks.

[📸 Screenshot: Proactive alert notification — "🔔 Digital Twin Alert"]

---

The data on the current unified engine:

Digital Twin alerts: massive signal. IST 0 → SOLL 316.3 alerts per run. Cohen's d = 4.70 in magnitude. Significant. The detection infrastructure was working.

Ketenzorg: also massive. IST 68.33 → SOLL 186.03 interventions per run, a 172% increase. d = 1.67 in magnitude, significant. The treatment infrastructure was working.

System deaths: IST 4.63, SOLL 4.33. d = 0.119. *Not statistically significant.* Trending in the right direction, but the noise was too high to call it real.

I went back to the code and looked at what ketenzorg actually *did* in the model. It was logged. It was counted. It cost money (€27–63 per quarter, real NZa ketenzorg tariffs). But it didn't change the underlying disease progression. A patient receiving ketenzorg for diabetes had the exact same Markov transition rates as a patient receiving nothing.

If the treatment doesn't change the disease trajectory, all you're doing is watching someone get worse.

---

I should have known this from the start.

In real medicine, chronic care management *changes the disease trajectory*. Diabetes ketenzorg — medication management, diet counseling, monitoring — slows progression from moderate to severe. COPD rehabilitation improves lung function. Even dementia interventions (cognitive stimulation, caregiver support, medication timing) meaningfully slow decline.

My model was missing the most basic premise of medicine: that treatment works.

Not because I forgot. Because I was so focused on the logistics — the queues, the admin, the triage, the detection — that I modeled the healthcare system without modeling healthcare. I built a dispatch system that didn't change what happened when the ambulance arrived.

---

So I changed one thing.

I added treatment-modified Markov transitions. When a patient receives ketenzorg or is actively being treated in hospital in SOLL mode, their disease progression changes:

- **Severity-scaled deceleration:** the probability of transitioning to a worse state decreases — by 15% for mild conditions, 25% for moderate, 35% for severe, and 45% for critical. Sicker patients benefit more from treatment because there's more trajectory to alter.
- **Severity-scaled improvement chance:** each cycle, there's a probability of moving one state *better* — 8% for mild, 6% for moderate, 3% for severe, 1% for critical. Treatment doesn't just slow decline; it occasionally reverses it. But the sicker you are, the harder reversal becomes.

These aren't arbitrary numbers. They're conservative, and they're scaled to reflect clinical reality: a mild diabetic responding to lifestyle changes improves more readily than a patient in critical heart failure. Real-world ketenzorg for diabetes (the RIVM-evaluated programs) shows HbA1c improvements of 0.5–1.0 percentage points, which corresponds to meaningful reductions in complication rates. The deceleration rates, if anything, are modest.

I ran it. A hundred IST. A hundred SOLL. Same protocol. Same parameters. Same personality-driven citizens, on the unified engine.

---

**Total deaths: IST 6.28 → SOLL 6.01.**

Cohen's d = 0.097. Welch's t-test: **not statistically significant.**

Four percent fewer deaths. Trending right. Not proven.

I'd seen this coming. Small populations produce seductive mortality signals. At 45 citizens, even 200 runs of the unified engine are not enough to separate a small survival effect from stochastic variance. The effect is in the expected direction, but it does not cross the significance line.

The treatment-modified Markov transitions help. They don't help *enough* to make a mortality claim. The simulation needs either more citizens, a stronger treatment effect, or — most likely — reduced specialist wait times to close the gap.

---

The 100-run analysis did prove some things beyond doubt:

| Metric | IST | SOLL | d | Sig? |
|--------|:---:|:----:|:---:|:---:|
| Total deaths | 6.28 ± 2.90 | 6.01 ± 2.65 | 0.097 | ❌ |
| System deaths | 4.63 ± 2.56 | 4.33 ± 2.48 | 0.119 | ❌ |
| Avg GP burnout | 18.57% ± 3.60 | 4.48% ± 1.12 | **5.30** | **✅** |
| Peak GP burnout | 39.13% ± 2.39 | 17.89% ± 2.80 | **8.16** | **✅** |
| Admin waste | €33,561 | €5,594 | — | **-83.3%** |
| Proactive alerts | 0 | 316 ± 95 | **4.70** | **✅** |
| Ketenzorg | 68 ± 40 | 186 ± 91 | **1.67** | **✅** |
| ER admissions | 64.6 ± 20.9 | 69.4 ± 19.9 | -0.234 | ❌ |
| Bias score | 0.354 ± 0.148 | 0.402 ± 0.204 | -0.273 | ❌ |
| SOLL fairness guardrail | — | 35% of runs | — | descriptive |

Mortality: not statistically significant. Workforce: massively significant. Detection and chronic-care throughput: significant. Fairness and ER admissions: not statistically significant in the personas-ON study.

---

### What the numbers say

**1. Detection alone isn't enough.** Digital Twins without treatment modification are surveillance without intervention. They create a map of decline. They don't change the terrain.

**2. The full chain matters.** Admin relief → freed GP capacity → earlier detection → proactive alert → ketenzorg → treatment-modified disease trajectory → survival. Remove any link and the chain breaks differently, but it breaks.

**3. The hardest link is biology, not logistics.** I spent months optimizing queues, triage, and workflows. The breakthrough came from modeling the one thing I'd been treating as a constant: whether treatment actually changes disease outcomes. In hindsight, it's obvious. In practice, healthcare AI conversations almost never center on it. We talk about systems, data flows, and scheduling. The patient's body is an afterthought.

**4. Four percent is a direction, not a conclusion.** From 6.28 to 6.01 deaths per run — not statistically significant at N=200. It trends right. But the noise is too large to call it real. The honest version: "AI, when connected to treatment that works, produces a consistent but unproven reduction in mortality." That's what 200 runs of personas-ON data actually say.

---

### The Truus question, honestly answered

Could this system have saved Truus de Groot? Her dementia Markov chain has a trajectory that ketenzorg stabilizes but rarely reverses. The severity-scaled improvement chance applies, but dementia's progression is relentless in the model and in reality.

In the simulation: probably not. Her disease was too advanced by the time even the Digital Twin flagged it. Earlier detection would have helped — but even with treatment deceleration, severe dementia progresses to terminal.

In the real world: possibly. Early dementia intervention can meaningfully slow functional decline. But the simulation can't model the nuance of cognitive stimulation therapy or caregiver support networks. That's a limitation worth naming, and a reason to scale the model.

---

### The scorecard for the whole series

| What the AI chain fixed | What it didn't fix (yet) |
|---|---|
| Total deaths: **−4%** (6.28→6.01, d=0.097, not significant) ⚠️ | Mortality not significant at N=200 |
| System deaths: **4.63→4.33** (d=0.119, not significant) ⚠️ | Small-N stochastic variance |
| Avg GP burnout: **−76%** (18.57→4.48, d=5.30, significant) ✅ | — |
| Peak GP burnout: **−54%** (39.13→17.89, d=8.16, significant) ✅ | — |
| Admin waste: **−83.3%** (€33,561→€5,594) ✅ | — |
| Proactive detection: **316/run** (d=4.70, significant) ✅ | — |
| Ketenzorg: **+172%** (68→186, d=1.67, significant) ✅ | — |
| ER admissions: **64.6→69.4** (d=-0.234, not significant) ⚠️ | ER flow not fixed yet |
| Bias score: **0.354→0.402** (d=-0.273, not significant) ⚠️ | SOLL guardrail activated in 35% of runs |

AI by itself doesn't save lives. AI connected to treatment that works trends toward saving lives. The distinction matters, and the gap is real.

---

This is the last post in the research series. The code is on GitHub. The simulation runs in a browser. The research runner produces 200 personas-ON trials with full statistics in a few minutes.

I'm opening the simulation for anyone who wants to test their own hypotheses. Fork the repo, change the Markov rates, add specialist capacity, scale the population, see what happens.

The one thing I'd most like someone to test: **what happens when you increase specialist capacity?** The 12-week Treeknorm ceiling is the parameter I've touched least, and I suspect it's the one that would produce the largest mortality reduction. The other: **what happens at N=500 agents?** 45 citizens may simply be too few to achieve statistical power on mortality. Both are open questions.

**What would you test?**

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Methodology: 100 runs × 3,000 cycles per mode (IST and SOLL), 45 personality-driven agents (CBS demographics), unified engine. Current headline numbers come from `scripts/output/persona_ab_comparison.json`; the personas-ON single-arm runner output is `scripts/output/deep_research_100runs.json`; an earlier v4-engine pre-persona baseline is preserved as `scripts/output/deep_research_100runs_baseline_prePersona.json` for provenance. Treatment-modified Markov transitions: severity-scaled deceleration (mild=15%, moderate=25%, severe=35%, critical=45%) and improvement chance (mild=8%, moderate=6%, severe=3%, critical=1%), applied when receiving ketenzorg or active hospital care in SOLL. Ketenzorg NZa tariffs: E11 = €63.36/q, J44 = €50.19/q, I25 = €27.17/q. Welch's t-test, Cohen's d, 95% CI.*

*Limitations: Treatment deceleration and improvement rates are severity-scaled but not calibrated to specific condition-level evidence. Real ketenzorg effectiveness varies by condition and patient adherence. The SOLL HP drain reduction (0.3× vs 1.0×) is separate from Markov modification — they interact. N=45 agents limits statistical power on rare events like mortality. A smaller earlier-engine analysis looked more optimistic; the 100-run unified-engine study is the current source of truth and is a cautionary example against publishing small-sample mortality claims.*

---

## Data Source (100×3000 cycles, unified persona A/B study)
```
IST_ON:  total=6.28±2.90, system=4.63±2.56, ER=64.6±20.9, ketenzorg=68.3±40.4, alerts=0, avgBurnout=18.57, peakBurnout=39.13, bias=0.354
SOLL_ON: total=6.01±2.65, system=4.33±2.48, ER=69.4±19.9, ketenzorg=186.0±91.2, alerts=316.3±95.3, avgBurnout=4.48, peakBurnout=17.89, bias=0.402, guardrail=35%
Total deaths: d=0.097 (NOT significant)
System deaths: d=0.119 (NOT significant) | ER: d=-0.234 (NOT significant) | Bias: d=-0.273 (NOT significant)
Admin waste: €33,561→€5,594 (-83.3%, deterministic)
Proactive alerts: d=-4.695 (SIGNIFICANT) | Ketenzorg: d=-1.668 (SIGNIFICANT, +172%)
Avg burnout: d=5.295 (SIGNIFICANT, -76%) | Peak burnout: d=8.161 (SIGNIFICANT, -54%)
Runner: scripts/persona_ab_study.cjs × 100 runs per cell (personas ON canonical arm)
```

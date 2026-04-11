# Series 1 — Health Sector | Post 5: The Digital Twin Paradox

**Status:** Draft v4 — Rewritten with 20-trial statistical data
**Target:** LinkedIn
**Tags:** #DigitalTwin #HealthcareAI #Preventie #Ketenzorg #Cammelot #RIVM

---

## Post

436 proactive alerts per run. Each one a patient who didn't know they were deteriorating.

Their Digital Twin did. And it didn't matter.

---

**Truus de Groot**, 72. Dementia and hypertension. In IST mode, her dementia Markov chain crept from mild → moderate → severe over 1,200 cycles. Nobody noticed. There was no mechanism to notice. At cycle 1,223, the chain hit terminal. Truus became a ghost.

In SOLL mode, her Digital Twin would have flagged the trajectory hundreds of cycles earlier. A proactive alert to her GP. A ketenzorg intervention.

I ran it 20 times. **The death count is identical.** Truus dies in both worlds — just with better paperwork in the second one.

[📸 Screenshot: Truus de Groot's agent panel — F03 dementia progressing, no proactive alert in IST]

---

**Research Question:** Do Digital Twin proactive alerts and ketenzorg interventions reduce preventable mortality?

**Method:** 20 runs × 3,000 cycles per mode. Every SOLL citizen has a Digital Twin that fires alerts when HP trajectory crosses a risk threshold. GPs can then initiate ketenzorg (integrated chronic care). Tracked: alert count, ketenzorg interventions, and — the metric that matters — deaths.

---

**Finding 1: Digital Twins fire massively. The numbers are real.**

| Metric | IST (N=20) | SOLL (N=20) | Cohen's d | Significant? |
|--------|-----------|-------------|-----------|-------------|
| Proactive alerts | 0 | **436 ± 158** | **3.89** | ✅ Yes (p<.001) |
| Ketenzorg interventions | 78 ± 45 | **210 ± 91** | **1.84** | ✅ Yes (p<.001) |

Cohen's d = 3.89 for proactive alerts — nearly four standard deviations apart. This isn't a marginal improvement; it's a qualitative shift from zero-detection to mass-screening. Ketenzorg tripled (168% increase, d = 1.84, also highly significant).

**The detection infrastructure works. The question is what happens next.**

---

**Finding 2: All those alerts don't reduce deaths.**

| Metric | IST | SOLL | Cohen's d | Significant? |
|--------|-----|------|-----------|-------------|
| System deaths | 5.35 ± 2.01 | 5.65 ± 3.22 | 0.11 | ❌ No |
| 80+ mortality | 58.2% | 58.4% | 0.006 | ❌ No |
| ER admissions | 90.6 ± 28.5 | 105.3 ± 35.4 | 0.46 | ❌ No |

Not only do deaths not decrease — SOLL has slightly *more* system deaths (5.65 vs 5.35) and *more* ER admissions (105 vs 91). Neither difference is statistically significant, but the direction is concerning.

**436 alerts per run × 20 runs = 8,720 proactive alerts. Zero mortality improvement.**

This is the Digital Twin Paradox: **detection without effective intervention is just documentation of decline.**

---

**Finding 3: Why doesn't detection translate to survival?**

Three hypotheses, all supported by the model mechanics:

**1. The Markov chain is sovereign.** Once a condition transitions to "severe" or "terminal," the progression is probabilistic and largely irreversible in the current model. An alert at cycle 400 doesn't change the transition matrix at cycle 800. Detection ≠ cure.

**2. Ketenzorg delays, doesn't prevent.** The model adds ketenzorg interventions as HP stabilization events, but they don't alter the underlying Markov transition rates. They slow the descent but don't change the destination. In real healthcare, chronic care management *does* alter disease trajectories — the model underestimates this.

**3. The bottleneck is downstream.** Even with perfect detection, patients still enter the same specialist queue with the same 12-week Treeknorm ceiling. The Digital Twin identifies who's deteriorating; it doesn't create more specialist capacity. You're flagging drowning people without adding lifeguards.

---

**Finding 4: The economics are real, the coupling is real — but the mortality assumption was wrong.**

| Item | Value |
|------|-------|
| Admin savings per run | €27,967 (deterministic) |
| Ketenzorg cost (210 interventions × ~€45 avg) | ~€9,450 |
| Net workflow savings | ~€18,500/run |
| Prevented hospitalizations | **0** (not statistically significant) |

I wrote in an earlier draft that "proactive care pays for itself through admin savings alone." The admin savings are real. The "pays for itself" framing assumed mortality reduction that doesn't exist in the data.

**The honest economics:** AI-augmented primary care saves €27,967/run on admin and spends €9,450 on expanded ketenzorg. That's a genuine €18,500 workflow efficiency gain. But you cannot claim it as a mortality ROI.

---

**Discussion: What this means for Digital Twin deployments.**

The coupling hypothesis from my earlier draft was right in principle: you need admin relief *before* you can do proactive care. AI scribes free GP time (burnout -84%), Digital Twins fill that time with alerts (436/run), ketenzorg triples.

**The pipeline works. The endpoint doesn't connect.**

For Digital Twins to save lives, the model needs two things the current simulation doesn't have:
1. **Altered Markov transitions** — treated patients should progress slower than untreated
2. **Elastic specialist capacity** — detected patients need somewhere to go besides the same 12-week queue

This isn't a failure of Digital Twins. It's a failure of a system where detection outpaces capacity. **The simulation reproduced the real-world NHS critique: "We found the cancer earlier, but the wait for treatment was the same."**

---

**The Truus question, honestly answered:**

Could Digital Twins have saved Truus de Groot? In this simulation: probably not. Her dementia Markov chain has a trajectory that ketenzorg stabilizes but doesn't reverse. An earlier alert gives her GP more time to plan — but more time to plan ≠ more time to live.

In the real world? Possibly. Early dementia intervention (cognitive stimulation, medication timing, caregiver support) can meaningfully slow progression. The simulation can't model that nuance yet. That's a limitation worth naming.

---

*Methodology: 20 runs × 3,000 cycles, 45 agents, CBS/RIVM/NZa parameters. Lethal conditions: I25, I50, C34, J44, F03. Ketenzorg tariffs: E11=€63.36/q, J44=€50.19/q, I25=€27.17/q. Welch's t-test, Cohen's d, 95% CI.*

*Limitations: The Markov model treats disease progression as independent of care intervention (transition rates don't change with treatment). This is the single most important limitation — it means the model structurally cannot show mortality benefits from proactive care. Future work should implement treatment-modified transition matrices. N=45 agents. ER admissions may increase in SOLL because proactive alerts route patients through the system who would otherwise die at home (a detection artifact, not a failure).*

---

This was the final post in the research series. The scorecard:

| What AI Fixed | What AI Didn't Fix | What AI Made Worse |
|--------------|-------------------|-------------------|
| GP burnout (-84%) ✅ | Deaths (d=0.11) ❌ | Bias (+42%) ⚠️ |
| Admin waste (-83%) ✅ | 80+ mortality (d=0.006) ❌ | |
| Detection (436 alerts) ✅ | ER admissions (d=0.46) ❌ | |
| Ketenzorg (+168%) ✅ | | |

**The honest conclusion: AI is a workforce intervention, not a mortality intervention — at least not yet, and not without systemic change.**

Next: I'm opening the simulation for anyone who wants to test their own hypotheses. Fork the repo, change the Markov rates, add specialist capacity, see what actually saves lives.

**What would you test?**

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

## Data Source (20-run averages)
```
IST 20×3000: deaths=5.35±2.01, ER=90.6±28.5, ketenzorg=78±45, alerts=0
SOLL 20×3000: deaths=5.65±3.22, ER=105.3±35.4, ketenzorg=210±91, alerts=436±158
Proactive alerts: Cohen's d=3.89, p<.001 (huge) | Deaths: d=0.11, NOT significant
Named deaths: Truus de Groot (72) cycle 1223, F03+I10 | Nico Kok (70) cycle 71, I25+E11+I10
Named survivors: Diana Hendriks (82) HP=100, E11 (survives in some runs, dies in others)
Guardrail: 7/20 SOLL runs (35%) | Bias: 0.33→0.46 (+42%, significant)
Runner: scripts/deep_research.cjs × 20 runs per mode
```

## Screenshots Needed
1. Truus de Groot's agent panel (IST — declining, no alert)
2. Diana Hendriks' agent panel (SOLL — survived, 100 HP)
3. Proactive alert toast notification: "🔔 Digital Twin Alert"
4. The scorecard table as a visual (AI fixes workflow, not mortality)
5. Ghost sprite on the map (the emotional closer)

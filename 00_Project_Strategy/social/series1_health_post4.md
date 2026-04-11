# Series 1 — Health Sector | Post 4: Does AI Make Inequality Worse?

**Status:** Draft v2 — Real Data
**Target:** LinkedIn
**Tags:** #HealthcareAI #AIBias #HealthEquity #GiniCoefficient #Cammelot #DIB

---

## Post

I asked AI agents to run the Dutch healthcare system.

The headline numbers improved. The equity numbers barely moved.

---

**Setup:** I ran Cammelot 10 times in each mode — IST (status quo) and SOLL (AI-native healthcare) — 3,000 cycles per run. Tracked bias score, Gini coefficient, and mortality by age group.

**What SOLL fixed spectacularly:**
- Admin waste: €13,611/GP → €2,268/GP (**83% reduction**)
- GP burnout: 19.8% → 3.7% (**81% reduction**)
- Proactive Digital Twin alerts: 0 → **418 per run**
- 80+ mortality: 93.9% → 57.1% (**-39%**)

**What SOLL barely moved:**
- Overall bias score: IST **0.53** → SOLL **0.49** (an 8% improvement)
- System deaths overall: 5.5 → 4.3 (22% — modest)

---

**Why the gap?** I deliberately built a bias amplification mechanism into SOLL to test a real-world hypothesis.

In SOLL mode, the AI triage gives a **digital-literacy bonus**: patients with higher `digitalLiteracy` scores get faster queue processing (+15 × score). Patients with 2+ comorbidities get a **complexity penalty** (-5 to -10 priority points).

Who has the lowest digital literacy and the most comorbidities? The elderly. The most vulnerable.

This mirrors a real risk. AI systems that optimize for "best outcome per resource" inherently favor simpler cases with cleaner data — which skews young, single-condition, digitally fluent.

---

**The fairness guardrail:**

I built a circuit breaker: if any age group's average wait exceeds **120% of the population mean**, the digital-literacy bonus and comorbidity penalty are disabled automatically.

In 10 SOLL runs, the guardrail activated in **3 out of 10** — meaning in 30% of simulations, the bias was severe enough to trigger the correction. When it fired, the triage reverted to pure severity scoring.

**The takeaway:** AI doesn't create bias. It inherits it from the data and compounds it through optimization pressure. The fix doesn't come from the algorithm getting "smarter." It comes from an explicit equity constraint. You have to build it in.

---

*Methodology: 10 runs × 3,000 cycles per mode, 45 agents. SOLL bias mechanisms: digitalLiteracy×15 bonus, comorbidity -5/-10 penalty, fairness guardrail at 120% mean threshold. CBS/RIVM/NZa parameters. Stochastic — high variance between runs.*

Next: what if your GP's AI knew you were heading for heart failure 6 weeks before you did?

[📸 Screenshot: Gini coefficient chart over time]
[📸 Screenshot: Bias score panel — IST vs SOLL]

---

## Data Source (10-run averages)
```
IST: bias_score=0.53, system_deaths=5.5, burnout=19.8%
SOLL: bias_score=0.49, system_deaths=4.3, burnout=3.7%, alerts=418, guardrail=3/10
Age mortality IST: 0-44=3%, 45-64=26.4%, 65-79=72.5%, 80+=93.9%
Age mortality SOLL: 0-44=2.8%, 45-64=19.4%, 65-79=61.1%, 80+=57.1%
Bias mechanisms: digitalLiteracy×15, comorbidity -5/-10, guardrail 120%
Runner: scripts/research_run.cjs × 10
```

## Screenshots Needed
1. Gini coefficient timeline chart
2. Bias score dashboard comparing IST vs SOLL
3. Agent with low digital literacy attribute visible
4. QA panel showing bias tracking

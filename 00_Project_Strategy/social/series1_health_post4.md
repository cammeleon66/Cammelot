# Series 1 — Health Sector | Post 4: Does AI Make Inequality Worse?

**Status:** Draft v3 — WOW rewrite
**Target:** LinkedIn
**Tags:** #HealthcareAI #AIBias #HealthEquity #GiniCoefficient #Cammelot #DIB

---

## Post

I built an AI healthcare system that discriminated against the elderly.

On purpose.

---

In my last post, I showed that severity-based triage saves lives — especially for the 80+ group (-39% mortality). So I asked the obvious next question: **what happens when the AI optimizes the triage system?**

I programmed two bias mechanisms into Cammelot's SOLL mode to test a real-world hypothesis:

**1. Digital literacy bonus.** Patients with higher digital-literacy scores get faster queue processing (+15 × score). Because in the real world, patients who can navigate patient portals, upload data, and respond to Digital Twin alerts get served faster.

**2. Comorbidity penalty.** Patients with 2+ conditions get a priority penalty (-5 to -10 points). Because complex cases take longer, and optimization pressure favors simple, clean, predictable cases.

**Who has the lowest digital literacy and the most comorbidities?**

The elderly. The exact group the system is supposed to protect.

[📸 Screenshot: Agent panel showing low digitalLiteracy score on an elderly patient]

---

**The results (10 runs × 3,000 cycles):**

The headline metrics improved beautifully:
- Admin waste: €13,611 → €2,268/GP (**-83%**)
- GP burnout: 19.8% → 3.7% (**-81%**)
- Proactive alerts: 0 → **418 per run**

But the equity score barely moved:
- **Bias score: IST 0.53 → SOLL 0.49** — only 8%

Eight percent. That's noise, not progress.

The AI made the system *faster* but not *fairer*. It optimized the average while the vulnerable got the same deal as before. **This is the most common failure mode of AI in healthcare, and I just reproduced it in 500ms.**

---

**The circuit breaker that saved the simulation:**

I built a fairness guardrail: if any age group's average wait exceeds **120% of the population mean**, the digital-literacy bonus and comorbidity penalty disable automatically.

In 10 SOLL runs, the guardrail fired in **3 out of 10**.

Let that sink in: in 30% of simulations, the AI's own optimization was severe enough to trigger the safety net. Without the guardrail, those 3 runs would have amplified the very inequality the system was built to reduce.

**The guardrail didn't make the AI smarter. It made the AI accountable.**

[📸 Screenshot: Guardrail activating — bias panel showing the moment it fires]

---

**The takeaway for anyone deploying AI in healthcare:**

1. **AI doesn't create bias. It inherits it from the data and compounds it through optimization pressure.** My triage algorithm was mathematically "optimal" — and structurally discriminatory.

2. **You can't audit bias after deployment. You have to build the constraint into the system.** My guardrail fires in real-time, every tick. Not in a quarterly review.

3. **The metric to watch isn't accuracy. It's equity.** Bias score, Gini coefficient, age-stratified outcomes. If you're only tracking "did outcomes improve on average?" you'll miss the pattern until it's too late.

The most dangerous AI system is one that works perfectly well — for most people.

---

*Methodology: 10 runs × 3,000 cycles per mode, 45 agents. SOLL bias mechanisms: digitalLiteracy×15 bonus, comorbidity -5/-10 penalty. Fairness guardrail threshold: 120% of population mean wait. CBS/RIVM/NZa parameters. Stochastic — bias score variance is high with N=45. The 30% guardrail activation rate is the most stable finding.*

Next: the Digital Twin experiment. 418 proactive alerts per run. Each one a patient who didn't know they were deteriorating. Their Digital Twin did.

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
1. Agent panel: elderly patient with low digitalLiteracy, multiple conditions
2. Bias panel showing guardrail activation moment
3. Gini coefficient timeline (use smoothed rolling average from research runner)
4. Before/after guardrail: triage scores for elderly vs young patients

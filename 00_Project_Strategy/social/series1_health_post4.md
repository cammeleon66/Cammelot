# Series 1 — Health Sector | Post 4: Does AI Make Inequality Worse?

**Status:** Draft v4 — Rewritten with 20-trial statistical data
**Target:** LinkedIn
**Tags:** #HealthcareAI #AIBias #HealthEquity #GiniCoefficient #Cammelot #DIB

---

## Post

I built an AI healthcare system. It made inequality worse.

Not by accident. By design.

---

In my last post, I showed that FIFO queues produce a 15× mortality gradient between youngest and oldest. The natural next step: let AI triage by severity instead. Sicker patients go first.

So I did. And I added two bias mechanisms to test a real-world hypothesis:

**1. Digital literacy bonus.** Patients with higher digital-literacy scores get faster queue processing (+15 × score). Because in the real world, patients who navigate portals, upload data, and respond to Digital Twin alerts get served faster.

**2. Comorbidity penalty.** Patients with 2+ conditions get a priority penalty (-5 to -10 points). Because complex cases take longer, and optimization pressure favors simple, predictable cases.

**Who has the lowest digital literacy and the most comorbidities?** The elderly. The exact group the system is supposed to protect.

[📸 Screenshot: Agent panel showing low digitalLiteracy score on an elderly patient]

---

**Research Question:** Does AI-optimized triage amplify health inequity, and can a real-time fairness guardrail mitigate it?

**Method:** 20 runs × 3,000 cycles per mode. Bias score = weighted metric combining age-stratified wait time disparities. Fairness guardrail: if any age group's average wait exceeds 120% of the population mean, digital-literacy bonuses and comorbidity penalties auto-disable. Welch's t-test, Cohen's d.

---

**Finding 1: AI made inequality statistically significantly worse.**

| Metric | IST (N=20) | SOLL (N=20) | Cohen's d | Significant? |
|--------|-----------|-------------|-----------|-------------|
| Bias score | 0.33 ± 0.08 | 0.46 ± 0.22 | **0.81** | ✅ Yes |

Cohen's d = 0.81 — a **large** effect size. The AI system didn't just fail to reduce bias; it actively increased it by 42%.

In my earlier 10-run analysis, I reported bias dropping from 0.53 to 0.49 (−8%) and called it "noise, not progress." The 20-run data tells a worse story: **bias goes up, significantly.**

The mechanism is straightforward: severity-based triage + digital literacy bonus + comorbidity penalty = a system that structurally deprioritizes the people who need it most.

---

**Finding 2: The guardrail fires in 35% of AI runs — and that's the good news.**

| | Value |
|---|---|
| Guardrail activations | **7 out of 20** SOLL runs (35%) |
| Cohen's d (guardrail activation) | 1.01 (large) |
| Statistically significant | ✅ Yes |

In more than a third of simulations, the AI's own optimization was severe enough to trigger the safety net. Without the guardrail, those 7 runs would have produced even worse equity outcomes.

**The guardrail didn't make the AI fair. It made the AI less unfair.** Bias still increased 42% even WITH the guardrail active. The safety net catches the worst violations but doesn't fix the structural tendency.

[📸 Screenshot: Guardrail activating — bias panel showing the moment it fires]

---

**Finding 3: The workflow improvements are spectacular — which makes the equity failure more dangerous.**

| Metric | IST | SOLL | Cohen's d | Significant? |
|--------|-----|------|-----------|-------------|
| GP burnout | 18.9% | 3.0% | 2.99 | ✅ Huge |
| Proactive alerts | 0 | 436 | 3.89 | ✅ Huge |
| Admin waste | €33,561 | €5,594 | — | -83% |
| **Bias score** | **0.33** | **0.46** | **0.81** | **✅ Worse** |
| System deaths | 5.35 | 5.65 | 0.11 | ❌ No change |

This is the pattern to watch: **AI produces impressive headline metrics (burnout -84%, alerts +∞, admin -83%) while quietly making equity worse.** If you only track averages, you'll celebrate the deployment. If you track disparity, you'll catch the problem.

**The most dangerous AI system is one that works perfectly well — for most people.**

---

**Discussion: Three lessons for anyone deploying AI in healthcare.**

**1. Optimization pressure is inequity pressure.** My triage algorithm was mathematically "optimal" and structurally discriminatory. These aren't bugs — they're the same thing. Optimizing for throughput systematically disadvantages complex, slow, digitally excluded patients.

**2. Real-time guardrails are necessary but not sufficient.** The 120% threshold catches acute violations but allows chronic drift. A 35% activation rate means the system is *regularly* pushing past the fairness boundary. That's not "occasionally triggered" — it's load-bearing safety infrastructure.

**3. The audit metric isn't accuracy. It's equity.** Bias score, age-stratified outcomes, Gini coefficient. If your AI dashboard shows "outcomes improved 15%" but doesn't show "for whom?" — you don't have a dashboard, you have a press release.

---

*Methodology: 20 runs × 3,000 cycles per mode, 45 agents. SOLL bias mechanisms: digitalLiteracy×15 bonus, comorbidity -5/-10 penalty. Fairness guardrail threshold: 120% of population mean wait. Welch's t-test, Cohen's d, 95% CI. CBS/RIVM/NZa parameters.*

*Limitations: N=45 agents. Bias score has high variance (SD=0.22 in SOLL) because small-population demographics amplify disparity metrics. The bias mechanisms are modeled as static parameters, not learned — real-world AI systems develop bias through training data, which may produce different patterns. The guardrail threshold (120%) is arbitrary; sensitivity analysis across thresholds would strengthen the finding.*

Next: 436 proactive alerts per run. Digital Twins caught every deterioration — and it still didn't save anyone. Why?

---

## Data Source (20-run averages)
```
IST 20×3000: bias_score=0.326±0.084, system_deaths=5.35±2.01, burnout=18.9%±7.2
SOLL 20×3000: bias_score=0.463±0.224, system_deaths=5.65±3.22, burnout=3.0%±2.2
Bias Cohen's d=0.81 (LARGE, significant) — 42% increase
Guardrail: 7/20 SOLL runs (35%), Cohen's d=1.01 (significant)
Bias mechanisms: digitalLiteracy×15, comorbidity -5/-10, guardrail 120%
Runner: scripts/deep_research.cjs × 20 runs per mode
```

## Screenshots Needed
1. Agent panel: elderly patient with low digitalLiteracy, multiple conditions
2. Bias panel showing guardrail activation moment
3. Comparison dashboard: workflow metrics all green, equity metric red
4. Gini coefficient timeline — IST vs SOLL (showing SOLL isn't better)

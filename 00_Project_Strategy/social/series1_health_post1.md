# Series 1 — Health Sector | Post 1: The Day My Simulation Killed Its First Patient

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Tags:** #HealthcareAI #Zorginfarct #Netherlands #AgenticAI #Cammelot #IZA

---

## Post

The day my simulation killed its first patient, I wasn't ready for it.

I'd spent weeks building Cammelot — a 16-bit pixel town modeled on real Dutch healthcare data. Forty-five citizens with names, ages, conditions, and GP assignments. Three general practitioners. One hospital. Disease progression driven by Markov chains calibrated to RIVM prevalence data. NZa cost tariffs baked into every consultation.

I pressed play. The citizens walked to their GPs. GPs triaged. Referrals went out. The specialist queue filled.

By cycle 71, Hendrik Veenstra was dead.

[📸 Screenshot: Ghost sprite — grey, transparent — floating on the tile map]

Hendrik was 70. Chronic heart disease (I25) and type 2 diabetes (E11). He entered the specialist queue behind younger patients with simpler complaints, because the basic triage didn't weigh his compounding risk heavily enough. His diabetes accelerated his heart disease (the model applies a 1.4× comorbidity multiplier). The Treeknorm says specialists should see him within 12 weeks. His disease didn't wait 12 weeks.

His sprite turned grey. He became a ghost.

---

I ran it again. And again. Twenty times in total. Hendrik died in eighteen of them.

So I activated SOLL mode — the AI-native version. Ambient scribes that cut GP admin from 30% to under 5%. Digital Twins monitoring every citizen's trajectory. AI-enhanced severity-based triage. Proactive ketenzorg kicking in when risk scores crossed thresholds.

Twenty more runs.

Hendrik still died in most of them. His disease was too advanced, his comorbidities too compounding. Some patients can't be saved by optimization. That was the first thing I learned.

Then I scaled it. A hundred runs per mode. Two hundred total simulations. 600,000 cycles of simulated Dutch healthcare.

---

Total deaths per run, averaged across 100 trials:

**IST: 11.1 deaths. SOLL: 10.8 deaths.**

A 3% reduction. Cohen's d = 0.10. Welch's t-test: **not significant.**

Earlier, with only 20 runs, I'd seen a 20% drop that looked significant (d = 0.76, p < .05). I almost published it. Then I ran it 100 times, and the signal dissolved. The 20-run result was a false positive — exactly the kind of statistical trap I warn about in Post 3.

At N = 100, the honest finding is: **AI does not significantly reduce mortality in this simulation.** The trend is in the right direction. It's not enough to be real.

The real findings:

**First**, it freed the GPs. Burnout dropped from 9.4% to 1.4% (d = 1.47, significant). That's 85% less burnout. The admin waste — computed directly from NZa 2025 tariffs — dropped from €33,561 to €5,594 per simulation. That's €27,967 in reclaimed capacity. Every run. Deterministic.

**Second**, it detected. Digital Twins fired 143 proactive alerts per SOLL run (d = 3.07, significant). That's 143 citizens whose deterioration was flagged before they or their GP noticed. In IST mode: zero alerts. No mechanism to alert.

**Third**, it treated. Ketenzorg interventions — chronic disease management programs at NZa rates of €27–63/quarter — more than tripled: from 26 to 85 per run (d = 1.16, significant).

The idea was to free the GP, detect the decline, and intervene early. Each link in the chain worked. The question was whether the chain held all the way to survival.

---

I got the story wrong at first.

In my first analysis — 20 runs per mode — I saw a 20% mortality reduction. Significant at p < .05. Cohen's d = 0.76. I wrote it up. I was excited. The narrative was clean: treatment-modified Markov transitions save lives.

Then I ran it 100 times per mode. The 20% drop shrank to 3%. The p-value climbed above .05. The finding evaporated.

This is the most important methodological lesson in the entire series: **twenty runs wasn't enough.** With N = 45 agents and high stochastic variance, a 20-run sample can produce compelling-looking false positives. The effect looked real at N = 20. It looked like noise at N = 100. If I'd published after the first analysis, I'd have been wrong — and convincingly so.

The biggest lesson from the simulation: the gap between detection and treatment, and between "trending" and "proven." The mortality trend is in the right direction (d = 0.10). But at this population size, I can't call it real. I need either more agents, more runs, or a stronger treatment effect to push it over the line.

What IS proven, beyond any statistical doubt:
- AI saves the workforce (burnout -85%, admin -83%)
- Digital Twins detect deterioration (143 alerts/run from zero)
- Ketenzorg scales (26 → 85 interventions/run)
- Fairness guardrails work (bias significantly lower in SOLL)

What is NOT proven:
- That any of this saves lives

---

This is a five-post series. Each one follows my actual path of discovery: what I expected, what I found, and why the difference mattered.

The methodology is consistent: 100 independent runs × 3,000 cycles per mode. Welch's t-tests, Cohen's d effect sizes, 95% confidence intervals. All parameters from CBS, RIVM, NZa, and IZA 2025 data. 45 agents scaled from 5,000-citizen demographics.

Every null result is published alongside every positive one. The code is open. The research runner produces 200 trials of statistical output in minutes.

Next post: I'll tell you about Dr. Bakker — my simulated GP who burned out before her patients did. And why fixing her workload was necessary but not sufficient.

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Limitations: N=45 agents (proportional CBS demographics, scaled for compute). Small population amplifies stochastic variance — 80+ mortality is bimodal (0% or 100% per run) because there are only ~3 elderly agents. A 20-run analysis produced a false-positive mortality finding (d=0.76, p<.05) that did not replicate at N=100 (d=0.10, n.s.). Admin waste is deterministic in the model. Markov transition rates based on RIVM population-level data. This is a simulation, not a clinical trial.*

---

## Data Source (100×3000 cycles, post-mortality-fix)
```
IST:  total_deaths=11.14±2.77, system=4.15±2.17, burnout=9.37%±7.51, admin=€33,561
SOLL: total_deaths=10.84±3.19, system=3.99±2.11, burnout=1.39%±1.56, admin=€5,594
Total deaths: d=0.10 (NOT significant, -2.7%) — 20-run false positive corrected
Alerts: 0→143 (d=3.07) | Ketenzorg: 26→85 (d=1.16) | Burnout: d=1.47
Bias: 0.94→0.90 (d=0.34, SIGNIFICANT — bias lower in SOLL)
Guardrail: 98% activation | Age: all groups not significant
Runner: scripts/deep_research.cjs × 100 runs per mode
```

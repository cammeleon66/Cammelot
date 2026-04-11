# Series 1 — Health Sector | Post 1: The Day My Simulation Killed Its First Patient

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Tags:** #HealthcareAI #Zorginfarct #Netherlands #AgenticAI #Cammelot #IZA

---

## Post

The day my simulation killed its first patient, I wasn't ready for it.

I'd spent weeks building Cammelot — a 16-bit pixel town modeled on real Dutch healthcare data. Forty-five citizens with names, ages, conditions, and GP assignments. Three general practitioners. One hospital. Disease progression driven by Markov chains calibrated to RIVM prevalence data. NZa cost tariffs baked into every consultation.

I pressed play. The little pixel people walked to their GPs. GPs triaged. Referrals went out. The specialist queue filled.

By cycle 71, Hendrik Veenstra was dead.

[📸 Screenshot: Ghost sprite — grey, transparent — floating on the tile map]

Hendrik was 70. Chronic heart disease (I25) and type 2 diabetes (E11). He entered the specialist queue behind younger patients with simpler complaints — because the queue was first-in-first-out, just like most Dutch waiting lists. His diabetes accelerated his heart disease (the model applies a 1.4× comorbidity multiplier). The Treeknorm says specialists should see him within 12 weeks. His disease didn't wait 12 weeks.

His sprite turned grey. He became a ghost.

---

I ran it again. And again. Twenty times in total. Hendrik died in eighteen of them.

So I activated SOLL mode — the AI-native version. Ambient scribes that cut GP admin from 30% to under 5%. Digital Twins monitoring every citizen's trajectory. Severity-based triage replacing FIFO. Proactive ketenzorg kicking in when risk scores crossed thresholds.

Twenty more runs.

Hendrik still died in most of them. His disease was too advanced, his comorbidities too compounding. Some patients can't be saved by optimization. That's the first thing the simulation teaches you.

Then I scaled it. A hundred runs per mode. Two hundred total simulations. 600,000 cycles of simulated Dutch healthcare.

---

Total deaths per run, averaged across 100 trials:

**IST: 11.7 deaths. SOLL: 10.9 deaths.**

A 7% reduction. Cohen's d = 0.24. Welch's t-test: **not significant.**

I stared at that number for a long time. Because earlier, with only 20 runs, I'd seen a 20% drop that looked significant (d = 0.76, p < .05). I almost published it. Then I ran it 100 times, and the signal dissolved. The 20-run result was a false positive — exactly the kind of statistical trap I warn about in Post 3.

At N = 100, the honest finding is: **AI does not significantly reduce mortality in this simulation.** The trend is in the right direction. It's not enough to be real.

Here's what IS real:

**First**, it freed the GPs. Burnout dropped from 7.1% to 1.6% (d = 1.17, significant). That's 77% less burnout. The admin waste — computed directly from NZa 2025 tariffs — dropped from €33,561 to €5,594 per simulation. That's €27,967 in reclaimed capacity. Every run. Deterministic.

**Second**, it detected. Digital Twins fired 167 proactive alerts per SOLL run (d = 3.58, significant). That's 167 citizens whose deterioration was flagged before they or their GP noticed. In IST mode: zero alerts. No mechanism to alert.

**Third**, it treated. Ketenzorg interventions — chronic disease management programs at NZa rates of €27–63/quarter — nearly tripled: from 32 to 92 per run (d = 1.15, significant).

Free the GP. Detect the decline. Intervene early. Each link in the chain worked. The question was whether the chain held all the way to survival.

---

And here's where I *did* get the story wrong.

In my first analysis — 20 runs per mode — I saw a 20% mortality reduction. Significant at p < .05. Cohen's d = 0.76. I wrote it up. I was excited. The narrative was clean: treatment-modified Markov transitions save lives.

Then I ran it 100 times per mode. The 20% drop shrank to 7%. The p-value climbed above .05. The finding evaporated.

This is the most important methodological lesson in the entire series: **twenty runs wasn't enough.** With N = 45 agents and high stochastic variance, a 20-run sample can produce compelling-looking false positives. The effect looked real at N = 20. It looked like noise at N = 100. If I'd published after the first analysis, I'd have been wrong — and convincingly so.

**The simulation's most important lesson wasn't about AI. It was about the connection between detection and treatment — and the gap between "trending" and "proven."** The mortality trend is in the right direction (d = 0.24). But at this population size, I can't call it real. I need either more agents, more runs, or a stronger treatment effect to push it over the line.

What IS proven, beyond any statistical doubt:
- AI saves the workforce (burnout -77%, admin -83%)
- Digital Twins detect deterioration (167 alerts/run from zero)
- Ketenzorg scales (32 → 92 interventions/run)
- Fairness guardrails work (bias significantly lower in SOLL)

What is NOT proven:
- That any of this saves lives

---

This is a five-post series. Each one follows my actual path of discovery: the thing I expected, the thing I found, and why the gap between them mattered.

The methodology is consistent: 100 independent runs × 3,000 cycles per mode. Welch's t-tests, Cohen's d effect sizes, 95% confidence intervals. All parameters from CBS, RIVM, NZa, and IZA 2025 data. 45 agents scaled from 5,000-citizen demographics.

Every null result is published alongside every positive one. The code is open. The research runner produces 200 trials of statistical output in minutes.

Next post: I'll tell you about Dr. Bakker — my simulated GP who burned out before her patients did. And why fixing her workload was necessary but not sufficient.

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Limitations: N=45 agents (proportional CBS demographics, scaled for compute). Small population amplifies stochastic variance — 80+ mortality is bimodal (0% or 100% per run) because there are only ~3 elderly agents. A 20-run analysis produced a false-positive mortality finding (d=0.76, p<.05) that did not replicate at N=100 (d=0.24, n.s.). Admin waste is deterministic in the model. Markov transition rates based on RIVM population-level data. This is a simulation, not a clinical trial.*

---

## Data Source (100×3000 cycles, post-treatment-fix)
```
IST:  total_deaths=11.71±3.34, system=4.69±2.32, burnout=7.09%±6.35, admin=€33,561
SOLL: total_deaths=10.90±3.31, system=4.28±2.31, burnout=1.63%±1.74, admin=€5,594
Total deaths: d=0.24 (NOT significant, -6.9%) — 20-run false positive corrected
Alerts: 0→167 (d=3.58) | Ketenzorg: 32→92 (d=1.15) | Burnout: d=1.17
Bias: 0.94→0.88 (d=0.49, SIGNIFICANT — bias lower in SOLL)
Guardrail: 97% activation | Age: all groups trending right, none significant
Runner: scripts/deep_research.cjs × 100 runs per mode
```

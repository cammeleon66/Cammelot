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

But across those 40 runs — 20 IST, 20 SOLL — something else happened. Something I didn't see until I looked at the aggregate data.

---

Total deaths per run, averaged across 20 trials:

**IST: 12.3 deaths. SOLL: 9.85 deaths.**

A 20% reduction. Cohen's d = 0.76. Welch's t-test: significant at p < .05.

I stared at that number for a long time. Not because it was large — in clinical terms, 2.45 fewer deaths per 3,000-cycle run is modest. But because it was the first statistically significant mortality finding the simulation had ever produced. And I'd been looking for months.

Here's what made it complicated: the signal came from *total* deaths, not from any single mechanism. Break it down and the picture fragments:

- System deaths (patients dying in the care pipeline): 4.95 → 4.15. Trending right. Not significant (d = 0.35).
- 80+ mortality: 65.7% → 52.7%. Trending right. Not significant (d = 0.34).
- 45–64 mortality: 52.5% → 39.2%. Same pattern (d = 0.53).
- 65–79 mortality: 68.5% → 76.6%. *Worse*. Not significant, but concerning.

No individual metric crossed the significance threshold. The mortality reduction was real but distributed — a little saved here, a little there, adding up to something meaningful only in aggregate.

---

**What was AI actually doing?**

Three things, all measurable:

**First**, it freed the GPs. Burnout dropped from 7.7% to 2.1% (d = 1.06, significant). That's 73% less burnout. The admin waste — computed directly from NZa 2025 tariffs — dropped from €33,561 to €5,594 per simulation. That's €27,967 in reclaimed capacity. Every run. Deterministic.

**Second**, it detected. Digital Twins fired 176 proactive alerts per SOLL run (d = 2.94, significant). That's 176 citizens whose deterioration was flagged before they or their GP noticed. In IST mode: zero alerts. No mechanism to alert.

**Third**, it treated. Ketenzorg interventions — chronic disease management programs at NZa rates of €27–63/quarter — nearly tripled: from 36 to 100 per run (d = 1.12, significant).

Free the GP. Detect the decline. Intervene early. Each link in the chain worked. The question was whether the chain held all the way to survival.

---

And here's where I almost got the story wrong.

In my first version of the simulation, treatment didn't actually change disease progression. Ketenzorg was logged, costs were tracked, but the underlying Markov transition rates were identical for treated and untreated patients. The Digital Twin could detect your deterioration with perfect accuracy — and then do nothing about it. Detection without altered trajectories is just documentation of decline.

When I fixed that — giving treatment a 20% deceleration effect on disease progression and a 5% chance of improvement — the mortality signal appeared. Not because the AI got smarter. Because the biology responded to the intervention.

**The simulation's most important lesson wasn't about AI. It was about the connection between detection and treatment.** A system that detects everything and treats nothing is a system that watches people die with better paperwork. A system where treatment actually changes disease trajectories — even modestly — is a system that saves lives.

---

This is a five-post series. Each one follows my actual path of discovery: the thing I expected, the thing I found, and why the gap between them mattered.

The methodology is consistent: 20 independent runs × 3,000 cycles per mode. Welch's t-tests, Cohen's d effect sizes, 95% confidence intervals. All parameters from CBS, RIVM, NZa, and IZA 2025 data. 45 agents scaled from 5,000-citizen demographics.

Every null result is published alongside every positive one. The code is open. The research runner produces 40 trials of statistical output in under a minute.

Next post: I'll tell you about Dr. Bakker — my simulated GP who burned out before her patients did. And why fixing her workload was necessary but not sufficient.

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Limitations: N=45 agents (proportional CBS demographics, scaled for compute). Small population amplifies stochastic variance — 80+ mortality is bimodal (0% or 100% per run) because there are only ~3 elderly agents. The 65-79 mortality increase in SOLL (68.5% → 76.6%, d=-0.30) may indicate triage redistribution effects worth investigating. Admin waste is deterministic in the model. Markov transition rates based on RIVM population-level data. This is a simulation, not a clinical trial.*

---

## Data Source (20×3000 cycles, post-treatment-fix)
```
IST:  total_deaths=12.30±3.88, system=4.95±2.37, burnout=7.67%±7.29, admin=€33,561
SOLL: total_deaths=9.85±2.37, system=4.15±2.18, burnout=2.10%±1.50, admin=€5,594
Total deaths: d=0.76, p<.05 (SIGNIFICANT) | System deaths: d=0.35 (trending)
Alerts: 0→176 (d=2.94) | Ketenzorg: 36→100 (d=1.12) | Burnout: d=1.06
Age: 80+ IST=65.7% SOLL=52.7% (d=0.34) | 65-79: 68.5%→76.6% (d=-0.30, WORSE)
Runner: scripts/deep_research.cjs × 20 runs per mode
```

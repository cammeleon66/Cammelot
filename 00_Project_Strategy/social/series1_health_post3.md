# Series 1 — Health Sector | Post 3: Same Queue, Different Graves

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Tags:** #HealthcareAI #Treeknorm #AgeBias #Zorginfarct #Cammelot #RIVM

---

## Post

In the Netherlands, if you need to see a specialist, you enter a queue. First in, first out. The Treeknorm says you should be seen within 4 weeks for diagnostics, 7–12 weeks for treatment. It's the same queue for everyone: a 35-year-old with knee pain and a 71-year-old with COPD and hypertension.

In Cammelot, I watched what happens when you run that "equal" queue for 3,000 cycles.

The 35-year-old survived. The 71-year-old did not.

---

His name was Karel de Groot. COPD and hypertension. He entered the specialist queue behind younger patients — not because anyone decided he was less important, but because they arrived first. His COPD Markov chain ticked forward while he waited. Hypertension compounded it (1.3× multiplier). By cycle 99, the chain reached terminal.

Karel wasn't deprioritized. He wasn't triaged out. The queue treated him identically to everyone else.

That was the problem.

[📸 Screenshot: Karel's agent panel — declining HP, COPD + hypertension, weeks waiting]

---

Here are the mortality rates from 100 IST runs, broken down by age:

| Age Group | Approximate N | Mortality Rate | 95% CI |
|-----------|:---:|:---:|:---:|
| 0–44 | ~30 | 13.2% | [11.9%, 14.6%] |
| 45–64 | ~7 | 39.1% | [34.2%, 44.0%] |
| 65–79 | ~4 | 65.8% | [59.3%, 72.3%] |
| 80+ | ~3 | **64.7%** | [56.5%, 72.8%] |

A 5× difference between youngest and oldest. Same queue. Same rules. Same Treeknorm.

Three things compound to produce this:

**Comorbidity drag.** RIVM data says 96% of people over 75 have at least one chronic condition. In the simulation, each condition multiplies progression: diabetes worsens heart disease (1.4×), hypertension compounds both (1.3×). Karel had two conditions racing each other. Most younger patients have zero.

**Baseline fragility.** A 35-year-old enters the queue with a deep HP buffer. A 71-year-old enters with margins already thin. The same 12-week wait is a nuisance for one and a death sentence for the other.

**Markov acceleration.** Every week past the Treeknorm threshold accelerates disease progression. For patients already in "moderate" or "severe" states — which the elderly disproportionately occupy — the acceleration hits harder. It's a compounding function applied to an already compounding problem.

---

So I turned on AI triage. SOLL mode replaces FIFO with severity-weighted priority. Sicker patients jump the queue. Digital Twins flag deterioration. Ketenzorg kicks in.

Here's what happened:

| Age Group | IST Mortality | SOLL Mortality | Cohen's d | Significant? |
|-----------|:---:|:---:|:---:|:---:|
| 0–44 | 13.2% | 12.1% | 0.20 | ❌ No |
| 45–64 | 39.1% | 36.9% | 0.10 | ❌ No |
| 65–79 | 65.8% | 62.3% | 0.11 | ❌ No |
| 80+ | 64.7% | 60.7% | 0.09 | ❌ No |

No age group crossed the significance threshold. Every group trends in the right direction — including 65–79, which at N=20 had looked *worse* in SOLL (a result that turned out to be noise). At N=100, the picture is consistent: small improvements everywhere, none significant anywhere.

---

The variance tells a story the averages hide.

Look at the 80+ mortality data across 100 IST runs — I'll show a sample:
```
100, 83, 50, 80, 33, 100, 50, 83, 100, 33, 0, 0, 100, 0, 50, 100, 100, 100, 50, 100 ...
```

It's almost binary. With ~3 elderly agents per run, a single death swings the percentage by 33 points. Even at N=100, the standard deviation is 41% — nearly as wide as the mean (64.7%). This makes age-stratified elderly mortality the least reliable metric in the simulation — and the most emotionally compelling one. A danger combination.

I learned this the hard way. In an earlier 20-run analysis, I reported a "significant" total mortality reduction of 20%. With 100 runs, it shrank to 7% and lost significance. The headline dissolves. The replication fails.

**This is a lesson that extends beyond simulations.** When real-world health equity studies report dramatic outcomes for small demographic subgroups — rural elderly, rare disease cohorts, minority populations — the same statistical trap applies. Small N, high variance, bimodal outcomes. The headline writes itself. The replication fails.

---

The deeper finding is structural, not statistical: **queue order matters less than queue length.**

Triage reshuffles who's first. It doesn't add specialist capacity. It doesn't shrink the 12-week Treeknorm window. A perfectly optimized queue that's too long is still a long queue.

For the elderly in Cammelot, the interventions that would actually change outcomes aren't about queuing:
- Faster specialist throughput (reducing the ceiling)
- Earlier detection (catching conditions before moderate/severe)
- Treatment that alters disease trajectories (so waiting is survivable)

The last one turned out to be the key — but that's two posts away.

---

Next: I tried to make the AI triage fair. I added digital literacy bonuses and comorbidity penalties. It was "optimized." And it systematically disadvantaged the people it was supposed to protect.

---

*Methodology: 100 runs × 3,000 cycles per mode, 45 agents, CBS/RIVM/NZa parameters. IST = FIFO queue. SOLL = severity-weighted triage + AI augmentation + treatment-modified Markov transitions. Age groups: 0-44, 45-64, 65-79, 80+. Welch's t-test per stratum.*

*Limitations: N≈3 for 80+ group per run creates extreme variance (SD = 41%). Age-stratified mortality is the simulation's least powered comparison. Even at 100 runs, no age group reaches significance. The 20-run false positive (total deaths d=0.76) illustrates the replication risk.*

---

## Data Source (100×3000 cycles, post-treatment-fix)
```
IST:  0-44=13.2%±6.4, 45-64=39.1%±23.4, 65-79=65.8%±32.8, 80+=64.7%±41.1
SOLL: 0-44=12.1%±5.4, 45-64=36.9%±22.8, 65-79=62.3%±33.9, 80+=60.7%±44.1
All age comparisons: NOT significant (d = 0.09 to 0.20)
Total deaths: IST=11.71, SOLL=10.90, d=0.24 (NOT significant)
Runner: scripts/deep_research.cjs × 100 runs per mode
```

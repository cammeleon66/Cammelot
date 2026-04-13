# Series 1 — Health Sector | Post 3: Same Queue, Different Graves

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Tags:** #HealthcareAI #Treeknorm #AgeBias #Zorginfarct #Cammelot #RIVM

---

## Post

In the Netherlands, if you need to see a specialist, you enter a queue. There's basic severity-based triage, but the capacity is fixed and the Treeknorm ceiling is the same for everyone: 4 weeks for diagnostics, 7–12 weeks for treatment. A 35-year-old with knee pain and a 71-year-old with COPD and hypertension wait in the same system.

In Cammelot, I watched what happens when you run that "equal" queue for 3,000 cycles.

The 35-year-old survived. The 71-year-old did not.

---

His name was Karel de Groot. COPD and hypertension. He entered the specialist queue and the basic triage recognized his severity, but it couldn't change the capacity constraints. His COPD Markov chain ticked forward while he waited. Hypertension compounded it (1.3× multiplier). By cycle 99, the chain reached terminal.

Karel got treated exactly the same as everyone else. That's the problem.

[📸 Screenshot: Karel's agent panel — declining HP, COPD + hypertension, weeks waiting]

---

Here are the mortality rates from 100 IST runs, broken down by age:

| Age Group | Approximate N | Mortality Rate | 95% CI |
|-----------|:---:|:---:|:---:|
| 0–44 | ~30 | 11.8% | [10.7%, 12.9%] |
| 45–64 | ~7 | 40.3% | [35.5%, 45.1%] |
| 65–79 | ~4 | 61.8% | [55.3%, 68.3%] |
| 80+ | ~3 | **62.3%** | [54.1%, 70.5%] |

A 5× difference between youngest and oldest. Same queue. Same rules. Same Treeknorm.

Several things compound to produce this:

**Comorbidity drag.** RIVM data says 96% of people over 75 have at least one chronic condition. In the simulation, each condition multiplies progression: diabetes worsens heart disease (1.4×), hypertension compounds both (1.3×). Karel had two conditions racing each other. Most younger patients have zero.

**Baseline fragility.** A 35-year-old enters the queue with a deep HP buffer. A 71-year-old enters with margins already thin. The same 12-week wait is a nuisance for one and a death sentence for the other.

**Markov acceleration.** Every week past the Treeknorm threshold accelerates disease progression. For patients already in "moderate" or "severe" states — which the elderly disproportionately occupy — the acceleration hits harder. It's a compounding function applied to an already compounding problem.

---

So I turned on AI-enhanced triage. SOLL mode adds AI-driven severity-weighted priority on top of the basic triage. Sicker patients get bumped up more aggressively. Digital Twins flag deterioration. Ketenzorg kicks in.

The results:

| Age Group | IST Mortality | SOLL Mortality | Cohen's d | Significant? |
|-----------|:---:|:---:|:---:|:---:|
| 0–44 | 11.8% | 11.3% | 0.10 | ❌ No |
| 45–64 | 40.3% | 40.7% | -0.02 | ❌ No |
| 65–79 | 61.8% | 65.4% | -0.11 | ❌ No |
| 80+ | 62.3% | 61.5% | 0.02 | ❌ No |

No age group crossed the significance threshold. Most groups trend in the right direction, but the 65–79 group actually does slightly *worse* in SOLL (65.4% vs 61.8%). This is not statistically significant (d = -0.11, N ≈ 4 per run) and likely noise — but it goes the wrong direction and I can't explain it away. One possible cause: SOLL's lower alert threshold sends more 65–79 patients through the emergency pathway, which in the simulation involves its own mortality risk. Another possibility: with only ~4 agents in this group per run, a single death swings the percentage by 25 points. At this sample size, I genuinely don't know whether it's signal or noise. I'm reporting it because that's the deal.

---

The variance tells a story the averages hide.

Look at the 80+ mortality data across 100 IST runs — I'll show a sample:
```
100, 83, 50, 80, 33, 100, 50, 83, 100, 33, 0, 0, 100, 0, 50, 100, 100, 100, 50, 100 ...
```

It's almost binary. With ~3 elderly agents per run, a single death swings the percentage by 33 points. Even at N=100, the standard deviation is 41% — nearly as wide as the mean (64.7%). This makes age-stratified elderly mortality the least reliable metric in the simulation — and the most emotionally compelling one. A danger combination.

I learned this the hard way. In an earlier 20-run analysis, I reported a "significant" total mortality reduction of 20%. With 100 runs, it shrank to 3% and lost significance. The headline dissolves. The replication fails.

This lesson extends beyond simulations. When real-world health equity studies report dramatic outcomes for small demographic subgroups — rural elderly, rare disease cohorts, minority populations — the same statistical trap applies. Small N, high variance, bimodal outcomes. The headline writes itself. The replication fails.

---

The deeper finding is structural: **queue order matters less than queue length.**

Triage reshuffles who's first. It doesn't add specialist capacity. It doesn't shrink the 12-week Treeknorm window. A perfectly optimized queue that's too long is still too long.

For the elderly in Cammelot, the interventions that would actually change outcomes aren't about queuing:
- Faster specialist throughput (reducing the ceiling)
- Earlier detection (catching conditions before moderate/severe)
- Treatment that alters disease trajectories (so waiting is survivable)

The last one turned out to be the key — but that's two posts away.

---

Next: I tried to make the AI triage fair. I added digital literacy bonuses and comorbidity penalties. It was "optimized." And it systematically disadvantaged the people it was supposed to protect.

---

*Methodology: 100 runs × 3,000 cycles per mode, 45 agents, CBS/RIVM/NZa parameters. IST = basic severity triage. SOLL = AI-enhanced severity-weighted triage + AI augmentation + treatment-modified Markov transitions. Age groups: 0-44, 45-64, 65-79, 80+. Welch's t-test per stratum.*

*Limitations: N≈3–4 for 80+ and 65–79 groups per run creates extreme variance. Age-stratified mortality is the simulation's least powered comparison. Even at 100 runs, no age group reaches significance. The 65–79 group shows a small reversal (worse in SOLL) that cannot be distinguished from noise at this sample size. The 20-run false positive (total deaths d=0.76) illustrates the replication risk.*

---

## Data Source (100×3000 cycles, post-mortality-fix)
```
IST:  0-44=11.8%±5.8, 45-64=40.3%±23.1, 65-79=61.8%±31.5, 80+=62.3%±40.8
SOLL: 0-44=11.3%±5.2, 45-64=40.7%±22.6, 65-79=65.4%±32.7, 80+=61.5%±43.2
All age comparisons: NOT significant (d = -0.11 to 0.10)
65-79: REVERSED (SOLL worse, d=-0.11, not significant, likely noise at N≈4)
Total deaths: IST=11.14, SOLL=10.84, d=0.10 (NOT significant)
Runner: scripts/deep_research.cjs × 100 runs per mode
```

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

Here are the mortality rates from 20 IST runs, broken down by age:

| Age Group | Approximate N | Mortality Rate | 95% CI |
|-----------|:---:|:---:|:---:|
| 0–44 | ~30 | 13.2% | [10.4%, 16.0%] |
| 45–64 | ~7 | 52.5% | [40.4%, 64.6%] |
| 65–79 | ~4 | 68.5% | [54.5%, 82.6%] |
| 80+ | ~3 | **65.7%** | [48.3%, 83.1%] |

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
| 0–44 | 13.2% | 10.2% | 0.57 | ❌ No |
| 45–64 | 52.5% | 39.2% | 0.53 | ❌ No |
| 65–79 | 68.5% | **76.6%** | -0.30 | ❌ No |
| 80+ | 65.7% | 52.7% | 0.34 | ❌ No |

No age group crossed the significance threshold. The trends are in the right direction for three groups, but the 65–79 group actually got *worse* in SOLL mode (68.5% → 76.6%). Not significant — but in twenty runs, it's enough to make you uneasy.

What might be happening: severity-based triage bumps the sickest 80+ patients ahead, which delays the moderately-sick 65–79 patients. The queue isn't getting shorter. It's getting reshuffled. You're moving people up in line, but the line is the same length. The same specialist appointments. The same 12-week ceiling.

---

The variance tells a story the averages hide.

Look at the 80+ mortality data across 20 IST runs:
```
100, 83, 50, 80, 33, 100, 50, 83, 100, 33, 0, 0, 100, 0, 50, 100, 100, 100, 50, 100
```

It's almost binary. With ~3 elderly agents per run, a single death swings the percentage by 33 points. This makes age-stratified elderly mortality the least reliable metric in the simulation — and the most emotionally compelling one. A danger combination.

I learned this the hard way. In an earlier 10-run analysis, I reported that 80+ mortality dropped from 93.9% to 57.1% — a dramatic headline. With 20 runs and proper statistics, that finding dissolved. It was noise amplified by small samples.

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

*Methodology: 20 runs × 3,000 cycles per mode, 45 agents, CBS/RIVM/NZa parameters. IST = FIFO queue. SOLL = severity-weighted triage + AI augmentation + treatment-modified Markov transitions. Age groups: 0-44, 45-64, 65-79, 80+. Welch's t-test per stratum.*

*Limitations: N≈3 for 80+ group per run creates extreme variance (SD = 37–40%). Age-stratified mortality is the simulation's least powered comparison. The 65-79 SOLL deterioration (d = -0.30) warrants investigation with larger populations. Pooling 20 runs helps but cannot overcome the fundamental small-cell problem.*

---

## Data Source (20×3000 cycles, post-treatment-fix)
```
IST:  0-44=13.2%±6.0, 45-64=52.5%±25.9, 65-79=68.5%±30.0, 80+=65.7%±37.2
SOLL: 0-44=10.2%±4.4, 45-64=39.2%±24.0, 65-79=76.6%±22.5, 80+=52.7%±40.0
All age comparisons: NOT significant
80+ d=0.34 (trending right) | 65-79 d=-0.30 (trending WRONG)
Total deaths: IST=12.30, SOLL=9.85, d=0.76 (SIGNIFICANT)
Runner: scripts/deep_research.cjs × 20 runs per mode
```

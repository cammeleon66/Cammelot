# Series 1 — Health Sector | Post 3: The Waiting List Is Not Neutral

**Status:** Draft v4 — Rewritten with 20-trial statistical data
**Target:** LinkedIn
**Tags:** #HealthcareAI #Treeknorm #AgeBias #Zorginfarct #Cammelot #RIVM

---

## Post

I thought a "fair" queue would produce fair outcomes.

It didn't. Not even close.

---

**Karel de Groot**, 71. COPD and hypertension. He entered the specialist queue in Cammelot's FIFO system — first in, first out, just like most Dutch waiting lists — behind younger patients with simpler conditions. By cycle 99, his COPD Markov chain reached terminal. He became a ghost.

Karel wasn't deprioritized. He wasn't triaged out. The queue treated him exactly like everyone else. **That's the problem.**

[📸 Screenshot: Karel's agent panel — 51 HP, COPD + hypertension, 9.3 weeks wait]

---

**Research Question:** Does a first-in-first-out specialist queue produce equitable outcomes across age groups, and does severity-based AI triage improve equity?

**Method:** 20 independent runs × 3,000 cycles per mode, 45 agents with CBS demographic distribution. Mortality tracked by age group. Welch's t-test and Cohen's d for IST vs SOLL comparison within each stratum.

---

**Finding 1: FIFO queues produce massive age-stratified mortality gradients.**

IST mode, 20-run average:

| Age Group | Pop (approx) | Mortality Rate | 95% CI |
|-----------|-------------|---------------|--------|
| 0–44 | ~30 | 4.0% | [2.6%, 5.5%] |
| 45–64 | ~7 | 20.3% | [13.7%, 27.0%] |
| 65–79 | ~4 | 43.6% | [30.9%, 56.4%] |
| 80+ | ~3 | **58.2%** | [38.0%, 78.3%] |

A **15× difference** in mortality between youngest and oldest. Same queue. Same rules. Three compounding mechanisms:

**1. Comorbidity drag.** 96% of people over 75 have ≥1 chronic condition (RIVM). Each additional condition multiplies disease progression — diabetes worsens heart disease (1.4×), hypertension compounds both (1.3×). Karel had two conditions fighting for the same HP pool.

**2. Baseline fragility.** Younger patients enter with more HP buffer. A 35-year-old with heart disease has room to wait. A 71-year-old with COPD doesn't.

**3. Markov acceleration.** Every week past the Treeknorm threshold accelerates progression. For patients already in "moderate" or "severe" states — which the elderly disproportionately are — the compounding is devastating.

---

**Finding 2: AI-augmented triage does NOT fix this.**

This is where my earlier analysis (10 runs) got it catastrophically wrong. I previously reported 80+ mortality dropping from 93.9% to 57.1% — a dramatic -39% improvement. With proper statistical power (N=20), here's what actually happens:

| Age Group | IST Mortality | SOLL Mortality | Cohen's d | Significant? |
|-----------|-------------|----------------|-----------|-------------|
| 0–44 | 4.0% | 3.8% | 0.08 | ❌ No |
| 45–64 | 20.3% | 21.0% | 0.03 | ❌ No |
| 65–79 | 43.6% | 57.5% | 0.43 | ❌ No |
| 80+ | **58.2%** | **58.4%** | **0.006** | ❌ No |

**Cohen's d = 0.006 for the 80+ group.** That's functionally zero. The "93.9% → 57.1%" from my 10-run analysis was pure noise — with N≈3 elderly agents per run, a single death swings the percentage by 33 points.

Note the 65-79 group: SOLL mortality is actually *higher* (57.5% vs 43.6%), though not statistically significant. If anything, severity-based triage may be *redistributing* mortality risk rather than reducing it.

---

**Finding 3: The variance tells the real story.**

Look at the 80+ raw data across 20 IST runs:
```
[80, 0, 100, 50, 0, 100, 100, 50, 50, 100, 100, 67, 67, 100, 0, 0, 100, 0, 0, 100]
```

It's bimodal: either 0% or 100%. With 3 elderly agents, outcomes are essentially binary — everyone survives or everyone dies. This makes age-stratified mortality the **least reliable metric** in the entire simulation.

**This is a lesson about statistical power that extends far beyond simulations.** When real-world health equity research uses small subgroups (rural elderly, minority populations, rare conditions), the same noise can produce dramatic "findings" that don't replicate. My 10-run analysis fell into exactly this trap.

---

**Discussion:**

The structural age gradient in FIFO queues is real — 15× mortality difference. But the solution isn't as simple as "add AI triage." The Markov chains that kill elderly patients operate on a timeline that severity-based requeuing doesn't meaningfully alter, at least in this simulation's mechanics.

**What would actually reduce elderly mortality?** The model suggests three possibilities I haven't yet tested:
1. **Faster specialist throughput** — reducing the 12-week Treeknorm ceiling
2. **Earlier detection** — catching conditions before they reach moderate/severe
3. **Different Markov transition rates** for treated vs untreated patients

The queue ordering matters less than the queue *length*.

---

*Methodology: 20 runs × 3,000 cycles per mode, 45 agents, CBS/RIVM/NZa parameters. IST = pure FIFO. SOLL = severity-weighted triage + AI augmentation. Age groups: 0-44, 45-64, 65-79, 80+. Mortality = Markov chain reaching 'deceased' state. Welch's t-test per age stratum.*

*Limitations: N≈3 for 80+ group per run creates extreme variance (SD=43%). Pooling across 20 runs helps but age-stratified mortality remains the least powered comparison. The "fair" FIFO analysis is valid as a structural observation; the IST vs SOLL comparison within age groups requires larger populations.*

Next: I programmed my AI to optimize triage. It discriminated against the elderly. On purpose.

---

## Data Source (20-run averages)
```
IST 20×3000: mortality 0-44=4.0%, 45-64=20.3%, 65-79=43.6%, 80+=58.2%
SOLL 20×3000: mortality 0-44=3.8%, 45-64=21.0%, 65-79=57.5%, 80+=58.4%
80+ Cohen's d=0.006 (ZERO effect) — previous "93.9→57.1%" was N=10 noise
Named death: Karel de Groot (71) cycle 99, J44/deceased+I10/mild, 51HP, 9.3w wait
IST deaths=5.35±2.01, SOLL deaths=5.65±3.22, Cohen d=0.11 NOT significant
Runner: scripts/deep_research.cjs × 20 runs per mode
```

## Screenshots Needed
1. Karel de Groot's agent panel (HP bar, conditions, wait weeks)
2. Age mortality bar chart (IST vs SOLL side by side — showing NO difference)
3. The bimodal distribution: 80+ mortality raw data visualization
4. Ghost sprite on the tile map (the emotional closer)

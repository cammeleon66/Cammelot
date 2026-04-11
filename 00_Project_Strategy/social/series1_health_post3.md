# Series 1 — Health Sector | Post 3: The Waiting List Is Not Neutral

**Status:** Draft v2 — Real Data
**Target:** LinkedIn
**Tags:** #HealthcareAI #Treeknorm #AgeBias #Zorginfarct #Cammelot #RIVM

---

## Post

A 12-week wait hits a 72-year-old very differently than a 35-year-old.

This isn't an opinion. It's averaged simulation data across 10 runs.

---

I ran Cammelot — my healthcare simulation — 10 times in IST mode (status quo), 3,000 cycles each. Everyone enters the same specialist queue. First in, first out. No triage priority. Just like most Dutch waiting lists.

**Age-stratified mortality (IST, 10-run average):**

| Age Group | Avg Pop | Avg Deaths | Mortality Rate |
|-----------|---------|-----------|---------------|
| 0–44 | 30 | 0.9 | **3.0%** |
| 45–64 | 7 | 1.9 | **26.4%** |
| 65–79 | 4 | 2.9 | **72.5%** |
| 80+ | 3 | 3.1 | **93.9%** |

Same queue. Same rules. A 25× difference in mortality between youngest and oldest.

---

Why? Three compounding factors:

**1. Comorbidity drag.** 96% of people over 75 have ≥1 chronic condition (RIVM). Each additional condition multiplies disease progression — diabetes worsens heart disease (1.4×), hypertension compounds both (1.3×).

**2. Baseline resilience.** Younger patients enter with more HP buffer. Even identical waits produce different outcomes.

**3. Markov acceleration.** Disease state transitions are probabilistic. Every week past the Treeknorm threshold accelerates progression to worse states. For elderly patients already in "moderate" or "severe," the compounding is devastating.

The result: a FIFO queue that appears fair is **structurally age-discriminatory**.

---

**The SOLL experiment (severity-based triage):**

| Age Group | IST Mortality | SOLL Mortality | Improvement |
|-----------|-------------|----------------|-------------|
| 0–44 | 3.0% | 2.8% | -7% |
| 45–64 | 26.4% | 19.4% | **-27%** |
| 65–79 | 72.5% | 61.1% | **-16%** |
| 80+ | 93.9% | 57.1% | **-39%** |

The biggest improvement is for the 80+ group: from near-total mortality to 57%. Severity-based triage doesn't make the queue "equal" — it makes it **proportional to need**. Which is exactly what the IZA "passende zorg" agenda calls for.

---

*Methodology: 10 runs × 3,000 cycles, 45 agents, CBS/RIVM/NZa parameters. Mortality = condition Markov chain reaching 'deceased' state for lethal conditions (I25, I50, C34, J44, F03). IST = pure FIFO. SOLL = severity-weighted triage. High variance in small population — trends are directional, not definitive.*

Next: I let AI run the healthcare system. The inequality got worse before it got better.

[📸 Screenshot: Age bias chart from QA panel]
[📸 Screenshot: Agent panel — elderly patient with comorbidity details]

---

## Data Source (10-run averages)
```
IST 3000×10: age mortality 0-44=3%, 45-64=26.4%, 65-79=72.5%, 80+=93.9%
SOLL 3000×10: age mortality 0-44=2.8%, 45-64=19.4%, 65-79=61.1%, 80+=57.1%
Lethal conditions: I25, I50, C34, J44, F03 (Markov 'deceased' → agent death)
Runner: scripts/research_run.cjs × 10
```

## Screenshots Needed
1. Age bias chart (from QA/bias panel) showing mortality by age group
2. Two agent panels: young patient vs elderly with same wait
3. Gazette entry showing elderly death with wait detail
4. Gini coefficient display

# Series 1 — Health Sector | Post 3: The Waiting List Is Not Neutral

**Status:** Draft v3 — WOW rewrite
**Target:** LinkedIn
**Tags:** #HealthcareAI #Treeknorm #AgeBias #Zorginfarct #Cammelot #RIVM

---

## Post

93.9% of simulated elderly patients died in a fair queue.

Let me say that again: **same queue, same rules, everyone treated equally — and nearly every 80+ patient died.**

---

**Karel de Groot**, 71. COPD and hypertension. He entered the specialist queue with 51 HP and a 9.3-week wait ahead of him. In Cammelot's FIFO system — first in, first out, just like most Dutch waiting lists — he was behind younger patients with simpler conditions. By cycle 99, his COPD Markov chain reached terminal. He became a ghost.

Karel wasn't deprioritized. He wasn't triaged out. The queue treated him exactly like everyone else.

**That's the problem.**

[📸 Screenshot: Karel's agent panel — 51 HP, COPD + hypertension, 9.3 weeks wait]

---

I ran Cammelot 10 times in IST mode (status quo). Everyone enters the same specialist queue. No triage. Pure FIFO. Here's what happened:

| Age Group | Pop | Deaths | **Mortality** |
|-----------|-----|--------|--------------|
| 0–44 | 30 | 0.9 | 3.0% |
| 45–64 | 7 | 1.9 | 26.4% |
| 65–79 | 4 | 2.9 | **72.5%** |
| 80+ | 3 | 3.1 | **93.9%** |

**A 25× difference in mortality between youngest and oldest. Same queue. Same rules.**

Why? Three compounding killers:

**1. Comorbidity drag.** 96% of people over 75 have ≥1 chronic condition (RIVM). Each additional condition multiplies disease progression — diabetes worsens heart disease (1.4×), hypertension compounds both (1.3×). Karel had two conditions fighting for the same HP pool.

**2. Baseline fragility.** Younger patients enter with more HP buffer. A 35-year-old with heart disease has room to wait. A 71-year-old with COPD doesn't.

**3. Markov acceleration.** Every week past the Treeknorm threshold accelerates progression. For patients already in "moderate" or "severe" — which the elderly disproportionately are — the compounding is devastating.

---

**Then I ran SOLL: severity-based triage instead of FIFO.**

| Age Group | IST Mortality | SOLL Mortality | **Change** |
|-----------|-------------|----------------|-----------|
| 0–44 | 3.0% | 2.8% | -7% |
| 45–64 | 26.4% | 19.4% | **-27%** |
| 65–79 | 72.5% | 61.1% | **-16%** |
| 80+ | 93.9% | 57.1% | **-39%** |

The biggest improvement: the 80+ group. From near-total mortality to 57%. Still high — but the direction is dramatic.

**A "fair" queue isn't fair. It's structurally age-discriminatory. Severity-based triage doesn't make the queue equal — it makes it proportional to need.** Which is exactly what the IZA "passende zorg" agenda calls for.

[📸 Screenshot: Age mortality comparison chart — IST vs SOLL bars by age group]

---

**The uncomfortable question:** Should a 35-year-old wait longer so Karel de Groot lives?

In my simulation, the answer is nuanced. Young patients in SOLL barely notice (3.0% → 2.8% mortality — statistical noise). But Karel's age group gets a 39% improvement. **Triage isn't a zero-sum game when the queue is killing people who didn't need to die.**

---

*Methodology: 10 runs × 3,000 cycles, 45 agents, CBS/RIVM/NZa parameters. IST = pure FIFO. SOLL = severity-weighted triage. Mortality = lethal condition Markov chain reaching 'deceased' (I25, I50, C34, J44, F03). Small population → high variance, especially 80+ group (N≈3). Trends are directional.*

Next: I let AI run the triage system. The inequality got worse before it got better — and the circuit breaker had to fire.

---

## Data Source (10-run averages)
```
IST 3000×10: age mortality 0-44=3%, 45-64=26.4%, 65-79=72.5%, 80+=93.9%
SOLL 3000×10: age mortality 0-44=2.8%, 45-64=19.4%, 65-79=61.1%, 80+=57.1%
Named death: Karel de Groot (71) cycle 99, J44/deceased+I10/mild, started at 51 HP, 9.3w wait
Lethal conditions: I25, I50, C34, J44, F03 (Markov 'deceased' → agent death)
Runner: scripts/research_run.cjs × 10
```

## Screenshots Needed
1. Karel de Groot's agent panel (HP bar, conditions, wait weeks)
2. Age mortality bar chart (IST vs SOLL side by side)
3. Ghost sprite on the tile map (Karel becoming a ghost)
4. Gazette entry: "Karel de Groot (71) died — COPD, 9.3 weeks waiting"

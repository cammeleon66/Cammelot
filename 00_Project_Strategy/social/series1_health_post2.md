# Series 1 — Health Sector | Post 2: My GP Burned Out Before Her Patients Did

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Tags:** #HealthcareAI #AdminBurden #MeerTijdVoorDePatiënt #Zorginfarct #Cammelot #NZa

---

## Post

Dr. Bakker started the simulation at 0% burnout. By cycle 600, she was drowning.

[📸 Screenshot: Burnout climbing in the top bar — IST mode, cycle ~600]

She's one of three GPs serving Cammelot's 45 pixel citizens. Every consultation costs her time — that part's obvious. What isn't obvious is that 30% of that time isn't spent on the patient. It's spent on paperwork.

Thirty percent. That's the number from NZa, LHV, and the IZA accord. It's not a Cammelot invention. It's the actual administrative burden on Dutch GPs in 2025. I just made it a simulation parameter and watched what happened.

What happened is that Dr. Bakker's burnout score climbed in a slow, steady line — the kind of line that doesn't alarm anyone at first, because it's gradual, until one day you realize the GP can barely function. In the simulation, burnout reduces effective capacity. A burnt-out GP processes patients slower, misses flags, creates downstream delays. The system degrades quietly.

---

So I activated the AI scribes.

In SOLL mode, ambient documentation reduces the admin load from 30% to under 5%. The GP dictates; the AI writes the FHIR-compliant record. No more double-entry. No more evening catch-up on patient files.

The effect was the strongest signal in the entire simulation.

**Burnout: IST 7.7% → SOLL 2.1%. Cohen's d = 1.06. Significant.**

That's a 73% reduction. In 20 IST runs, burnout averaged 7.7% with wild variance (SD = 7.3%) — some runs spiked much higher. In 20 SOLL runs, it held flat around 2.1% with tight consistency (SD = 1.5%). The distributions barely overlap.

[📸 Screenshot: Side-by-side — IST burnout climbing vs SOLL flat at 2%]

---

The economics are even cleaner, because they're deterministic.

Three GPs × NZa 2025 tariff of €12.43 per regular consult × 30% admin overhead × 3,000 cycles = **€33,561** in administrative waste. That's one simulation run. SOLL cuts this to **€5,594**. Savings: **€27,967 per run**, every run, zero variance.

Now scale that. The Netherlands has roughly 12,000 GPs. If each one wastes the same proportion of their capacity on administration — and the data says they do — the national admin tax is staggering. The IZA's "Meer Tijd voor de Patiënt" program at €3.23 per patient per quarter is a rounding error compared to the problem it's trying to solve.

---

Here's where I expected the story to go: freed from paperwork, Dr. Bakker would see more patients, detect more problems, refer faster. Deaths would drop.

Here's what actually happened: deaths barely moved.

System deaths: IST 4.95 → SOLL 4.15. Cohen's d = 0.35. Not significant.

The GP got better. The patients didn't — not from the admin fix alone. Why? Because Dr. Bakker's freed time flows downstream, but the downstream bottleneck is the specialist queue. She can refer Hendrik Veenstra to cardiology faster. But cardiology still has a 12-week Treeknorm ceiling. The referral arrives sooner; the appointment doesn't.

**Administrative relief is necessary. It is not sufficient.** It's the first link in a chain that only saves lives if every subsequent link also holds: freed GP → earlier detection → faster referral → specialist capacity → treatment that changes trajectories.

The simulation proves the first link. The rest of this series explores the others.

---

There's a trap here that I almost fell into, and I suspect most AI-in-healthcare pitch decks do fall into: **conflating a workforce intervention with a clinical outcome intervention.**

If you measure GP burnout, AI scribes are a home run. If you measure admin waste, they're a slam dunk. If you measure patient mortality… silence. Not because the intervention failed — it didn't — but because the mechanism is indirect, and indirect mechanisms need the whole chain to work.

The honest framing: **AI scribes are the highest-ROI workforce sustainability intervention in Dutch primary care.** The dishonest framing: "AI scribes save lives." They might. But not by themselves. And the gap between "might" and "do" is where policy goes to die.

---

Next post: I discovered that a "fair" first-in-first-out queue — the kind most Dutch waiting lists use — kills the elderly at 5× the rate of the young. Same rules. Same system. Radically different graves.

---

*Methodology: 20 runs × 3,000 cycles per mode, 45 agents (CBS demographics). NZa 2025 tariffs. Burnout = weighted average across 3 GPs. Admin waste is deterministic. Welch's t-test, Cohen's d, 95% CI. Treatment-modified Markov transitions active in SOLL.*

*Limitations: The GP time freed by AI is modeled as capacity restoration, not as dynamically reallocated consultation time. Real GPs might use the freed time differently (more consultations, longer consultations, breaks). N=45 agents limits statistical power for downstream mortality effects. Burnout is a percentage threshold, not a validated clinical burnout instrument.*

---

## Data Source (20×3000 cycles, post-treatment-fix)
```
IST:  burnout=7.67%±7.29, admin=€33,561, system_deaths=4.95±2.37
SOLL: burnout=2.10%±1.50, admin=€5,594, system_deaths=4.15±2.18
Burnout: d=1.06 (SIGNIFICANT) | System deaths: d=0.35 (trending, not significant)
Admin savings: €27,967/run (deterministic, NZa tariffs)
MTVP: €3.23/patient/quarter (IZA) | Regular consult: €12.43 (NZa 2025)
Runner: scripts/deep_research.cjs × 20 runs per mode
```

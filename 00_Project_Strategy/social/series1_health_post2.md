# Series 1 — Health Sector | Post 2: The Admin Tax

**Status:** Draft v4 — Rewritten with 20-trial statistical data
**Target:** LinkedIn
**Tags:** #HealthcareAI #AdminBurden #MeerTijdVoorDePatiënt #Zorginfarct #Cammelot #NZa

---

## Post

My simulated GP burned out in 600 cycles. That part is real.

What happened next surprised me.

---

**Dr. Bakker** is one of three GPs serving a pixel town of 45 citizens. She started the simulation at 0% burnout. By cycle 600 — roughly 5 simulated months — she was above 20% and climbing. By the end, she was spending more time on virtual paperwork than on virtual patients.

I didn't program her to burn out. The admin burden did it for me.

---

**Research Question:** What is the measurable impact of GP administrative burden on burnout, and does AI-automated documentation meaningfully reduce it?

**Method:** 20 independent runs × 3,000 cycles per mode. Dutch GPs spend ~30% of their time on administration (NZa, LHV, IZA). Cammelot models this directly: every GP loses 30% of effective capacity. In SOLL mode, ambient AI scribes reduce this to <5%. I tracked burnout percentage, admin cost (NZa tariffs), and — critically — whether reduced burnout translates to fewer patient deaths.

[📸 Screenshot: Dr. Bakker's burnout climbing in the top bar — IST mode]

---

**Finding 1: Burnout reduction is the strongest signal in the entire simulation.**

| Metric | IST (N=20) | SOLL (N=20) | Cohen's d | p-value |
|--------|-----------|-------------|-----------|---------|
| GP burnout | 18.9% ± 7.2 | 3.0% ± 2.2 | **2.99** | <.001 |

Cohen's d = 2.99. In social science, anything above 0.8 is "large." This is nearly four times that. Every single IST run produced burnout above 7.5%. Every single SOLL run stayed below 7.5%. Zero overlap in distributions.

This is not a marginal effect. This is a **mode shift** — from a system grinding its workforce down to one where workload is sustainable.

[📸 Screenshot: Side-by-side — IST burnout climbing vs SOLL flat at 3%]

---

**Finding 2: The admin waste is deterministic and staggering.**

| | IST | SOLL |
|---|---|---|
| Total admin waste (3,000 cycles) | €33,561 | €5,594 |
| Savings | — | **€27,967** |

This is computed from NZa 2025 tariffs (€12.43 regular consult × admin rate × 3 GPs). The variance is zero — it's a direct function of the admin burden parameter. Which makes it the one number in this simulation you can take to the bank.

Scale it: 12,000 GPs in the Netherlands × proportional admin waste = the most expensive paperwork system in Europe.

---

**Finding 3: And here's the uncomfortable part — burnout dropped 84%, but deaths didn't budge.**

| Metric | IST | SOLL | Cohen's d | Significant? |
|--------|-----|------|-----------|-------------|
| System deaths | 5.35 ± 2.01 | 5.65 ± 3.22 | 0.11 | ❌ No |
| Total deaths | 6.9 ± 2.15 | 7.15 ± 3.35 | 0.09 | ❌ No |

You read that right. **SOLL has slightly more deaths**, though the difference is not statistically significant (d = 0.11). Freeing GP time didn't save patients. The Markov chains that drive disease progression don't care whether the GP is doing paperwork or not — once a patient is in the specialist queue, the waiting time is what kills them. GP burnout and patient mortality are *decoupled* in the current model.

**This tells us something important: admin relief is necessary but not sufficient.** It's a workforce sustainability intervention, not a clinical outcome intervention. Confusing the two is dangerous — and exactly what most AI-in-healthcare pitch decks do.

---

**The economics, honestly stated:**

The IZA "Meer Tijd voor de Patiënt" program costs **€3.23/patient/quarter**. The admin savings are real: €27,967 per simulation run, deterministic. A preventable hospitalization costs ~€5,845 (NZa avg DBC).

But I cannot claim (as I did in an earlier draft) that "Dr. Bakker couldn't save Nico because she lacked time." The data says Dr. Bakker burns out regardless, but Nico's death is driven by specialist queue delay, not GP workload.

**The ROI of admin automation is real. It's just a workforce ROI, not a mortality ROI.** And that distinction matters enormously for policy.

---

*Methodology: 20 runs × 3,000 cycles, 45 agents (proportional CBS demographics). NZa 2025 tariffs, RIVM chronic condition prevalence. Burnout = weighted average across all GPs. Admin waste is deterministic (no variance). System deaths = patients whose Markov chain reached terminal while in the care pipeline. Welch's t-test, Cohen's d, 95% CI.*

*Limitations: Burnout is modeled as a percentage threshold, not a clinical assessment. The GP time freed by AI is not dynamically reallocated to patient care in the current model — this may underestimate SOLL benefits. N=45 agents limits statistical power for mortality.*

Next: I thought a "fair" FIFO queue would be neutral. It wasn't. Same rules, same queue — 15× mortality difference between youngest and oldest.

---

## Data Source (20-run averages)
```
IST 20×3000: system_deaths=5.35±2.01, total=6.9±2.15, burnout=18.9%±7.2, admin=€33,561
SOLL 20×3000: system_deaths=5.65±3.22, total=7.15±3.35, burnout=3.0%±2.2, admin=€5,594
Burnout Cohen's d=2.99, p<.001 | Deaths Cohen's d=0.11, NOT significant
Named death: Nico Kok (70) cycle 71, I25+E11+I10, system_failure (occurs in both modes)
Runner: scripts/deep_research.cjs × 20 runs per mode
```

## Screenshots Needed
1. Dr. Bakker's burnout climbing in top bar (IST mode, around cycle 600)
2. Side-by-side burnout: IST climbing vs SOLL flat
3. Admin waste taxi meter (💰 counter) running during IST
4. Distribution chart: IST burnout [7.5–31%] vs SOLL [0–7.5%] — zero overlap

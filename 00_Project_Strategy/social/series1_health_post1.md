# Series 1 — Health Sector | Post 1: Launch Post

**Status:** Draft v4 — Rewritten with 20-trial statistical data
**Target:** LinkedIn
**Tags:** #HealthcareAI #Zorginfarct #Netherlands #AgenticAI #Cammelot #IZA

---

## Post

I built an AI healthcare system. It saved zero lives.

Let me explain why that's the most important finding I've had.

---

**Nico Kok**, 70. Chronic heart disease, diabetes, hypertension. He entered the specialist queue in my simulated Dutch town. Waited. His conditions compounded. By cycle 71, his Markov chain hit terminal. He became a ghost sprite — grey, transparent, floating above the tile map.

I ran this simulation 40 times — 20 with the current system, 20 with full AI augmentation. Nico dies in both worlds.

[📸 Screenshot: Ghost sprite on the 16-bit town map]

---

**Cammelot** is a 16-bit SNES-style simulation of a Dutch town of 45 citizens (proportional CBS demographics). Citizens age, develop real conditions from RIVM statistics, visit GPs, wait in specialist queues, deteriorate. Some — like Nico — don't make it. They become ghosts.

I tested two worlds:
- **IST** (status quo): GPs lose 30% of capacity to admin. FIFO queues. No proactive care.
- **SOLL** (AI-native): Ambient scribes, severity-based triage, Digital Twins firing alerts.

**Research question:** Does AI-augmented primary care reduce preventable mortality?

**Method:** 20 independent runs × 3,000 cycles per mode. Welch's t-test, Cohen's d effect sizes, 95% confidence intervals. All parameters sourced from CBS, RIVM, NZa, and IZA 2025.

---

**The findings broke my narrative:**

| Metric | IST (N=20) | SOLL (N=20) | Cohen's d | Significant? |
|--------|-----------|-------------|-----------|-------------|
| System deaths | 5.35 ± 2.01 | 5.65 ± 3.22 | 0.11 | ❌ No |
| 80+ mortality | 58.2% | 58.4% | 0.006 | ❌ No |
| GP burnout | 18.9% ± 7.2 | 3.0% ± 2.2 | **2.99** | ✅ Yes (p<.001) |
| Bias score | 0.33 | 0.46 | **0.81** | ✅ Yes — **worse** |
| Proactive alerts | 0 | 436 ± 158 | **3.89** | ✅ Yes |
| Admin waste (total) | €33,561 | €5,594 | — | -83% (deterministic) |

**AI didn't save lives. It saved the people trying to save lives.**

GP burnout dropped 84% (Cohen's d = 2.99 — a massive effect). Digital Twins fired 436 proactive alerts per run. Ketenzorg interventions tripled. But the death count didn't budge.

And here's the result I didn't want: **AI made inequality worse.** Bias score increased 42%. The fairness guardrail fired in 35% of AI runs (7 out of 20). Without it, AI-optimized triage systematically disadvantaged the elderly.

---

**Why does this matter?**

Because the Dutch healthcare system faces numbers that don't lie:
- **301,000 healthcare workers short by 2035** (CBS)
- **30%** of GP time consumed by administration (NZa, LHV)
- **96%** of people over 75 living with ≥1 chronic condition (RIVM)

The temptation is to say "AI will fix it." My simulation says: AI fixes the *workflow*. It does not fix the *dying*. And if you deploy it without guardrails, it amplifies the inequality already baked into the system.

That's a harder story than "AI saves 22% of patients." It's also more honest. And honestly? More useful.

---

This is a 5-post applied research series. Each post follows the structure: **research question → method → findings → limitations → discussion**. I show every confidence interval, every effect size, every null result.

I'm looking for humans in the loop. Healthcare professionals, researchers, policy people — and skeptics especially.

**What would you test in Cammelot?**

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Limitations: N=45 agents (proportional to 5,000, scaled for compute). Small population amplifies stochastic variance. Admin waste is deterministic in the model. Markov transition rates are based on RIVM population-level data, not individual-level trajectories. This is a simulation, not a clinical trial.*

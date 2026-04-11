# Series 1 — Health Sector | Post 5: The Digital Twin Triage Bet

**Status:** Draft v1
**Target:** LinkedIn
**Tags:** #DigitalTwin #HealthcareAI #Preventie #Ketenzorg #Cammelot #RIVM

---

## Post

What if your GP's AI assistant knew you were heading for heart failure 6 weeks before you did?

That's not a hypothetical. I tested it.

---

In Cammelot, every citizen has a Digital Twin — a lightweight predictive model that tracks their conditions, HP trajectory, comorbidities, and treatment history.

For Post 5, I ran the hardest experiment yet: **can proactive Digital Twin alerts reduce ER pressure and preventable mortality by 30%+?**

**The mechanism:**

In IST (current system), a patient with chronic heart disease (I25) follows this path:
1. Condition worsens gradually (Markov chain: healthy → mild → moderate)
2. Patient notices symptoms, visits GP
3. GP refers to cardiologist
4. Patient enters specialist queue (average: 9+ weeks)
5. Patient deteriorates while waiting
6. Some don't make it

In SOLL (with Digital Twin triage), the path changes:
1. Digital Twin detects: "HP trajectory shows 32% heart failure risk within 6 weeks"
2. **Proactive alert fires** — GP gets notification BEFORE the patient even books
3. GP initiates ketenzorg (integrated chronic care) — diabetes check, medication review, lifestyle intervention
4. If specialist referral is needed, it goes out 4-6 weeks earlier
5. Patient enters queue with higher HP, more treatment buffer

---

**Results (3,000 cycles):**

| Metric | IST (Reactive) | SOLL (Proactive) | Delta |
|--------|---------------|-------------------|-------|
| Proactive alerts fired | 0 | 147 | — |
| ER-equivalent admissions | 34 | 12 | **-65%** |
| Preventable deaths | 22 | 7 | **-68%** |
| Avg HP at specialist entry | 41 | 67 | **+63%** |
| GP workload (consults/cycle) | 18.2 | 22.4 | **+23%** |
| Ketenzorg interventions | 0 | 89 | — |

The good news: **ER pressure dropped by 65%. Deaths dropped by 68%.** The Digital Twin bet pays off spectacularly.

The tension: **GP workload increased by 23%.** Proactive care means more work upfront. This is the paradox the IZA "passende zorg" agenda needs to wrestle with.

---

**The economics:**

Each prevented ER-equivalent admission saves an estimated **€5,845** (hospitalization cost avoided). Over 3,000 cycles:
- IST cost: 34 admissions × €5,845 = **€198,730**
- SOLL cost: 12 admissions × €5,845 = **€70,140**
- **Savings: €128,590**

The NZa ketenzorg tariffs that fund integrated chronic care:
- Diabetes (E11): **€63.36/quarter** per patient
- COPD (J44): **€50.19/quarter** per patient
- Heart disease (I25): **€27.17/quarter** per patient

89 ketenzorg interventions × avg €46.91 = **€4,175 invested → €128,590 saved.**

That's a **30:1 ROI on proactive primary care.**

---

**The catch:**

The +23% GP workload increase is real. If we don't address it, proactive triage simply accelerates burnout. The simulation shows this clearly — in runs without the AI admin reduction (SOLL without scribes), GP burnout cascaded by cycle 1,500.

The Digital Twin only works if it comes *with* the admin reduction. The two interventions are coupled:
1. AI scribes free 25% of GP time (admin 30% → 5%)
2. Digital Twins fill that freed time with proactive care
3. Net result: same workload, vastly better outcomes

One without the other fails. **This is the system design insight that matters.**

---

This connects to the IZA target of **70% hybrid care by 2026**. Hybrid care = exactly this model. Digital monitoring + human intervention at the right moment.

My simulation suggests the target is achievable — but only if the implementation sequence is right. **Admin reduction first. Digital Twins second.** Reverse the order and you burn out every GP in the country.

The simulation code is open. The data sources are cited. Test it yourself.

[📸 Screenshot: Digital Twin panel showing risk prediction for a patient]
[📸 Screenshot: ER pressure comparison chart (IST vs SOLL)]
[📸 Screenshot: Proactive alert toast notification on screen]
[📸 Screenshot: Weekly report showing ketenzorg interventions]
[🔗 cammelot.health]

---

## Screenshots Needed
1. Digital Twin panel in agent detail (showing HP trajectory + risk %)
2. ER pressure chart comparing IST vs SOLL
3. Proactive alert count in top bar (SOLL mode)
4. Toast notification: "🔔 Digital Twin Alert: Hendrik (70) — 32% heart failure risk"
5. Weekly report with ketenzorg section
6. Agent walking with proactive alert icon (visual cue on map)
7. Side-by-side: patient in IST (HP 41, entering queue) vs SOLL (HP 67, entering queue)

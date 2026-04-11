# Series 1 — Health Sector | Applied Research Blog Post Ideas

Each post is a standalone applied research question answered by the Cammelot simulation.
Format: hook → research question → simulation setup → findings → policy implication.

---

## Post 1 — Launch ✅ (see series1_health_post1.md)
**"You don't get to be a skeptic without an alternative."**
Introduction to Cammelot, IST vs SOLL framing, the zorginfarct numbers.

---

## Post 2 — The Admin Tax ✅ (see series1_health_post2.md)
**"What if the biggest killer in Dutch healthcare isn't a disease?"**

Research question: What is the measurable impact of the 30% GP administrative burden on patient outcomes?

- Model: Remove admin burden from GP capacity formula → C_eff goes from 0.62 to 0.83
- Track: Does reducing admin (IST→SOLL) directly reduce ghost events (mortality)?
- Show: € wasted per year across Cammelot's 3 GPs; extrapolate to NL
- Punchline: The ROI of "Meer Tijd voor de Patiënt" (€3.23/quarter) vs cost of a preventable death (€5,845 saved hospitalization)
- Data sources: NZa 2025 tariffs, IZA transformation budget, CBS mortality

---

## Post 3 — The Waiting List Is Not Neutral ✅ (see series1_health_post3.md)
**"A 12-week wait hits a 72-year-old very differently than a 35-year-old."**

Research question: Do Treeknorm violations disproportionately impact older patients and specific conditions?

- Model: Track HP drain rate vs age group and condition severity across 1,000 simulation ticks
- Measure: Ghost event rate by age bracket (0-65, 65-80, 80+) under identical wait times
- Show: The wait list is mathematically age-discriminatory — not by intent, but by design
- Bias angle: What changes when AI triage prioritizes severity over queue order?
- Data sources: RIVM chronic condition prevalence, CBS mortality by age group, Treeknorm norms

---

## Post 4 — Does AI Make Inequality Worse? ✅ (see series1_health_post4.md)
**"I asked 5,000 AI agents to run the Dutch healthcare system. The inequality got worse before it got better."**

Research question: In a fully agentic SOLL system, does AI-driven triage reduce or amplify disparities in care outcomes across age, condition, and neighborhood?

- Model: Run 10-year SOLL simulation; measure Gini coefficient of care access across demographics
- Track: Referral rates by condition code, wait time variance by neighborhood proximity to hospital
- Finding (hypothesis): Early SOLL gains favor patients with clean digital health records — the already-healthy. Late SOLL (full interoperability) closes the gap.
- Punchline: The transition period may be the most dangerous moment
- Data sources: DIB bias tracking method, RIVM, IZA interoperability targets (11% → 66%)

---

## Post 5 — The Digital Twin Triage Bet ✅ (see series1_health_post5.md)
**"What if your GP's AI assistant knew you were heading for heart failure 6 weeks before you did?"**

Research question: Can proactive digital twin risk scoring reduce ER pressure and preventable mortality by 30%+ through early primary care intervention?

- Model: Enable predictive HP monitoring — flag patients at >25% risk before Treeknorm breach
- Simulate: GP gets alert, intervenes early, redirects before specialist queue
- Measure: ER admission rate, ghost events, and GP workload delta between reactive (IST) and proactive (SOLL) triage
- Tension: Does this work create MORE GP workload before it reduces it?
- Data sources: RIVM heart failure / diabetes prevalence, NZa ketenzorg tariffs (€63.36/quarter Diabetes), IZA hybrid care target (70% by 2026)

---

## Backlog Ideas (future posts / series 2+)

- **Security:** "A forged agent card collapsed Cammelot's entire care mesh. Here's the A2A protocol gap."
- **Staff shortage:** "I removed 301,000 workers from the simulation. Here's what actually broke first."
- **The Admin Paradox:** "If AI scribes free up 25% of GP time, do hospitals see more patients — or just bill more?"
- **Sector crossover:** "The same structural failure pattern in healthcare exists in education. Cammelot is testing that next."
- **IZA ROI:** "270 transformation plans submitted. I simulated the 3 most common ones. Only one actually works."

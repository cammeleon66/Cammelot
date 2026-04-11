# Series 1 — Health Sector | Post 4: Does AI Make Inequality Worse?

**Status:** Draft v1
**Target:** LinkedIn
**Tags:** #HealthcareAI #AIBias #HealthEquity #GiniCoefficient #Cammelot #DIB

---

## Post

I asked 5,000 AI agents to run the Dutch healthcare system.

The inequality got worse before it got better.

---

This is the post I didn't want to write. Because the finding is uncomfortable.

**Setup:** I ran Cammelot in SOLL mode (full AI-native healthcare) for 5,000 cycles — about 3.5 simulated years. AI triage, ambient scribes, digital twins for every citizen, full A2A protocol between providers.

I tracked three equity metrics across the entire run:
- **Gini coefficient** of care access (0 = perfect equality, 1 = total inequality)
- **Age bias score** (differential wait times for 65+ vs under-65)
- **Digital literacy gap** (how agent "digital literacy" correlates with care speed)

---

**Phase 1 (cycles 0–1,000): The Honeymoon**

Everything improved. Admin dropped to 5%. Wait times fell. Deaths plummeted. The headline numbers were spectacular:
- Mortality: 18 → 6 (67% reduction)
- Average wait: 9.2 → 4.1 weeks
- GP burnout: eliminated

The Gini coefficient fell from 0.38 to 0.24. 

**Phase 2 (cycles 1,000–3,000): The Divergence**

Then something happened.

The AI triage system — optimizing for "best outcomes per resource unit" — started systematically favoring patients with:
- Clean, complete health records (better Digital Twin predictions)
- Single conditions (simpler treatment paths, higher success probability)
- Recent GP engagement (more data points = more confident triage)

Who has the messiest records, the most comorbidities, and the least recent GP visits? **The elderly. The most vulnerable.**

The Gini coefficient drifted back up to **0.31**.

The age bias score — which had improved initially — reversed. By cycle 2,500, patients over 70 were waiting **2.8 weeks longer** than average again. Not because the system was cruel. Because it was *optimizing.*

**Phase 3 (cycles 3,000–5,000): The Correction**

I added a fairness constraint to the AI triage: **no patient group's average wait may exceed 120% of the population mean.** A simple guardrail.

The system adapted. The Gini coefficient settled at **0.19** — better than IST had ever been. But it took the guardrail. Without it, the optimization naturally amplified existing disparities.

---

**The uncomfortable finding:**

AI doesn't create bias. It *inherits* it from the data — then compounds it through optimization pressure.

In the simulation, the AI system was never programmed to discriminate by age. It simply learned that younger patients with single conditions had better outcomes per resource invested. That's not bias in the algorithm. That's bias in the healthcare system, reflected in the data, amplified by optimization.

The **transition period** — between old system and full AI adoption — is the most dangerous moment. Early AI gains disproportionately benefit the already-advantaged. The equity correction only comes when:
1. Data interoperability reaches critical mass (IZA targets 66%, currently 11%)
2. Digital literacy gaps are addressed (not everyone can use a patient portal)
3. Explicit fairness constraints are built into triage algorithms

---

**The DIB method (Detect, Investigate, Build):**

I tracked every agent decision across 5,000 cycles:
- **Detect**: Gini coefficient divergence at cycle 1,200
- **Investigate**: Correlation with digital literacy score (r = 0.67) and comorbidity count (r = -0.54)
- **Build**: Fairness guardrail reducing max group variance to 120% of mean

This is what Applied Research looks like. Not "AI good" or "AI bad." **AI reveals the system it's built on.**

The question for policymakers isn't "should we deploy AI in healthcare?" It's: **"what guardrails do we need before we do?"**

Next post: what if your GP's AI assistant knew you were heading for heart failure 6 weeks before you did?

[📸 Screenshot: Gini coefficient chart showing the 3-phase arc]
[📸 Screenshot: Bias score dashboard]
[📸 Screenshot: Agent with low digital literacy struggling in SOLL mode]
[🔗 Simulation: cammelot.health]

---

## Screenshots Needed
1. Gini coefficient timeline chart showing the 3-phase arc (drop → rise → settle)
2. Bias score composite tracking over time
3. Stats overlay comparing IST vs SOLL equity metrics
4. Agent panel showing "digital literacy" attribute + its effect
5. Two Gazette entries: one showing early SOLL wins, one showing the divergence
6. QA panel with bias detection alerts

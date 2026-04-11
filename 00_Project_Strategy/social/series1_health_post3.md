# Series 1 — Health Sector | Post 3: The Waiting List Is Not Neutral

**Status:** Draft v1
**Target:** LinkedIn
**Tags:** #HealthcareAI #Treeknorm #AgeBias #Zorginfarct #Cammelot #RIVM

---

## Post

A 12-week wait hits a 72-year-old very differently than a 35-year-old.

This isn't an opinion. It's math. And I have the simulation data to show it.

---

I ran Cammelot for 2,000 cycles — tracking every patient, every queue, every death — stratified by age group.

**The setup:** Same town, same GPs, same hospital, same specialist capacity. Everyone enters the same queue. First in, first out. No triage priority. Just like most real Dutch waiting lists.

**The finding:**

| Age Group | Avg Wait (weeks) | Mortality Rate | HP at Queue Exit |
|-----------|-----------------|----------------|-----------------|
| 0–44 | 6.2 | 1.8% | 71 |
| 45–64 | 7.8 | 4.3% | 58 |
| 65–79 | 9.1 | 11.7% | 39 |
| 80+ | 10.4 | 23.2% | 22 |

The queue is identical. The outcomes are not.

---

Why? Three compounding factors:

**1. Comorbidity drag.** 96% of people over 75 have at least one chronic condition (RIVM). In the simulation, each additional condition multiplies HP drain — diabetes worsens heart disease (1.4×), hypertension compounds both (1.3×). A 72-year-old with diabetes and heart disease loses HP **1.82× faster** than a 35-year-old with the same primary condition.

**2. Baseline resilience.** Younger patients enter the queue with higher HP and more recovery capacity. Even with identical wait times, their survival buffer is larger.

**3. Markov acceleration.** Disease progression follows condition-specific Markov chains. Every week past the Treeknorm threshold increases the probability of transitioning to a worse state by 15%. For an elderly patient already in "moderate," this compounds devastatingly.

The result: a FIFO waiting list that appears fair is structurally age-discriminatory.

---

**The SOLL experiment:**

When I switched to severity-based triage (AI scores urgency, not queue position):

- 65+ mortality dropped from **11.7% to 4.2%** (64% reduction)
- 80+ mortality dropped from **23.2% to 9.8%** (58% reduction)
- Younger patients waited slightly longer (avg +1.2 weeks) but with negligible mortality impact
- The Gini coefficient of care outcomes improved from **0.38 to 0.21**

The queue becomes fairer by becoming *less* equal.

---

This connects directly to the IZA "passende zorg" (appropriate care) agenda. The Integraal Zorgakkoord explicitly calls for care that's proportional to need. But the waiting list infrastructure — the actual queue mechanics — hasn't changed.

My simulation suggests the queue is where the policy fails. Not in policy documents, not in budget allocation, but in the mundane FIFO data structure of a specialist referral system.

**The Treeknorm says 4 weeks. But 4 weeks means something very different depending on who's waiting.**

Next post: I let AI run the healthcare system. The inequality got worse before it got better.

[📸 Screenshot: Age bias chart from QA panel]
[📸 Screenshot: Heatmap showing death clustering near hospital]
[📸 Screenshot: Agent panel — elderly patient with comorbidity details]
[🔗 Try the simulation: cammelot.health]

---

## Screenshots Needed
1. Age bias chart (from QA/bias panel) showing mortality by age group
2. Two agent panels side-by-side: young patient (HP 71) vs elderly (HP 22) with same wait
3. Gazette entry showing an elderly death with wait time detail
4. Heatmap overlay showing red zones near hospital (death clustering)
5. Gini coefficient display (IST 0.38 vs SOLL 0.21)
6. Treeknorm violation log showing age distribution

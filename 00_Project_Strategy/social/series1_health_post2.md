# Series 1 — Health Sector | Post 2: The Admin Tax

**Status:** Draft v1
**Target:** LinkedIn
**Tags:** #HealthcareAI #AdminBurden #MeerTijdVoorDePatiënt #Zorginfarct #Cammelot #NZa

---

## Post

What if the biggest killer in Dutch healthcare isn't a disease?

I ran 1,000 simulation cycles in Cammelot — a town of 5,000 AI citizens with real CBS/RIVM health data.

Here's what I tested: **What happens when you remove the 30% GP admin burden?**

---

Right now, Dutch GPs spend roughly 30% of their working hours on administration. Not patient care. Paperwork, systems, coding, reporting. This is well-documented — NZa, LHV, and IZA all track it.

In simulation terms, this means:
- **Effective GP capacity: 62%** (C_eff = total × (1 - 0.30 admin - 0.08 sick leave))
- A GP with 2,400 registered patients can actually *attend to* about 1,488 per cycle
- The remaining 912 patient-slots are consumed by administration

I modeled this across three GPs serving Cammelot:

**IST (status quo):**
- 📊 Admin waste per GP per year: **~€47,000** (based on NZa consult rate × lost slots)
- 📊 Average specialist wait: **9.2 weeks** (Treeknorm norm: 4 weeks)
- 📊 Preventable deaths (1,000 cycles): **18** — citizens who ran out of time in the queue
- 📊 GP burnout: all three GPs exceeded 70% burnout by cycle 600

**SOLL (admin reduced to 5% via AI scribes):**
- 📊 Effective capacity jumps to **83%** (C_eff × 1.34 AI multiplier)
- 📊 Average specialist wait drops to **4.1 weeks**
- 📊 Preventable deaths: **6** — a 67% reduction
- 📊 GP burnout: none exceeded 50%

---

The economics are brutal.

The IZA "Meer Tijd voor de Patiënt" program costs **€3.23 per patient per quarter**. That's the investment.

A single preventable death — one citizen who deteriorates in a specialist queue because their GP couldn't process the referral in time — represents an estimated **€5,845** in avoided hospitalization costs alone. That's before you count the human cost.

In Cammelot, the admin tax killed more people than heart disease.

---

This is applied research, not an opinion piece. The model parameters come from CBS 2024, RIVM chronic condition prevalence, and NZa 2025 tariff data. The simulation code is open.

The question isn't whether the admin burden is a problem. Everyone agrees it is. The question is: **what is it actually costing in lives?**

I'm building the tool to answer that.

Next post: the waiting list isn't neutral — and I have the age-stratified data to prove it.

[📸 Screenshot: Cammelot admin waste taxi meter showing €47,000+]
[📸 Screenshot: IST vs SOLL comparison — deaths counter]
[🔗 Try it yourself: cammelot.health]

---

## Screenshots Needed
1. Admin waste taxi meter (💰 counter on canvas) running during IST mode
2. Top bar showing GP Burnout at 70%+ (red indicator)
3. IST mode with 18 deaths counter vs SOLL mode with 6 deaths
4. Stats overlay showing cost breakdown
5. A ghost sprite near the hospital with wait time tooltip

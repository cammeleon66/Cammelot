# Series 1 — Health Sector | Post 2: The Admin Tax

**Status:** Draft v2 — Real Data
**Target:** LinkedIn
**Tags:** #HealthcareAI #AdminBurden #MeerTijdVoorDePatiënt #Zorginfarct #Cammelot #NZa

---

## Post

What if the biggest drag on Dutch healthcare isn't a disease — but a spreadsheet?

I built Cammelot: a 16-bit simulation of a Dutch town where AI agents live, get sick, and navigate the healthcare system. Every parameter sourced from CBS, RIVM, and NZa.

Here's what I tested: **What happens when you cut the 30% GP admin burden?**

---

Dutch GPs spend ~30% of their time on administration (NZa, LHV, IZA). Effective capacity drops to just 62%.

I ran 10 simulations of 3,000 cycles each, across two modes:

**IST (status quo):**
- 📊 Admin waste per GP: **€13,611/year** (NZa consult rates × lost capacity)
- 📊 GP burnout score: **~20%** and climbing
- 📊 System deaths (disease progression): **5.5 avg** per run

**SOLL (admin reduced to <5% via AI scribes):**
- 📊 Admin waste per GP: **€2,268/year** — an **83% reduction**
- 📊 GP burnout score: **3.7%** — near zero
- 📊 System deaths: **4.3 avg** — 22% fewer

---

The burnout finding is dramatic. An 81% reduction in GP burnout just from removing admin friction. That's not a treatment improvement — it's a workflow improvement with clinical consequences.

The IZA "Meer Tijd voor de Patiënt" program costs **€3.23/patient/quarter**. A single preventable hospitalization costs ~**€5,845** (NZa avg DBC). The admin tax isn't just waste — it compounds into burnout, delays, and lost lives.

---

*Methodology: 10 runs × 3,000 cycles, 45 agents (proportional demographics). CBS 2024, RIVM chronic condition prevalence, NZa 2025 tariffs. Headless research runner. Variance between runs is significant — these are stochastic averages, not deterministic claims.*

Next: the waiting list isn't neutral — and I have the age-stratified data to prove it.

[📸 Screenshot: Cammelot admin waste taxi meter]
[📸 Screenshot: IST vs SOLL burnout comparison]

---

## Data Source (10-run averages)
```
IST: system_deaths=5.5, ER=93, burnout=19.8%, bias=0.53, admin_waste/GP=€13,611
SOLL: system_deaths=4.3, ER=92.6, burnout=3.7%, bias=0.49, admin_waste/GP=€2,268
Runner: scripts/research_run.cjs × 10 | 3,000 cycles each
```

## Screenshots Needed
1. Admin waste taxi meter (💰 counter) running during IST mode
2. Top bar showing GP Burnout climbing in IST
3. IST vs SOLL mode toggle — burnout comparison
4. Stats overlay showing cost breakdown

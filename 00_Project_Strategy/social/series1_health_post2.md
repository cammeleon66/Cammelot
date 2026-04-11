# Series 1 — Health Sector | Post 2: The Admin Tax

**Status:** Draft v3 — WOW rewrite
**Target:** LinkedIn
**Tags:** #HealthcareAI #AdminBurden #MeerTijdVoorDePatiënt #Zorginfarct #Cammelot #NZa

---

## Post

My simulated GP burned out in 600 cycles.

Her name is Dr. Bakker. She's one of three GPs serving a pixel town of 45 citizens. She started the simulation at 0% burnout. By cycle 600 — roughly 5 simulated months — she was above 20% and climbing. By the end, she was spending more time on virtual paperwork than on virtual patients.

I didn't program her to burn out. The admin burden did it for me.

---

**The setup:** Dutch GPs spend ~30% of their time on administration (NZa, LHV, IZA). Not on patients. On dossiers, referral letters, coding, billing. Cammelot models this directly: every GP loses 30% of their effective capacity to admin tasks. What's left after admin and sick leave? **62% of their total capacity.**

I ran this 10 times. Tracked every euro wasted.

[📸 Screenshot: Dr. Bakker's burnout climbing in the top bar — IST mode]

**IST (status quo), 10-run average:**
- 💰 Admin waste per GP: **€13,611/year**
- 🔥 GP burnout: **19.8%** — and rising
- 💀 System deaths: **5.5** (patients whose conditions hit terminal while waiting)

Then I flipped the switch. SOLL mode: ambient AI scribes handle the admin. The 30% drops to <5%.

**SOLL (AI-native), 10-run average:**
- 💰 Admin waste per GP: **€2,268/year** — that's **€11,343 saved per GP**
- 🔥 GP burnout: **3.7%** — effectively zero
- 💀 System deaths: **4.3** — 22% fewer

[📸 Screenshot: Side-by-side — IST burnout climbing vs SOLL flat at 3.7%]

---

**The number that keeps me up at night:** an 81% reduction in GP burnout from a *workflow* change. Not a clinical breakthrough. Not a new drug. A spreadsheet that fills itself.

And here's the economics that make it absurd:

The IZA "Meer Tijd voor de Patiënt" program costs **€3.23/patient/quarter**. A single preventable hospitalization costs ~**€5,845** (NZa avg DBC). In my simulation, each system death represents a patient whose conditions progressed to terminal *while the GP was doing paperwork*. 

**Dr. Bakker couldn't save Nico Kok (70, heart disease + diabetes + hypertension). Not because she lacked skill. Because she lacked time.**

---

*Methodology: 10 runs × 3,000 cycles, 45 agents (proportional CBS demographics). NZa 2025 tariffs, RIVM chronic condition prevalence. Stochastic — variance is significant. But the burnout signal is consistent: every single IST run exceeded 15%.*

Next: the waiting list isn't neutral. Same queue, same rules — 25× difference in mortality between youngest and oldest.

---

## Data Source (10-run averages)
```
IST: system_deaths=5.5, ER=93, burnout=19.8%, bias=0.53, admin_waste/GP=€13,611
SOLL: system_deaths=4.3, ER=92.6, burnout=3.7%, bias=0.49, admin_waste/GP=€2,268
Named death: Nico Kok (70) cycle 71, I25+E11+I10, system_failure
Runner: scripts/research_run.cjs × 10 | 3,000 cycles each
```

## Screenshots Needed
1. Dr. Bakker's burnout climbing in top bar (IST mode, around cycle 600)
2. Side-by-side burnout: IST climbing vs SOLL flat
3. Admin waste taxi meter (💰 counter) running during IST
4. Agent panel showing GP with high admin load

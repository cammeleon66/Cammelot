# Series 1 — Health Sector | Post 5: The Digital Twin Triage Bet

**Status:** Draft v3 — WOW rewrite
**Target:** LinkedIn
**Tags:** #DigitalTwin #HealthcareAI #Preventie #Ketenzorg #Cammelot #RIVM

---

## Post

418 alerts. Each one a patient who didn't know they were deteriorating.

Their Digital Twin did.

---

**Truus de Groot**, 72. Dementia and hypertension. In IST mode (status quo), her dementia Markov chain crept from mild → moderate → severe over 1,200 cycles. Nobody noticed. There was no mechanism to notice. At cycle 1,223, the chain hit terminal. Truus became a ghost.

In SOLL mode, her Digital Twin would have flagged the trajectory hundreds of cycles earlier. A proactive alert to her GP. A ketenzorg intervention. Maybe a different ending.

I can't prove Truus would have survived. But I can prove she never got the chance.

[📸 Screenshot: Truus de Groot's agent panel — F03 dementia progressing, no proactive alert in IST]

---

**How it works in Cammelot:**

Every citizen has a Digital Twin — a lightweight model tracking conditions, HP trajectory, comorbidities, and treatment history. In IST, it's inert. In SOLL, it fires proactive alerts when a patient's trajectory crosses a risk threshold.

**IST path (Truus's reality):**
1. Condition worsens gradually (Markov chain: healthy → mild → moderate → severe)
2. Patient notices symptoms, visits GP
3. GP refers to specialist → 12-week Treeknorm queue
4. Disease progresses while waiting
5. Terminal state reached. Ghost sprite.

**SOLL path (what could have been):**
1. Digital Twin detects downward HP trajectory
2. **🔔 Proactive alert fires** — GP gets notification *before* Truus books
3. GP initiates ketenzorg (integrated chronic care)
4. Earlier intervention = higher HP at treatment start = survivable

---

**The numbers (10 runs × 3,000 cycles):**

| Metric | IST | SOLL | Δ |
|--------|-----|------|---|
| Proactive alerts | 0 | **418** | ∞ |
| Ketenzorg interventions | ~26 | **189** | +627% |
| System deaths | 5.5 | 4.3 | -22% |
| 80+ mortality | 93.9% | 57.1% | **-39%** |
| GP burnout | 19.8% | 3.7% | -81% |

**The 80+ group again.** The same group that was dying at 93.9% in a "fair" FIFO queue, the same group that the AI triage nearly discriminated against — they're also the group that benefits most from proactive Digital Twin alerts. Because they deteriorate fastest and have the least margin for error.

**Diana Hendriks**, 82, survived SOLL with 100 HP. Diabetes type 2. In IST, patients like her die. In SOLL, the Digital Twin caught the trajectory and ketenzorg kicked in early.

[📸 Screenshot: Diana Hendriks' agent panel — survived, HP 100, SOLL mode]

---

**The economics that make this a no-brainer:**

Each prevented hospitalization: ~**€5,845** (NZa avg DBC)
Admin waste saved per GP: **€11,343/year**
189 ketenzorg interventions × avg €44.68 ≈ **€8,400 invested**

The proactive care pays for itself through admin savings alone. You don't even need the hospitalization savings — they're gravy.

**But here's the insight most people miss:**

The two interventions are *coupled*. You can't do Digital Twin triage without first solving the admin burden.

1. **AI scribes free GP time** (admin 30% → 5%)
2. **Digital Twins fill that freed time** with proactive care (418 alerts)
3. **Net result:** lower burnout, better outcomes, proactive instead of reactive

One without the other fails. Digital Twins without admin relief = more alerts to overwhelmed GPs = more burnout. Admin relief without Digital Twins = freed capacity with nothing proactive to fill it.

**Sequence matters: admin reduction first. Digital Twins second.**

[📸 Screenshot: Weekly report with 418 alerts and ketenzorg section]

---

**The Truus question:**

Could this system have saved Truus de Groot? Maybe. Her dementia progressed over 1,223 cycles — that's more than 10 simulated months. An early alert at cycle 400 could have changed the Markov trajectory. Could have.

The honest answer is: in a simulation of 45 agents with stochastic Markov chains, individual outcomes are probabilistic. But the systemic pattern is clear: proactive triage + severity-based queuing + admin relief = fewer ghosts.

And fewer ghosts is the metric that matters.

---

*Methodology: 10 runs × 3,000 cycles, 45 agents, CBS/RIVM/NZa parameters. Lethal conditions: I25, I50, C34, J44, F03. Stochastic — high variance. Death cost at €5,845/event (NZa avg DBC). Ketenzorg tariffs: E11=€63.36/q, J44=€50.19/q, I25=€27.17/q.*

This was the last post in the series. Next: I'm opening the simulation for anyone who wants to test their own hypotheses. Fork the repo, change the parameters, run the research runner. **What would you test?**

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

## Data Source (10-run averages)
```
IST: system_deaths=5.5, ER=93, ketenzorg=26, burnout=19.8%, 80+ mortality=93.9%
SOLL: system_deaths=4.3, ER=92.6, ketenzorg=189, alerts=418, burnout=3.7%, 80+ mortality=57.1%
Named deaths (IST): Truus de Groot (72) cycle 1223, F03+I10 | Nico Kok (70) cycle 71, I25+E11+I10
Named survivors (SOLL): Diana Hendriks (82) HP=100, E11 | Wim Maas (75) HP=100, E11+I10
Guardrail activated: 3/10 SOLL runs
Preventable death cost: IST=€32,168 vs SOLL=€25,155 (avg)
Runner: scripts/research_run.cjs × 10
```

## Screenshots Needed
1. Truus de Groot's agent panel (IST — declining, no alert)
2. Diana Hendriks' agent panel (SOLL — survived, 100 HP)
3. Proactive alert toast notification: "🔔 Digital Twin Alert"
4. Weekly report with 418 alerts + ketenzorg section
5. Ghost sprite on the map (any patient — the emotional closer)

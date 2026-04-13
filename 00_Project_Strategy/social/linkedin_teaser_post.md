# LinkedIn Teaser Post — Series Announcement

**Status:** Final — updated with 100-run data (April 2025)
**Target:** LinkedIn (short-form post)
**Publish:** Same day as or just before Blog Post 0
**Data source:** `scripts/output/mortality_fix_100runs.json`

---
## MY version
Welcome to Cammelot! 🏰 Warning up front: hobby project gone *very* rogue.

I built this because both online and in real-life I still see most people pro and con AI focussing on seeing this as a productivity tool only. I actually believe (yes, I am biased) that this is the wrong way to look at things: the current status of AI is able to disrupt a complete industry, but then we need to be able to compare it the right way. So, that is what I did. I built Cammelot.

**Cammelot** is a simulated Dutch town. Forty-five citizens with names, ages, pre-existing conditions, and GP assignments. Three general practitioners. One hospital. The citizens walk around a 16-bit pixel map that looks like it belongs on a 1994 Super Nintendo. Their diseases are drawn from 2025 RIVM prevalence data, the health system is drawn from CBS demographics, IZA program and NZa tariffs. The simulation is built on agentic citizens that spawn diseases based on statistical Markov Chains reflecting actual Dutch data.

Then, I built the AI-augmented version of my simulated Dutch town reflecting the health industry: ambient scribes, Digital Twins, AI triage, proactive chronic care management, standardized data, interoperable data.

I ran 100 simulations of 1 year in both environments and did a mini 'applied science' analysis to check all the biased ideas I have (had?) on the (non-)value of AI in health.

The headline result that surprised me most: GP burnout drops 85%. Admin waste drops 83%. But mortality? That one was hard. It only became statistically significant (d=0.35) after I added proper triage priority and referral capacity management. The AI doesn't save lives by being smart — it saves lives by not wasting the doctor's time on paperwork.

In a series of ten posts I will take you through the architecture, the uncomfortable findings, and why I think the "data mesh" is the wrong abstraction for Dutch healthcare. Happy to get some peer reviews or new research questions from the wider public. And.. I had a looooooooot of fun doing this.

Code is open source. All statistics are published. Tell me where I'm wrong.

🔗 [Link to series]


## FINAL VERSION

Welcome to Cammelot 🏰

I built a simulated Dutch town. 45 inhabitants, three GPs, one hospital. Real CBS demographics, real RIVM disease prevalence, real NZa tariffs. Everything runs as a 16-bit pixel simulation because that's apparently how my brain works.

Then I ran it 100 times with the current healthcare system. And 100 times with an AI-augmented version: ambient scribes, Digital Twins, AI triage, proactive chronic care management, federated research agents, signed agent cards.

Results from 100 paired simulations (Cohen's d, Welch's t-test):

→ GP burnout: 7.9% → 1.2%, d=1.4+ ✅ (large effect, p<0.001)
→ Administrative waste: €33.6k → €5.6k, −83% ✅
→ Proactive alerts: 0 → 147/run, d=2.92 ✅
→ Ketenzorg enrollment: +159%, d=0.94 ✅
→ Patient mortality: 11.75 → 10.60 deaths/year, d=0.35 ✅ (significant after triage + capacity fixes)
→ Age fairness: bias index 0.92 → 0.88, d=0.29 ✅ (guardrail fired 98% of runs)
→ Research queries: 30/run (SOLL only) — federated, consent-checked, k-anonymity enforced
→ Security: both forged-card and replay attacks blocked by signed agent cards

The finding that surprised me most: mortality only became significant after I stopped optimizing the AI and started fixing the plumbing — referral capacity limits, proper triage priority, signed agent cards. AI doesn't save lives by being smart. It saves lives by not wasting the doctor's time on paperwork and not losing the referral in a broken queue.

I wrote ten posts about it. Six on the health data (including the null results and one age group where SOLL was actually worse). Four on the architecture (A2A protocol, FHIR memory, security red-teaming, why the data mesh is the wrong abstraction for healthcare).

Code is open. Stats are open. I would genuinely like people to tell me where the model is wrong.

🔗 [Link to series]

---

## ARCHIVED — Previous variations (old data, rejected)

<details>
<summary>Click to expand 5 old variations (stale numbers from 200-run set)</summary>

### Variation 1: The Stakes (ARCHIVED)

The Netherlands will be short 301,000 healthcare workers by 2035.

Your GP already spends 30% of their time on paperwork instead of you. The specialist queue is 12 weeks. If you're 75 with COPD and diabetes, 12 weeks is not a waiting time. It's a death sentence.

Everyone says AI will fix this. Nobody shows their math.

So I built a simulation. A tiny Dutch town — 45 citizens, three GPs, one hospital — running on real CBS, RIVM, and NZa data. I ran it 200 times. With AI. Without AI. Measured everything.

The AI crushed GP burnout (−77%). It did not reduce mortality. Not significantly. Not in 200 runs.

I wrote five posts about why. With all the statistics and all the uncomfortable findings. Because the conversation about AI in healthcare deserves better than vibes.

🔗 [Link to full series]

### Variation 2: The Personal (ARCHIVED)

My grandmother waited 14 weeks for a cardiologist. She was fine. But every day in that queue, I wondered: what if she wasn't?

That question wouldn't leave me alone. So I built something weird: a 16-bit simulation of a Dutch town where citizens get sick, wait, and sometimes die — all based on real health data.

I called it Cammelot. I gave it AI. Then I ran it 200 times to see if the AI would have helped someone like her.

The honest answer: it helps the doctors. Burnout drops 77%. Admin waste drops 83%. But the queue is still the queue. And the queue is what kills.

I published everything — the nulls, the surprises, and one finding about fairness that genuinely shocked me.

Five posts. Open code. Real stats.

🔗 [Link]

### Variation 3: The Challenge (ARCHIVED)

If you work in Dutch healthcare, I have a question:

Do you believe AI will reduce patient mortality in primary care? Yes or no?

I didn't know either. So I built a simulation to find out. 200 runs. Real RIVM disease data. Real NZa costs. Statistical tests on everything.

Result: AI saves the workforce. It does not (yet) save the patients. And if you deploy it without fairness guardrails, it discriminates against the elderly — consistently enough that the safety net triggered in 97 out of 100 runs.

I wrote the whole thing up. Five posts. Every confidence interval, every effect size, every null. The code is open source — you can change my assumptions and run your own.

I'm looking for people who think I'm wrong. Especially if you can explain why.

🔗 [Link]

### Variation 4: The Contrarian (ARCHIVED)

The most expensive healthcare system in Europe doesn't have a technology problem. It has a plumbing problem.

I know this because I spent months building a simulation of Dutch primary care, added every AI intervention I could think of — scribes, Digital Twins, smart triage, proactive chronic care — and watched mortality barely budge.

The GPs got better. Burnout dropped 77%. Admin waste dropped 83%. 167 proactive alerts per run that would never have existed.

But the specialist queue is still 12 weeks. And that's where people die.

AI optimizes the pipes. It doesn't add water. Five posts on what I learned, with all the data.

🔗 [Link]

### Variation 5: The Dutch One (ARCHIVED)

Welkom in Cammelot 🏰

Een gesimuleerd Nederlands dorp. 45 inwoners. Drie huisartsen. Eén ziekenhuis. Echte CBS-demografie. Echte RIVM-ziektedata. Echte NZa-tarieven.

200 keer gesimuleerd. Met AI. Zonder AI.

English summary of 200 runs:
→ GP burnout: −77% ✅
→ Admin waste: −83% ✅  
→ Proactive detection: 167 alerts/run ✅
→ Patient mortality: −7% ❌ (not significant)
→ Fairness: improved ✅ (the guardrail works)

The uncomfortable finding: AI is a workforce intervention, not a mortality intervention. At least not yet.

I wrote five posts about it. In English, with the stats, the code, and every null result.

Especially looking for Dutch healthcare professionals who want to stress-test the model.

🔗 [Link]

</details>


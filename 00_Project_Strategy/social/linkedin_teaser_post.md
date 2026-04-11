# LinkedIn Teaser Post — Series Announcement

**Status:** Draft v4 — 5 variations (urgency + personal + scientific)
**Target:** LinkedIn (short-form post)
**Publish:** Same day as or just before Blog Post 0

---

## Variation 1: The Stakes

The Netherlands will be short 301,000 healthcare workers by 2035.

Your GP already spends 30% of their time on paperwork instead of you. The specialist queue is 12 weeks. If you're 75 with COPD and diabetes, 12 weeks is not a waiting time. It's a death sentence.

Everyone says AI will fix this. Nobody shows their math.

So I built a simulation. A tiny Dutch town — 45 citizens, three GPs, one hospital — running on real CBS, RIVM, and NZa data. I ran it 200 times. With AI. Without AI. Measured everything.

The AI crushed GP burnout (−77%). It did not reduce mortality. Not significantly. Not in 200 runs.

I wrote five posts about why. With all the statistics and all the uncomfortable findings. Because the conversation about AI in healthcare deserves better than vibes.

🔗 [Link to full series]

---

## Variation 2: The Personal

My grandmother waited 14 weeks for a cardiologist. She was fine. But every day in that queue, I wondered: what if she wasn't?

That question wouldn't leave me alone. So I built something weird: a 16-bit simulation of a Dutch town where citizens get sick, wait, and sometimes die — all based on real health data.

I called it Cammelot. I gave it AI. Then I ran it 200 times to see if the AI would have helped someone like her.

The honest answer: it helps the doctors. Burnout drops 77%. Admin waste drops 83%. But the queue is still the queue. And the queue is what kills.

I published everything — the nulls, the surprises, and one finding about fairness that genuinely shocked me.

Five posts. Open code. Real stats.

🔗 [Link]

---

## Variation 3: The Challenge

If you work in Dutch healthcare, I have a question:

Do you believe AI will reduce patient mortality in primary care? Yes or no?

I didn't know either. So I built a simulation to find out. 200 runs. Real RIVM disease data. Real NZa costs. Statistical tests on everything.

Result: AI saves the workforce. It does not (yet) save the patients. And if you deploy it without fairness guardrails, it discriminates against the elderly — consistently enough that the safety net triggered in 97 out of 100 runs.

I wrote the whole thing up. Five posts. Every confidence interval, every effect size, every null. The code is open source — you can change my assumptions and run your own.

I'm looking for people who think I'm wrong. Especially if you can explain why.

🔗 [Link]

---

## Variation 4: The Contrarian

The most expensive healthcare system in Europe doesn't have a technology problem. It has a plumbing problem.

I know this because I spent months building a simulation of Dutch primary care, added every AI intervention I could think of — scribes, Digital Twins, smart triage, proactive chronic care — and watched mortality barely budge.

The GPs got better. Burnout dropped 77%. Admin waste dropped 83%. 167 proactive alerts per run that would never have existed.

But the specialist queue is still 12 weeks. And that's where people die.

AI optimizes the pipes. It doesn't add water. Five posts on what I learned, with all the data.

🔗 [Link]

---

## Variation 5: The Dutch One

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


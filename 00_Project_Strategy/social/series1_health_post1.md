# Series 1 — Health Sector | Post 1: Launch Post

**Status:** Draft v3 — WOW rewrite
**Target:** LinkedIn
**Tags:** #HealthcareAI #Zorginfarct #Netherlands #AgenticAI #Cammelot #IZA

---

## Post

I killed 8 people last week.

Pixel people. In a simulation. But the reasons they died are very real.

---

**Nico Kok**, 70. Chronic heart disease, diabetes, hypertension. He entered the specialist queue in my simulated Dutch town. Waited. His conditions compounded. By cycle 71, his Markov chain hit terminal. He became a ghost sprite — grey, transparent, floating above the tile map.

Nico didn't die because the system was cruel. He died because the system was *busy*.

[📸 Screenshot: Ghost sprite on the 16-bit town map]

---

There's a lot of skepticism about AI in healthcare right now. I get it. Hype cycles, hallucinations, ethics debates. The doubts are legitimate.

But there's a question I don't hear enough:

**What is the cost of NOT changing?**

In the Netherlands, the math is already brutal:
- **301,000 healthcare workers short by 2035** (CBS)
- GPs burning **30% of their time on administration**, not patients
- **96%** of people over 75 living with ≥1 chronic condition (RIVM)
- Specialist waiting lists breaching legal norms across the board

This isn't a future problem. It's killing simulated Nicos right now.

**You don't get to be a skeptic without an alternative.**

---

So I built one. Or rather — I built the question.

**Cammelot** is a 16-bit SNES-style simulation of a Dutch town. Tiny pixel citizens age, develop real conditions from RIVM statistics, visit GPs, wait in queues, get referred, deteriorate. Some — like Nico — don't make it. They become ghosts.

[📸 Screenshot: The pixel town — vibrant SNES aesthetic, citizens walking between GP and hospital]

**Two worlds, one town:**
- **IST** (status quo): GPs overloaded. Admin eating 30% of capacity. FIFO queues that look fair but aren't. 93.9% mortality for 80+ patients.
- **SOLL** (AI-native rebuild): Ambient scribes, severity-based triage, Digital Twins firing proactive alerts. 80+ mortality drops to 57.1%.

Then I asked the hard questions:
- Does AI triage worsen inequality? *(Yes — until you add a fairness guardrail.)*
- What's the real € cost of the admin tax? *(€13,611/GP/year in wasted consults.)*
- Can Digital Twins catch Nico before he becomes a ghost? *(418 proactive alerts per run say: often, yes.)*

---

This is a 5-post research series. Not marketing. Not hype. Real simulation data, 10-run averaged, sourced from CBS, RIVM, NZa, and IZA — code on GitHub.

I'm looking for humans in the loop. Healthcare professionals, researchers, policy people, and skeptics especially.

**What would you test in Cammelot?**

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

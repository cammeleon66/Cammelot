# Series 1 — Health Sector | Post 0: What I Built, How It Works, and Why You Should Be Skeptical

**Status:** Draft v5 — Narrative rewrite (ai-2027 / Park et al. style)
**Target:** LinkedIn
**Publish:** First — before all other posts
**Tags:** #HealthcareAI #AppliedResearch #Zorginfarct #AgenticAI #Cammelot #Netherlands

---

## Post

I work at Microsoft. You should assume I'm biased toward AI.

That's exactly why I built a system that could prove me wrong — and in several important ways, did.

---

**Cammelot** is a simulated Dutch town. Forty-five citizens with names, ages, pre-existing conditions, and GP assignments. Three general practitioners. One hospital. The citizens walk around a 16-bit pixel map that looks like it belongs on a 1994 Super Nintendo. Their diseases are drawn from 2025 RIVM prevalence data. Their healthcare costs come from NZa tariffs. Their waiting times follow the Treeknorm — the Dutch legal norm for how long you should wait for specialist care.

[📸 Hero: Aerial view of the Cammelot pixel town — citizens moving between GPs and hospital]

I built it because I was tired of the vibes.

"AI will solve the zorginfarct." How? Which interventions? In what order? With what side effects?

"AI is overhyped." Compared to what? The system that's already producing a 301,000-worker shortage by 2035?

Both sides argue with anecdotes and intuition. I wanted a machine that produces numbers. Not predictions — *outputs*. Run it, measure it, break it, run it again. Forty times. With statistics.

---

### The architecture: how it actually works

Every citizen in Cammelot is an autonomous agent running a cognitive loop inspired by Park et al.'s "Generative Agents" — the Stanford paper that simulated 25 AI agents in a town called Smallville. Their agents organized a Valentine's Day party. Mine enter waiting lists.

Each agent, every simulation cycle, does three things:

**1. Memory.** Every action — GP visits, referrals, queue entries, diagnoses — is logged as a FHIR R4 resource. The international healthcare data standard. Not a toy format; the actual standard that hospitals and GP systems use. Each agent's "life history" is a chronological FHIR record: Conditions, Encounters, Observations, MedicationRequests.

**2. Reflection.** Agents assess their own state. A patient might "realize" their breathing is getting worse. A GP might notice their burnout climbing. These reflections drive behavior — when to seek care, when to refer, when to escalate.

**3. Planning.** Based on memory and reflection, agents act. Patients visit GPs. GPs triage and refer. Specialists process queues. The system runs forward one tick. Repeat 3,000 times.

Disease progression is driven by **Markov chains** — probabilistic state machines calibrated to RIVM data. A patient with COPD transitions between states: healthy → mild → moderate → severe → terminal. Each tick, the chain rolls. Comorbidities multiply the odds: diabetes worsens heart disease (1.4×), hypertension compounds both (1.3×). When a patient reaches terminal, their sprite turns grey. They become a ghost.

Providers communicate through **A2A (Agent-to-Agent) protocol**. Every GP and specialist publishes an Agent Card — a machine-readable description of their skills, current wait time, and queue depth. Referrals flow as structured messages. Wait times are real-time, not estimated.

[📸 Architecture diagram: Agent cognitive loop → FHIR memory → A2A communication → Markov disease engine]

---

### Two worlds: IST and SOLL

The simulation runs in two modes. Each is a complete set of parameters — not a toggle, but a different reality.

**IST ("Ist-Zustand" — the current state):**

This is today's Dutch healthcare system, parameterized from CBS, NZa, LHV, and IZA data:

- **30% of GP time** lost to administrative paperwork (NZa/LHV)
- **8% workforce capacity** lost to sick leave (CBS)
- **12-week Treeknorm ceiling** for specialist care (NZa)
- **FIFO queues** — first in, first out, regardless of severity
- **No proactive monitoring** — problems are detected when patients show up
- **No AI assistance** — efficiency multiplier is 1.0
- **Standard disease progression** — Markov chains tick identically for treated and untreated patients

The effective GP capacity in IST: `C_total × (1 - 0.30 - 0.08) × 1.0 = 62%`. Your GP is operating at sixty-two percent before they see their first patient.

**SOLL ("Soll-Zustand" — the target state):**

This is what an AI-native primary care system *could* look like. Every parameter has a source, and I'll be honest about which are evidence-based and which are aspirational:

- **5% admin load** — ambient AI scribes handle documentation (IZA 2030 target: 20%. I'm more aggressive.)
- **5% sick leave** — reduced through better workforce support (aspirational)
- **4-week Treeknorm** — AI-driven scheduling + capacity optimization (aspirational — the hardest one)
- **Severity-based triage** — sickest patients jump the queue, not first-come
- **Digital Twin monitoring** — continuous risk assessment for every citizen. Alert threshold: 25% risk (vs. 60% in IST). This means problems are flagged much earlier.
- **1.34× AI efficiency multiplier** — GPs see 34% more patients effectively (IZA/Vilans research estimate)
- **0.3× HP drain** — patients waiting in SOLL deteriorate 70% slower (because of active monitoring + ketenzorg)
- **Treatment-modified disease progression** — ketenzorg and hospital care actually slow Markov transitions: 20% deceleration on worsening, 5% chance of improving one state
- **Fairness guardrail** — if any age group's average wait exceeds 120% of the population mean, optimization biases auto-disable

The effective GP capacity in SOLL: `C_total × (1 - 0.05 - 0.05) × 1.34 = ~121%`. The same GP, nearly double the output.

---

### Wait — that's a lot of changes at once

Yes. And that's deliberate.

I'm not testing whether "one AI tool helps." I'm testing what happens when you redesign the system end-to-end. SOLL isn't "IST plus a chatbot." It's a different architecture — the way a Tesla isn't a horse with an engine bolted on.

The downside: when SOLL produces better outcomes, you can't point to a single cause. Was it the admin relief? The triage? The Digital Twins? The treatment effect? The Treeknorm reduction?

That's what the five posts in this series are for. Each one isolates a different mechanism and asks: does this specific link in the chain hold?

Spoiler: some do. Some spectacularly don't. And one mechanism turned out to matter more than all the others combined.

---

### The methodology: why you should take this semi-seriously

Every finding in this series comes from the same protocol:

- **20 independent runs per mode** (IST and SOLL)
- **3,000 cycles per run** — roughly 10 simulated years
- **Welch's t-test** for significance (unequal variances)
- **Cohen's d** for effect size (how big is the difference, not just "is it nonzero")
- **95% confidence intervals** on every metric
- **Every null result published** alongside every positive one

N = 45 agents is small. I know. The stochastic variance is high — especially for elderly subgroups, where 3 agents per run means a single death swings mortality by 33 percentage points. I'll flag this limitation every time it matters. And I'll show you the raw data, not just the averages.

---

### Why you should be skeptical of me

Three reasons:

**1. I work at Microsoft.** My employer builds and sells AI products. If this simulation showed "AI fixes everything," you should discount it heavily. It doesn't — several findings are embarrassing for the AI-optimist position — but the conflict of interest is real and I won't pretend otherwise.

**2. I built the simulation.** I chose the parameters, the architecture, and the disease models. A different builder would make different choices. The code is open — you can change anything and re-run.

**3. N = 45.** This is a proof of concept, not a clinical trial. The findings are directional, not definitive. I use proper statistics to separate signal from noise, but small populations have fundamental power limitations that no amount of t-testing can overcome.

What I *can* promise: I report every finding honestly. When the data contradicts my hypothesis, I say so. When a result is not significant, I don't dress it up. When I got something wrong in an earlier analysis, I show the correction.

---

### What's coming

Over the next five posts, I'll walk through what happened — in the order I discovered it:

1. **The first death.** Hendrik Veenstra, 70, dead at cycle 71. The aggregate finding: 20% fewer total deaths in SOLL. The first significant mortality result I ever found — and why it took me months.

2. **The admin tax.** GP burnout drops 73%. Admin waste drops 83%. Deaths barely move. Fixing the workforce doesn't fix the patients — not by itself.

3. **The queue.** FIFO kills the elderly at 5× the rate of the young. Same rules. Radically different graves. AI triage doesn't fix it.

4. **The bias.** I optimized for throughput. The system pushed back against the elderly. The fairness guardrail fired in every single AI run.

5. **The one thing that worked.** 176 proactive alerts per run. Ketenzorg tripled. None of it mattered — until I changed how disease responds to treatment. One parameter shift. Twenty percent fewer deaths.

The code is on GitHub. The simulation runs in a browser. The research runner produces 40 trials of statistical output in under a minute.

I'm looking for healthcare professionals, researchers, and skeptics. Especially skeptics.

What would you test in Cammelot?

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

[📸 Logo: Cammelot pixel logo — castle + health cross, SNES style]

---

## Visual Assets Needed

1. **Hero image** — Aerial screenshot of Cammelot (vibrant SNES colors, citizens moving)
2. **Cammelot logo** — Pixel-art (castle + health cross, "Press Start 2P" font), SVG+PNG
3. **Architecture diagram** — Cognitive loop → FHIR memory → A2A → Markov engine (pixel-art style)
4. **IST vs SOLL parameter comparison** — Visual side-by-side (not just a table)
5. **IST vs SOLL screenshot split** — Left: ghosts/queues/burnout. Right: alerts/low burnout.

## Publishing Order

1. **Post 0** (this) → 2. **Post 1** (3 days) → 3. **Post 2** (3 days) → 4. **Post 3** (3 days) → 5. **Post 4** (3 days) → 6. **Post 5** (3 days)
Each links back to Post 0. Total series: ~3 weeks.

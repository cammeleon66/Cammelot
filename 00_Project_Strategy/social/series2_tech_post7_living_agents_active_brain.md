# Series 2 — Architecture | Post T7: The Living Patient — Giving the Record a Brain (and Why It Generalises to Cities and Stores)

**Status:** Draft for review (2026-06-09)
**Target:** LinkedIn (AI/agent builders, healthcare-AI, health-policy, digital-government, retail/supply-chain, data-platform people)
**Tags:** #AgenticAI #PreventativeCare #DigitalTwin #HealthcareAI #PublicSector #AgenticCommerce #Cammelot

> **Series note:** Series 2 is about architecture — agent identity, memory, cognition, persona, and resilience. This is **Post T7 (the concept)**: what the SOLL state in Cammelot is actually *for*. It builds on **T3 (the cognitive loop)**, **T4 (the agentic mesh)** and **T5 (the persona layer)**, and it sets up the uncomfortable counter-weight in **T6 (when the shared substrate goes dark)**.

---

## Post

For two years, almost every serious healthcare-AI conversation I've been in has been about the same thing: **getting the data to flow.** Eleven percent of Dutch health data is meaningfully interoperable. Records are scattered across systems that don't talk, in formats that don't match, at a quality that makes any downstream model nervous. So we built integration projects. Data lakes. Mapping layers. FHIR gateways. A decade of heroic plumbing whose entire ambition was: *let the right number reach the right screen at the right time.*

I want to argue that this era is ending — and that we are mostly preparing for the wrong thing on the other side of it.

Agentic software engineering and agentic data engineering are collapsing the cost of the plumbing. Pipelines that took a team a quarter now get scaffolded, mapped, validated and maintained by agents that read the schemas, write the transforms, and reconcile the formats continuously. The scattered, uncoupled, multi-format, low-quality data problem doesn't vanish by magic — but it stops being the *bottleneck*. In the SOLL state I model in Cammelot, interoperable data goes from ~11% to ~66% not because someone finally finished the integration project, but because keeping data coherent becomes a standing, automated capability rather than a heroic one-off.

And here is the trap. **A system where data finally flows is still a system that waits.** Flowing data lands on a dashboard. A dashboard needs a human to look at it. And the one thing the Dutch health system has *least* of — the binding constraint behind every waiting list, every 12-week Treeknorm breach, every burned-out GP — is **human attention**. We are short 66,400 care workers today and on track for 301,000 by 2035. Solving the data problem and then routing the result to an already-saturated human is not a transformation. It's a better-instrumented version of the same gridlock.

The leap isn't *data that flows*. It's **a brain that acts on top of it.**

---

### The Living Patient, defined

I use "Living Patient" to mean something specific, and it is *not* the persona layer from Post T5 (that's how I make simulated citizens *behave* differently). The Living Patient is the **SOLL product concept**: an autonomous agent that lives alongside a real person's health record, continuously reasons over it, and — when the trajectory turns bad — **reaches out first.**

Not a portal you log into. Not an alert a clinician has to notice. An agent whose default state is *attention*, whose output is *action*, and whose job is to make sure the system contacts you before your body forces the issue.

Concretely, the Living Patient does four things a record can't:

1. **It watches.** Every new observation — a creeping blood pressure, a missed refill, a wearable's resting heart-rate drift, a lab value out of range — is an event it sees, in context, against your whole history.
2. **It predicts.** On top of the clean record sits a digital twin: a model of *your* trajectory, not the population's. It doesn't ask "is this value abnormal?" It asks "is *this person* deteriorating, and how fast?"
3. **It decides.** Against a policy — clinical guidelines, your consent settings, fairness constraints — it chooses whether to do nothing, nudge, book, or escalate.
4. **It acts outward.** It sends *you* the message: *"Your numbers have been drifting for three weeks. I've held a slot with your GP on Thursday at 14:00 — shall I confirm it?"* Or it pings your GP's queue with a pre-built, FHIR-native summary so the human starts the consult already informed.

The record is a noun. The Living Patient is a verb. That's the whole idea.

---

### How it actually works (the architecture)

This isn't speculative for me — it's the SOLL half of the Cammelot mesh, and it reuses machinery I've already written about:

- **A coherent substrate (T3, T4).** A FHIR-native memory store where every action is a resource, kept coherent by agentic data engineering. This is the "data finally flows" layer — necessary, not sufficient.
- **A digital twin per person.** A predictive model over that person's memory stream. In Cammelot this is deliberately humble — a calibrated Markov disease model plus an HP-style deterioration score — but the *shape* is the point: continuous, individual risk, not a population average.
- **A cognitive loop (T3).** Observe → reflect → plan → act, every tick. The reflection step is where "BP up, refill missed, twin says rising heart-failure risk" becomes a *conclusion*. The plan step turns the conclusion into an intervention.
- **Effectors over A2A (T4).** The agent doesn't just think; it *messages*, it *books*, it *refers* — using the same agent-to-agent protocol the GP and specialist agents already speak. Proactive outreach is just an outbound message with a clinical reason attached.
- **Guardrails, first-class.** Consent gates (you opt in, you can mute, you can leave), a human-in-the-loop threshold for anything high-stakes, an audit trail (every nudge is a logged FHIR resource), and a fairness monitor watching *who* gets reached — because an outreach engine is also, structurally, a *triage* engine, and triage is where bias hides.

None of these pieces are exotic. The shift is one of **default**. Today the record's default is *silence until summoned*. The Living Patient's default is *act until told to stop*.

---

### Reactive vs proactive: the inversion, with receipts

This is the single distinction the whole concept rests on, and I can put numbers on it from the simulation.

In **IST** — today's system — care is *pulled*. You notice symptoms, you decide to seek help, you enter a queue, you wait past the Treeknorm, and sometimes the waiting itself is what kills you. In my 100-run study, IST produces **zero proactive interventions.** By construction *and* by emergence: there is no agent whose job is to reach out, so no one does. Demand only ever arrives at the emergency door.

In **SOLL** — the Living Patient switched on — care is *pushed*. Across the same 100 runs, the same town generates **305 proactive alerts per run** (0 → 305; Cohen's d ≈ −5.4 — about as unambiguous as effect sizes get) and **+177% more chronic-care (ketenzorg) interventions** (62 → 171 per run; d ≈ −1.7, significant). Administrative waste falls from ~€33,600 to ~€5,600 per run as the ambient AI absorbs the paperwork that was eating 30% of clinician time. The active brain doesn't invent demand — it *re-times* it, moving care upstream of the crisis.

I owe you the honest caveats, because the concept is only worth anything if it survives them:

- **ER load barely moves** in these runs (62.6 → 68.4; a small, significant *increase*). Proactive outreach surfaces need that was previously invisible; in a town this size, more contact can mean more onward referral before it means less. "Prevention reduces acute load" is a *hypothesis the architecture makes testable*, not a result I'm claiming.
- **This is a 45-agent town.** Mortality comparisons are underpowered by design; read them as mechanism, not as a body count. (The persona work in T5 found preventable deaths fall most exactly where the system is *worst* — which is the same story from the other side: a proactive system flattens the penalty for being a human who waits.)
- **The digital twin here is a toy.** A real Living Patient needs validated risk models, calibration per condition, and a defensible false-positive rate. My point is architectural, not clinical.

What the simulation *does* show cleanly is the mechanism: give the record a brain with the authority to act, and the system stops waiting for people to collapse into it.

---

### Why this generalises: the Living Citizen and the Living Store

Strip "Living Patient" down to its skeleton and you get a pattern with three requirements:

1. an **entity that accumulates state over time** (a person, a household, a store),
2. **data that can flow** about that entity (now cheap, thanks to agentic engineering), and
3. **actions that can be initiated** on its behalf (a message, a booking, an order).

Wherever those three hold, you can put a brain on top of the record. Two examples I find compelling — and uncomfortable — in equal measure.

**The Living Citizen (municipalities and government).** A resident accumulates state too: income, benefits eligibility, debt, housing status, life events. Today government is overwhelmingly *reactive* — you discover a benefit you were owed two years late; debt compounds into eviction because no one connected the missed-rent signal to the eligibility you already qualified for. A Living Citizen agent watches those signals against entitlement rules and **reaches out before the cliff**: *"You appear eligible for support you're not receiving — shall I start the application?"* The same inversion — from "come to the counter" to "the service finds you" — applied to public administration. Preventative governance instead of reactive bureaucracy.

This is also where the concept is *most* dangerous, and I won't pretend otherwise. An agent that proactively contacts citizens about their finances and housing is, viewed from one angle, a welfare brain; viewed from another, a surveillance and behavioural-control apparatus. The line between *care* and *control* is consent, transparency, the right to opt out, and a hard stop on coercive use. Get that wrong and "Living Citizen" is a dystopia with a friendly UI.

**The Living Store (retail and supply chains).** Here I deliberately say "Living *Store*," not "Living Customer." You *could* build a customer-side agent — and agentic commerce (autonomous purchasing, UCP-style transactions) will — but the entity with the richest, fastest-accruing, *legitimately observable* state isn't the shopper; it's the store and its supply chain. Demand signals, stock levels, lead times, spoilage curves, weather, local events. A Living Store agent watches its own shelves and its suppliers' twins and **acts before the stockout or the waste**: re-forecasts, reorders, re-prices, rebalances between locations — autonomously, with humans setting policy rather than placing orders. Same skeleton: flowing data plus a brain that initiates, this time pointed at inventory instead of arteries. (And the consent calculus is *easier* here precisely because the watched entity is the business itself, not a person — which is exactly why retail will probably ship this pattern first.)

The general claim: **"Living X" = give X a continuously-reasoning agent that turns flowing data into autonomous, preventative action.** Healthcare is just where the stakes, the data, and the crisis are highest at the same time — which is why I think it's where this gets proven or disproven first.

---

### The parts that should keep you up at night

A concept post that only sells the upside is marketing. So, the failure modes I take seriously:

- **Dependency and concentration risk.** An active brain you come to rely on is, by definition, a system you can't function without — which is the *exact* failure mode of Post T6. If the Living Patient mesh runs on one substrate from one vendor, you've built a national single point of failure and given it a caring voice. Plurality, exit rights, and graceful degradation aren't features here; they're the price of admission.
- **Alert fatigue and false positives.** A brain that cries wolf trains people to ignore it — and in healthcare, a confidently wrong "you're fine" is its own kind of harm. The false-positive rate isn't a tuning detail; it's the thing that decides whether the concept is trusted or muted.
- **Fairness.** Autonomous outreach is autonomous triage. Whoever the brain reaches out to *more* gets more care; whoever it under-serves gets less, silently. Bias here doesn't show up as a denied claim — it shows up as a phone that simply rings less often for some groups. That has to be measured continuously, not audited annually.
- **Consent and autonomy.** Nudging is not overriding. The right to be left alone has to survive contact with a system whose default is to act.
- **Liability.** When the brain books, defers, or reassures, who is accountable for the outcome? "The model decided" is not an answer a regulator — or a family — will accept.

None of these are reasons not to build it. They're the reasons to build it *deliberately*, with the governance wired in from the first commit rather than retrofitted after the first incident.

---

### The one-line version

For thirty years we built **systems of record**. The next decade is about **systems of action** — records with a brain on top, whose default is to reach out before you have to. Healthcare gets it first because the crisis is worst and the data is richest. But the Living Patient, the Living Citizen, and the Living Store are the same idea wearing three coats: *let the data flow, then give it the authority to act.*

I'd rather argue about this now, while it's still a simulation, than after it's infrastructure.

[🔗 GitHub: github.com/msft-common-demos/Cammelot] · [🌐 Live town: cammelot.org]

*Earlier in Series 2 → T3 (the cognitive loop), T4 (the agentic mesh), T5 (the persona layer). The counter-weight → T6, "When Chipsoft Goes Dark": the same active brain, viewed as a dependency you can't switch off.*

---

### Figures

**Figure 1 — Reactive vs proactive, measured.** `scripts/output/persona_ab_figure_data.txt`
- *Caption:* 100 runs × 3,000 cycles. Switching on the Living Patient (SOLL) takes proactive interventions from **0 to ~305 per run** and chronic-care (ketenzorg) interventions up **+177%** (62 → 171, d ≈ −1.7, significant), while administrative waste falls from ~€33.6k to ~€5.6k per run. ER load barely moves (62.6 → 68.4) — prevention re-times demand rather than obviously deleting it at this town size.
- *Alt text:* A data table comparing IST and SOLL modes, showing proactive alerts rising from zero to about three hundred per run, chronic-care interventions up 177%, and administrative waste falling by roughly 83% under SOLL.

**Figure 2 — The town, watched and acted upon.** `scripts/output/world_town_screenshot.png`
- *Caption:* The 16-bit Cammelot town. In SOLL the same population is monitored continuously and contacted proactively; sprites are routed to a GP or the hospital *before* the deterioration that, in IST, would have put them in a queue past the Treeknorm.
- *Alt text:* Pixel-art town with three GP practices and a central hospital; citizen sprites move along paths between homes and care buildings.

---

*Disclosure: I've worked in Big Tech on AI for years, so I may be biased toward AI-enabled architectures. Cammelot is an independent applied-research project. It models simulated citizens, not real patients — nothing here is clinical advice or a recommendation about any real system, product, or government programme.*

*Data & sources: demographics and mortality calibrated to **CBS**; chronic-disease prevalence and progression to **RIVM**; care tariffs and administrative-burden figures to **NZa**; staffing-shortage and interoperability assumptions to **IZA** and national digital-health reporting. The data-interoperability figures (~11% today → ~66% in SOLL) are scenario assumptions, not measured outcomes. Reproducibility: fixed seeds, 100-run protocol, open code. Effect sizes are reported; mortality differences are underpowered at N=45 by design — I do not claim "AI saves lives."*

*Technical note: the SOLL "active brain" in the simulation is the proactive-care and ambient-admin machinery in the unified `site/world.html` engine (proactive alerts, ketenzorg uptake, admin load 30%→5%), measured via `scripts/persona_ab_study.cjs` against `scripts/output/persona_ab_comparison.json`. The digital twin is a calibrated Markov disease model plus a deterioration score — deliberately humble; the contribution here is architectural, not a validated clinical risk model. The Living Citizen and Living Store extrapolations are conceptual, not simulated.*

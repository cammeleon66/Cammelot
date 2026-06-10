# Series 2 — Architecture | Post T7: The Living Patient
## From systems of record to systems of action

**Status:** Draft for review (2026-06-09)
**Target:** LinkedIn (AI/agent builders, healthcare-AI, health-policy, digital-government, retail/supply-chain, data-platform people)
**Tags:** #AgenticAI #PreventativeCare #DigitalTwin #HealthcareAI #PublicSector #AgenticCommerce #Cammelot

> **Series note:** Series 2 is about architecture: agent identity, memory, cognition, persona, and resilience. This is Post T7, the concept post, which describes what the SOLL state in Cammelot is actually for. It builds on T3 (the cognitive loop), T4 (the agentic mesh) and T5 (the persona layer), and it sets up the counter-weight in T6 (when the shared substrate goes dark).

---

## Post

For two years, almost every serious healthcare-AI conversation I have been in has been about the same thing: getting the data to flow. About 11% of Dutch health data is meaningfully interoperable. Records are scattered across systems that do not talk to each other, in formats that do not match, at a quality that makes any downstream model nervous. So we built integration projects, data lakes, mapping layers, and FHIR gateways. A decade of plumbing whose entire ambition was to let the right number reach the right screen at the right time.

I want to argue that this era is ending, and that we are mostly preparing for the wrong thing on the other side of it.

![From a system of record to a system of action](assets/living_patient_stages.svg)

*Figure 1. The same health record at three stages. In stage 1 (today) the data is fragmented and care is reactive: you seek help, then you wait. In stage 2 the data finally flows into one coherent record, but a dashboard still needs a human to look at it. In stage 3 an agent reasons over the record and reaches out before deterioration. Only the third stage acts.*

Agentic software engineering and agentic data engineering are lowering the cost of the plumbing. Pipelines that took a team a quarter can now be scaffolded, mapped, validated and maintained by agents that read the schemas, write the transforms, and reconcile the formats continuously. The scattered, uncoupled, multi-format, low-quality data problem does not vanish, but it stops being the bottleneck. In the SOLL state I model in Cammelot, interoperable data goes from about 11% to about 66%, not because someone finally finished the integration project, but because keeping data coherent becomes a standing, automated capability rather than a one-off effort.

There is a trap on the other side of that. A system where data finally flows is still a system that waits. Flowing data lands on a dashboard, and a dashboard needs a human to look at it. The one thing the Dutch health system has least of, the binding constraint behind every waiting list, every 12-week Treeknorm breach, and every overloaded GP, is human attention. The Netherlands is short roughly 66,400 care workers today and is on track for about 301,000 by 2035. Solving the data problem and then routing the result to an already-saturated human is not a transformation. It is a better-instrumented version of the same gridlock.

The step that matters is not data that flows. It is a brain that acts on top of it.

---

### The Living Patient, defined

I use "Living Patient" to mean something specific, and it is not the persona layer from Post T5 (that is how I make simulated citizens behave differently). The Living Patient is the SOLL product concept: an autonomous agent that lives alongside a real person's health record, continuously reasons over it, and reaches out first when the trajectory turns bad.

It is not a portal you log into, and not an alert a clinician has to notice. It is an agent whose default state is attention, whose output is action, and whose job is to make sure the system contacts you before your body forces the issue.

Concretely, the Living Patient does four things a record cannot:

1. **It watches.** Every new observation, such as a creeping blood pressure, a missed refill, a wearable's resting heart-rate drift, or a lab value out of range, is an event it sees in context, against your whole history.
2. **It predicts.** On top of the clean record sits a digital twin: a model of your trajectory, not the population's. It does not ask whether a value is abnormal. It asks whether this particular person is deteriorating, and how fast.
3. **It decides.** Against a policy made of clinical guidelines, your consent settings, and fairness constraints, it chooses whether to do nothing, nudge, book, or escalate.
4. **It acts outward.** It can send you a message, for example: "Your numbers have been drifting for three weeks. I have held a slot with your GP on Thursday at 14:00, shall I confirm it?" Or it can place a pre-built, FHIR-native summary in your GP's queue so the human starts the consult already informed.

The difference from today's record is not the data. It is the default behaviour. A record stays silent until summoned. The Living Patient acts until it is told to stop.

---

### How it works (the architecture)

This is not speculative for me. It is the SOLL half of the Cammelot mesh, and it reuses machinery I have already written about:

- **A coherent substrate (T3, T4).** A FHIR-native memory store where every action is a resource, kept coherent by agentic data engineering. This is the layer where data finally flows. It is necessary, but not sufficient.
- **A digital twin per person.** A predictive model over that person's memory stream. In Cammelot this is deliberately humble, a calibrated Markov disease model plus a deterioration score, but the shape is the point: continuous, individual risk, rather than a population average.
- **A cognitive loop (T3).** Observe, reflect, plan, act, every tick. The reflection step is where "blood pressure up, refill missed, twin says rising heart-failure risk" becomes a conclusion. The plan step turns that conclusion into an intervention.
- **Effectors over A2A (T4).** The agent does not only think; it messages, books, and refers, using the same agent-to-agent protocol the GP and specialist agents already speak. Proactive outreach is simply an outbound message with a clinical reason attached.
- **Guardrails as first-class components.** Consent gates (you opt in, you can mute, you can leave), a human-in-the-loop threshold for anything high-stakes, an audit trail in which every nudge is a logged FHIR resource, and a fairness monitor watching who gets reached. An outreach engine is also, structurally, a triage engine, and triage is where bias tends to hide.

None of these pieces are exotic. The change is one of default. Today the record's default is silence until summoned. The Living Patient's default is to act until told to stop.

---

### Reactive versus proactive

This is the distinction the concept rests on, and I can put numbers on it from the simulation.

In IST, today's system, care is pulled. You notice symptoms, you decide to seek help, you enter a queue, you wait past the Treeknorm, and sometimes the waiting itself is what kills you. In my 100-run study, IST produces zero proactive interventions, both by construction and by emergence: there is no agent whose job is to reach out, so no one does. Demand only ever arrives at the emergency door.

In SOLL, with the Living Patient switched on, care is pushed. Across the same 100 runs, the same town generates about 322 proactive alerts per run (0 to 322, Cohen's d of about 4.0), and about 182% more chronic-care (ketenzorg) interventions (66 to 187 per run, d of about 1.5, significant). Administrative waste falls from roughly €33,600 to roughly €5,600 per run as the ambient AI absorbs the paperwork that was consuming about 30% of clinician time. The active brain does not invent demand. It re-times it, moving care upstream of the crisis.

The honest caveats matter, because the concept is only worth anything if it survives them:

- **Emergency-room load does not change significantly** in these runs (64.5 to 63.3 per run, not significant). The active brain re-times demand upstream without measurably raising acute load at this town size, but it does not clearly lower it either. "Prevention reduces acute load" is a hypothesis the architecture makes testable, not a result I am claiming.
- **This is a 45-agent town.** Mortality comparisons are underpowered by design; read them as mechanism, not as a body count. The persona work in T5 found that preventable deaths fall most exactly where the system is worst, which is the same story from the other side: a proactive system flattens the penalty for being a person who waits.
- **The digital twin here is a toy.** A real Living Patient would need validated risk models, calibration per condition, and a defensible false-positive rate. The point I am making is architectural, not clinical.

What the simulation does show cleanly is the mechanism. Give the record a brain with the authority to act, and the system stops waiting for people to collapse into it.

---

### Why this generalises: the Living Citizen and the Living Store

Reduced to its skeleton, "Living Patient" is a pattern with three requirements:

1. an entity that accumulates state over time (a person, a household, a store),
2. data that can flow about that entity (now cheaper, thanks to agentic engineering), and
3. actions that can be initiated on its behalf (a message, a booking, an order).

Wherever those three hold, you can put a brain on top of the record. Two examples seem worth thinking through, and both are as uncomfortable as they are useful.

**The Living Citizen (municipalities and government).** A resident accumulates state too: income, benefits eligibility, debt, housing status, life events. Today government is overwhelmingly reactive. People discover a benefit they were owed two years late, or debt compounds into eviction because no one connected the missed-rent signal to the eligibility the person already qualified for. A Living Citizen agent watches those signals against entitlement rules and reaches out before the cliff: "You appear eligible for support you are not receiving, shall I start the application?" It is the same inversion, from "come to the counter" to "the service finds you", applied to public administration. Preventative governance instead of reactive bureaucracy.

This is also where the concept is most dangerous, and I will not pretend otherwise. An agent that proactively contacts citizens about their finances and housing is, from one angle, a welfare brain, and from another, a surveillance and behavioural-control apparatus. The line between care and control is drawn by consent, transparency, the right to opt out, and a hard stop on coercive use. Get that wrong and the Living Citizen becomes a far more intrusive state wearing a friendly interface.

**The Living Store (retail and supply chains).** Here I deliberately say "Living Store", not "Living Customer". You could build a customer-side agent, and agentic commerce (autonomous purchasing, UCP-style transactions) will. But the entity with the richest, fastest-accruing, and legitimately observable state is not the shopper; it is the store and its supply chain: demand signals, stock levels, lead times, spoilage curves, weather, local events. A Living Store agent watches its own shelves and its suppliers' twins and acts before the stockout or the waste, by re-forecasting, reordering, re-pricing, and rebalancing between locations, with humans setting policy rather than placing orders. The same skeleton, flowing data plus a brain that initiates, this time pointed at inventory instead of arteries. The consent question is easier here precisely because the watched entity is the business itself rather than a person, which is part of why retail will probably ship this pattern first.

The general claim is simple. "Living X" means giving X a continuously-reasoning agent that turns flowing data into autonomous, preventative action. Healthcare is just the domain where the stakes, the data, and the crisis are highest at the same time, which is why I think it is where the idea gets proven or disproven first.

---

### The parts I take seriously as risks

A concept that only describes the upside is marketing. These are the failure modes I take seriously:

- **Dependency and concentration risk.** An active brain you come to rely on is, by definition, a system you cannot function without, which is the exact failure mode of Post T6. If the Living Patient mesh runs on one substrate from one vendor, you have built a national single point of failure and given it a caring voice. Plurality, exit rights, and graceful degradation are not features here; they are the price of admission.
- **Alert fatigue and false positives.** A brain that cries wolf trains people to ignore it, and in healthcare a confidently wrong "you are fine" is its own kind of harm. The false-positive rate is not a tuning detail; it decides whether the concept is trusted or muted.
- **Fairness.** Autonomous outreach is autonomous triage. Whoever the brain reaches out to more gets more care; whoever it under-serves gets less, silently. Bias here does not show up as a denied claim. It shows up as a phone that simply rings less often for some groups. That has to be measured continuously, not audited once a year.
- **Consent and autonomy.** Nudging is not overriding. The right to be left alone has to survive contact with a system whose default is to act.
- **Liability.** When the brain books, defers, or reassures, who is accountable for the outcome? "The model decided" is not an answer a regulator, or a family, will accept.

None of these are reasons not to build the concept. They are reasons to build it deliberately, with the governance wired in from the first commit rather than retrofitted after the first incident.

---

### Summary

For about thirty years we built systems of record. The next decade is about systems of action: records with a brain on top, whose default is to reach out before a person has to. Healthcare is likely to reach this first because its crisis is worst and its data is richest. The Living Patient, the Living Citizen, and the Living Store are versions of one idea: let the data flow, then give it the authority to act. I would rather examine this carefully now, while it is still a simulation, than after it is infrastructure.

[GitHub: github.com/msft-common-demos/Cammelot] · [Live town: cammelot.org]

*Earlier in Series 2: T3 (the cognitive loop), T4 (the agentic mesh), T5 (the persona layer). The counter-weight: T6, "When Chipsoft Goes Dark", which looks at the same active brain as a dependency you cannot switch off.*

---

### Figures

**Figure 1 (top of post). From a system of record to a system of action.** `scripts/output/living_patient_stages.svg`
- *Caption:* Three stages of the same health record. Stage 1 (today, IST): fragmented data, about 11% interoperable, care is reactive. Stage 2: one coherent record kept current by agentic data engineering, about 66% interoperable, but a dashboard still waits for a human. Stage 3 (SOLL): an agent with a digital twin reasons over the record and reaches out before deterioration, making care proactive.
- *Alt text:* A three-panel diagram. The left panel shows scattered data silos and a waiting queue under the label "reactive". The middle panel shows the silos feeding one unified record that produces a dashboard a human must watch. The right panel shows an agent above the record sending a message to a person, labelled "proactive: a system of action".

**Figure 2. Reactive versus proactive, measured.** `scripts/output/persona_ab_figure_data.txt`
- *Caption:* 100 runs of 3,000 cycles. Switching on the Living Patient (SOLL) takes proactive interventions from 0 to about 322 per run and chronic-care (ketenzorg) interventions up about 182% (66 to 187, d of about 1.5, significant), while administrative waste falls from about €33.6k to about €5.6k per run. Emergency-room load does not change significantly (64.5 to 63.3), so prevention re-times demand upstream rather than visibly adding or removing acute load at this town size.
- *Alt text:* A data table comparing IST and SOLL modes, showing proactive alerts rising from zero to about three hundred and twenty per run, chronic-care interventions up about 182%, and administrative waste falling by roughly 83% under SOLL.

**Figure 3. The town, watched and acted upon.** `scripts/output/world_town_screenshot.png`
- *Caption:* The 16-bit Cammelot town. In SOLL the same population is monitored continuously and contacted proactively, so sprites are routed to a GP or the hospital before the deterioration that, in IST, would have put them in a queue past the Treeknorm.
- *Alt text:* Pixel-art town with three GP practices and a central hospital; citizen sprites move along paths between homes and care buildings.

---

*Disclosure: I have worked in Big Tech on AI for years, so I may be biased toward AI-enabled architectures. Cammelot is an independent applied-research project. It models simulated citizens, not real patients, and nothing here is clinical advice or a recommendation about any real system, product, or government programme.*

*Data and sources: demographics and mortality calibrated to CBS; chronic-disease prevalence and progression to RIVM; care tariffs and administrative-burden figures to NZa; staffing-shortage and interoperability assumptions to IZA and national digital-health reporting. The data-interoperability figures (about 11% today rising to about 66% in SOLL) are scenario assumptions, not measured outcomes. Reproducibility: fixed seeds, a 100-run protocol, and open code. Effect sizes are reported; mortality differences are underpowered at N=45 by design, and I do not claim that AI saves lives.*

*Technical note: the SOLL "active brain" in the simulation is the proactive-care and ambient-admin machinery in the unified `site/world.html` engine, measured via `scripts/persona_ab_study.cjs` against `scripts/output/persona_ab_comparison.json`. The four behaviours in the text are wired in: the twin watches a per-agent risk trajectory (a deterioration trend over recent ticks, not just a point value); on a rising trajectory it acts outward, sending the patient a message, writing a FHIR `CAMMELOT-ALERT` audit resource, and pre-briefing the GP over the same A2A protocol the providers already speak; outreach is consent-gated (opted-out citizens are never contacted) and the reach is tracked by age group. Admin load moving from 30% to 5% is a deterministic model input, not a discovered effect. The digital twin is a calibrated Markov disease model plus a deterioration score, deliberately humble; the contribution here is architectural, not a validated clinical risk model. The Living Citizen and Living Store extrapolations are conceptual, not simulated.*

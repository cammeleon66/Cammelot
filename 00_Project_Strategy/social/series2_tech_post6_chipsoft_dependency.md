# Series 2 — Architecture | Post T6: When Chipsoft Goes Dark — The Monoculture Risk Nobody Wants to Price

**Status:** Ready to publish (2026-06-09)
**Target:** LinkedIn (healthcare IT, CISOs, platform architects, policy people)
**Tags:** #HealthcareSecurity #ConcentrationRisk #Ransomware #AgenticAI #Resilience #Cammelot

> **Series note:** Series 2 is about architecture — agent identity, memory, cognition, persona, and resilience. This is **Post T6 (resilience & concentration risk)**; it follows **T5 (the living patient agent)** and calls back to **T2 (the forged Mordred agent)** and **T3 (the FHIR memory / cognitive loop)**.

---

## Post

On 7 April 2026, Chipsoft was reportedly hit by ransomware. Chipsoft makes HiX, the electronic health record that runs an estimated **70–80% of Dutch hospitals**. The company took its website, the patient portal, HiX Mobile and the Zorgplatform offline as a precaution. At least eleven hospitals disconnected. Staff went back to paper and phones. Chipsoft told partners it "cannot rule out that patient data has been accessed or stolen."

I have seen no reports of patient deaths. Critical care kept running. But for a few days, a single company's bad week became a national clinical-logistics problem. That's not a Chipsoft story. That's a **concentration risk** story — and it's the exact failure mode I'd been simulating in Cammelot months before it happened.

---

### The thing we don't put on the architecture diagram

When you draw a hospital's IT, you draw boxes: EHR, lab system, imaging, pharmacy, billing. What you don't draw is the number above each box — *how many other hospitals depend on the same box*. That number is the risk.

One vendor at 70–80% national share isn't a product. It's **infrastructure**. And we don't regulate it, price it, or back it up the way we treat infrastructure. We treat it like a software purchase. A hospital does diligence on *its own* HiX install — uptime, support SLA, GDPR processing agreement — and never has to reckon with the fact that its resilience is correlated with two hundred other hospitals it has never spoken to. When the shared dependency goes down, everyone's "five nines" turns out to have been the same nine all along.

This is the part of the Chipsoft incident that should keep planners up at night. Not "a vendor got hacked" — that's Tuesday. It's that **a vendor getting hacked was a single event that degraded a large fraction of an entire country's hospital care simultaneously.** Diversity is what stops a local failure from becoming a national one, and Dutch hospital IT has very little of it.

---

### I built this attack before it was news

In Post T2 I introduced Mordred — a forged agent in my Cammelot simulation who published a fake "cardiologist" card with a zero-week wait time, vacuumed up every heart-patient referral, treated no one, and collapsed the cardiology pathway in well under 50 cycles. That experiment was about a *malicious* agent.

Chipsoft is the other half of the same lesson: you don't need a malicious *insider*. You need a single *shared* component, and an outage — accidental or hostile — does the rest. Mordred showed how one corrupted node poisons a mesh. Chipsoft showed how one *unavailable* node starves it. Same architectural sin, two symptoms: **the system trusts that one thing will always be there, and builds no answer for the day it isn't.**

In Cammelot terms: imagine the FHIR memory store — the shared substrate every agent reads and writes — simply going dark. In my current design, that's game over. Every GP loses their patients' histories. Every referral loses its context. The cognitive loop has nothing to reflect *on*. I built a single source of truth, which is another way of saying I built a single point of failure and gave it a nicer name.

---

### Why agentic AI makes this *worse* before it makes it better

Here's the uncomfortable part for anyone (me included) selling the "AI-native healthcare" vision. The SOLL mode of Cammelot — the optimistic future where AI removes 83.3% of the administrative waste and cuts average GP burnout by 76% — achieves those numbers precisely by **increasing dependency**. (Worth saying plainly: those two figures are partly *by construction*. Admin load is a model input I move from 30% to 5%, so the headline reductions are closer to a stated assumption than a discovered result. The genuinely *emergent* SOLL effects are different in kind — proactive alerts appearing where IST had exactly zero, and a 172% rise in chronic-care interventions.) Ambient AI scribes, autonomous referral routing, digital-twin triage: every one of those is a new thing that has to be *up* for care to flow.

The more you automate the human out of the loop, the more catastrophic the loop's failure becomes. When a GP does referrals by hand and the system is down, the GP picks up the phone. When an autonomous agent does referrals and *its* dependency is down, there's no one in the chair. Efficiency and fragility are bought with the same coin. If your transformation story is "we removed the manual fallback," you didn't remove cost — you converted it into tail risk and stopped pricing it.

So the honest version of the SOLL pitch isn't "AI makes healthcare resilient." It's "AI makes healthcare *efficient*, and efficiency without redundancy is brittle." You have to design the redundancy back in on purpose, because the optimisation will eat it otherwise.

---

### What decentralisation actually buys you (and what it doesn't)

The A2A / agentic-mesh architecture I'm building Cammelot on has a genuine structural answer to monoculture: there is no single HiX. Each provider runs their own agent, publishes their own card, holds their own slice of state. Knock one out and the mesh degrades gracefully instead of going dark. That's the good news, and it's real.

But — and I want to be precise, because the easy version of this post is "decentralise everything and you're safe" — a mesh doesn't delete concentration risk. It *moves* it:

- **Shared protocol = shared vulnerability.** If 80% of agents speak the same A2A library and that library has a flaw, you've rebuilt the monoculture one layer down. (Cf. the vantage6 supply-chain breach from an earlier post — CVE-2026-4404, hardcoded admin credentials in the shared Harbor registry: the weak point was the shared container registry, not any one hospital.)
- **Shared discovery = shared chokepoint.** If every agent finds every other agent through one registry, that registry *is* the new Chipsoft.
- **Shared model = shared failure mode.** If every triage agent is the same fine-tuned model, they share the same blind spots and the same prompt-injection surface. A monoculture of *intelligence* is still a monoculture.

Decentralisation isn't a property you get for free by adding agents. It's a property you have to *defend* — by deliberately diversifying protocols, registries, and models, and by accepting some redundancy you'll be tempted to optimise away.

---

### The four things I'd actually do

This isn't hypothetical hand-wringing; it maps to concrete design choices, and I've started wiring them into the simulation:

A fair objection first: isn't some of this already regulated? Partly. The EU's **NIS2 directive** classifies healthcare providers as essential entities and already mandates supply-chain risk management; the **European Health Data Space (EHDS)** governs interoperability and portability; and the Dutch **Wegiz** law mandates electronic data exchange between care providers. The gap isn't an absence of rules — it's that none of them price *vendor concentration itself*. Supply-chain mandates land on each individual hospital, not on the systemic fact that one vendor sits behind most of them. So the four moves below are less "invent new law" and more "close the concentration gap the existing frameworks leave open."

1. **Treat the shared EHR/FHIR layer as critical infrastructure, not a vendor.** That means a mandated, *tested*, offline-capable fallback — the digital equivalent of the paper-and-phone mode hospitals fell back to on 7 April. If your continuity plan was never rehearsed, you don't have one.

2. **Cap concentration the way finance caps counterparty exposure.** Banks aren't allowed to put all their risk in one counterparty. There's no reason national hospital IT should be allowed to put 80% of clinical operations behind one vendor with no systemic backstop. Price the correlation.

3. **Design for graceful degradation, explicitly.** In Cammelot, an agent that can't reach the FHIR store should fall back to its *local* memory and keep making safe, conservative decisions — not freeze. "What does this system do when its dependency is gone?" should be a required answer, not an afterthought. (My current build fails this test, and I'm fixing it.)

4. **Diversify on purpose.** Different protocol implementations, more than one discovery registry, a mix of models for triage. Redundancy is a cost. It is also the only thing standing between "one company had a bad week" and "a country lost its hospitals for three days."

---

Chipsoft will recover. The hospitals will reconnect, credentials will be rotated, the post-mortem will be written. The lesson will be filed under "cybersecurity" and most of the diagrams will stay exactly as they were.

But the real finding has nothing to do with the attacker, who as of this writing is still unidentified. The finding is that we built a system where *one* of anything — one EHR vendor, one registry, one model, one shared truth — can take down *many*. Cammelot is, among other things, a small machine for making that failure mode visible before it's a headline. The forged agent and the dark vendor are the same simulation with the polarity flipped.

If your healthcare architecture has a box that 80% of the country depends on, the most important number on the diagram is the one you didn't write down.

The simulation is open. Fork it, switch on SOLL, then kill the FHIR store mid-run and watch what your "AI-native future" does without its single source of truth.

[🔗 GitHub: github.com/msft-common-demos/Cammelot] · [🌐 Live town: cammelot.org]

*Earlier in Series 2: Post T5, "The Living Patient Agent" (richer agents) and Post T2, "Mordred" (the forged agent card). This post is their mirror image — not one bad node, but one shared node everyone depends on.*

---

### Figure

**Figure 1 — Efficiency bought with dependency.** `scripts/output/persona_ab_figure_data.txt`
- *Caption:* SOLL vs IST over 100 runs × 3,000 cycles: administrative waste −83.3% and average GP burnout −76% — gains achieved by routing more of care through shared AI dependencies. Efficiency and fragility are bought with the same coin.
- *Alt text:* Data table comparing IST and SOLL simulation modes; SOLL shows large reductions in administrative waste and GP burnout and a rise in proactive alerts and chronic-care interventions, while mortality differences are small and not statistically significant.

---

*Disclosure: I've worked in Big Tech on AI for years, so I may be biased toward AI-enabled architectures. Cammelot is an independent applied-research project. It models simulated citizens, not real patients — nothing here is clinical advice. The SOLL figures are simulation output, not measured real-world results; mortality differences between modes are not statistically significant.*

*On the Chipsoft incident: details are as reported by **Z-CERT** (the Dutch healthcare CERT) and security press and remain under investigation. I separate official/primary reporting from secondary media summaries, keep all claims hedged, and make no assertion of patient harm beyond reported outage and degradation — the argument here is about concentration risk, not proven clinical harm.*

*References: Chipsoft / HiX ransomware incident, 7 April 2026 — Z-CERT (Dutch healthcare CERT); reporting via SecurityAffairs and The Cyber Express. Chipsoft HiX EHR market share in Dutch hospitals (~70–80%). Vantage6 Harbor registry supply-chain breach — CVE-2026-4404 (GoHarbor/Harbor hardcoded-credentials vulnerability); vantage6 community disclosure, April 2026. EU NIS2 Directive (2022/2555). European Health Data Space (EHDS) Regulation. Dutch Wegiz (Wet elektronische gegevensuitwisseling in de zorg). A2A Protocol Specification v1.0.0 (Linux Foundation / Google, 2025). SMART-on-FHIR v2.2.0 (HL7, 2023). NEN 7510/7512/7513 (Dutch healthcare information security standards). Cammelot SOLL metrics: 100-run × 3,000-cycle personas-ON study, see scripts/output/persona_ab_comparison.json and scripts/output/deep_research_100runs.json.*

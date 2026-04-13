# Series 2 — Architecture | Post T4: The Data Mesh is Dead. Long Live the Agentic Mesh.

**Status:** Draft v1 — Deep Research
**Target:** LinkedIn (technical audience, healthcare IT, data architects, policy)
**Tags:** #DataMesh #AgenticMesh #FHIR #A2A #HealthcareInteroperability #Netherlands #Cammelot

---

## Post

In 2019, Zhamak Dehghani published a blog post that changed how enterprises think about data. The core idea of data mesh was elegant: stop dumping everything into a central lake. Let domain teams own their own data. Treat data as a product. Federate governance.

Five years later, the track record is mixed. Zalando, Netflix, PayPal adopted data mesh. Many more tried and failed. The recurring complaints are predictable: federated governance turns into governance-by-committee, domain teams resent the new responsibility because it's rarely compensated, and employees report severe lack of comprehension of what data mesh even means (that last one is from actual academic research, not my opinion).

I think data mesh was the right diagnosis applied to the wrong patient. The problem was real: centralised data teams become bottlenecks. The solution assumed that data wants to sit in one place and be queried. What if data doesn't want to sit anywhere? What if data wants to move?

---

### The Dutch healthcare data problem, specifically

The Netherlands has a healthcare data landscape that makes the data mesh failures look quaint.

There are roughly 12,000 GP practices. About 90 hospital organisations. Eight academic medical centres. Hundreds of mental health, rehabilitation, and home care providers. Every one of them has an EHR (electronic health record). The GP systems mostly run HIS (Huisartsinformatiesysteem) software from a handful of vendors. Hospitals run their own systems. Pharmacies have their own. The national EHR from 2012 is a "virtual EHR" — a reference server that knows which local EHR stores what kind of patient record. It doesn't actually store data. It points to data.

Most data exchange still happens via EDIFACT — a messaging standard from the 1980s that was originally designed for shipping container logistics. In 2024, only about 11% of Dutch health data was interoperable between providers.

The IZA (Integraal Zorgakkoord) wants that at 66% by 2030. They're spending €2.8 billion on transformation plans to get there. Over 270 plans submitted before the postbus closed in July 2025.

The Wegiz (Wet elektronische gegevensuitwisseling in de zorg) — the law mandating electronic data exchange in healthcare — came into effect to force the issue. But mandating exchange and achieving it are different things. The law says you must exchange. It doesn't say how. And "how" is where every integration project in Dutch healthcare goes to die.

---

### Why data mesh won't save healthcare

A data mesh advocate would look at this and say: give each domain (GPs, hospitals, pharmacies) ownership of their data products. Let them publish standardised data contracts. Build a self-serve data platform. Federate the governance.

It sounds reasonable. It doesn't survive contact with the Dutch healthcare system.

**Problem 1: Domain ownership presupposes willing domain owners.**

In data mesh, domain teams are supposed to take end-to-end responsibility for their data products. In Dutch healthcare, a GP practice with 2 GPs and a practice nurse is not a "domain team" in the Thoughtworks sense. They're three people drowning in 30% administrative overhead trying to see patients. Asking them to also maintain a data product with quality metrics, documentation, and access controls is asking them to become a software team. They are not a software team. They are doctors.

The same applies to most hospitals. The IT departments are running EHR systems, not building data products. They have vendor contracts with Chipsoft or Epic or Nexus. The data sits inside those systems, behind vendor-specific APIs. The hospital doesn't own the data product in any meaningful engineering sense. The vendor does.

Data mesh works when you have autonomous engineering teams that can iterate on data quality. Healthcare has autonomous clinical teams that want the computer to stop breaking.

**Problem 2: Data contracts assume stable schemas.**

In retail or fintech, a data contract between "orders" and "payments" domains can be versioned and maintained because the schema is well-understood and relatively stable. In healthcare, the clinical data model is vast, evolving, and clinically nuanced. FHIR R4 defines over 150 resource types. A single patient encounter might generate Condition, Observation, Encounter, Procedure, MedicationRequest, DiagnosticReport, and ServiceRequest resources, each with dozens of fields and extensions.

The Dutch healthcare standards body Nictiz publishes "Zibs" (Zorginformatiebouwstenen — care information building blocks) that try to standardise clinical concepts across systems. There are over 150 Zibs. They're good. They're also insufficient, because the clinical reality is messier than any schema can capture.

A data mesh data contract between "GP practice" and "hospital" would need to cover every possible clinical exchange scenario. That's not a contract. That's a standards body. We already have several of those. They've been working on it for decades.

**Problem 3: Federated governance in healthcare is called "regulation" and it already exists and it already doesn't work well enough.**

Healthcare is the most regulated data domain in existence. GDPR, the Wgbo (Wet geneeskundige behandelingsovereenkomst), NEN 7510 (information security), NEN 7512 (trust infrastructure), NEN 7513 (logging). The governance is not missing. There is too much governance and not enough interoperability.

Data mesh's federated governance model assumes that governance is the thing you need to create. In healthcare, governance is the thing that's preventing data from moving. Adding another governance layer on top of existing regulation is not a solution. It's another committee.

---

### What an agentic mesh does differently

The difference is in the question. Data mesh asks: "How do we organise data so humans can query it?" The agentic mesh asks: "How do we organise agents so they can act on it?"

The difference is agency. In a data mesh, data is passive. It sits in a domain, behind a contract, waiting for someone to pull it. In an agentic mesh, data is carried by agents that can discover each other, negotiate, and act.

In Cammelot, my healthcare simulation, I built this. Every GP and specialist is an autonomous agent. Each publishes an Agent Card — a machine-readable description of capabilities, wait times, and capacity — at a well-known URL. This follows the A2A (Agent-to-Agent) protocol, which Google published as an open standard in 2025.

```json
{
  "agentId": "gp-de-jong",
  "name": "Dr. de Jong",
  "role": "gp",
  "skills": ["triage", "referral", "chronic_care"],
  "status": "available",
  "waitTime": { "weeks": 2, "queueSize": 12 },
  "metadata": { "admin_load": "30%", "max_patients": 2400 }
}
```

When Dr. de Jong needs to refer a patient with heart disease, she doesn't query a data lake. She doesn't look up a data product. Her agent reads the cardiology agent card, checks the wait time, and sends a referral. The referral has a lifecycle (submitted → working → completed). Both sides track it. The data moves with the action.

The patient's medical history is stored as FHIR R4 resources, the international healthcare data standard. But it's not stored in a data product that someone queries. It's the agent's memory. The agent carries its own context. When the agent interacts with another agent, relevant context flows with the interaction, through communication rather than a data pipeline.

This is not theoretical. The A2A protocol (version 1.0.0, released under the Linux Foundation) already specifies discovery, negotiation, task lifecycle, streaming, and push notifications. FHIR R4 has been a published standard since 2019. SMART-on-FHIR provides OAuth-based authorization scoping. The pieces exist. They've never been assembled into a mesh.

---

### The four properties that matter

**1. Discovery, not integration.**

In the current Dutch landscape, adding a new specialist to a hospital's referral network requires integration work that takes, by most estimates I've heard, 3 to 18 months. In an agentic mesh, the specialist publishes an Agent Card and other agents discover it. The network grows by publication, not by connection. This is the same architectural pattern that made the web scale: HTTP didn't require every browser to negotiate with every server. Both sides spoke the same protocol.

**2. Context travels with action.**

In a data mesh, if a GP needs a patient's hospital records, they query the hospital's data product. In an agentic mesh, when the hospital agent sends a discharge summary, the relevant FHIR resources travel with the message. The receiving GP agent has the context it needs to act. No query. No pipeline. No ETL.

This isn't just more convenient. It changes the security model. In a data mesh, you need to secure every data product's access point. In an agentic mesh, you need to secure the communication channel and scope the data per interaction. SMART-on-FHIR already defines this: OAuth tokens scoped to specific patients and resource types per interaction.

**3. Agents can reason about their own data.**

A data product doesn't know when it's stale, incomplete, or contradictory. An agent can. In Cammelot, each GP agent runs a reflection cycle: it notices when its queue is growing, when burnout is climbing, when patients in the waiting list are deteriorating. These reflections drive action — referrals, escalations, alerts.

Extend this to a real-world agentic mesh. A GP agent notices that a patient's blood pressure Observations have been trending upward over three consecutive encounters. It doesn't wait for the GP to notice. It flags the trend, suggests a medication review, and — if authorised — sends a status query to the cardiology agent to check current wait times. The data is the same as in a data mesh. The difference is that something acts on it without being asked.

**4. Governance is embedded, not federated.**

This matters most in the Dutch context. Data mesh says: create a federated governance group that agrees on policies. An agentic mesh says: encode the policies in the agent behaviour and enforce them at the protocol level.

If a GP agent tries to refer a patient to a specialist without meeting the triage threshold, the specialist agent rejects the referral automatically, with a machine-readable reason. If a patient's data is requested without proper SMART-on-FHIR scoping, the request is denied at the protocol level. If an agent card claims a wait time that's inconsistent with its processing rate, anomaly detection flags it (this is the Mordred attack from my security red-teaming post).

You don't need a governance committee to enforce these rules. You need them encoded in the protocol. The governance meeting is replaced by a test suite.

---

### What this looks like in practice

Imagine a 72-year-old patient in Amersfoort with COPD and type 2 diabetes. Today's data flow:

1. GP sees patient. Dictates notes into HIS. Sends EDIFACT referral to hospital. Maybe.
2. Hospital receives referral. Manually enters it into their system. Waits 4-12 weeks.
3. Specialist sees patient. Writes a letter back to the GP. On paper. Or maybe a PDF in a portal.
4. GP receives letter. Types key findings into their own HIS. The two records are now inconsistent.
5. Pharmacist has a third, independent record. The home care nurse has a fourth.

Five providers. Five records. Zero automated interoperability. The data mesh version would give each provider a data product. The GP queries the hospital's data product. Better than nothing. But still pull-based, still requires integration per data product pair, still assumes someone is asking the right question.

The agentic mesh version:

1. GP agent sees patient. FHIR resources (Encounter, Observation, Condition) are created automatically from the consultation. The agent's reflection cycle notices the COPD Markov trajectory is trending toward severe.
2. GP agent reads the pulmonology agent card. Wait time: 6 weeks. Below Treeknorm. Sends A2A referral with embedded FHIR context (relevant Conditions, recent Observations, medication list).
3. Pulmonology agent receives the referral. Validates the triage threshold. Accepts. The patient enters the queue with priority calculated from clinical severity and comorbidity risk.
4. During the wait, the patient's Digital Twin agent monitors the FHIR Observation stream. COPD exacerbation risk rises. The agent sends a proactive alert to the GP agent and the pulmonology agent.
5. Pulmonology agent bumps the patient's priority. The GP agent initiates ketenzorg (chronic care management) while the patient waits.
6. After treatment, the pulmonology agent sends a structured discharge message with FHIR resources. The GP agent's memory is updated. The pharmacy agent receives the MedicationRequest directly.

Same five providers. One shared protocol. Data moves with action. No one queries anything. No one types anything twice. Governance is enforced by the agents' behaviour, not by a committee.

---

### The bigger picture: research and benchmarks

The referral scenario is one interaction type. But the same architecture applies to two things that the current system handles poorly and that data mesh would not improve much either.

**Research queries that travel to the data, instead of the other way around.**

If a university researcher wants to know the average HbA1c trajectory of type 2 diabetes patients who also have COPD in the eastern Netherlands, today that requires: a research protocol, an ethics approval, a data sharing agreement with every participating GP practice and hospital, a data extraction from each system, a de-identification step, a central collection point, and then finally an analysis. This takes months. Sometimes years. By the time the data is assembled, the clinical landscape has changed.

In an agentic mesh, the research query is itself an agent. It carries a signed protocol (approved by the medical ethics committee), a SMART-on-FHIR scope definition (which resource types, which patient cohort), and a consent verification requirement. It travels the mesh. At each GP agent, it presents its credentials. The GP agent checks: does this patient have an active research consent for this type of study? If yes, the agent runs the aggregation locally — on the GP's own data, in the GP's own environment — and returns only the aggregate result. The raw data never leaves the practice.

This is federated computation, not federated governance. The data stays where it is. The question travels. The GP agent doesn't need to understand the research question — it just needs to verify the credentials and run a scoped FHIR query.

The same pattern works for **national quality benchmarks**. The Dutch healthcare inspectorate (IGJ) and quality registries currently collect data by asking every provider to submit reports. Each provider formats them differently. The data arrives late. The benchmarks are always retrospective.

In an agentic mesh, a benchmark agent carries a standardised measurement definition (say: "percentage of diabetes patients with HbA1c below 53 mmol/mol"). It visits each GP agent. Each GP agent runs the calculation against its own FHIR store and returns one number. The benchmark agent aggregates. No data extraction. No manual reports. No formatting inconsistencies. The benchmark updates in near-real-time instead of once a year.

**The open question: who owns the data?**

This is the thing I do not have a good answer for. When a research agent aggregates results across 200 GP agents, who owns the aggregate? The researcher? The GP practices? The patients who consented? When a benchmark agent produces a national quality score, and that score reveals that a specific region underperforms, who is responsible for the underlying data that produced that conclusion?

In a data mesh, ownership is at least theoretically clear: the domain owns its data product. In an agentic mesh, the data never leaves the domain, but the *conclusions* do. Ownership of conclusions derived from federated computation is an unsolved legal question, and it won't be solved by better technology. It needs policy.

I'm flagging this as an open problem, not proposing a solution. The architectural pattern works. The governance question around derived data is hard and I don't think anyone has cracked it yet.

---

### The honest limitations

A few things I'm not claiming.

The agentic mesh does not exist as a production system today. What exists is a simulation (Cammelot) that demonstrates the architectural pattern, and a set of open standards (A2A, FHIR R4, SMART-on-FHIR, openEHR) that could be assembled into one.

This is also not easy. The Dutch healthcare landscape has decades of accumulated technical debt, vendor lock-in, and regulatory complexity. An agentic mesh doesn't eliminate any of that. It provides a different integration architecture that might scale better than the current approach of point-to-point connections.

Agents don't replace humans. The agents I'm describing are infrastructure, not clinical decision-makers. They move data, flag risks, enforce protocols, and manage queues. The GP still decides. The specialist still treats. The agent handles the plumbing that currently consumes 30% of their time.

And data mesh wasn't wrong. The four principles — domain ownership, data as a product, self-serve platform, federated governance — are genuinely good ideas. They just assumed a world where data is the thing you optimise. In healthcare, the thing you optimise is the workflow. And workflows are what agents do.

---

### The uncomfortable question

The IZA is spending €2.8 billion on transformation plans. Most of those plans are building integrations between existing systems. System A talks to System B through a custom connector. Multiply by the number of system pairs and you get the current Dutch healthcare IT landscape: a hairball of point-to-point connections that breaks every time a vendor updates their API.

What if, instead, every provider published an agent card and every interaction followed a shared protocol?

The marginal cost of adding a new provider to the mesh would be near zero. The data exchange problem would become a protocol compliance problem. The governance problem would become a test suite.

I don't think anyone is going to rebuild Dutch healthcare IT around an agentic mesh in the next five years. But I do think the plans that will still be working in ten years are the ones that bet on protocol-level interoperability rather than integration-level connectivity. HTTP beat proprietary networks. FHIR is beating HL7v2. A2A might beat the connector model. Or something like it will.

The architectural principle is the same every time: publish rather than connect. Let the protocol do the work.

Data mesh told us to decentralise the data. The agentic mesh says to decentralise the action.

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*References and sources: Dehghani, Z. "How to Move Beyond a Monolithic Data Lake to a Distributed Data Mesh" (2019, Thoughtworks). A2A Protocol Specification v1.0.0 (Linux Foundation / Google, 2025). FHIR R4 (HL7, 2019). SMART-on-FHIR v2.2.0 (HL7, 2023). IZA — Integraal Zorgakkoord (Dutch Ministry of Health, 2022). NZa market scan waiting times (2024). Wikipedia: Healthcare in the Netherlands — EDIFACT still most common exchange format. Bode et al., Vestues et al., Joshi et al. — empirical data mesh adoption challenges. openEHR Foundation (2003-present). Model Context Protocol (Anthropic, 2024). Nictiz Zibs — 150+ care information building blocks. CBS / RIVM 2025 demographic and prevalence data.*

*Disclosure: I work at Microsoft. My employer builds and sells AI products and cloud infrastructure. I built Cammelot as a personal applied research project, not a Microsoft product. The code is open source. All opinions are my own.*

---

## Data Source
```
Dutch healthcare providers: ~12,000 GP practices, ~90 hospital organisations, 8 UMCs
Interoperability 2024: ~11% (IZA target: 66% by 2030)
IZA transformation budget: €2.8B, 270+ plans
GP admin burden: 30% (NZa/LHV)
FHIR R4 resource types: 150+
Nictiz Zibs: 150+ care information building blocks
A2A Protocol: v1.0.0, Linux Foundation, JSON-RPC 2.0 over HTTPS
SMART-on-FHIR: OAuth-based scoping, v2.2.0
Integration timeline (anecdotal): 3-18 months per system pair
Wegiz: Wet elektronische gegevensuitwisseling in de zorg
Exchange format: EDIFACT (1980s) still dominant
```

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

Everything above — the referral mesh, the Agent Cards, the FHIR memory — is what I built first. After writing the initial version of this post, I went back and added two new agent types to the simulation: a Research Agent that runs federated population health queries across GP practices, and a Benchmark Agent that collects quality metrics from providers. Both run only in SOLL mode. The Research Agent checks consent flags, enforces k-anonymity (cohort ≥ 10), and logs results as FHIR resources. In a 100-run validation, it completed 30 queries per run, encountered ~52 consent refusals (~5% opt-out rate), and had its diabetes-specific cohort suppressed ~29 times because the town is too small for condition-specific anonymity.

The referral scenario is one interaction type. But the same architecture applies to two things that the current system handles poorly and that data mesh would not improve much either.

**The Netherlands already tried "bring the question to the data."**

The concept of sending computation to where data lives, instead of centralising data, is not new. In fact, the Netherlands is one of the pioneers. The Personal Health Train (PHT), developed by Health-RI (the Dutch national health research infrastructure) and DTL (Dutch Techcentre for Life Sciences), explicitly uses this metaphor: data stays at the "station" (the hospital, the GP practice), and the "train" (the analysis) travels to it.

The technical implementation is vantage6, an open-source Privacy Enhancing Technology (PET) platform built by IKNL (Integraal Kankercentrum Nederland). It works: a researcher defines an algorithm, the vantage6 server distributes it to participating nodes, each node runs the computation locally on its own data, and only aggregated results return to the researcher. Federated learning, federated statistics, multi-party computation — vantage6 supports all of them. It has been used in oncology research across multiple hospitals.

So the idea of "questions traveling to data" already exists in the Dutch healthcare ecosystem. The agentic mesh is not that idea. Or rather, it's an evolution of it.

The difference is in what travels. In vantage6, what travels is a containerised algorithm. It runs on data, produces a result, and stops. It has no state, no memory, no ability to discover what other data exists, and no ability to negotiate access on the fly. It's batch computation that happens to be federated.

In an agentic mesh, what travels is an agent. It can discover other agents (via Agent Cards). It can negotiate (present credentials, request specific FHIR scopes). It can reason about what it finds (is this cohort large enough? does the aggregate make sense given what I already know from three other nodes?). And it maintains state across interactions.

Consider a concrete research scenario. A university epidemiologist wants to know the average HbA1c trajectory of type 2 diabetes patients who also have COPD in the eastern Netherlands. Today's process: write a research protocol, obtain METC approval (medical ethics committee), negotiate data sharing agreements with each participating hospital and GP practice, wait for each institution's data manager to extract and de-identify the data, assemble it centrally, and finally run the analysis. Nivel, the Netherlands Institute for Health Services Research, has built an impressive infrastructure for this — their Primary Care Database receives data from hundreds of GP practices. But even Nivel's process requires each practice to participate in the registration, and researchers must formally request access through a governance protocol with steering committees.

With vantage6, this is faster: the algorithm goes to the data. But the researcher still needs to know in advance which nodes have relevant data. The discovery is manual. The consent verification is separate from the computation. The algorithm can't adapt based on what it finds at the first node.

In an agentic mesh, the research agent carries a signed protocol (METC-approved), a SMART-on-FHIR scope definition, and a consent verification requirement. It discovers GP agents on the mesh via their Agent Cards — which advertise, among other things, whether the practice participates in research protocols and what disease populations they serve. The agent visits each relevant node. At each GP agent, it presents credentials. The GP agent checks: does this patient have an active research consent for this study type? If yes, the agent runs the FHIR query locally and returns the aggregate. If the cohort at this node is too small for anonymity (say, fewer than 10 patients), the agent flags it and moves on without returning data.

The difference: discovery is automated, consent is verified per-interaction, and the agent can reason about statistical sufficiency as it goes. The raw data never leaves the practice. The agent is stateful — it knows what it has already collected and what it still needs.

**Quality benchmarks: the DICA problem.**

DICA (Dutch Institute for Clinical Auditing) runs 26 quality registries for hospital care. Their tagline is "life saving data," and it's accurate — systematic quality measurement has measurably improved surgical outcomes in the Netherlands. They collect data from hospitals into registries like DSCA (colorectal cancer), DUCA (upper GI cancer), DHFA (hip fracture), and 23 others. Hospitals submit data, DICA analyses it, and the results go back as "mirror sessions" (spiegelsessies) where clinicians compare their outcomes with national benchmarks.

The problem is the data pipeline. Hospitals must extract, format, and submit data to DICA. This is manual work. DICA recently announced that batch costs for PROMs (Patient-Reported Outcome Measures) data submission were fully abolished as of January 2026 — which tells you that the cost of submitting data to quality registries was a real barrier. The benchmarks are retrospective: by the time you learn that your hospital's complication rate is above the national average, the patients have already been treated.

In an agentic mesh, a benchmark agent carries a standardised measurement definition (say: "30-day mortality after colorectal surgery, adjusted for ASA score and tumor stage"). It visits each hospital agent. Each hospital agent runs the calculation against its own FHIR store and returns one number. The benchmark agent aggregates. No data extraction. No manual formatting. No batch submission costs. The benchmark updates continuously instead of annually.

This is not hypothetical extrapolation — it's the logical extension of what Nivel already does for primary care and what DICA does for hospital care, but with the data pipeline replaced by a protocol.

**The EHDS changes the legal landscape — and creates new problems.**

The European Health Data Space (EHDS, Regulation EU 2025/327) entered into force on March 26, 2025. It is the most significant piece of European health data legislation since GDPR. For secondary data use (research, benchmarks, policy), the EHDS mandates that each EU member state establish at least one Health Data Access Body (HDAB). Researchers apply to the HDAB, the HDAB processes the request, data holders are obligated to share, and analysis must happen in "secure processing environments" under HDAB control. Patients can opt out.

The EHDS is designed around centralised access bodies. That's a reasonable architecture when you're coordinating across 27 member states with different legal traditions. But it means the HDAB becomes a bottleneck — every research request goes through a single body per country. The regulation even specifies that data holders can charge fees for the time spent making data available (Article 62), which means the cost doesn't disappear; it shifts.

An agentic mesh is not a replacement for the EHDS — the regulation is law, and compliance isn't optional. But it could be the infrastructure layer that HDABs use to fulfil their mandate. Instead of manually coordinating data extraction from every hospital, an HDAB could dispatch a certified research agent into the mesh. The agent verifies consent (including EHDS opt-out), runs computations locally, and returns only anonymised aggregates. The HDAB remains the governance authority. The agent is the execution mechanism.

The EHDS also explicitly prohibits certain secondary uses: marketing, discrimination in insurance or employment, development of harmful products (Article 54). In a traditional data pipeline, these prohibitions are enforced by policy and audit. In an agentic mesh, they could be enforced at the protocol level — the agent's scope is restricted by its signed credentials, and the receiving agent validates those restrictions before executing any query.

**The security question is not theoretical.**

If you think "sending computation to data nodes" is inherently safe, consider what happened to vantage6 in March 2026. An attacker gained admin access to vantage6's Harbor container registry and injected malware into infrastructure Docker images — including node images, VPN clients, and algorithm base images. The malware was a downloader that, once executed, would fetch additional payloads from the internet. Several infrastructure images that had internet access (VPN clients, SSH tunnels, proxy containers) were compromised. The vantage6 team published an advisory on April 2, 2026, and the investigation is still ongoing.

This is exactly the attack vector that matters for federated computation: the "train" that visits your hospital's data can be tampered with before it arrives. Vantage6 uses Docker containers, and the container registry was the weak point. In an agentic mesh, every agent presents an Agent Card with verifiable credentials. If the card doesn't validate against a trust anchor — say, a certificate from the HDAB or a signed research protocol — the receiving agent refuses the interaction. This is the same pattern from my security red-teaming post (Series 2, T2): the Mordred attack works because a forged Agent Card can bypass trust verification. The defence is protocol-level validation, not perimeter security.

The vantage6 breach is not an argument against federated computation. It's an argument for building trust into the protocol layer rather than relying on infrastructure security alone.

**The open question: who owns derived conclusions?**

This is the thing I genuinely do not have a good answer for, and I don't think anyone else does either.

Under GDPR, the data controller is whoever determines the purposes and means of processing personal data. Each GP practice is the data controller for its patient records. When a researcher sends a federated query and 200 GP agents each return an aggregate (say: mean HbA1c = 52.3 mmol/mol, N=47), the individual aggregates may not constitute personal data — they're statistics. But the researcher's combined analysis might be re-identifiable in small cohorts. Who is the data controller of the combined result?

The EHDS addresses this partially: analysis must happen in secure processing environments, and data must be anonymised (Article 60). But what about the conclusions? When a benchmark agent discovers that Region X has a 30-day surgical mortality rate twice the national average, and that information becomes public, the hospitals in Region X might argue that the benchmark was derived from their data without adequate context. The data stayed in place, but the conclusions traveled — and conclusions have consequences.

In a data mesh, ownership is at least theoretically clear: the domain owns its data product. In an agentic mesh, the data never leaves the domain. But conclusions do. And ownership of conclusions derived from federated computation across hundreds of independent data controllers is an unsolved legal question. The EHDS doesn't fully answer it. The GDPR doesn't cleanly cover it. The Dutch Wgbo (Wet geneeskundige behandelingsovereenkomst — the patient rights law) gives patients rights over their care data, but says nothing about aggregate statistics derived from those data.

I'm flagging this as an open research problem. The architectural pattern works. The governance of derived insights from that pattern is genuinely hard. I'd love to hear from healthcare lawyers and ethicists on this one.

---

### The honest limitations

A few things I'm not claiming.

The agentic mesh does not exist as a production system today. What exists is a simulation (Cammelot) that demonstrates the architectural pattern — including signed agent cards, scoped FHIR access, referral rate limiting, a research agent with consent verification and k-anonymity, and a benchmark agent that collects quality metrics. These are working code, validated across 100 simulation runs. But they operate on 45 synthetic agents, not 12,000 GP practices. The gap between simulation and production is measured in decades of technical debt, vendor lock-in, and regulatory complexity.

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

*References and sources: Dehghani, Z. "How to Move Beyond a Monolithic Data Lake to a Distributed Data Mesh" (2019, Thoughtworks). A2A Protocol Specification v1.0.0 (Linux Foundation / Google, 2025). FHIR R4 (HL7, 2019). SMART-on-FHIR v2.2.0 (HL7, 2023). IZA — Integraal Zorgakkoord (Dutch Ministry of Health, 2022). NZa market scan waiting times (2024). Bode et al., Vestues et al., Joshi et al. — empirical data mesh adoption challenges. openEHR Foundation (2003-present). Model Context Protocol (Anthropic, 2024). Nictiz Zibs — 150+ care information building blocks. CBS / RIVM 2025 demographic and prevalence data. Health-RI / DTL — Personal Health Train concept (2017-present). Moncada-Torres et al. "VANTAGE6: an open source priVAcy preserviNg federaTed leArninG infrastructurE for Secure Insight eXchange" (AMIA 2020). Vantage6 security advisory — Harbor registry breach (April 2, 2026, vantage6.ai). DICA — Dutch Institute for Clinical Auditing, 26 quality registries (dica.nl). Nivel Primary Care Database — GP registration data from hundreds of practices (nivel.nl). EHDS — Regulation (EU) 2025/327, European Health Data Space (entered into force March 26, 2025). GDPR — Regulation (EU) 2016/679 (2018). Wgbo — Wet geneeskundige behandelingsovereenkomst (Dutch patient rights law). Wegiz — Wet elektronische gegevensuitwisseling in de zorg (electronic data exchange in healthcare). FAIR data principles (Wilkinson et al., Scientific Data, 2016). TEHDAS Joint Action — Towards the European Health Data Space (EU4Health programme).*

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
EHDS: Regulation (EU) 2025/327, entered into force 26 March 2025
EHDS HDABs: must be established per member state by March 2027
EHDS full implementation: March 2029 (primary), March 2031 (genomics/imaging)
EHDS secondary uses: Art. 53 (permitted), Art. 54 (prohibited), Art. 60 (anonymisation)
EHDS opt-out: Art. 71(1) — natural persons can opt out at any time
EHDS fees: Art. 62 — data holders may charge for time spent making data available
GDPR: Regulation (EU) 2016/679, Art. 4 (data controller definition), Art. 6 (lawful bases)
Wgbo: Wet geneeskundige behandelingsovereenkomst (patient rights, data access)
Health-RI: Dutch national health research infrastructure (health-ri.nl)
Personal Health Train: "bring the analysis to the data" (Health-RI / DTL concept)
Vantage6: open-source PET platform by IKNL (github.com/vantage6/vantage6)
Vantage6 breach: Harbor registry compromised March 2026, advisory April 2, 2026
DICA: 26 quality registries for hospital care (dica.nl), "life saving data"
DICA PROMs batch costs: abolished January 2026
Nivel: Primary Care Database, ~170 researchers, GP registrations (nivel.nl)
Nivel governance: steering committees with national associations representatives
FAIR data: Wilkinson et al. 2016, GO FAIR International (NL/DE/FR)
TEHDAS: Towards the European Health Data Space, EU4Health programme
```

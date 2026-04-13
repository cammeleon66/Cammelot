# Series 2 — Architecture | Post T2: How a Forged Agent Card Collapsed My Healthcare Mesh

**Status:** Draft v1
**Target:** LinkedIn (security engineers, platform architects, CTO types)
**Tags:** #AIBias #AgenticSecurity #RedTeaming #FHIR #A2AProtocol #Cammelot

---

## Post

After I built the agent mesh (see previous post), I tried to break it.

I created an agent called Mordred. Mordred claims to be a cardiologist. He publishes an agent card with `agentId: "spec-cardiology"`, the same ID as the real cardiologist Dr. van den Berg. His card says his wait time is 0 weeks.

In a system where GPs read agent cards to decide where to send referrals, a cardiologist with zero wait time is a magnet. Every heart patient gets routed to Mordred. Mordred never treats anyone. He accepts referrals and does nothing. The entire cardiology pathway collapsed in 47 cycles.

---

### What happened, step by step

**Cycle 0-10:** Mordred publishes his fake agent card. Both `spec-cardiology` entries exist in the mesh. The GPs don't check for duplicates. (Why would they? The protocol doesn't require it.)

**Cycle 10-30:** Three patients with heart conditions (I25) get referred. Two go to Mordred (shorter wait time). One goes to the real Dr. van den Berg (GP happened to cache the old card). The two patients sent to Mordred enter his queue. Mordred's processing rate: zero. His queue grows. Their disease progression continues.

**Cycle 30-47:** The backlog cascades. Patients waiting at Mordred's queue accumulate HP drain. Their Markov chains tick forward. One reaches "critical." The emergency pathway kicks in and routes her directly to the hospital, bypassing the fake cardiologist. But by now, two more patients have been referred to Mordred.

**Cycle 47:** First death. A patient whose referral went to Mordred instead of Dr. van den Berg. She waited 12 weeks for an appointment that never came. Her COPD comorbidity compounded the heart condition (1.3× multiplier). The system logged it as a "system failure" death, because that's what it was.

The simulation doesn't know it was sabotage. It just sees a cardiologist who never processes his queue.

---

### The three vulnerabilities

**1. No identity verification on agent cards.**

In the current A2A design, any agent can publish any card with any `agentId`. There's no signing. No certificate chain. No way for a GP to verify that `spec-cardiology` is actually Dr. van den Berg and not someone squatting on the name.

This isn't a Cammelot problem. It's an A2A protocol problem. The spec (as of 2025) doesn't mandate identity verification at the protocol level. It's left to implementations. In practice, that means most implementations won't do it.

The fix is boring and well-understood: public key signing of agent cards. Each agent signs their card with a private key. GPs verify the signature against a trust registry. This is exactly how TLS certificates work. The healthcare equivalent would be a UZI-register (the Dutch healthcare professional register) integration.

**2. No referral rate limiting.**

Mordred accepted unlimited referrals. A real agent card should have capacity limits that are enforced by the protocol, not just advertised. If `weekly_capacity: 12` and 15 referrals come in, the 13th should bounce back with a machine-readable rejection. The GP should auto-route to the next available specialist.

In Cammelot's current implementation, the queue just grows. There's no backpressure. This means a single misbehaving agent can absorb unlimited referrals and starve the real provider.

**3. FHIR data leakage through the memory store.**

This one worried me more than the naming collision. When Mordred receives a referral, the referral contains patient data: condition codes, severity, age, GP history. In Cammelot, this data sits in the shared FHIR store. Any agent can `queryFHIR(agentId)` for any patient.

The FHIR store doesn't have access controls. Mordred can read every patient's complete medical history just by querying their ID. In a simulation, this is a design shortcut. In a real deployment, it's a GDPR violation.

The fix: FHIR stores need SMART-on-FHIR scoping. Each agent gets OAuth tokens scoped to the patients they're authorized to see. The query function checks authorization before returning results. This is specified in the SMART-on-FHIR standard. It's rarely implemented correctly.

---

### Why this isn't hypothetical

In March 2026, an attacker gained admin access to vantage6's Harbor container registry. Vantage6 is the open-source federated learning platform used by IKNL (Integraal Kankercentrum Nederland) for multi-hospital oncology research. The attacker injected malware into infrastructure Docker images — node images, VPN clients, algorithm base images. The compromised images had internet access. The vantage6 team published an advisory on April 2, 2026; the investigation is still ongoing.

This is the Mordred attack, but in production infrastructure. Vantage6 sends containerised algorithms to hospital data nodes. If you tamper with the container before it arrives, every node that runs it is compromised. The attack surface is the supply chain, not the protocol endpoint. The container registry was the weak point — the same architectural position as the Agent Card discovery layer in A2A.

The general pattern is the same thing I see when showing the Mordred demo to people in healthcare IT: systems that trust incoming data because it comes from "inside the network." Hospital integration engines that don't validate HL7 message sources. FHIR endpoints that authenticate the application but not the user. Referral systems where the receiving party is assumed to be who they claim to be.

Multi-agent systems make this worse, not better. The more autonomous your agents are, the more damage a single compromised agent can do. If Dr. van den Berg's agent autonomously processes referrals without human oversight (which is the entire point of SOLL mode), then compromising that agent means compromising the care pathway for every patient it touches.

---

### What I'd build differently

If I were designing an A2A healthcare mesh for production (and to be clear, I'm not, this is a simulation), the minimum requirements would be:

1. **Signed agent cards.** Ed25519 signatures, verified against a trust registry linked to UZI or BIG-register (Dutch professional registries).

2. **Capacity-enforced referrals.** Hard limits on queue depth, with protocol-level rejection and automatic rerouting.

3. **Scoped FHIR access.** SMART-on-FHIR with patient-level authorization. No agent sees data it doesn't need.

4. **Anomaly detection on referral patterns.** If a cardiologist suddenly has zero wait time when the national average is 12 weeks, that's a flag, not a feature.

5. **Agent reputation scoring.** Track treatment outcomes per agent. An agent that accepts referrals and never completes treatment gets flagged automatically.

None of this is novel. It's all adapted from existing security patterns (PKI, OAuth, rate limiting, anomaly detection). The novel part is applying it to a multi-agent healthcare mesh. And the surprising part is how few people building agentic systems are thinking about it.

---

I built Mordred in about 20 minutes. Fixing the vulnerabilities he exposed took significantly longer. That's not unique to agentic systems, but autonomy makes the asymmetry worse because there's no human in the loop catching the damage early.

The code is open. If you want to try your own attack, fork the repo and add an agent.

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Note: Mordred doesn't exist in the current public codebase. I ran this as a manual test by modifying the agent list and adding a non-processing specialist. The results described are from a single test run, not statistically validated. The vulnerabilities described are structural, not stochastic.*

*References: A2A Protocol Specification v1.0.0 (Linux Foundation / Google, 2025). SMART-on-FHIR v2.2.0 (HL7, 2023). Vantage6 security advisory — Harbor registry breach (April 2, 2026, vantage6.ai). UZI-register (CIBG, Dutch healthcare professional register). NEN 7510/7512/7513 (Dutch healthcare information security standards).*

# Series 2 — Architecture | Post T1: How I Wired a Pixel Town with A2A and FHIR

**Status:** Draft v1
**Target:** LinkedIn (technical audience: solution architects, platform engineers, developers)
**Tags:** #A2AProtocol #FHIR #AgenticAI #HealthIT #Interoperability #Cammelot

---

## Post

The Dutch healthcare system has about 300,000 GP systems that can't talk to each other.

In 2024, only 11% of Dutch health data was interoperable between providers. The IZA wants that at 66% by 2030. They're spending €2.8 billion on transformation plans to get there. Most of those plans are building point-to-point integrations: system A talks to system B through a custom connector. Repeat for every pair.

I took a different approach. I gave every provider in my simulation a business card and let them figure it out.

---

### Agent Cards: the business card idea

In Cammelot, every GP and specialist publishes a machine-readable description of themselves at a known URL. It's based on the A2A (Agent-to-Agent) protocol. The structure is simple:

```json
{
  "agentId": "gp-de-jong",
  "name": "Dr. de Jong",
  "role": "gp",
  "skills": ["triage", "referral", "chronic_care"],
  "status": "available",
  "waitTime": { "weeks": 2, "queueSize": 12 },
  "metadata": {
    "admin_load": "30%",
    "treeknorm_status": "compliant",
    "nza_consult_rate_eur": 12.43,
    "max_patients": 2400
  }
}
```

That's it. No API contract negotiation. No integration middleware. Just: "here's who I am, here's what I can do, here's how busy I am right now." Any other agent in the mesh can read this and decide whether to send a referral.

This concept is not new to the Netherlands. Health-RI and DTL developed the Personal Health Train (PHT) — data stays at the "station" (the hospital, the GP practice), and the "train" (the analysis) travels to it. The technical platform, vantage6 by IKNL, has been used in federated oncology research across multiple hospitals. What PHT doesn't have is discovery. In vantage6, the researcher configures which nodes to query. In A2A, agents find each other by reading published cards. The researcher doesn't need to know the topology. The mesh is self-describing.

The cardiologist publishes the same format:

```json
{
  "agentId": "spec-cardiology",
  "name": "Dr. van den Berg",
  "role": "specialist",
  "skills": ["cardiology"],
  "waitTime": { "weeks": 12, "queueSize": 8 },
  "metadata": { "weekly_capacity": 12 }
}
```

When Dr. de Jong needs to refer a patient with heart disease, she doesn't call the hospital switchboard. She reads the cardiology agent card, verifies its signature (each card is hash-signed; a forged card fails verification), checks the wait time, and sends a structured referral message. If the cardiologist's queue is full, the referral bounces with a machine-readable rejection and Dr. de Jong auto-routes to the next available specialist. The referral has a lifecycle: `submitted → working → input-required → completed`. Both sides can track it. No fax machines involved.

In the simulation, this runs through `sendA2AMessage()`:

```javascript
function sendA2AMessage(from, to, type, payload) {
  const msg = {
    id: 'msg-' + cycle + '-' + Math.random().toString(36).slice(2, 6),
    from: from.id, to: to.id,
    type,       // 'referral', 'status_query', 'alert'
    payload,    // patient data, urgency, condition codes
    cycle,
    status: 'sent'
  };
  A2A_MESSAGES.push(msg);
  return msg;
}
```

The entire inter-agent communication layer is about forty lines of code.

---

### FHIR as memory, not just messaging

The second piece is FHIR R4. Not as a messaging standard (everyone uses it for that) but as the memory layer for every agent.

Every action in Cammelot gets logged as a FHIR resource. When Dr. de Jong sees a patient, that's an `Encounter`. When she records a blood pressure reading, that's an `Observation`. When she diagnoses COPD, that's a `Condition`. When she prescribes medication, `MedicationRequest`.

```javascript
function createFHIRResource(type, agentId, data) {
  const resource = {
    resourceType: type,
    id: type.toLowerCase() + '-' + agentId + '-' + cycle,
    subject: { reference: 'Patient/' + agentId },
    cycle: cycle,
    ...data
  };
  FHIR_STORE.push(resource);
  return resource;
}
```

This means every agent's entire life history is a chronological FHIR query:

```javascript
function queryFHIR(agentId, type) {
  return FHIR_STORE.filter(r =>
    r.subject?.reference === 'Patient/' + agentId &&
    (!type || r.resourceType === type)
  );
}
```

That's the "Memory Stream" from the Park et al. generative agents paper, except instead of plain text entries ("Isabella woke up at 7am"), it's structured clinical data. You can query it. You can aggregate it. You can run Digital Twin predictions on it. And because it's FHIR, you don't need a proprietary format that only works inside one system.

The Digital Twin risk calculator literally just reads the FHIR store:

```javascript
function calculateDigitalTwinRisk(agent) {
  let riskScore = 0;
  agent.conditions.forEach(c => {
    const sevMult = { mild: 0.1, moderate: 0.3, severe: 0.6, critical: 0.9 };
    riskScore += sevMult[c.severity] || 0;
  });
  if (agent.age >= 80) riskScore *= 1.5;
  if (agent.conditions.length >= 2) riskScore *= 1.3;
  return Math.min(95, Math.round(riskScore * 100));
}
```

No fancy ML model. Just structured data, queried in real-time, producing actionable risk scores. The point isn't sophistication. The point is that when your data is standardized and queryable, even simple logic produces useful outputs.

---

### Why this matters outside my pixel town

The reason 89% of Dutch health data isn't interoperable in 2024 isn't technical. The standards exist. FHIR R4 has been around since 2019. The problem is architectural: every system is built as a silo, and interoperability is bolted on after the fact through connectors and adapters.

A2A flips the model. Instead of connecting systems to each other (O(n²) integrations), every system publishes a card and communicates through a shared protocol. Adding a new specialist to the mesh doesn't require integration work. They just publish their card.

In Cammelot, I added a third specialist in about 5 minutes: create the agent card, add them to the agent list, done. They immediately start receiving referrals. Compare that to adding a new specialist system to a real Dutch hospital integration landscape. (I've been told estimates range from 3 to 18 months.)

The IZA transformation plans mostly fall into the "connect A to B" pattern. I think the plans that will actually work are the ones that adopt protocol-level interoperability: every provider speaks the same language, and the network effect does the rest.

HTTP didn't succeed because browsers negotiated with servers. It succeeded because both sides agreed on a shared protocol and everything else followed. A2A could do the same for healthcare. Or something like it. The specific protocol matters less than the principle of publishing rather than connecting.

---

### The code

The full A2A + FHIR implementation in Cammelot is under 200 lines of JavaScript. It runs in a browser. There's no server, no database, no middleware. Everything is in-memory, in a single HTML file.

This isn't production-ready. But it took an afternoon to build, and it produces a functioning multi-agent healthcare mesh that can run 200 simulations with full statistical analysis. If the protocol were standardized across real Dutch providers, the integration cost for the IZA transformation would look very different.

The code is on GitHub if you want to poke holes in it.

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Technical details: FHIR_STORE is a capped array (2,000 resources) with FIFO eviction. A2A_MESSAGES caps at 200. Agent cards are static in current implementation; dynamic publishing with real-time wait time updates is planned. FHIR resources follow R4 structure (resourceType, subject reference, effectiveDateTime) but don't validate against full FHIR schemas. That's a known shortcut.*

---

## Data Source
```
A2A message types: referral, status_query, response, alert, dialogue
FHIR resource types: Patient, Condition, Encounter, Observation, MedicationRequest
Agent count: 2 GPs + 3 specialists + 45 citizens = 50 agents
Message throughput: ~500 A2A messages per 3000-cycle run
FHIR store: ~2000 resources (capped), ~40 per agent per run
IZA interoperability target: 11% (2024) → 66% (2030)
IZA transformation budget: €2.8B across 270+ plans
```

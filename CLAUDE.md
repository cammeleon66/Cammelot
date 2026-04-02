# Project Cammelot — Master Context for Claude Opus 4.6

> **This file is the single source of truth for the Cammelot simulation.**
> Read this file first before any code changes. All architecture, data, and design
> decisions are documented here.

---

## 1. Project Vision

**Cammelot** is an autonomous multi-agent system (MAS) simulating a Dutch town of
5,000 inhabitants. It serves as an **"Applied Research" proving ground** for:

- LinkedIn thought leadership on AI, healthcare, and systemic transformation
- Quantifying the Dutch "care infarction" (zorginfarct)
- Demonstrating where the healthcare system breaks down (IST)
- Simulating what an AI-native overhaul could look like (SOLL)

**Future expansion**: Cammelot Education, Cammelot Retail, Cammelot Research — all
using the same Agentic Mesh infrastructure.

---

## 2. Visual Identity

**Strict 16-bit SNES RPG aesthetic** (Park et al. "Generative Agents / AI Town"):

- **Colors**: Saturated SNES palette — lush green grass, bright blue water, vibrant buildings
- **Grid**: Tile-based (16×16px tiles, 64×48 grid)
- **Sprites**: Tiny expressive character sprites with speech bubbles
- **UI**: Retro-game menus (blue background, white borders, pixel fonts — "Press Start 2P")
- **NO** corporate dashboards, flat grey UIs, or "modern" chart-heavy layouts
- **Bottleneck visualization**: Queue congestion (sprites stacked up), red '!' icons,
  ghost sprites (grey/transparent) for mortality events

---

## 3. Core Architecture: The Agentic Mesh

### 3.1 Data Layer (MCP + FHIR)

- **FHIR R4-native memory store** — every agent action is logged as a FHIR resource
- Resource types: `Patient`, `Observation`, `Condition`, `Encounter`, `MedicationRequest`
- Custom observation codes: `CAMMELOT-WAIT`, `CAMMELOT-HP`, `CAMMELOT-GHOST`, `CAMMELOT-ACTION`
- The "Memory Stream" of each agent = chronological query on their FHIR resources
- Extensions: `http://cammelot.sim/fhir/hp` (integer HP), `http://cammelot.sim/fhir/sprite-state`

### 3.2 Communication Layer (A2A Protocol)

- Every GP and Specialist agent publishes an **Agent Card** at `/.well-known/agent-card.json`
- Agent Cards contain: skills, current wait times (Treeknorm status), endpoint, metadata
- Messages types: `referral`, `status_query`, `response`, `alert`, `dialogue`
- Referral lifecycle: `submitted` → `working` → `input-required` → `completed`
- Speech bubbles for visible dialogue (e.g., "Wait time is 12 weeks; I cannot refer you yet")

### 3.3 Cognitive Loop (Park et al.)

Every agent executes per tick:

1. **Memory Stream** — retrieve FHIR logs (chronological experience record)
2. **Reflection** — draw high-level conclusions about system state
   - Patient: "My breathing is heavy; Digital Twin predicts 32% heart failure risk"
   - GP: "I spend 30% of my time on files instead of patients; I am reaching burnout"
3. **Planning** — translate reflections to actions (seek care, refer, wait, escalate)

---

## 4. System Failure Logic (IST — Current Crisis)

### 4.1 Administrative Burden (The Friction Factor)

- **30%** of every GP's time is consumed by administrative tasks
- Effective capacity: `C_eff = C_total × (1 - L_admin - V_ziekte) × E_ai`
- In IST: `E_ai = 1.0` (no AI assistance), so `C_eff = C_total × (1 - 0.30 - 0.08) = 0.62`
- Target SOLL: admin drops to <5%, `E_ai = 1.34`

### 4.2 Treeknorm Violations (Waiting Lists)

- **Treeknorm**: 4 weeks for diagnostics, 7-12 weeks for treatment
- Simulation threshold: **12 weeks** (specialist referral)
- Current reality: Ophthalmology = 12 weeks, Neurology/Gynecology = 50%+ increase since 2022
- MRI/CT diagnostics: 28.9% exceed the 4-week norm

### 4.3 Mortality "Ghosting" Logic

Mortality is a **direct consequence of system delay**, not random:

```
if t_wait > T_Treeknorm:
    HP_drain = drainRate × (t_wait - T_Treeknorm) × severityMultiplier × (1 + adminBurden)

when HP ≤ 0:
    sprite → grey "Ghost Sprite" (mortality event)
```

- `drainRate` = 3 HP per week overdue
- `severityMultiplier`: healthy=0, mild=0.5, moderate=1.0, severe=2.0, critical=4.0
- `adminBurden` = 0.30 (adds 30% to drain)
- Ghost threshold = 0 HP; Critical HP = 20 (sprite changes to distressed)

### 4.4 Staffing Crisis

- Sick leave (ziekteverzuim): **8%** of GP/specialist capacity lost
- Projected shortage 2035: **301,000** healthcare workers nationally
- Simulation: agents become "ghostly" (transparent sprite) when overworked

---

## 5. Simulation Parameters (CBS/RIVM 2025)

### 5.1 Demographics

| Parameter | Value | Source |
|-----------|-------|--------|
| Population | 5,000 agents | CBS |
| Seniors (65+) | 1,000 (20%) | Vergrijzing 2025 |
| Chronic prevalence (75+) | 96% ≥1 condition | RIVM |
| Multimorbidity (75+) | 45% ≥2 conditions | RIVM |
| Natural mortality | ~48/year | CBS 2024 (172k on 18M) |
| Life expectancy M/F | 80.5 / 83.2 years | CBS |

### 5.2 Mortality by Age Group (Annual, Netherlands)

| Age Group | Deaths (2024) | Dominant Causes |
|-----------|--------------|-----------------|
| 0-65 | 21,175 | External causes, Neoplasms |
| 65-80 | 53,282 | Cardiovascular, Neoplasms |
| 80+ | 97,594 | Dementia, Heart Failure, Frailty |

### 5.3 Chronic Conditions (RIVM 2024)

| Condition | ICD-10 | Prevalence NL | 65+ Prevalence |
|-----------|--------|---------------|----------------|
| Arthrosis | M17 | 1.6 million | High |
| Diabetes Mellitus T2 | E11 | 1.2 million | 18% |
| Dementia | F03 | 300,000+ | 7% |
| COPD/Asthma | J44 | 600,000+ | 10% |
| Chronic Heart Disease | I25 | — | 12% |
| Osteoporosis | M81 | — | 15% |

### 5.4 Financial Parameters (NZa 2025)

| Item | Cost (EUR) |
|------|-----------|
| Short GP consult (<5 min) | €6.21 |
| Regular GP consult (5-20 min) | €12.43 |
| Long GP consult (>20 min) | €24.85 |
| Regular house visit (<20 min) | €18.64 |
| MTVP ("Meer Tijd voor de Patiënt") | €3.23/patient/quarter |
| Ketenzorg Diabetes | €63.36/quarter |
| Ketenzorg COPD | €50.19/quarter |
| Ketenzorg HVZ | €27.17/quarter |
| Specialist consultation | ~€150 |
| Hospital day | ~€850 |
| Prevented hospitalization (avg) | €5,845 saved |

### 5.5 IZA (Integraal Zorgakkoord) Parameters

| Parameter | Value |
|-----------|-------|
| Transformation budget | €2.8 billion (total) |
| Postbus closing date | July 1, 2025 |
| Submitted plans | 270+ |
| Target hybrid care | 70% by 2026 |
| Target admin reduction | From 30% to 20% by 2030 |
| Staff shortfall 2025 | 66,400 |
| Staff shortfall 2035 | 301,000 |

---

## 6. A2A Agent Card Schema

Agents MUST publish their card in this format:

```json
{
  "@context": "https://a2a-protocol.org/context",
  "agentId": "gp-de-jong",
  "name": "Dr. de Jong — GP Practice De Brink",
  "role": "gp",
  "skills": ["triage", "referral", "chronic_care", "general_medicine"],
  "status": "available",
  "waitTime": {
    "weeks": 2,
    "queueSize": 12
  },
  "metadata": {
    "admin_load": "30%",
    "treeknorm_status": "compliant",
    "sick_leave_rate": "8%",
    "nza_consult_rate_eur": 12.43,
    "max_patients": 2400
  },
  "location": { "x": 12, "y": 20 },
  "endpoint": "/.well-known/agents/gp-de-jong/card.json",
  "lastUpdated": "2026-04-01T12:00:00Z"
}
```

---

## 7. Agent Roster: Cammelot IST

### GPs (Huisartsen)
| ID | Name | Location | Max Patients |
|----|------|----------|-------------|
| gp-de-jong | Dr. de Jong | (12, 20) | 2,400 |
| gp-bakker | Dr. Bakker | (24, 32) | 2,000 |
| gp-visser | Dr. Visser | (36, 18) | 1,800 |

### Specialists (Ziekenhuis Cammelot)
| ID | Name | Specialty | Weekly Capacity |
|----|------|-----------|----------------|
| spec-cardiology | Dr. van den Berg | Cardiology (I25) | 12 |
| spec-endocrinology | Dr. Mulder | Endocrinology (E11) | 15 |
| spec-pulmonology | Dr. Janssen | Pulmonology (J44) | 10 |

### First Patient
| ID | Name | Age | Conditions | HP | State | Wait |
|----|------|-----|-----------|-----|-------|------|
| patient-hendrik-veenstra | Hendrik Veenstra | 70 | I25 + E11 | 82 | moderate | 4w |

---

## 8. Applied Research Scenarios

### 8.1 Bias Tracking (DIB Method)
- Track every agent decision (referral, triage, priority) across 1,000+ cycles
- Measure age bias: do 65+ agents get systematically delayed?
- Measure referral bias: variance in delay rates by condition code
- Measure location bias: distance-to-hospital correlation with outcomes
- LinkedIn hook: "I let 5,000 AI agents live together for 10 years. Here's why
  their implicit bias increased by 40%."

### 8.2 Security Red Teaming
- Introduce a "Malicious Agent" with a forged Agent Card
- Test: Can it corrupt the care logistics of 5,000 people?
- Test: Can it access patient FHIR data via naming collisions?
- LinkedIn hook: "Security GAP Alert: How a simple naming collision in the A2A
  protocol collapsed Cammelot's entire healthcare mesh."

### 8.3 ROI of Administrative Friction
- Calculate: How much €€€ is wasted on the 30% admin burden?
- Calculate: What is the cost of a "Ghosting" event (preventable death)?
- Calculate: ROI of "Meer Tijd voor de Patiënt" (€3.23/quarter/patient)
- LinkedIn hook: "Applied Research Report: In Cammelot, mortality risk increased
  by 12% purely from GP administrative interruptions."

### 8.4 The Admin Paradox
- If we automate 90% of admin with AI scribes, does consultation quality improve?
  Or do hospitals simply increase patient volume to bill more NZa tariffs?

### 8.5 Digital Twin Triage
- Can a "Digital Twin" predicting 32% heart failure risk reduce ER pressure by
  30%+ through proactive primary care intervention?

---

## 9. Sector Expansion Roadmap (Cammelot 2026+)

| Sector | Simulation Focus | IST Bottleneck | SOLL Vision |
|--------|-----------------|---------------|-------------|
| Education | 1,200 students, personalized learning paths | One-size-fits-all, teacher burnout from admin | Autonomous tutor agents adapting to learning style |
| Retail | Agentic commerce and supply chain twins | Shortages from manual forecasting | Non-human-in-the-loop transactions via UCP |
| Research | Distributed scientific discovery | Fragmented datasets, slow literature review | Agent teams autonomously testing hypotheses |

---

## 10. SOLL Overhaul Parameters (AI-Native Future)

When the SOLL toggle is activated in the simulation:

| Bottleneck | IST Value | SOLL Value | Mechanism |
|------------|-----------|-----------|-----------|
| Administrative Load | 30% of time | <5% | Ambient AI scribes, auto-FHIR mapping |
| Wait Times | 12 weeks (Ophthal.) | <4 weeks | AI-driven triage, A2A scheduling |
| Data Availability | 11% interoperable | 66% | Hybrid openEHR (storage) + FHIR (exchange) |
| Staff Pressure | 301k shortage (2035) | 110k freed by tech | AI takes over 36-66% of routine tasks |
| Effective Capacity | C_eff = 0.62 | C_eff = 0.62 × 1.34 = 0.83 | E_ai efficiency multiplier |

---

## 11. Development Instructions

### Build Team Structure
- **Team Lead Agent**: Orchestrator, decomposes into sub-tasks
- **Grid_Architect**: 2D tile-map, SNES aesthetics, congestion visualization
- **Clinical_Logic_Agent**: Markov models, HP drain, Treeknorm engine
- **Research_Monitor_Agent**: Bias tracker, ROI counter, Applied Research output

### Technical Rules
1. All UI text and logs in **English** (universal appeal)
2. Visual style: **Saturated 16-bit SNES** — no flat/grey dashboards
3. Agent dialogue in **speech bubbles** (e.g., "Wait time is 12 weeks; I cannot refer you yet")
4. FHIR-native memory for all agents
5. A2A protocol for all inter-agent communication
6. Effort: **max** for architectural decisions

### File Structure
```
Cammelot/
├── CLAUDE.md                 ← THIS FILE (Master Context)
├── 00_Project_Strategy/      Docs, strategy, iteration log
├── config/                   Simulation parameters, CBS/RIVM data
├── src/
│   ├── agents/               Agent definitions (cognitive_loop, patient, provider)
│   ├── clinical_logic/       Markov models, HP drain, Treeknorm
│   ├── communication/        A2A protocol, agent cards, message bus
│   ├── data_layer/           FHIR memory store, MCP server
│   ├── grid_engine/          Tile map, pathfinding, congestion
│   ├── research_monitor/     Bias tracker, ROI counter, security auditor
│   ├── frontend/             16-bit SNES web frontend
│   └── orchestrator/         Team Lead, simulation loop
├── assets/                   Sprites, tiles
└── tests/                    Test suites
```

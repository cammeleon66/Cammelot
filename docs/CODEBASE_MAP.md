# CODEBASE_MAP.md — Cammelot Architectural Memory

> **Generated:** 2026-04-02 | **Branch:** `feature/agentic-overhaul`
> **Purpose:** Primary memory document for all autonomous agents working on Cammelot.
> Read this BEFORE making any code changes.

---

## 1. Executive Summary

Cammelot is a **partially implemented multi-agent healthcare simulation** with a **fully functional frontend** (v4.html, 2527 lines) and a **disconnected backend** (Node.js ES modules):

| Layer | Status | Tech | Agents | Key Features |
|-------|--------|------|--------|--------------|
| **Frontend** (v4.html) | Functional — Sprints 1-3 COMPLETE | Vanilla JS, 2D Canvas | 45 patients + 6 infrastructure | DISEASE_DB, population spawner, disease engine, building click detection, GP/Hospital dashboards, doctor tracking, specialist capacity, natural mortality, comorbidity, EVENT_LOG, HP sparkline, stats dashboard, localStorage persistence |
| **Backend** (Node.js) | Implemented but **never executed by frontend** | ES Modules, Node stdlib only | 5000 potential | FHIR store, A2A protocol, Cognitive loop, disease engine, team lead orchestrator |

**Critical finding:** The frontend runs a **complete, self-contained simulation engine** (lines 894–2527) with:
- DISEASE_DB (12 conditions, ICD-10 codes, Markov matrices, comorbidity multipliers)
- Population spawner (45 agents, CBS age distribution, RIVM prevalence)
- Disease progression (condition-specific Markov chains)
- HP drain system (base rate × severity × Treeknorm × comorbidity)
- Natural mortality (age-based and condition-based)
- Building detection (agents hide inside hospital/GP buildings)
- Specialist capacity tracking (queues per referralSpecialty)
- EVENT_LOG memory system (all events timestamped)
- localStorage persistence (save/load simulation state)
- Stats overlay (population, deaths, wait times, costs)

The **backend cognitive loop, FHIR store, A2A protocol, and Treeknorm calculators exist but are never called by v4.html.** The two systems are architecturally disconnected (ADR-001).

---

## 2. File Inventory

### Configuration

| File | Lines | Exports | Purpose |
|------|-------|---------|---------|
| `config/simulation.js` | ~50 | `SIMULATION_CONFIG` | Population (5k), HP drain rates, grid (64×48), timing |
| `config/reference_data.js` | ~120 | `CBS_DATA`, `RIVM_DATA`, `NZA_TARIFFS`, `IZA_DATA`, `SOLL_PARAMETERS` | CBS/RIVM prevalence, NZa tariffs, IZA budget, SOLL targets |

### Agents (`src/agents/`)

| File | Lines | Exports | Pattern |
|------|-------|---------|---------|
| `cognitive_loop.js` | ~160 | `CammelotAgent` | Base class: Memory Stream → Reflection → Planning → Execution |
| `patient_agent.js` | ~180 | `PatientAgent`, `createHendrikVeenstra()` | HP tracking, disease state, referral logic, cognitive loop |
| `provider_agents.js` | ~130 | `GPAgent`, `SpecialistAgent` | Queue management, Treeknorm compliance, admin burden |
| `population_engine.js` | ~250 | `spawnPopulation()`, `instantiateAgents()` | CBS age distribution, RIVM prevalence, multimorbidity |

### Core Systems

| File | Lines | Exports | Pattern |
|------|-------|---------|---------|
| `src/communication/a2a_protocol.js` | ~200 | `AgentCard`, `A2AMessage`, `A2AMessageBus`, `globalMessageBus` | Singleton message bus, agent card registry, discovery |
| `src/data_layer/fhir_store.js` | ~220 | `FHIRMemoryStore`, `globalFHIRStore` | In-memory FHIR R4 store (Patient, Condition, Encounter, Observation) |
| `src/clinical_logic/disease_engine.js` | ~180 | `DiseaseProgressionModel`, `HPDrainEngine`, `TreeknormChecker` | Markov chains, HP drain per Treeknorm violation, sprite mapping |
| `src/grid_engine/tile_map.js` | ~280 | `TileMap`, `buildCammelotMap()`, `PALETTE`, `TILE_TYPES` | 64×48 tile grid, A* pathfinding, congestion zones, SNES palette |

### Orchestration & Research

| File | Lines | Exports | Pattern |
|------|-------|---------|---------|
| `src/orchestrator/simulation_loop.js` | ~320 | `SimulationRunner` | IST/SOLL profiles, initialize → tick loop → report |
| `src/orchestrator/team_lead.js` | ~200 | `TeamLeadAgent` | Orchestrator: Grid_Architect → Clinical_Logic → Research_Monitor |
| `src/research_monitor/research_monitor.js` | ~200 | `BiasTracker`, `ROICounter` | Age/referral/location bias, NZa cost tracking |
| `src/research_monitor/security_auditor.js` | ~150 | `SecurityAuditor` | Red team: forged cards, naming collisions, FHIR exfiltration |

### Frontend

| File | Type | Lines | Role |
|------|------|-------|------|
| `src/frontend/server.js` | Node HTTP | ~60 | Static file server, PORT 3014, MIME detection |
| `src/frontend/v4.html` | Vanilla JS | **2527** | **PRIMARY** — SNES canvas, 45 population + 6 infrastructure agents, IST/SOLL toggle, sidebar, stats overlay |
| `src/frontend/app.html` | Vanilla JS | ~1500 | Alternative — parchment/wooden frame aesthetic |
| `src/frontend/game.html` | Vanilla JS | ~1200 | Compact SNES — monospace HUD, minimal UI |
| `src/frontend/index.html` | Vanilla JS | ~300 | Simple fallback |

---

## 3a. Frontend Architecture (v4.html — Sprint 1-3 Implementation)

**Status:** Fully functional standalone simulation engine in single HTML file (2527 lines)

### Key Data Structures

| Constant | Lines | Purpose |
|----------|-------|---------|
| `EVENT_LOG` | ~427 | Primary memory system: all events logged { cycle, type, agentId, agentName, detail, hp, timestamp } |
| `DISEASE_DB` | ~463–1035 | Comprehensive clinical catalog (12 conditions, ICD-10 codes, Markov matrices, prevalence) |
| `INFRASTRUCTURE_AGENTS` | ~1037–1084 | 6 fixed agents: GP Collins, GP Bennett, Hospital, 3 Specialists |
| `agents` array | ~1085 | 45 patient agents spawned + 6 infrastructure = 51 total active agents |

### Key Functions (Population & Disease)

| Function | Line | Lines | Purpose |
|----------|------|-------|---------|
| `spawnPopulation(count)` | 894 | ~51 | Population spawner: age distribution (CBS), condition assignment (RIVM), initial HP |
| `transitionDiseaseState()` | 945 | ~47 | Markov disease progression: uses condition-specific matrices from DISEASE_DB |
| `calculateHPDrain()` | 992 | ~20 | HP degradation: base drain × severity × Treeknorm penalty × comorbidity × wait time |
| `getComorbidityMultiplier()` | 1012 | ~15 | Comorbidity drag: multiplicative penalty from DISEASE_DB.interactsWith |
| `getRandomRoadPosition()` | 881 | ~13 | Random spawn on roads/paths (not water/buildings) |
| `generateThoughts()` | 846 | ~35 | Cognitive state: generates agent internal monologue based on HP/conditions/wait |

### Key Functions (Building Detection & Pathfinding)

| Function | Line | Lines | Purpose |
|----------|------|-------|---------|
| `isInBuilding(fx, fy)` | 340 | ~2 | Check if agent is in hospital/GP building → hide on canvas |
| `isInWater(fx, fy)` | 336 | ~2 | Check no-walk zones (rivers, forest, buildings) |
| `nearestWaypointIdx()` | 397 | ~7 | Find closest road waypoint for pathfinding |
| `findWaypointPath()` | 406 | ~12 | Dijkstra-style pathfinding between road waypoints |
| `getGPDest()` | 330 | ~4 | Route patient to nearest GP (Collins/Bennett) by name |

### Key Functions (Dashboards & Tracking)

| Function | Line | Lines | Purpose |
|----------|------|-------|---------|
| `displayAgentCard()` | ~1400 | ~80 | Right-panel agent dossier: conditions, HP, wait time, history |
| `generateHistoryTimeline()` | ~1550 | ~25 | EVENT_LOG query: show agent's medical events |
| `renderSpecialistQueues()` | ~1650 | ~30 | Specialist dashboard: queue lengths, referral specialty matching |
| `renderGPDashboard()` | ~1650 | ~20 | GP panel: active patients, capacity |
| `renderHospitalDashboard()` | ~1720 | ~20 | Hospital census: beds occupied, discharge queue |

### Key Functions (HP & Recovery)

| Function | Line | Lines | Purpose |
|----------|------|-------|---------|
| `applyTreatmentEffect()` | ~1000 | ~8 | State transition after specialist treatment (DISEASE_DB effect) |
| `generateHPSparkline()` | ~1850 | ~15 | Mini sparkline chart (Sprint 3): 10-cycle HP trend from EVENT_LOG |
| `tick()` | 2086 | ~357 | **MAIN SIMULATION LOOP** — agents move, disease advances, HP drains, events log |

### Key Functions (Persistence & State)

| Function | Line | Lines | Purpose |
|----------|------|-------|---------|
| `saveSim()` | ~2397 | ~10 | localStorage save: agents, cycle, mode, EVENT_LOG, DISEASE_DB state |
| `loadSim()` | ~2410 | ~8 | localStorage restore: rebuild agent array, EVENT_LOG, continue from saved cycle |
| `resetSim()` | ~2420 | ~15 | Hard reset: clear agents, EVENT_LOG, cycle=0 |

### Key Functions (Overlay & Stats)

| Function | Line | Lines | Purpose |
|----------|------|-------|---------|
| `toggleStats()` | 2445 | ~8 | Toggle stats overlay (modal with population/death/cost breakdown) |
| `renderStats()` | ~2465 | ~80 | Stats panel HTML: alive/dead counts, system vs natural mortality, wait times, costs |
| `updateUI()` | 2563 | ~20 | Canvas redraw: render agents, roads, buildings, chat log, sidebar |

---



### 3.1 API Pattern

**Framework:** Native Node `http` module (no Express)

```
GET /           → serves v4.html
GET /assets/*   → static files with MIME detection + cache headers
404             → everything else
```

**No REST API.** No JSON endpoints. No WebSocket. Frontend is fully self-contained with inline JS.

### 3.2 Auth Pattern

**Status: NONE**

- No authentication on any endpoint
- No authorization on FHIR store queries
- No A2A message signature verification
- No CORS headers
- No TLS/HTTPS
- Agent cards accepted without validation (overwrites allowed)

### 3.3 Data Pattern

**Storage:** In-memory `Map` objects (RAM only, no persistence)

**Schema:** FHIR R4 partial implementation

```
globalFHIRStore (singleton)
├── resources:     Map<id → Resource>
├── patientIndex:  Map<patientId → [resourceIds]>
└── typeIndex:     Map<resourceType → [resourceIds]>

Custom Observation codes: CAMMELOT-WAIT, CAMMELOT-HP, CAMMELOT-GHOST, CAMMELOT-ACTION
Custom Extensions: http://cammelot.sim/fhir/hp, http://cammelot.sim/fhir/sprite-state
```

**CRUD:** `create*()` methods for Patient, Condition, Encounter, Observation. Query by patient/type/code/date. No update/delete.

### 3.4 Agent Pattern (Cognitive Loop — Park et al.)

```
CammelotAgent (base)
├── getMemoryStream()     → FHIR chronological query
├── reflect()             → importance scoring, high-level conclusions
├── plan()                → translate reflections to action queue
├── executeAction(action) → perform action + log to FHIR
└── say(target, text)     → A2A dialogue message + speech bubble
```

All agents register with `globalMessageBus` and publish Agent Cards. Messages routed by `agentId`.

### 3.5 Module Pattern

- **ES Modules** (`import`/`export`) throughout
- **Singletons** via `export const globalX = new X()`
- **Classes** for entities (agents, cards, messages)
- **No TypeScript** — JSDoc comments for type hints
- **No external dependencies** — all Node stdlib

---

## 4. Entry Points

| Command | Entry Point | What It Does |
|---------|-------------|--------------|
| `npm run frontend` | `server.js` | HTTP server on `:3014`, serves v4.html |
| `npm start` | `team_lead.js` | Backend orchestrator: map → population → 10-cycle sim → report |
| `npm run sim` | `simulation_loop.js` | Direct simulation: initialize → run cycles → generate report |
| `npm test` | `tests/` | **Empty** — no tests exist |

---

## 5. Data Flows

### Flow A: Simulation Tick (Backend)

```
SimulationRunner.runCycle()
  1. specialists.forEach(s => s.tick())     → process waitlists, reset weekly slots
  2. gps.forEach(g => g.tick())             → process referral queue, update cards
  3. patients.forEach(p => p.tick())        → Markov transition → HP drain → cognitive loop
  4. tileMap.updateCongestion()             → queue visualization
  5. biasTracker.recordDecision()           → age/referral/location tracking
  6. roiCounter.logCost()                   → NZa tariff accumulation
  7. snapshot every 10 cycles               → population state capture
```

### Flow B: Frontend Tick (v4.html — Currently Active)

```
tick()
  1. cycle++
  2. forEach patient: if waiting > 4w → hp -= 0.5/condition (SIMPLIFIED)
  3. forEach agent: random walk toward road waypoints
  4. if hp <= 0 → ghost sprite
  5. hardcoded dialogue triggers (hp < 50, wait > 12w)
  6. updateUI() → redraw canvas + sidebar panels
```

### Flow C: Patient Lifecycle

```
SPAWN → conditions assigned (RIVM prevalence)
  → healthy state, HP 85-100
  → assigned to nearest GP
  ↓
SYMPTOMS → Markov: healthy → mild → moderate
  → cognitive loop: "I feel symptoms"
  → seeks GP referral
  ↓
WAITING → referralPending = true
  → weeksWaiting increments each tick
  → if > 12w Treeknorm: HP drain = 3/w × severityMultiplier × 1.30 (admin burden)
  → Markov acceleration: +15% per overdue week
  ↓
TREATED (if HP > 0) → specialist processes from waitlist
  → encounter logged to FHIR
  → HP recovery: +2.5/tick for 15 ticks
  ↓
GHOSTED (if HP ≤ 0) → CAMMELOT-GHOST observation
  → sprite → grey/transparent
  → ROICounter logs preventable cost
  → BiasTracker records delayed outcome
```

---

## 7. DISEASE_DB Structure (Source of Clinical Truth)

Each condition object in DISEASE_DB contains:

```javascript
'I25': {  // Chronic Ischemic Heart Disease
  code: 'I25',
  name: 'Chronic Ischemic Heart Disease',
  icd10: 'I25',
  category: 'cardiovascular',
  prevalenceNL: 800_000,              // Population prevalence
  seniorPrevalence: 0.12,             // % of 65+ with condition
  ageMin: 40,                         // Minimum age for assignment
  canBeReferred: true,                // Can be referred to specialist?
  referralSpecialty: 'cardiology',    // Which specialist handles this
  gpTreatable: false,                 // Can GP handle it?
  treatmentDurationTicks: 6,          // Ticks in specialist care
  recoveryDurationTicks: 15,          // Ticks recovering after treatment
  hpDrainPerTick: 0.30,              // Base HP loss per cycle (untreated)
  hpGainPerTreatmentTick: 2.5,       // HP gained while in specialist care
  hpGainPerRecoveryTick: 1.2,        // HP gained during recovery
  
  interactsWith: ['E11', 'I10'],     // Comorbidity partners
  comorbidityMultiplier: {            // Multiplicative drag
    'E11': 1.4,  // diabetes worsens heart disease
    'I10': 1.3   // hypertension worsens heart disease
  },
  
  markovTransitions: {                // Condition-specific states
    healthy:  { healthy: 0.95, mild: 0.04, ... },
    mild:     { healthy: 0.10, mild: 0.80, ... },
    moderate: { ... },
    severe:   { ... },
    critical: { ... },
    deceased: { ..., deceased: 1.0 }
  },
  
  treatmentEffect: {                  // State improvement after treatment
    severe: 'moderate',
    moderate: 'mild',
    critical: 'severe'
  },
  
  mortalityRisk: {                    // Condition-specific death rates
    untreated: 0.04,  // 4% die per cycle if not treated
    treated: 0.005    // 0.5% die per cycle if treated
  }
}
```

**Total conditions in DISEASE_DB:** 12 (lines 463–1035)
- I25: Chronic Ischemic Heart Disease
- E11: Diabetes Mellitus Type 2
- F03: Dementia
- M54: Back pain
- J44: COPD
- I10: Essential Hypertension
- I50: Heart Failure
- E78: Dyslipidemia
- N18: Chronic Kidney Disease
- F32: Major Depressive Disorder
- M79: Myofascial pain syndrome
- G47: Sleep disorders

---

## 8. IST vs SOLL Parameters

| Parameter | IST (Current Crisis) | SOLL (AI-Native) |
|-----------|---------------------|-------------------|
| Admin burden | 30% | 5% |
| Sick leave rate | 8% | 5% |
| Treeknorm threshold | 12 weeks | 4 weeks |
| AI efficiency multiplier | 1.0 | 1.34 |
| Data availability | 11% | 66% |
| Hybrid care adoption | 25% | 70% |
| Effective capacity | 0.62 | 0.83 |

---

## 9. Security Vulnerabilities (Red Team)

| ID | Severity | Vector | Impact |
|----|----------|--------|--------|
| SEC-1 | CRITICAL | Forged Agent Cards — no auth on registration | Referrals routed to fake specialist |
| SEC-2 | CRITICAL | Naming collisions — registry overwrites | Messages intercepted, data exposed |
| SEC-3 | CRITICAL | A2A message injection — no sender verification | Fake "treatment complete" stops care |
| SEC-4 | HIGH | FHIR exfiltration — no access control on `globalFHIRStore` | Any agent reads all patient records |
| SEC-5 | HIGH | No HTTPS — plaintext communication | Data interception |

---

## 10. Dependency Graph

```
package.json
  └── dependencies: NONE (all Node stdlib)
  └── devDependencies: NONE

Node built-ins used:
  node:http, node:fs/promises, node:path, node:url, node:crypto
```

---

## 9. Gaps & Technical Debt

| # | Category | Gap | Severity | Addressed in Sprint |
|---|----------|-----|----------|---------------------|
| 1 | **Architecture** | Frontend ↔ Backend completely disconnected | CRITICAL | Phase 1 (ADR-001) |
| 2 | **Testing** | Zero automated tests | CRITICAL | Phase 2 |
| 3 | **Auth** | No authentication or authorization anywhere | CRITICAL | Phase 3 |
| 4 | **Persistence** | localStorage only — no database | HIGH | Phase 2 (ADR-005) |
| 5 | **Linting** | No ESLint, no TypeScript, no formatting rules | MEDIUM | Phase 2 |
| 6 | **Types** | JSDoc only — no compile-time safety | MEDIUM | Phase 2 |
| 7 | **Natural mortality** | Implemented via untreated condition Markov | RESOLVED | Sprint 1 |
| 8 | **Comorbidity** | Multiplicative drag from DISEASE_DB.interactsWith | RESOLVED | Sprint 1 |
| 9 | **HP Balance** | Treeknorm + comorbidity prevents 100% mortality | RESOLVED | Sprint 1 |
| 10 | **Event tracking** | EVENT_LOG captures all state changes | RESOLVED | Sprint 3 |

---

## 9a. Sprint 1-3 Delivery Map

### Sprint 1: Disease Engine + Population (COMPLETE)
- ✅ DISEASE_DB: 12 conditions, ICD-10 codes, Markov matrices, comorbidity
- ✅ Population spawner: CBS age distribution, RIVM prevalence (45 agents)
- ✅ Disease progression: Markov state machine per condition
- ✅ HP drain system: base rate × severity × Treeknorm × comorbidity × wait time
- ✅ Natural mortality: condition-specific rates in DISEASE_DB
- ✅ Comorbidity multiplier: DISEASE_DB.interactsWith lookup

### Sprint 2: Dashboards + Specialist Tracking (COMPLETE)
- ✅ Building click detection: isInBuilding() filters agents inside hospitals/GPs
- ✅ GP dashboard: patient list, referral queue, capacity tracking
- ✅ Hospital dashboard: bed census, discharge queue, specialist integration
- ✅ Doctor tracking: specialist capacity per referralSpecialty (cardiology, pulmonology, etc.)
- ✅ Specialist capacity: weekly slots from SPECIALIST_CAPACITY, queue-based assignment
- ✅ Referral routing: patient → specialty → queued → treated → recovery

### Sprint 3: Memory System + Stats (COMPLETE)
- ✅ EVENT_LOG: primary memory { cycle, type, agentId, agentName, detail, hp, timestamp }
- ✅ HP sparkline: 10-cycle trend visualization in agent dossier
- ✅ Stats dashboard: population breakdown, death attribution, wait time distribution, cost
- ✅ localStorage persistence: save/load simulation state (agents, EVENT_LOG, cycle, mode)
- ✅ History timeline: EVENT_LOG query for agent medical events
- ✅ Cost tracking: admin waste (DISEASE_DB drain) + preventable death cost (€5,845 each)

---



## 11. Conventions for Agents

### Code Style
- ES Modules (`import`/`export`) — no CommonJS
- `const` over `let`, never `var`
- Classes for entities, singletons via `export const globalX = new X()`
- JSDoc for type annotations
- Async/await for all I/O

### Naming
- Files: `snake_case.js`
- Classes: `PascalCase`
- Functions/methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Agent IDs: `role-lastname` (e.g., `gp-de-jong`, `spec-cardiology`)

### FHIR Codes
- Wait time: `CAMMELOT-WAIT`
- HP change: `CAMMELOT-HP`
- Mortality: `CAMMELOT-GHOST`
- Action log: `CAMMELOT-ACTION`
- Disease state: `CAMMELOT-DISEASE-STATE`

### Visual Rules
- 16-bit SNES RPG aesthetic — saturated palette, pixel art
- Speech bubbles for agent dialogue
- Ghost sprites (grey/transparent) for mortality
- Queue congestion visualization (stacked sprites, red `!` icons)
- Font: "Press Start 2P"

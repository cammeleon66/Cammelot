# CODEBASE_MAP.md — Cammelot Architectural Memory

> **Generated:** 2026-04-02 | **Branch:** `feature/agentic-overhaul`
> **Purpose:** Primary memory document for all autonomous agents working on Cammelot.
> Read this BEFORE making any code changes.

---

## 1. Executive Summary

Cammelot is a **partially implemented multi-agent healthcare simulation** with two disconnected systems:

| Layer | Status | Tech |
|-------|--------|------|
| **Frontend** (v4.html) | Functional — 15 hardcoded agents, canvas rendering, SNES aesthetic | Vanilla JS, 2D Canvas |
| **Backend** (Node.js) | Implemented but **never executed by frontend** | ES Modules, Node stdlib only |

**Critical finding:** The backend cognitive loop, FHIR store, A2A protocol, and disease engine exist but the frontend runs its own simplified `tick()` with hardcoded logic. The two systems are disconnected.

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
| `src/frontend/v4.html` | Vanilla JS | ~2500 | **PRIMARY** — SNES canvas, 15 agents, IST/SOLL toggle, sidebar |
| `src/frontend/app.html` | Vanilla JS | ~1500 | Alternative — parchment/wooden frame aesthetic |
| `src/frontend/game.html` | Vanilla JS | ~1200 | Compact SNES — monospace HUD, minimal UI |
| `src/frontend/index.html` | Vanilla JS | ~300 | Simple fallback |

---

## 3. Core Patterns

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

## 6. IST vs SOLL Parameters

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

## 7. Security Vulnerabilities (Red Team)

| ID | Severity | Vector | Impact |
|----|----------|--------|--------|
| SEC-1 | CRITICAL | Forged Agent Cards — no auth on registration | Referrals routed to fake specialist |
| SEC-2 | CRITICAL | Naming collisions — registry overwrites | Messages intercepted, data exposed |
| SEC-3 | CRITICAL | A2A message injection — no sender verification | Fake "treatment complete" stops care |
| SEC-4 | HIGH | FHIR exfiltration — no access control on `globalFHIRStore` | Any agent reads all patient records |
| SEC-5 | HIGH | No HTTPS — plaintext communication | Data interception |

---

## 8. Dependency Graph

```
package.json
  └── dependencies: NONE (all Node stdlib)
  └── devDependencies: NONE

Node built-ins used:
  node:http, node:fs/promises, node:path, node:url, node:crypto
```

---

## 9. Gaps & Technical Debt

| # | Category | Gap | Severity |
|---|----------|-----|----------|
| 1 | **Architecture** | Frontend ↔ Backend completely disconnected | CRITICAL |
| 2 | **Testing** | Zero automated tests | CRITICAL |
| 3 | **Auth** | No authentication or authorization anywhere | CRITICAL |
| 4 | **Persistence** | In-memory only, all data lost on restart | HIGH |
| 5 | **Linting** | No ESLint, no TypeScript, no formatting rules | MEDIUM |
| 6 | **Types** | JSDoc only — no compile-time safety | MEDIUM |
| 7 | **Frontend** | Agent logic duplicated/simplified in v4.html | HIGH |
| 8 | **Natural mortality** | Everyone dies from system delays, no age-based death | MEDIUM |
| 9 | **Comorbidity** | No multiplicative drag between conditions | MEDIUM |
| 10 | **HP Balance** | IST mode reaches 100% mortality by ~cycle 50 | HIGH |

---

## 10. Conventions for Agents

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

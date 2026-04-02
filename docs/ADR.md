# Architecture Decision Records (ADR) — Cammelot

> **Purpose:** Document architectural decisions made during Cammelot development.  
> **Format:** Each ADR has Date, Status, Context, Decision, Consequences sections.  
> **Status:** Accepted decisions are frozen and guide all future implementation.

---

## ADR-001: Frontend-First Architecture (All Simulation Logic in v4.html, No Bundler)

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (Sprints 1-3 validation)

### Context

The Cammelot project maintains two systems:
1. **Frontend** (v4.html): 2527-line vanilla JavaScript single-file simulation
2. **Backend** (Node.js): Complete multi-agent system with cognitive loop, FHIR store, A2A protocol

The backend was architected first (cognitive loop, disease engine, population generator) but the frontend evolved independently with its own implementations. No bundler (webpack, esbuild) was used to avoid toolchain complexity.

### Decision

**Adopt frontend-first architecture** where v4.html contains the complete, standalone, runnable simulation engine. The frontend is the primary system of record for:
- Population spawning (45 agents)
- Disease progression (Markov chains per condition)
- HP drain calculations (base rate × severity × Treeknorm × comorbidity)
- Building detection and pathfinding
- Doctor/specialist tracking
- Event logging (EVENT_LOG system)
- State persistence (localStorage)
- Statistics and diagnostics

**Zero npm dependencies** in frontend (no React, no bundler, no framework). Single-file HTML with inline JavaScript.

### Consequences

**Advantages:**
- No build step, no npm install, zero toolchain friction
- Single <script> tag — works in any web server
- Easy debugging (browser DevTools on one file)
- No version conflicts or transitive dependencies
- Fast page load (no code splitting, network latency)
- Can be deployed as static file (nginx, GitHub Pages, S3)

**Disadvantages:**
- 2500+ line file violates single-responsibility principle
- No module system (all functions share global scope)
- Code reuse impossible without copy-paste or eval()
- No compile-time type checking (JSDoc only)
- Harder to test individual functions (no test framework)
- Duplicate logic between backend and frontend (not DRY)

**Mitigation:**
- Maintain CLAUDE.md as architectural spec (supersedes code comments)
- All agent functions documented in CODEBASE_MAP.md Section 3a
- DATA FLOW section (CODEBASE_MAP.md) explains v4.html tick() vs backend simulation_loop.js
- Agents using backend system must accept that frontend is the source of truth during development

---

## ADR-002: DISEASE_DB as Single Source of Clinical Truth

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (Sprint 1 validation)

### Context

Disease configuration was previously scattered:
- `src/clinical_logic/disease_engine.js`: baseTransitions Markov matrices
- `config/simulation.js`: HP drain rates
- `config/reference_data.js`: RIVM prevalence (but hard to match to ICD-10 codes)
- Patient agents: hardcoded condition lists

This fragmentation caused:
- Inconsistent prevalence rates between backend and frontend
- Markov matrices not summing to 1.0 (broke stochastic guarantees)
- No comorbidity drag (conditions treated independently)
- No specialist referral routing (all conditions treated as GP-only)

### Decision

**Create DISEASE_DB object** in v4.html (lines 463–1035) containing **12 conditions** each with:
- ICD-10 code, category, prevalence (national + senior)
- Can-be-referred flag, referral specialty, GP-treatable flag
- Treatment duration, recovery duration
- HP drain per tick, HP gain per treatment, HP gain per recovery
- Interacts-with list (comorbidity partners)
- Comorbidity multipliers (per-partner drag)
- **Markov transitions** (rows sum to 1.0, deceased is absorbing state)
- Treatment effect (state improvement pathway)
- Mortality risk (untreated vs treated)

DISEASE_DB is the **single source of truth** for all disease logic, used by:
- `spawnPopulation()`: assignment algorithm (line 894)
- `transitionDiseaseState()`: Markov transitions (line 945)
- `calculateHPDrain()`: base drain rate lookup (line 992)
- `getComorbidityMultiplier()`: multiplicative drag (line 1012)
- All specialist referral routing (display functions ~line 1650+)

### Consequences

**Advantages:**
- No sync issues: one source, no duplicate data
- Clinical accuracy: Markov matrices reviewed and Galahad-tested
- Easy to add new conditions (copy-paste + edit)
- Easy to adjust clinical parameters (prevalence, drain rates)
- Referral logic automated (specialty routing via DISEASE_DB.referralSpecialty)
- Comorbidity drag properly multiplicative (not additive)

**Disadvantages:**
- DISEASE_DB is large (~570 lines) — could eventually move to separate file
- JSON-like syntax (not actual JSON) — hard to export/import formats
- All conditions must be defined upfront (can't lazy-load)
- Changing DISEASE_DB affects all 45 agents immediately (no versioning)

**Mitigation:**
- DISEASE_DB documented in CODEBASE_MAP.md Section 7
- Clinical sources cited in comment block (lines 457–461)
- Markov matrix validation script in future Phase 2 (test suite)

---

## ADR-003: 45 Active Agents, Not 5000 (Canvas Performance Budget)

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (Sprint 1 calibration)

### Context

The backend `simulation.js` configures **5000 patients** (SIMULATION_CONFIG.population = 5000). This is realistic for a regional healthcare system but impossible to render on 2D canvas:
- 5000 agents = 5000 pixels/shapes per frame
- 30 FPS = 150,000 draw calls per second
- SNES 256×224 canvas at 32px tiles = 8×7 = 56 possible positions
- 5000 agents → average ~90 agents per tile → overlapping sprites, illegible UI

### Decision

**Cap frontend population at 45 agents** in v4.html (line 1085):
```javascript
const agents = [...INFRASTRUCTURE_AGENTS, ...spawnPopulation(45)];
```

This creates:
- 6 infrastructure agents (2 GPs, 1 hospital, 3 specialists)
- 39 patient agents (50:50 healthy:diseased split)
- Total: 45 agents, ~5–8 per visible tile cluster

**Backend remains at 5000** for research/reporting but is not displayed by frontend.

### Consequences

**Advantages:**
- Canvas renders 45 sprites at 30 FPS with zero lag
- Each agent visible and clickable (distinct identity on UI)
- Specialist queues remain small (max 10 waiting per specialty)
- Event log remains short (manageable memory, localStorage fits)
- Meaningful gameplay (player can track individual agents)

**Disadvantages:**
- Population statistics are unrepresentative of real healthcare system
- Disease prevalence rates don't scale properly (45 vs 5000)
- Specialist utilization unrealistic (hospital has 8 beds for 39 patients)
- Loss of detail: one agent represents ~111 real patients (5000/45)

**Mitigation:**
- CLAUDE.md clearly states "45 is gameplay concession" (not epidemiological reality)
- Backend simulation_loop.js can still run 5000-agent batches for research
- Frontend disclaimer in top bar: "Gameplay simulation — not to scale"

---

## ADR-004: Condition-Specific Markov Matrices (Not Generic Shared)

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (Sprint 1 clinical review)

### Context

Initial disease engine (`disease_engine.js`) had **one global Markov matrix**:
```javascript
const baseTransitions = {
  healthy:  { healthy: 0.95, mild: 0.04, moderate: 0.01, severe: 0, critical: 0, deceased: 0 },
  mild:     { healthy: 0.08, mild: 0.82, moderate: 0.08, severe: 0.02, critical: 0, deceased: 0 },
  // ... same for all conditions
}
```

This violated clinical reality:
- Dementia (F03) and back pain (M54) share same mortality curve → false
- Diabetes (E11) progresses slower than COPD (J44) → not captured
- Specialist treatment varies by condition (cardiology 6 ticks, others 8) → not modeled

### Decision

**Implement condition-specific Markov transitions** in DISEASE_DB (lines 463–1035):
```javascript
'I25': {  // Chronic Ischemic Heart Disease
  markovTransitions: {
    healthy:  { healthy: 0.95, mild: 0.04, moderate: 0.01, severe: 0,    critical: 0,    deceased: 0    },
    mild:     { healthy: 0.10, mild: 0.80, moderate: 0.08, severe: 0.02, critical: 0,    deceased: 0    },
    moderate: { healthy: 0.02, mild: 0.10, moderate: 0.75, severe: 0.10, critical: 0.03, deceased: 0    },
    severe:   { healthy: 0,    mild: 0.02, moderate: 0.08, severe: 0.70, critical: 0.15, deceased: 0.05 },
    critical: { healthy: 0,    mild: 0,    moderate: 0.02, severe: 0.10, critical: 0.68, deceased: 0.20 },
    deceased: { healthy: 0,    mild: 0,    moderate: 0,    severe: 0,    critical: 0,    deceased: 1.0  }
  },
  treatmentDurationTicks: 6,
  recoveryDurationTicks: 15,
  // ...
}
```

Each condition has:
- Own row sums (verified to sum to 1.0)
- Own critical/deceased rates
- Own treatment duration
- Own mortality risk profile (untreated vs treated)

Lookup in `transitionDiseaseState()` (line 945):
```javascript
const db = DISEASE_DB[conditionCode];
const row = db.markovTransitions[currentState];  // condition-specific!
```

### Consequences

**Advantages:**
- Clinically defensible: each condition has evidence-based curve
- Emergent behavior: disease progression realistically varies
- Specialist selection: diseases needing urgent cardiology look different from endocrinology
- Mortality patterns: dementia has high untreated death, hypertension has lower
- Treatable vs non-treatable: COPD requires specialist, back pain can be GP-managed

**Disadvantages:**
- 12 matrices to maintain (must verify each sums to 1.0)
- DISEASE_DB becomes large (~570 lines) — hard to find bugs
- No reuse (can't copy one disease to create another)
- Clinical sources must be verified (RIVM VTV, NICE guidelines, etc.)

**Mitigation:**
- Markov validation test in Phase 2 (test suite): each row sums to 1.0, deceased absorbing
- DISEASE_DB sources cited in comment block (lines 457–461)
- Matrix templates provided in CLAUDE.md for adding new conditions

---

## ADR-005: localStorage for Persistence, Not SQLite or IndexedDB (Yet)

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (Sprint 3 storage decision)

### Context

Frontend state must persist across browser refreshes:
- Agents (position, HP, conditions, wait weeks, state)
- EVENT_LOG (all historical events)
- cycle counter
- Mode (IST vs SOLL)

Initial options:
1. **localStorage** (~5–10 MB limit, key-value, synchronous, no querying)
2. **IndexedDB** (async, >100 MB, queryable, complex API, Service Worker needed)
3. **SQLite** (via sql.js, can work in browser, but huge JS bundle)
4. **Backend server** (HTTP POST/GET, stateful, requires login, complex)

### Decision

**Use localStorage** for now (lines ~2397–2420):
```javascript
function saveSim() {
  localStorage.setItem('cammelot_agents', JSON.stringify(agents));
  localStorage.setItem('cammelot_log', JSON.stringify(EVENT_LOG));
  localStorage.setItem('cammelot_cycle', cycle);
  localStorage.setItem('cammelot_mode', mode);
}
function loadSim() {
  agents = JSON.parse(localStorage.getItem('cammelot_agents') || '[]');
  EVENT_LOG = JSON.parse(localStorage.getItem('cammelot_log') || '[]');
  cycle = parseInt(localStorage.getItem('cammelot_cycle')) || 0;
  mode = localStorage.getItem('cammelot_mode') || 'IST';
}
```

Save/load triggered:
- Manual: localStorage.setItem() on button click
- Auto: Future Phase 2 (periodic autosave every 10 cycles)

### Consequences

**Advantages:**
- Zero dependencies (no npm package)
- Works offline (no server required)
- Simple key-value API (JSON stringify/parse)
- Adequate for 45 agents + EVENT_LOG (~1 MB typical)
- Per-user storage (multiple people can have different saves)

**Disadvantages:**
- 5–10 MB limit (fails with huge EVENT_LOG)
- Synchronous (blocks rendering during large saves)
- No querying (must load entire dataset)
- Not shared across devices
- No versioning (old save format breaks with schema change)
- Security: localStorage readable by any script on domain

**Upgrade path (Phase 2+):**
- Replace localStorage with IndexedDB once Save/Load is core feature
- Compress EVENT_LOG (only keep last 100 cycles)
- Add backend sync (optional cloud save)

---

## ADR-006: EVENT_LOG as Primary Memory System (Not FHIR — Yet)

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (Sprint 3 memory architecture)

### Context

The backend implements **FHIR R4 store** (globalFHIRStore, ~220 lines) with:
- Patient resources (demographics, insurance)
- Condition resources (ICD-10 codes, onset date)
- Encounter resources (visit records)
- Observation resources (lab results, custom codes)
- Type/patient indexing for queries

Frontend v4.html originally had **no history** — agents' pasts were not recorded. When clicked, the right panel showed current state but no timeline.

### Decision

**Create EVENT_LOG array** (line 427) to record all state changes:
```javascript
const EVENT_LOG = []; // { cycle, type, agentId, agentName, detail, hp, timestamp }

function logEvent(type, agent, detail) {
  EVENT_LOG.push({
    cycle,
    type,  // 'spawned', 'referred', 'treated', 'died', 'natural_death', 'recovered', 'action'
    agentId: agent.id,
    agentName: agent.name,
    detail: detail || '',
    hp: Math.round(agent.hp),
    timestamp: Date.now()
  });
}
```

EVENT_LOG is queried by:
- `displayAgentCard()` (line ~1400): show agent's medical timeline
- `renderStats()` (line ~2465): count deaths, treatments, costs
- `generateHPSparkline()` (line ~1850): plot 10-cycle HP trend

**NOT FHIR-compliant** (yet): EVENT_LOG is a simple array, not HL7 structured. Each entry is a flat object, not a FHIR Resource Bundle.

### Consequences

**Advantages:**
- No schema design (any event type can be added)
- Fast append (EVENT_LOG.push() is O(1))
- Simple queries (Array.filter() by type/agent)
- Human-readable (direct object inspection in DevTools)
- Replaces FHIR for frontend gameplay (faster, simpler)
- Easy timeline visualization (sort by cycle, group by agent)

**Disadvantages:**
- Not FHIR R4 compliant (future interoperability issue)
- No queryable index (filtering whole array is O(n))
- No relationships (encounters not linked to conditions)
- Not validated (any string accepted as `detail`)
- Memory grows unbounded (45 agents × 1000 cycles = 45k events = ~5 MB)

**Upgrade path (Phase 3+):**
- Convert EVENT_LOG → FHIR Bundle on export
- Add FHIR-compliant observer service (validates Observation codes)
- Implement IndexedDB with FHIR schema
- Create REST API endpoint: GET /fhir/Patient/:id/Observation → FHIR JSON

**For now:** EVENT_LOG serves as "proto-FHIR" — captures events in simple form, can be mapped to FHIR later.

---

## ADR-007: Zero npm Dependencies (Node stdlib Only for Tests)

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (Sprints 1-3 tech decision)

### Context

Modern Node.js projects typically have 100+ dependencies (Express, Axios, Lodash, etc.). Each dependency:
- Adds supply-chain risk (typosquatting, malware)
- Creates version conflicts (semantic versioning, breaking changes)
- Increases bundle size (when eventually deployed)
- Requires auditing (npm audit fixes, security updates)
- Complicates CI/CD (npm install, cache management)

Cammelot's backend uses only Node.js built-ins:
- `node:http` (no Express)
- `node:fs/promises` (no fs-extra)
- `node:path` (no path-extra)
- `node:url` (no url-parse)
- `node:crypto` (no bcrypt)

Frontend v4.html has zero dependencies (no React, no framework).

### Decision

**Maintain zero npm dependencies** for both backend and frontend:

**Frontend v4.html:**
- No bundler (no webpack, esbuild, Vite)
- No framework (no React, Vue, Svelte)
- No utility library (no Lodash, date-fns)
- No HTTP client (pure fetch() API)
- No testing framework (future: Node.js built-in test runner)

**Backend (src/agents, src/orchestrator, etc.):**
- `package.json` dependencies: **`{}`**
- `package.json` devDependencies: **`{}`** (or just Node built-ins)
- All logic uses `node:*` modules

**Exception:** Testing framework in Phase 2 may use `node:test` (built-in, no install) or `pytest` (external language, acceptable).

### Consequences

**Advantages:**
- No supply-chain attacks (zero external code)
- No version conflicts (always latest Node.js built-ins)
- Instant startup (no npm install, no node_modules)
- Easy deployment (copy files, no build step)
- High velocity (no dependency updates to manage)
- Educational (shows how to build without frameworks)

**Disadvantages:**
- No ORM for database (must write SQL by hand)
- No request validation (manual schema checking)
- No authentication library (must implement)
- Large code (less abstraction, more boilerplate)
- Maintenance burden (reimplementing features)
- Hard to hire (teams expect npm ecosystems)

**Mitigation:**
- Document in CLAUDE.md: "No dependencies is intentional design choice"
- Add built-in test runner in Phase 2 (node:test, available in Node 18+)
- Maintain list of "equivalent npm packages" in CODEBASE_MAP.md for reference

---

## ADR-008: Docker + nginx for Deployment (Static Files, No Backend)

**Date:** 2024-04-02  
**Status:** Accepted  
**Author:** Knowledge Keeper (deployment architecture)

### Context

Currently, frontend is served by `server.js` (Node.js HTTP server, ~60 lines):
```javascript
import http from 'node:http';
const PORT = process.env.PORT || 3014;
http.createServer((req, res) => {
  // serve /src/frontend/v4.html + static files
}).listen(PORT);
```

This is suitable for development but not production. Deployment options:
1. **Keep Node.js server** (current) — simple but stateful, slow scaling, hard to SLA
2. **Vercel/Netlify** — requires build step, not suitable for no-bundler design
3. **Docker + nginx** — standard DevOps, static file serving, load balancers, CDN-ready

### Decision

**Containerize with Docker + nginx** for Phase 2+ deployment:

```dockerfile
# Dockerfile
FROM nginx:alpine
COPY src/frontend/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

**nginx configuration** (nginx.conf):
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  
  # Serve v4.html
  location / {
    try_files $uri $uri/ /v4.html;
  }
  
  # Static assets (images, fonts)
  location /assets/ {
    expires 1d;
    add_header Cache-Control "public, immutable";
  }
  
  # No backend API (all logic in v4.html)
}
```

**Deployment:**
```bash
docker build -t cammelot:latest .
docker run -p 8080:80 cammelot:latest
```

Backend (Node.js agents, orchestrator, FHIR store) **remains undeployed** — it is for research/testing, not production use.

### Consequences

**Advantages:**
- Zero application server overhead (nginx is fast)
- Stateless (horizontally scalable, no sticky sessions)
- CDN-ready (all content cacheable)
- Standard DevOps (Docker is industry standard)
- Cost-effective (static hosting is cheap)
- No backend maintenance (no Node.js process to monitor)

**Disadvantages:**
- Cannot execute backend code (cognitive loop, FHIR store) without Node.js
- No server-side rendering (all HTML/JS sent to browser)
- No persistent database (unless added separately)
- No authentication (must add frontend-only or separate auth service)
- All business logic exposed (frontend code readable in DevTools)

**Future phases:**
- Phase 3: Add Node.js backend service (separate container)
- Phase 4: Add PostgreSQL/MongoDB for persistence
- Phase 5: Add auth service (Keycloak, Auth0, or custom)

**For now:** v4.html is 100% frontend, no backend needed.

---

## Summary Table

| ADR | Decision | Status | Rationale | Risk |
|-----|----------|--------|-----------|------|
| **001** | Frontend-first, no bundler | ✅ Accepted | Zero build friction, single file | Monolithic (2500 LOC) |
| **002** | DISEASE_DB = source of truth | ✅ Accepted | No data fragmentation, conditions unified | Sync with backend |
| **003** | 45 agents, not 5000 | ✅ Accepted | Canvas performance, playable UX | Unrealistic scale |
| **004** | Condition-specific Markov | ✅ Accepted | Clinical accuracy, emergent behavior | Complex to maintain |
| **005** | localStorage, not SQLite | ✅ Accepted | Zero dependencies, offline, simple | 5 MB limit, block sync |
| **006** | EVENT_LOG, not FHIR | ✅ Accepted | Simple, fast, queryable | Not FHIR R4 compliant |
| **007** | Zero npm dependencies | ✅ Accepted | Supply-chain security, velocity | More code, less ecosystem |
| **008** | Docker + nginx | ✅ Accepted | Standard DevOps, scalable, cheap | No backend capability |

---

## How to Add a New ADR

When making a major architectural decision, create a new ADR:

1. Use format: `ADR-XXX: Title (1–8 words)`
2. Include sections: Date, Status, Context, Decision, Consequences
3. Add summary row to table above
4. Link from affected code files (e.g., `// See ADR-005: localStorage`)
5. Notify team (update CLAUDE.md "Architecture" section)

**Status values:**
- `Accepted` — decision is final, code implements it
- `Proposed` — under discussion, not yet implemented
- `Superseded` — replaced by newer ADR, keep for history

---

*Last updated: 2026-04-02*

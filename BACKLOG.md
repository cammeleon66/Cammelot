# Cammelot — Engineering Backlog

> **Status**: Active — Last updated 2026-04-01
> **Goal**: Turn the architectural proof-of-concept into a working, connected simulation
> **Runtime target**: `npm run frontend` serves everything — no separate backend process needed

---

## Current State (Honest Assessment)

The project has **two disconnected systems**:

| Layer | What exists | Problem |
|-------|-------------|---------|
| **Frontend** (v4.html) | 15 hardcoded agents, visual walking, click-to-inspect | No connection to backend engines; disease progression is fake math in the tick() function |
| **Backend** (simulation_loop.js) | Real Markov disease models, FHIR store, A2A protocol, cognitive loop | Nobody sees it — runs headless in terminal, output goes to console.log |
| **Data** | RIVM/CBS/NZa reference data in config/ | In-memory only, no persistence, conditions hardcoded per agent |
| **Buildings** | Drawn on map, agents walk in/out | Can't click them, can't see queues, doctor load, or patient flow |

### What works today
- Agents walk around town on roads (waypoint pathfinding)
- Sick agents walk to GP → get referred → walk to hospital → get treated → recover
- Click agent → see HP, conditions, behavioral state, action history
- IST/SOLL mode toggle changes drain parameters
- Loading screen with logo

### What's broken
- Disease spawning ignores the statistical RIVM model — conditions are hardcoded per agent
- Almost everyone still dies because drain math isn't balanced against treatment speed
- Can't click buildings (Hospital, GP practices) to see what's happening inside
- History is shallow — only tracks the current session, no persistence
- Doctors have no visible workload/burnout/queue stats in UI
- Backend engines (disease_engine.js, population_engine.js, fhir_store.js) exist but frontend doesn't use them
- Zero tests

---

## Epic 1: Disease Database & Statistical Spawning

**Why**: Conditions are currently hardcoded per agent. The RIVM prevalence data exists in `config/reference_data.js` but the frontend doesn't use it. We need a proper disease catalog that drives spawning.

### 1.1 — Disease Catalog (client-side database)
Build a `DISEASE_DB` object in the frontend containing every condition with full metadata:
```
{
  code: "I25",
  name: "Chronic Ischemic Heart Disease",
  icd10: "I25",
  category: "cardiovascular",
  prevalenceNL: 800_000,
  seniorPrevalence: 0.12,
  ageMin: 0,
  canBeReferred: true,
  referralSpecialty: "cardiology",
  gpTreatable: false,         // needs specialist
  treatmentDurationTicks: 6,  // how long hospital stay
  recoveryDurationTicks: 15,
  hpDrainPerTick: 0.3,       // passive drain while untreated
  hpGainPerTreatmentTick: 2.5,
  hpGainPerRecoveryTick: 1.2,
  interactsWith: ["E11", "I10"],  // comorbidity pairs
  markovTransitions: { ... },     // condition-specific Markov matrix
  treatmentEffect: "moderate→mild, severe→moderate",
  mortalityRisk: { untreated: 0.04, treated: 0.005 },  // per cycle
}
```
Source: merge `RIVM_DATA.chronicConditions` + `DiseaseProgressionModel.baseTransitions` + new clinical data.

**Acceptance**: Every condition referenced in the sim has a full entry. No more magic numbers in tick().

### 1.2 — Statistical Population Spawner
Replace the 15 hardcoded agent definitions with a procedural spawner:
- Use `CBS_DATA.ageDistribution` to generate ages
- Use `RIVM_DATA.chronicConditions[].seniorPrevalence` to assign diseases
- Use `RIVM_DATA.multimorbidityRate` (45% of 75+) for multi-condition assignment
- Use `CBS_DATA.genderRatio` for gender split
- Generate Dutch names from `FIRST_NAMES_M/F` + `SURNAMES` lists (already in population_engine.js)
- Assign GP based on grid proximity
- Initial HP based on age + conditions (already in population_engine.js)
- Generate 30–60 agents (enough to see patterns, not so many it lags)

**Acceptance**: On page load, citizens are procedurally generated with statistically accurate disease distribution. Refresh gives different citizens.

### 1.3 — Comorbidity Interactions
When a patient has multiple conditions, model interactions:
- Diabetes (E11) + Heart Disease (I25): HP drain ×1.4
- COPD (J44) + Lung Cancer (C34): HP drain ×2.0
- Hypertension (I10) + Heart Failure (I50): HP drain ×1.5
- Dementia (F03) + anything: patient takes 2× longer to seek GP (delayed self-awareness)

**Acceptance**: Comorbid patients visibly deteriorate faster. Click panel shows "Comorbidity risk: High".

### 1.4 — Natural Mortality (Age-Based)
Not everyone should die from wait times. Add background mortality:
- CBS says 48 deaths/year in a 5,000 town
- Per-tick probability: `(48 / 5000) / (365 * 4) = 0.0000066` per tick for average citizen
- Scale by age: 80+ has ~15× the mortality rate of 18-64
- When natural death occurs: ghost sprite + "Passed away peacefully at age 87"

**Acceptance**: Some elderly agents die naturally over long runs, not just from system failure.

---

## Epic 2: Wire Backend Engines into Frontend

**Why**: The frontend has its own simplified tick() function. The backend has proper Markov chains, HP drain engines, FHIR stores, and cognitive loops that nobody sees.

### 2.1 — Inline the Disease Engine
Port the core logic from `disease_engine.js` into the frontend:
- `DiseaseProgressionModel` — Markov state transitions per condition
- `HPDrainEngine` — calculates HP loss from Treeknorm violations
- `TreeknormChecker` — compliance checking

Don't import ES modules (v4.html is a standalone file). Copy the logic as functions.

**Acceptance**: `tick()` uses real Markov transitions, not `a.hp -= 0.05 * conditions.length`.

### 2.2 — Inline the FHIR Memory Store
Port a lightweight version of `fhir_store.js` into the frontend:
- Every agent action creates a FHIR-like log entry
- `Patient`, `Condition`, `Encounter`, `Observation` resources
- Queryable by patient ID for the history panel
- Memory stream = chronological log of everything that happened to this agent

**Acceptance**: Click an agent → History tab shows timestamped FHIR events. "Cycle 45: Condition I25 progressed from mild to moderate".

### 2.3 — Cognitive Loop Integration
Port the reflection/planning logic from `cognitive_loop.js`:
- Memory Stream: agent reviews recent FHIR events
- Reflection: "My HP is dropping — I should see a doctor" 
- Planning: generates action (seek_gp, wait, seek_alternative)
- This replaces the hardcoded `if(hp < 75) goto gp` logic

**Acceptance**: Agent thoughts in the panel reflect actual reasoning from FHIR memory. Different agents make different decisions based on their history.

---

## Epic 3: Clickable Buildings & Doctor Dashboards

**Why**: You can't click the hospital or GP to see what's going on inside. Doctors have no visible workload.

### 3.1 — Click Detection for Buildings
When clicking a map location that's inside a building zone (`BUILDINGS` array), show a building detail panel instead of the agent panel:
- Hospital: show queue, patients inside, patients treated today, specialist workload
- GP: show queue, admin burden %, patients seen, referrals made
- Determine click target: check buildings FIRST (agent might be inside), then agents

**Acceptance**: Click hospital → see panel titled "Cammelot Hospital" with live stats.

### 3.2 — GP Dashboard Panel
When GP building is clicked, show:
```
GP Collins
──────────────
Admin Burden:     30% ████████░░ 
Patients Seen:    12 today
Referrals Made:   3
Queue:            4 waiting
Burnout Risk:     Medium ⚠
──────────────
Active Patients:
  • Henry Ward (I25) — referred to hospital
  • Sophie Taylor (F32) — treated, recovering
  • Keith Miller — checkup, all clear
──────────────
Thoughts: "30% of my day is paperwork. If only I had more time..."
```

**Acceptance**: Click GP building → see live workload, patient list, burnout indicator.

### 3.3 — Hospital Dashboard Panel
When hospital is clicked, show:
```
Cammelot Hospital
──────────────
Beds Occupied:    3 / 8
Specialists:      Dr. Ashworth (Cardiology), Dr. Pryce (Pulmonology)
Wait List:        7 patients
Avg Wait:         9.2 weeks
Treeknorm Status: ⚠ VIOLATED (12w norm)
──────────────
Patients Inside:
  • Peter Shaw (C34, severe) — Day 3 of treatment, HP 42→58
  • Robert Green (I50) — Admitted today
──────────────
Recently Discharged:
  • Henry Ward (I25) — Treated, discharged cycle 52, HP 34→78
──────────────
Thoughts: "My queue is 12 weeks deep. Patients are deteriorating."
```

**Acceptance**: Click hospital → see bed count, wait list, Treeknorm violations, patients inside.

### 3.4 — Doctor Agent Tracking
GP and Specialist agents should have proper state:
- `patientsSeenToday` counter (resets every 28 ticks = 1 sim week)
- `referralsMade` counter
- `burnoutLevel`: function of (admin_burden × queue_size × sick_leave_risk)
- `currentPatient`: who they're seeing right now
- Action history (same as patients): "Cycle 12: Referred Henry Ward to cardiology"

**Acceptance**: Click a doctor sprite OR their building → see their workload and history.

---

## Epic 4: Proper History & Event System

**Why**: The action history is shallow. Events aren't persisted. You can't see what happened over time.

### 4.1 — Global Event Log
Create a simulation-wide event log:
```js
const EVENT_LOG = [];  // { cycle, type, agentId, agentName, detail, hp }
```
Types: `spawned`, `feeling_sick`, `visited_gp`, `referred`, `admitted`, `treated`, `discharged`, `recovered`, `worsened`, `died`, `natural_death`, `gp_consultation`, `specialist_consultation`

**Acceptance**: Event log is queryable. "Show me all referrals" or "Show me all deaths."

### 4.2 — Enhanced Agent History Panel
When you click an agent, the history section should show:
- **Full lifecycle**: from spawn to current state
- **HP graph**: tiny sparkline showing HP over time (array of HP values per tick)
- **Condition timeline**: when each condition was diagnosed, progressed, treated
- **Care pathway**: visual flow → Healthy → Felt Sick → Visited GP → Referred → Hospital → Recovered
- **Wait time tracking**: "Spent 14 weeks waiting for cardiology"

**Acceptance**: Clicking even a healthy citizen shows "No conditions. Last checkup: Cycle 40."

### 4.3 — Simulation Summary Dashboard
Add a collapsible panel or overlay showing:
- Total agents / alive / dead / in treatment / recovering
- Deaths by cause (system failure vs natural)
- Average wait time trend
- GP utilization %
- Hospital bed occupancy %
- Top 3 conditions causing deaths
- Cost accumulation (admin waste, preventable deaths in EUR)

Could be a toggle button in the control bar: "📊 Stats"

**Acceptance**: Click Stats → see full overview of the simulation's cumulative state.

### 4.4 — LocalStorage Persistence
Save simulation state to `localStorage` so it survives page refresh:
- Agent positions, HP, conditions, behavioral state
- Event log
- Cycle count
- Serialize on every 10th cycle + on page unload
- Load on startup if available (with "Continue" / "New Game" prompt)

**Acceptance**: Close tab, reopen → simulation continues where you left off.

---

## Epic 5: Balanced Simulation Mechanics

**Why**: The drain/heal math needs to be balanced so that the simulation tells a meaningful story — not "everyone dies" and not "everyone is fine."

### 5.1 — Treatment Effectiveness from Disease DB
Pull treatment parameters from the Disease Catalog (Epic 1.1):
- Each condition specifies: `treatmentDurationTicks`, `hpGainPerTreatmentTick`, `recoveryDurationTicks`
- GP-treatable conditions (mild depression, managed hypertension, mild diabetes) heal at GP without referral
- Specialist-required conditions (severe heart disease, COPD, cancer) need hospital
- Treatment downgrades severity: severe→moderate→mild (not instant cure)

**Acceptance**: A patient with mild hypertension visits GP, gets medication, recovers to 95+ HP. A patient with severe heart disease goes to hospital, comes out moderate, slowly improves.

### 5.2 — GP Capacity Model
GPs shouldn't treat infinitely:
- Max consultations per day: 30 (NZa standard)
- Admin burden (30% IST) steals 9 slots → 21 effective consultations
- If queue > capacity: patients wait (visible queue at GP building)
- In SOLL: admin drops to 5% → 28.5 effective slots
- GP can see 1 patient per tick (4 ticks/day = max 4 per tick-day... simplify to: GP processes 1 patient per tick from queue)

**Acceptance**: When many agents are sick simultaneously, GP queue builds up. Visible congestion at GP building.

### 5.3 — Specialist Wait Times (Treeknorm)
Model real specialist capacity:
- Cardiology: 12 patients/week → 3/tick (if 4 ticks/week)
- If waitlist exceeds capacity: actual wait = waitlist.length / capacity_per_tick
- Publish wait time on building dashboard
- When wait > 12 weeks (Treeknorm): HP drain accelerates (this is already modeled)
- In SOLL: capacity × 1.34 (AI efficiency multiplier)

**Acceptance**: Hospital dashboard shows "Cardiology wait: 8 weeks (compliant)" or "14 weeks ⚠ TREEKNORM VIOLATED".

### 5.4 — Decay Curve Calibration
Target outcomes over 1000 cycles (~250 sim days):
- IST mode: 5-15% mortality (system failure deaths) + 1-2% natural mortality → ~6-17% total
- SOLL mode: 1-3% system failure deaths + 1-2% natural → ~2-5% total
- Most agents should cycle through: healthy → sick → treated → recovered → healthy
- Severe cases should take 2-3 treatment cycles before stabilizing

Currently: decay is either too aggressive (everyone dies by cycle 50) or too gentle (nobody dies). Need to calibrate:
- Passive drain (roaming, untreated): ~0.02/tick per mild condition, ~0.08/tick per severe
- Treeknorm drain: 0.3/tick per week overdue × severity multiplier
- Treatment heal: +2.5/tick (hospital), +1.0/tick (GP)
- Recovery heal: +1.2/tick for 15-25 ticks

**Acceptance**: Run 500 cycles in IST. ~10% ghost. Switch to SOLL, run 500 more. Ghost rate decreases. Meaningful difference.

---

## Epic 6: Server & API Improvements

**Why**: The server.js is a basic static file server. It needs to support the live simulation.

### 6.1 — WebSocket Simulation API (Optional / Future)
If we ever want a shared multi-user view or headless simulation:
- Server runs `SimulationRunner` from `simulation_loop.js`
- WebSocket pushes tick updates to all connected clients
- Client sends: `{ action: "tick" }`, `{ action: "selectAgent", id: "..." }`
- Server responds with full state snapshot

**NOTE**: This is OPTIONAL. The current approach (all logic in v4.html) works for single-user. Only build this if we need multi-user or persistence beyond localStorage.

### 6.2 — SQLite Persistence (Optional / Future)
Replace in-memory FHIR store with SQLite:
- `better-sqlite3` package (synchronous, no ORM needed)
- Tables: `patients`, `conditions`, `events`, `encounters`, `observations`
- Server stores simulation state; frontend queries via REST API
- Enables: replay, time-travel debugging, cross-session continuity

**NOTE**: This is a Phase 2 item. LocalStorage (Epic 4.4) covers the immediate need.

---

## Priority Order (What to Build Tomorrow)

### Sprint 1 — Core Loop Fix (Morning)
| # | Task | Epic | Est. | Why first |
|---|------|------|------|-----------|
| 1 | Disease Catalog (`DISEASE_DB`) | 1.1 | 30min | Everything else depends on this |
| 2 | Statistical Population Spawner | 1.2 | 45min | Replaces hardcoded agents |
| 3 | Inline Disease Engine | 2.1 | 30min | Real Markov transitions in tick() |
| 4 | Decay Curve Calibration | 5.4 | 30min | Balance drain vs healing |
| 5 | GP Capacity Model | 5.2 | 20min | Realistic bottleneck |

### Sprint 2 — Buildings & Doctors (Afternoon)
| # | Task | Epic | Est. | Why second |
|---|------|------|------|-----------|
| 6 | Click Detection for Buildings | 3.1 | 20min | Enables building panels |
| 7 | GP Dashboard Panel | 3.2 | 30min | See doctor workload |
| 8 | Hospital Dashboard Panel | 3.3 | 30min | See hospital state |
| 9 | Doctor Agent Tracking | 3.4 | 20min | Doctors get history too |
| 10 | Specialist Wait Times | 5.3 | 20min | Treeknorm visualization |

### Sprint 3 — History & Polish (Evening)
| # | Task | Epic | Est. | Why third |
|---|------|------|------|-----------|
| 11 | Global Event Log | 4.1 | 20min | Powers all history views |
| 12 | Enhanced Agent History Panel | 4.2 | 30min | HP sparkline, care pathway |
| 13 | Simulation Summary Dashboard | 4.3 | 30min | Stats overlay |
| 14 | LocalStorage Persistence | 4.4 | 20min | Survive refresh |
| 15 | Comorbidity Interactions | 1.3 | 20min | More realistic progression |
| 16 | Natural Mortality | 1.4 | 15min | Not everyone dies from queues |

### Phase 2 (Later)
| # | Task | Epic | When |
|---|------|------|------|
| 17 | Cognitive Loop Integration | 2.3 | Week 2 |
| 18 | FHIR Memory Store in frontend | 2.2 | Week 2 |
| 19 | WebSocket API | 6.1 | Week 3 |
| 20 | SQLite Persistence | 6.2 | Week 3 |
| 21 | Bias Tracker UI | — | Week 4 |
| 22 | ROI Dashboard | — | Week 4 |
| 23 | Security Red Team UI | — | Week 4 |
| 24 | Test Suite | — | Ongoing |

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where does sim logic run? | **Frontend (v4.html)** | Single-file app, no build step, instant reload. Port backend logic as inline functions. |
| Database? | **localStorage now, SQLite later** | localStorage is free and works. SQLite needs `better-sqlite3` + API routes. |
| How many agents? | **30–60 procedurally generated** | Enough for statistical patterns, fast enough for 60fps rendering |
| Module bundler? | **None** | v4.html is self-contained. Copy-paste needed functions. Keep it simple. |
| State management? | **Plain objects + arrays** | No framework. agents[], EVENT_LOG[], DISEASE_DB object. |

---

## Definition of Done

A task is "done" when:
1. The feature works in the browser (no console errors)
2. Click interaction functions as described in acceptance criteria
3. IST and SOLL modes both produce different, meaningful outcomes
4. The simulation can run 500 cycles without everyone dying or nobody dying
5. No regressions — existing features still work

# Cammelot — Strategic Engineering Backlog

> **Status**: Active — Last updated 2026-04-02
> **Vision**: A public-facing simulation of the Dutch healthcare crisis that anyone can visit, understand, and share. People watch tiny citizens live, get sick, queue, wait, and sometimes die — not from disease alone, but from a system that can't keep up.
> **URL target**: `cammelot.health` — static Docker container, zero backend
> **Runtime**: Self-contained `v4.html` (~2500 lines) — no bundler, no framework

---

## What We've Built (Sprints 1–3 ✅)

| Feature | Status | Sprint |
|---------|--------|--------|
| DISEASE_DB (10 ICD-10 conditions, Markov matrices) | ✅ | 1 |
| Statistical Population Spawner (45 CBS-distributed agents) | ✅ | 1 |
| Inline Disease Engine (Markov transitions in tick()) | ✅ | 1 |
| Clickable Buildings (GP + Hospital dashboards) | ✅ | 2 |
| Doctor Agent Tracking (queue, burnout, capacity) | ✅ | 2 |
| Specialist Wait Times + Treeknorm visualization | ✅ | 2 |
| Natural Mortality (age-based, distinct from system failure) | ✅ | 2 |
| Comorbidity Interactions (multipliers + F03 delay) | ✅ | 2 |
| Decay Curve Calibration | ✅ | 2 |
| Global Event Log (13 event types) | ✅ | 3 |
| Enhanced Agent History (HP sparkline, care pathway) | ✅ | 3 |
| Simulation Summary Dashboard (📊 Stats overlay) | ✅ | 3 |
| LocalStorage Persistence (Continue / New Game) | ✅ | 3 |
| 109 backend tests | ✅ | 1 |

### What's Still Wrong (Honest)

| Problem | Impact | Why it matters for visitors |
|---------|--------|---------------------------|
| Agents are **soulless** — no bio, no occupation, no personality | People don't care about "cit-023" | Emotional connection drives sharing |
| Agents **don't talk to each other** — they walk in silence | Town feels dead | "Watch" value is zero if nothing happens |
| **Queues aren't visible** — blobs appear but agents don't physically line up | The core visual metaphor is missing | The whole point is showing congestion |
| **No onboarding** — visitors land on a simulation and have no idea what anything means | Bounce rate will be 95% | Must explain before they explore |
| **Right panel is wasted** — empty until you click something | First-time visitors see nothing | Should show a living town feed |
| **Metrics are cryptic** — "C_eff 62%" means nothing to non-experts | Core message is lost | Must translate to human language |
| **Not mobile-friendly** — no media queries, fixed 320px sidebar | 60%+ of visitors are on phones | Dead on arrival for social sharing |
| **Not deployable** — no Docker, no CI/CD, no hosting config | Can't share it | The whole point is public visibility |
| **No security model** — anyone could inject, no CSP, no testing | Public website = attack surface | Must harden before launch |

---

### 🛡️ Mordred Security Audit — OWASP Top 10 Baseline (17 findings)

> Mordred (Security Sentinel) completed a full static analysis scan on 2026-04-02.
> 5 findings are **veto-worthy** (block deployment). All are in `src/frontend/v4.html`.

#### Veto-Worthy (Must Fix Before Deployment)

| ID | OWASP Category | Severity | Description | Line(s) |
|----|---------------|----------|-------------|---------|
| MISCONFIG-003 | A05 Misconfiguration | **HIGH** | 12 inline `onclick=` handlers violate CSP | Throughout |
| XSS-001 | A03 Injection | MEDIUM | `innerHTML+=` with unsanitized template literals (chat data) | ~2373 |
| XSS-004 | A03 Injection | MEDIUM | innerHTML with unsanitized cycle count from localStorage | ~2676 |
| MISCONFIG-001 | A05 Misconfiguration | MEDIUM | No CSP (Content-Security-Policy) header configured | Server |
| INTEGRITY-001 | A08 Data Integrity | MEDIUM | localStorage load has no schema validation (only checks version) | ~2620 |

#### Tracked (Fix in Sprint 9 Before Docker)

| ID | OWASP Category | Severity | Description |
|----|---------------|----------|-------------|
| MISCONFIG-002 | A05 Misconfiguration | MEDIUM | Missing X-Frame-Options header |
| DESIGN-001 | A04 Insecure Design | MEDIUM | JSON.parse of localStorage without schema validation |
| DESIGN-005 | A04 Insecure Design | MEDIUM | Agent array from save spread without property whitelist |
| XSS-002 | A03 Injection | LOW | Template literals building agent cards with unsanitized names |
| XSS-003 | A03 Injection | LOW | innerHTML assignment (safe — static text only) |
| DESIGN-002 | A04 Insecure Design | LOW | EVENT_LOG bounded at 500 (✅ already mitigated) |
| DESIGN-003 | A04 Insecure Design | LOW | hpHistory bounded at 200 (✅ already mitigated) |
| DESIGN-004 | A04 Insecure Design | LOW | actionHistory bounded at 50 (✅ already mitigated) |
| INTEGRITY-002 | A08 Data Integrity | LOW | Numeric defaults prevent NaN injection (✅ already mitigated) |

#### Clean (No Action Required)

| ID | Category | Finding |
|----|----------|---------|
| SECRETS-001 | A02 Cryptographic | No hardcoded API keys, passwords, or tokens found ✅ |
| SECRETS-002 | A02 Cryptographic | No third-party packages with vulnerabilities ✅ |
| COMPONENTS-001 | A06 Vulnerable Components | Only Node.js built-ins used ✅ |

**Mordred's Verdict**: Overall risk = **MEDIUM**. No secrets exposure. Zero third-party supply chain risk. The 5 veto-worthy items are all CSP/XSS related and must be resolved in Sprint 9 (before Docker deployment). The bounded arrays (DESIGN-002/003/004) and defensive defaults (INTEGRITY-002) are already properly mitigated.

---

### 🧪 Galahad QA Findings — Pre-Existing Bugs (2)

> Galahad (QA Sentinel) found 2 bugs in the backend reference implementation during Sprint 1.
> Neither affects v4.html (frontend-first architecture), but they should be fixed for backend parity.

| ID | File | Description | Impact |
|----|------|-------------|--------|
| BUG-001 | `src/clinical_logic/disease_engine.js` | `getAdjustedTransitions("deceased", >12w)` — probability sum < 1.0 | Dead agents could theoretically transition states |
| BUG-002 | `src/clinical_logic/disease_engine.js` | `severityMultiplier["healthy"] = 0` is JS-falsy, hits `\|\| 1.0` fallback | Healthy agents drain HP faster than intended |

**Galahad's Verdict**: These are backend-only. The v4.html inline disease engine uses different code paths. Fix when we port FHIR store (Sprint 10).

---

## Strategic Phases

### Phase 1: Make It Alive (Sprint 4–5)
*"I want to watch these people and feel something."*

### Phase 2: Make It Understandable (Sprint 6–7)
*"A stranger lands on this page and gets it within 30 seconds."*

### Phase 3: Make It Shareable (Sprint 8–9)
*"I can send this link to anyone and it works on their phone."*

### Phase 4: Make It Smart (Sprint 10–11)
*"The agents actually think, remember, and communicate."*

### Phase 5: Make It Rigorous (Sprint 12)
*"We can prove it's fair, secure, and scientifically grounded."*

---

## Phase 1: Make It Alive

### Epic 7: Vivid Characters

#### 7.1 — Agent Biographies
Generate a short bio for every citizen:
- **Occupation**: Teacher, Retired nurse, Bus driver, Baker, Student, etc. (30+ Dutch occupations)
- **Family**: "Married to Anna, 2 children" / "Lives alone since partner passed" / "Single parent"
- **Personality trait**: Stoic, Anxious, Optimistic, Stubborn, Social
- **One-liner backstory**: "Worked at the Philips factory for 32 years. Knees gave out first, then the heart."
- Seeded from agent ID for determinism (same citizen = same backstory on reload)

**Acceptance**: Click any citizen → see occupation, family, personality, backstory in the panel. Makes you care.

#### 7.2 — Agent Portraits
Generate a pixel-art face closeup for each agent (64×64px canvas):
- Derive from existing LOOKS data (skin tone, hair style/color, gender, age)
- Frontal face with eyes, simple expression
- Elderly: wrinkles (darker skin lines), glasses (random)
- Sick: pale tint, droopy expression
- Dead: greyscale, eyes closed
- Shown in agent panel header and in building patient lists

**Acceptance**: Every citizen has a unique, recognizable face. Panel feels personal.

#### 7.3 — Social Interactions (Agent-to-Agent)
When two agents are near each other on a road:
- 15% chance per tick of "chatting" — both pause for 3-5 ticks
- Speech bubble appears with contextual dialogue:
  - Healthy: "Lovely weather!" / "Have you seen the new bakery?"
  - Sick: "I've been waiting 8 weeks for the specialist..." / "My GP says there's nothing they can do."
  - About town: "Did you hear about Hendrik? He passed last week." / "The hospital queue is terrible."
- Post-interaction: add a `talked_to` event to both agents' EVENT_LOG
- Proximity threshold: 0.03 in normalized coords
- Visual: both agents face each other, speech icons appear

**Acceptance**: Watching the town for 30 seconds, you see people stop, chat, and move on. The conversations reference actual simulation state.

#### 7.4 — Emotional Sprites
Add visible emotional states to agent sprites:
- **Happy** (HP > 80, no conditions): slight bounce in walk, 😊 occasionally
- **Worried** (HP 50-80, has conditions): slower walk speed, 😟
- **In Pain** (HP 20-50): hobbling animation (alternating lean), 😣
- **Critical** (HP < 20): crawling speed, ❗ permanent bubble
- **Grieving**: When a nearby agent dies, neighbors get 💔 for 20 ticks

**Acceptance**: You can tell how someone is doing just by watching them walk.

---

### Epic 8: Visible Queues & Congestion

#### 8.1 — Physical Queue Lines
Replace abstract blob queues with actual agents lining up:
- When `behaviorState === 'going_to_gp'` and agent reaches GP entrance, enter a FIFO queue
- Queue positions: line up along the road outside the building (staggered positions)
- Agents in queue are visible on the map (not hidden inside building)
- They fidget (tiny random movement), show wait-related speech bubbles
- Queue length visible from a distance (you can see congestion at a glance)

**Acceptance**: When 6 agents are waiting at the GP, you SEE 6 tiny sprites lined up outside.

#### 8.2 — Building Status Indicators
Add visual indicators on buildings themselves:
- 🟢 Green glow: operating normally (queue < 50% capacity)
- 🟡 Yellow glow: busy (queue 50-100% capacity)
- 🔴 Red glow + pulse: overloaded (queue > capacity or Treeknorm violated)
- Small number badge on building: current queue count
- Hospital shows bed count: "3/8" rendered near the building

**Acceptance**: Zoom out and immediately see which buildings are in crisis.

#### 8.3 — Ghost Trail Enhancement
Make death more visible and impactful:
- Ghost sprite floats slowly upward for 30 ticks before fading out
- A small 🪦 marker remains at the location of death for the rest of the session
- If death was from system failure: marker is red, tooltip shows "Died waiting: 14 weeks for cardiology"
- If natural death: marker is grey, tooltip shows "Passed peacefully at age 87"
- Running death counter animation in top bar when a death occurs (flash red)

**Acceptance**: Deaths are unmissable. The graveyard of markers tells the story over time.

---

## Phase 2: Make It Understandable

### Epic 9: Onboarding & Education

#### 9.1 — Welcome Wizard (Mayor of Cammelot)
First-time visitors get a 4-step guided tour by the Mayor sprite:
1. **"Welcome to Cammelot!"** — Mayor portrait, brief intro: "I am the Mayor of this small Dutch town of 5,000 souls. What you're about to see is a simulation of our healthcare system — and why it's breaking."
2. **"Meet Your Citizens"** — Highlights a citizen, explains: age, conditions, HP. "Each person has real medical conditions based on Dutch health data."
3. **"The System"** — Highlights GP + Hospital. "When people get sick, they visit the GP. If it's serious, they're referred to a specialist. But the wait can be deadly."
4. **"IST vs SOLL"** — Shows the toggle. "IST shows today's crisis: 30% admin burden, 12-week waits. SOLL shows what AI could fix."

- Skip button always available
- "Don't show again" checkbox → localStorage
- Mayor sprite: distinguished character with chain of office

**Acceptance**: A stranger can understand the simulation in 60 seconds without reading documentation.

#### 9.2 — Contextual Tooltips
Hover any metric → get a plain-language explanation:
- **C_eff 62%**: "Clinical Efficiency — Only 62% of doctor time goes to patients. The rest is lost to paperwork."
- **Ghosts: 3**: "3 citizens have died. Some from untreatable disease, some because the system was too slow."
- **Wait 8w**: "Average time patients wait for a specialist. The Treeknorm says it should be under 4 weeks."
- **Treeknorm**: "The legal maximum waiting time for specialist care in the Netherlands."
- **Admin Burden 30%**: "Dutch GPs spend 30% of their time on administrative tasks instead of treating patients."

**Acceptance**: Every number on screen can be understood by a non-expert.

#### 9.3 — Narrative Event Ticker
A scrolling text ticker at the bottom of the game area (or top) showing key events in plain language:
- "💀 Hendrik Veenstra (70) died after waiting 14 weeks for a cardiologist."
- "🏥 Maria de Vries was admitted to hospital with severe COPD."
- "⚕ Dr. Collins referred 3 patients today. Her burnout level: HIGH."
- "⚠ Hospital wait time has exceeded the Treeknorm (12 weeks)."
- Ticker auto-scrolls, clickable to select the agent mentioned

**Acceptance**: Even without clicking anything, visitors understand what's happening by reading the ticker.

---

### Epic 10: Right Panel Redesign

#### 10.1 — Town Feed (Default View)
When no agent/building is selected, the right panel shows a **"Last 24 Hours in Cammelot"** feed:
- Reverse-chronological list of significant events
- Each entry: emoji icon + agent name (clickable) + event description + cycle number
- Categories: Deaths (red), Admissions (orange), Referrals (yellow), Recoveries (green), Social (blue)
- Filter buttons at top: All | 💀 Deaths | 🏥 Hospital | ⚕ GP | 💬 Social
- Auto-updates every tick

**Acceptance**: The panel is never empty. First thing a visitor sees is a living feed of what's happening.

#### 10.2 — Contextual Panel Switching
The right panel smoothly transitions between views:
- **Click nothing** → Town Feed ("Last 24 Hours")
- **Click a citizen** → Citizen Dossier (bio, HP sparkline, care pathway, history)
- **Click a doctor** → Staff Dossier (workload, patients, burnout)
- **Click a building** → Building Report (dashboard, queue, stats)
- **Click a grave marker** → Memorial (who died, how, what went wrong)
- Back button / click empty space → return to Town Feed

**Acceptance**: Panel always has relevant content. Transitions feel smooth and intentional.

#### 10.3 — Summary Statistics Bar
Replace or augment the top stats bar with human-readable metrics:
- Instead of "C_eff 62%" → "⚕ Doctors at 62% capacity"
- Instead of "Ghosts: 3" → "💀 3 deaths (2 preventable)"
- Instead of "Wait 8w" → "⏱ 8 week average wait"
- Add: "👥 42 alive" / "🏥 3 in hospital" / "💰 €24k system cost"
- Color-coded: green (good), yellow (warning), red (crisis)

**Acceptance**: A visitor immediately understands the state of the town from the top bar alone.

---

## Phase 3: Make It Shareable

### Epic 11: Mobile & Responsive Design

#### 11.1 — Responsive Layout
- **Desktop (>1024px)**: Current layout — game left, panel right
- **Tablet (768-1024px)**: Game full width, panel slides up from bottom (40% height)
- **Mobile (<768px)**: Game full width, panel is a bottom sheet (swipe up to expand)
- Touch-friendly: tap to select (no hover), pinch to zoom, swipe to pan
- Control bar adapts: fewer buttons on mobile, hamburger menu for extras

**Acceptance**: Simulation is usable on an iPhone SE.

#### 11.2 — Social Sharing Meta
- Open Graph tags: title, description, preview image (screenshot of town)
- Twitter Card: large image summary
- Description: "Watch a simulation of the Dutch healthcare crisis. 5,000 citizens, real medical data, real consequences."
- Favicon: Cammelot crest (16px)

**Acceptance**: Sharing the URL on LinkedIn/Twitter shows a rich preview card.

---

### Epic 12: Deployment & Infrastructure

#### 12.1 — Docker Container
- `Dockerfile`: nginx serving static files (v4.html + assets/)
- `docker-compose.yml` for local dev
- Multi-stage build: copy only production files
- Health check endpoint
- Gzip compression for v4.html (~100KB → ~20KB)

```dockerfile
FROM nginx:alpine
COPY src/frontend/v4.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/
EXPOSE 80
```

**Acceptance**: `docker build -t cammelot . && docker run -p 80:80 cammelot` → simulation runs at localhost.

#### 12.2 — CI/CD Pipeline
- GitHub Actions workflow:
  - On push: run 109 tests
  - On merge to main: build Docker image, push to registry
  - Lighthouse performance audit (target: >90 performance score)
  - HTML validation
- Branch protection on `main`

**Acceptance**: Every PR runs tests automatically. Merge to main deploys.

#### 12.3 — Performance Optimization
- Canvas rendering: dirty-rect optimization (only redraw changed areas)
- Agent limit: cap at 60, with "crowd simulation" for visual filler beyond that
- Asset loading: inline SVG sprites (already done), lazy-load map image
- Target: 60fps with 60 agents on mid-range hardware
- Lighthouse audit: Performance >90, Accessibility >80

**Acceptance**: Runs smoothly on a 2020 MacBook Air or equivalent.

#### 12.4 — Landing Page
Before entering the simulation, show a brief context page:
- Cammelot logo + tagline
- "The Netherlands has a healthcare crisis. We built a simulation to show you."
- 3 key stats: "301,000 worker shortage by 2035" / "12-week specialist waits" / "30% GP time lost to admin"
- [Enter Simulation →] button
- Links: About, Methodology, Data Sources, GitHub
- Language toggle: EN / NL

**Acceptance**: Visitor understands context before seeing the simulation. Professional enough for LinkedIn sharing.

---

## Phase 4: Make It Smart

### Epic 13: Cognitive Architecture

#### 13.1 — Inline FHIR Memory Store
Port lightweight FHIR store into v4.html:
- Every agent action creates a FHIR-like resource (Patient, Condition, Encounter, Observation)
- Resources queryable by patient ID for history panel
- Memory stream = chronological log per agent
- Powers the "Memory" tab in agent panel

**Acceptance**: Click agent → Memory tab shows FHIR resources: "Observation: HP dropped from 82 to 67. Encounter: Visited GP Collins."

#### 13.2 — Cognitive Loop (Reflect → Plan → Act)
Port reflection/planning from cognitive_loop.js:
- **Memory retrieval**: Agent reviews last N FHIR events
- **Reflection**: Draws conclusions: "My breathing is getting worse. I waited 6 weeks already."
- **Planning**: Generates action: seek_gp, wait, seek_alternative, complain
- Replaces hardcoded `if(hp < 75) goto gp` with actual reasoning
- Visible in panel: "Thinking: My HP dropped 15 points this week. I should see a doctor."

**Acceptance**: Agents make decisions based on history, not just HP thresholds. Different agents with same HP make different choices based on personality/history.

#### 13.3 — A2A Protocol (Agent-to-Agent Communication)
GP agents communicate with specialist agents:
- Referral messages: GP sends structured referral with patient ID, condition, urgency
- Specialists respond: "Accepted. Estimated wait: 8 weeks" or "Queue full. Suggest alternative."
- Messages visible in building dashboards
- Agent Cards with published wait times and capacity

**Acceptance**: The A2A protocol panel shows live message flow between GP and Hospital agents.

#### 13.4 — Digital Twin Predictions
Each patient agent has a lightweight "Digital Twin" that predicts outcomes:
- Based on current conditions, age, treatment status
- Predicts: "32% chance of heart failure within 6 months if untreated"
- Shown in agent panel: "Digital Twin says: Seek specialist within 4 weeks"
- Drives urgency in cognitive loop decisions

**Acceptance**: Agent panel shows predicted risk. Predictions influence behavior.

---

## Phase 5: Make It Rigorous

### Epic 14: Testing & Security

#### 14.1 — Security Hardening (Mordred-Informed)
Remediate all 5 veto-worthy OWASP findings from Mordred's baseline scan:

| Finding | Fix | Effort |
|---------|-----|--------|
| MISCONFIG-003: 12 inline `onclick=` | Refactor all to `addEventListener()` in init block | Medium |
| XSS-001: innerHTML+= with chat data | Sanitize via `textContent` or DOMPurify-lite helper | Small |
| XSS-004: innerHTML with save data | Escape cycle count before interpolation | Small |
| MISCONFIG-001: No CSP header | Add strict CSP in nginx config (`script-src 'self'`) | Small |
| INTEGRITY-001: No save schema validation | Add JSON schema check on localStorage load | Medium |

Additional hardening (from Mordred tracked findings):
- MISCONFIG-002: Add `X-Frame-Options: DENY` in nginx
- DESIGN-001/005: Property whitelist for deserialized agent objects
- XSS-002: Escape agent names in template literals (defense-in-depth)
- Subresource Integrity for external fonts (Press Start 2P from Google Fonts)

**Acceptance**: Re-run Mordred scan → 0 veto-worthy findings. OWASP ZAP produces no medium/high findings.

#### 14.2 — Security Swarm Test (Red Team)
Automated test scenario:
- Inject a "malicious agent" with forged Agent Card
- Test: Can it corrupt care logistics? Access other agents' FHIR data?
- Test: Naming collision attack (agent claims to be "gp1")
- Test: Overflow EVENT_LOG or localStorage to DOS
- Document findings for LinkedIn Applied Research post

**Acceptance**: All attack vectors documented with pass/fail. No critical vulnerabilities.

#### 14.3 — Agentic Test Panel
An in-sim "observer agent" that reviews outcomes:
- Checks: Is mortality rate within expected bounds? (5-15% IST, 1-3% SOLL)
- Checks: Are queues realistic? (average wait < 20 weeks)
- Checks: Are all conditions represented in deaths? (no single condition dominates >50%)
- Checks: Is age distribution of deaths realistic? (elderly > young)
- Visual: "🔬 QA" button shows test panel with pass/fail indicators
- Auto-runs every 100 cycles

**Acceptance**: The simulation self-validates. Anomalies are flagged automatically.

#### 14.4 — Bias Tracker (DIB Method)
Track systematic inequities across 1000+ cycles:
- Age bias: Do 65+ agents get systematically delayed vs younger?
- Condition bias: Are certain ICD-10 codes undertreated?
- GP assignment bias: Does GP proximity affect outcomes?
- Gender bias: Any statistical difference in treatment speed?
- Output: bias report with p-values and effect sizes
- Visual: "📊 Bias" tab in Stats overlay

**Acceptance**: After 1000 cycles, bias report shows whether the system discriminates. Feeds LinkedIn Applied Research posts.

#### 14.5 — Frontend Test Suite
Add browser-testable assertions for v4.html:
- Playwright or Puppeteer tests that load v4.html and verify:
  - Agents spawn correctly
  - Click detection works (agents + buildings)
  - IST/SOLL toggle changes parameters
  - Stats overlay opens/closes
  - Save/load cycle works
  - 500-cycle run produces expected mortality range
- Run in CI pipeline

**Acceptance**: `npm run test:e2e` passes. Catches regressions in the frontend.

---

### Epic 15: Applied Research Output

#### 15.1 — ROI Dashboard
Calculate and display:
- Admin waste: GP time × hourly rate × admin_burden%
- Preventable death cost: system_failure_deaths × €5,845
- Treeknorm violation cost: queue_weeks × weekly_cost
- IST vs SOLL comparison: "Switching to SOLL saves €X per year"
- Visual: cost counter ticking up in real-time

**Acceptance**: The economic argument for healthcare transformation is quantified and visible.

#### 15.2 — Scenario Comparison Mode
Side-by-side view:
- Left panel: IST simulation running
- Right panel: SOLL simulation running (identical starting population)
- Synced clocks: same cycle count
- Delta indicators: "SOLL has 8 fewer deaths, €34k less waste"

**Acceptance**: The difference between IST and SOLL is immediately, viscerally clear.

#### 15.3 — Data Export
- Export button: download simulation results as JSON or CSV
- Includes: all agents, all events, all metrics, parameters used
- Enables: academic analysis, reproducibility, external visualization
- Anonymized mode: strip names, use agent IDs only

**Acceptance**: A researcher can load the export into R/Python and reproduce findings.

---

## Sprint Schedule

### Sprint 4 — Vivid Characters (Next)
| # | Task | Epic | Priority |
|---|------|------|----------|
| 1 | Agent Biographies | 7.1 | 🔴 Critical |
| 2 | Agent Portraits (pixel faces) | 7.2 | 🔴 Critical |
| 3 | Social Interactions | 7.3 | 🔴 Critical |
| 4 | Emotional Sprites | 7.4 | 🟡 High |

### Sprint 5 — Visible Queues
| # | Task | Epic | Priority |
|---|------|------|----------|
| 5 | Physical Queue Lines | 8.1 | 🔴 Critical |
| 6 | Building Status Indicators | 8.2 | 🟡 High |
| 7 | Ghost Trail Enhancement | 8.3 | 🟡 High |

### Sprint 6 — Onboarding
| # | Task | Epic | Priority |
|---|------|------|----------|
| 8 | Welcome Wizard (Mayor) | 9.1 | 🔴 Critical |
| 9 | Contextual Tooltips | 9.2 | 🔴 Critical |
| 10 | Narrative Event Ticker | 9.3 | 🟡 High |

### Sprint 7 — Right Panel & Metrics
| # | Task | Epic | Priority |
|---|------|------|----------|
| 11 | Town Feed (default view) | 10.1 | 🔴 Critical |
| 12 | Contextual Panel Switching | 10.2 | 🟡 High |
| 13 | Human-Readable Stats Bar | 10.3 | 🟡 High |

### Sprint 8 — Mobile & Social
| # | Task | Epic | Priority |
|---|------|------|----------|
| 14 | Responsive Layout | 11.1 | 🔴 Critical |
| 15 | Social Sharing Meta | 11.2 | 🟡 High |

### Sprint 9 — Security Gate + Deployment
| # | Task | Epic | Priority |
|---|------|------|----------|
| 16 | **Security Hardening** (Mordred veto items) | 14.1 | 🔴 Critical — BLOCKS deployment |
| 17 | Docker Container | 12.1 | 🔴 Critical |
| 18 | CI/CD Pipeline | 12.2 | 🔴 Critical |
| 19 | Performance Optimization | 12.3 | 🟡 High |
| 20 | Landing Page | 12.4 | 🟡 High |

### Sprint 10–11 — Cognitive Architecture
| # | Task | Epic | Priority |
|---|------|------|----------|
| 21 | Inline FHIR Memory Store | 13.1 | 🟡 High |
| 22 | Cognitive Loop | 13.2 | 🟡 High |
| 23 | A2A Protocol | 13.3 | 🟢 Medium |
| 24 | Digital Twin Predictions | 13.4 | 🟢 Medium |
| 25 | Fix Galahad BUG-001/002 (backend disease_engine) | — | 🟢 Medium |

### Sprint 12 — Rigor & Research
| # | Task | Epic | Priority |
|---|------|------|----------|
| 26 | Security Swarm Test (Red Team) | 14.2 | 🟡 High |
| 27 | Agentic Test Panel | 14.3 | 🟡 High |
| 28 | Bias Tracker | 14.4 | 🟡 High |
| 29 | Frontend E2E Tests | 14.5 | 🟡 High |
| 30 | ROI Dashboard | 15.1 | 🟡 High |
| 31 | Scenario Comparison | 15.2 | 🟢 Medium |
| 32 | Data Export | 15.3 | 🟢 Medium |

---

## Technical Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | **Frontend-only (v4.html)** | Zero backend = free hosting, no server costs, instant load |
| Persistence | **localStorage (done) → IndexedDB (future)** | Supports larger datasets than localStorage's 5MB limit |
| Hosting | **Docker + nginx** | Static files, CDN-friendly, scales infinitely |
| Memory system | **EVENT_LOG (done) → FHIR store (Phase 4)** | EVENT_LOG is simple and fast; FHIR adds semantic structure for research |
| Testing | **Node test (backend) + Playwright (frontend)** | Separate concerns: logic tests vs integration tests |
| Security | **CSP + no inline handlers + input sanitization** | Mordred scan: 5 veto items must clear before Sprint 9 Docker gate |
| Mobile | **CSS media queries + touch events** | No separate mobile app; responsive web works |
| Agent count | **45-60 active + crowd simulation for visual filler** | Balance between meaningful data and performance |
| Bundler | **None** | Single file keeps deployment trivial |

---

## Definition of Done

A feature is "done" when:
1. It works in Chrome, Firefox, and Safari (no console errors)
2. Click/touch interactions function as described
3. IST and SOLL modes produce meaningfully different outcomes
4. The simulation runs 500 cycles without everyone dying or nobody dying
5. No regressions — all existing features still work
6. A non-technical person can understand the feature without explanation
7. Mobile layout doesn't break (Phase 3+)

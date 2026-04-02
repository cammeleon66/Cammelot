# Cammelot — Strategic Engineering Backlog

> **Status**: ✅ ALL 12 SPRINTS COMPLETE — Last updated 2026-04-02
> **Vision**: A public-facing simulation of the Dutch healthcare crisis that anyone can visit, understand, and share. People watch tiny citizens live, get sick, queue, wait, and sometimes die — not from disease alone, but from a system that can't keep up.
> **URL target**: `cammelot.health` — static Docker container, zero backend
> **Runtime**: Self-contained `v4.html` (~4300 lines) — no bundler, no framework
> **Next phase**: MAKE IT PRETTY — visual polish, animations, micro-interactions

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

---

## ═══════════════════════════════════════════════════════════
## PHASE 6: MAKE IT PRETTY ✨
## ═══════════════════════════════════════════════════════════

> **Status**: NEW — This is the next engineering phase
> **Goal**: Transform Cammelot from functional to *beautiful*. Every pixel, every animation, every transition should feel crafted. When someone shares this on LinkedIn, the first reaction should be "Wow, this is gorgeous" before they even understand what it simulates.
> **Principle**: "If it doesn't make you feel something, it's not done."

---

### Epic 16: Map & Environment Polish

#### 16.1 — Day/Night Cycle
- Smooth color overlay transitioning from dawn (warm gold) → day (bright) → dusk (amber) → night (deep blue)
- Cycle tied to simulation time: 1 full day = 100 ticks
- Night: warm window glow on buildings (yellow rectangles), street lamps (small light circles)
- Dawn/dusk: long shadows from buildings and agents
- Stars appear at night (tiny twinkling white dots)
- Moon phases (quarter, half, full) change every few sim days

**Acceptance**: Watching the simulation for 2 minutes, you see a full day pass. Night feels cozy, not dark.

#### 16.2 — Weather System
- Random weather events: ☀ Sunny, 🌧 Rain, ❄ Snow, 🌫 Fog, ⛈ Storm
- Rain: animated blue streaks falling across screen, puddle reflections, agents walk faster
- Snow: white particles drifting down, accumulation on rooftops (white line on top)
- Fog: semi-transparent white overlay, agents further from camera fade
- Storm: darker sky, lightning flash (brief white flash), agents run to buildings
- Weather indicator in top bar or ticker

**Acceptance**: Weather makes the town feel alive. Rain makes you feel the cold.

#### 16.3 — Seasonal Foliage
- Trees change color: Spring (bright green) → Summer (deep green) → Autumn (orange/red/gold) → Winter (bare branches, snow)
- Season tied to simulation cycle (1 season = 250 ticks)
- Fallen leaves drift across roads in autumn (tiny particle system)
- Flowers bloom in spring near buildings (small colored dots)

**Acceptance**: The town visually changes through the year.

#### 16.4 — Ambient Particle System
- Dust motes floating in sunlight (tiny gold dots moving slowly)
- Fireflies at night (small green-yellow blinks near park)
- Birds flying across the sky (tiny V-shapes, occasional, high up)
- Smoke from chimneys in winter (small grey wisps rising from buildings)

**Acceptance**: The world breathes. There's always something subtle moving.

---

### Epic 17: Character Visual Polish

#### 17.1 — Smooth Movement & Pathfinding
- Replace current jittery linear movement with eased interpolation (lerp with easing)
- Agents slow down approaching destinations, speed up from stops
- Head-turn: agent sprite faces direction of movement (flip sprite horizontally)
- Group walking: agents near each other match pace slightly
- Intersection behavior: agents yield to each other at crossings (brief pause)

**Acceptance**: Movement feels natural, not robotic. Characters look like they belong in the world.

#### 17.2 — Enhanced Sprite Animations
- Idle animation: subtle breathing (1px vertical oscillation every 2s)
- Sitting: agents at the park occasionally sit on benches (different sprite pose)
- Waving: when two agents start chatting, brief wave animation
- Phone checking: idle agents occasionally look at phone (hand up gesture)
- Stretching: agents leaving buildings stretch (arms up 1 frame)

**Acceptance**: Even standing still, characters feel alive.

#### 17.3 — Shadow & Lighting on Agents
- Dynamic shadow direction matches day/night cycle
- Agents near buildings cast shorter shadows
- Night: agents near street lamps get a warm glow highlight
- Indoor agents (in buildings) not visible but shown as silhouettes in windows

**Acceptance**: Characters look grounded in the world, not floating on top.

#### 17.4 — Status Visual Effects
- Healing: small green + particles float up from recovering agents
- Damage: small red - particles when HP drops
- Level-up style flash when someone recovers from critical
- Subtle heart-rate line near critical agents (like ECG blip)
- Money particle (€) floats up from GP building when consultation happens

**Acceptance**: You can tell what's happening to someone without clicking them.

---

### Epic 18: UI & Panel Polish

#### 18.1 — Panel Transitions & Micro-animations
- Panel content fades in (opacity 0→1, 200ms ease)
- Tab switching: smooth crossfade between views
- Numbers animate when changing (count-up effect for stats)
- HP bar: smooth width transition (CSS transition 300ms)
- Care pathway badges: sequential reveal animation (pop in one by one)
- Feed entries: slide in from right with staggered delay

**Acceptance**: Every panel change feels smooth and intentional. No jarring jumps.

#### 18.2 — Typography & Color Refinement
- Move to SNES-authentic type scale (Press Start 2P headings, system font body)
- Reduce information density: fewer metrics visible by default
- Color hierarchy: critical numbers pulse, stable numbers stay calm
- Dark mode toggle with midnight-blue palette

**Acceptance**: UI feels designed, not engineered.

#### 18.3 — Sound Design (Optional/Mutable)
- Ambient: soft town hum, birds (day), crickets (night), rain (weather)
- Events: subtle chime on death, soft blip on new event, heartbeat near critical patients
- Music: 8-bit ambient loop (muted by default, toggle in settings)
- Sound icon in top bar: 🔇/🔊

**Acceptance**: With sound on, the simulation is immersive. Sound off by default.

---

### Epic 19: Data Visualization Polish

#### 19.1 — Animated Charts
- Stats dashboard charts animate on open (bars grow, lines draw)
- Age distribution: smooth bar chart with CBS reference overlay
- Mortality curve: animated line chart showing deaths over time
- Condition breakdown: animated donut chart

**Acceptance**: Opening Stats feels like a reveal, not a data dump.

#### 19.2 — Heatmap Overlay
- Toggle: "Show Heatmap" overlays the map with a color gradient
- Red zones: areas where agents wait longest / die most
- Blue zones: areas near functional healthcare
- Opacity adjustable via slider
- Data source: aggregate agent position + HP data over time

**Acceptance**: The spatial inequality of healthcare access is visible at a glance.

#### 19.3 — Timeline Scrubber
- Bottom bar: horizontal timeline showing simulation history
- Key events marked with icons (💀 death, 🏥 admission, ⚕ treatment)
- Drag to rewind/fast-forward through history
- Playback controls: ⏮ ⏪ ⏸ ⏩ ⏭

**Acceptance**: You can rewind to "when did things go wrong?" and play it forward.

#### 19.4 — Relationship Lines
- Toggle: show A2A communication lines between agents and buildings
- Referral lines: dashed, colored by urgency
- GP→Hospital: thick when queue is full
- Social chat: thin dotted line between chatting agents
- Pulse animation on active communication

**Acceptance**: The invisible network of healthcare becomes visible.

---

### Epic 20: Loading & First Impression

#### 20.1 — Loading Screen
- Animated pixel art loading: castle builds brick by brick
- Progress bar: "Spawning 5,000 citizens... Calibrating diseases... Building town..."
- Fun facts during load: "Did you know? 30% of your GP's time goes to paperwork, not you."
- Tip: "Click any citizen to see their story"

**Acceptance**: Loading is entertaining, not boring. Sets the mood.

#### 20.2 — Intro Camera Pan
- On first load (no save data): slow zoom from sky-level to street-level
- Camera pans across the town showing key locations
- Text overlays: "This is Cammelot. Population 5,000." → "3 GP practices" → "1 Hospital" → "And a crisis."
- Ends at normal view with the Mayor's welcome wizard

**Acceptance**: First-time visitors get context before interacting. Feels cinematic.

#### 20.3 — Attract/Idle Mode
- If no interaction for 60s: enters screensaver mode
- Camera slowly pans across town, auto-follows interesting agents
- Narration ticker: auto-generated town updates
- Good for lobby displays, conference booths, embedded widgets

**Acceptance**: The simulation runs beautifully unattended.

---

### Epic 21: Performance & Infrastructure

#### 21.1 — Canvas Optimization
- Double-buffering: render to offscreen canvas, flip on vsync
- Dirty region tracking: only repaint changed areas
- Layer separation: static map, buildings, agents, UI each on own canvas
- requestAnimationFrame with frame budget (16ms target)

**Acceptance**: Smooth 60fps even with 60 agents + particles + weather.

#### 21.2 — Progressive Asset Loading
- Map image: load low-res immediately, swap to high-res when ready
- Font: system fallback → Press Start 2P (no flash of unstyled text)
- Sprites: pre-render all character variants on init

**Acceptance**: Time to first meaningful paint < 2 seconds.

#### 21.3 — IndexedDB Migration
- Move from localStorage (5MB limit) to IndexedDB
- Multiple save slots: "Save 1: Cycle 500, IST, 23 deaths" / "Save 2: ..."
- Auto-save every 50 cycles
- Export/import save files as JSON

**Acceptance**: Users can maintain multiple experiments.

#### 21.4 — PWA Support
- manifest.json: installable as desktop/mobile app
- Service worker: offline support (cache v4.html + assets)
- App icon: 192px and 512px Cammelot castle
- Splash screen matching loading screen design

**Acceptance**: "Add to Home Screen" works on mobile. Runs offline.

---

## ═══════════════════════════════════════════════════════════
## PHASE 7: WOWZERS 🚀 — The Viral Engine
## ═══════════════════════════════════════════════════════════

> **Status**: STRATEGIC PLAN — Awaiting execution
> **Goal**: Transform Cammelot from a simulation into a **social phenomenon**.
> Every feature here serves one purpose: make people **share** this. On LinkedIn,
> on X, at conferences, in classrooms, in board meetings. The simulation doesn't
> just show the crisis — it makes the crisis **impossible to ignore**.
>
> **Core Insight**: The biggest WOW isn't prettier graphics — it's **storytelling**.
> People share **stories**, not dashboards. A citizen's 14-week wait and death is
> more powerful than any chart. We need to make those stories surface automatically.

---

### Epic 22: The Daily Gazette (24-Hour Summary)

> "What happened in Cammelot today?" — This is the single most important missing
> feature. It turns raw events into a narrative that non-technical people understand.

#### 22.1 — Cammelot Gazette Panel
- **Right sidebar toggle**: "📰 Gazette" tab (alongside Town Feed, Agent Detail)
- Generates every 100 cycles (1 "day") automatically
- Written as a **newspaper article** by the simulation engine:

```
═══════════════════════════════
 🏰 THE CAMMELOT GAZETTE
   Day 47 — Autumn, Year 1
═══════════════════════════════

HEADLINES:
• Hendrik Veenstra (70) died waiting for cardiology.
  He waited 14 weeks. Treeknorm says max 12.
  
• Hospital queue reached 18 — a new record.
  Dr. van den Berg is working at 130% capacity.
  
• Good news: Maria de Graaf (45) recovered from
  moderate COPD after 6 weeks of treatment.

NUMBERS:
  Born:  0   Died:  1   Treated:  8
  In Queue: 18   Avg Wait: 9.2 weeks
  System Cost: €14,840

MOOD: 😟 Tense — the town is worried.
```

- **History**: stores all past gazette entries, scrollable
- **Click any name** → opens that agent's detail panel
- **Mood indicator**: aggregates agent emotional states into a town-wide sentiment

**Acceptance**: Anyone can read the Gazette and understand what happened without
knowing what IST/SOLL, Treeknorm, or FHIR means. It tells a HUMAN story.

#### 22.2 — Mayor's Commentary
- The Mayor character delivers periodic commentary:
  - "Citizens, I must address the growing wait times at our hospital..."
  - "I am pleased to announce: Dr. Bakker treated 12 patients this week."
  - "We lost Hendrik today. He waited too long. This system failed him."
- Appears as a special speech bubble on the map (larger, gold border)
- Also appears at the top of the Gazette
- In SOLL mode, the Mayor is optimistic: "The new AI system processed 30% more patients today!"

**Acceptance**: The Mayor is the human voice of the simulation. LinkedIn screenshots
of the Mayor's commentary are immediately quotable.

#### 22.3 — Trend Analysis (Week/Month/Year Summary)
- "📈 Trends" sub-tab in Gazette:
  - "This week vs last week: Deaths ↑2, Queue ↓3, Wait time →"
  - "This month: 4 preventable deaths, €47,000 in admin waste"
  - "This year: IST lost 22 citizens. SOLL projection: would have lost 6."
- Sparkline mini-charts inline with text
- Year-end "Annual Report" auto-generated at cycle 1000

**Acceptance**: Long-running simulations generate increasingly powerful data stories.

---

### Epic 23: Screenshot & Share Engine (The Viral Toolkit)

> People share images, not URLs. We need beautiful, branded, one-click shareable
> screenshots that tell a story.

#### 23.1 — Screenshot Button (📸)
- Top bar: "📸" button
- Captures current canvas + UI + a branded frame:
  ```
  ┌─────────────────────────────────────┐
  │  🏰 CAMMELOT                        │
  │  Healthcare Crisis Simulation       │
  │  ┌─────────────────────────────────┐ │
  │  │                                 │ │
  │  │   [Canvas snapshot here]        │ │
  │  │                                 │ │
  │  └─────────────────────────────────┘ │
  │  Day 47 | 4,977 alive | 23 deaths   │
  │  IST Mode | Avg Wait: 9.2 weeks     │
  │  cammelot.health                     │
  └─────────────────────────────────────┘
  ```
- Uses `canvas.toBlob()` → `navigator.clipboard.write()` (copies to clipboard)
- Fallback: download as PNG
- Watermark: `cammelot.health` in bottom-right

**Acceptance**: One click → branded screenshot on clipboard → paste into LinkedIn.

#### 23.2 — Moment Cards (Auto-Generated)
- When dramatic events happen, auto-generate a "Moment Card":
  - 💀 Death: "Hendrik Veenstra, 70, died after waiting 14 weeks for cardiology.
    His Digital Twin predicted this 8 weeks ago. The system knew. It couldn't act."
  - 🏥 Queue Record: "Hospital queue reached 22. Dr. van den Berg worked 47 hours
    this week. 8% of his colleagues are on sick leave."
  - 📊 Milestone: "Cycle 500 complete. IST lost 12 citizens. SOLL would have
    saved 9 of them. Cost of inaction: €52,605."
- Cards appear as toast notifications (bottom-right, 5s, dismissable)
- "📋 Copy" button on each card → copies formatted text to clipboard
- Card gallery: "🃏 Moments" tab shows all captured moments

**Acceptance**: The simulation generates LinkedIn-ready content without user effort.

#### 23.3 — Auto-Generated LinkedIn Drafts
- "📝 Generate Post" button in Stats or Gazette
- Creates a ready-to-paste LinkedIn post based on current sim data:

```
I built a simulation of the Dutch healthcare crisis.

5,000 AI citizens. Real CBS/RIVM data. Real consequences.

After 500 cycles, here's what I found:

📊 23 citizens died. 18 of them were over 65.
⏰ Average specialist wait: 11.2 weeks (norm: 4 weeks)
💰 Admin waste: €127,000 (30% of GP time on paperwork)
👻 3 deaths were 100% preventable with AI triage

The scariest part? This isn't fiction. These numbers
match the real Netherlands.

Toggle "SOLL mode" (AI-native future) and watch:
deaths drop by 60%, costs fall by €89,000.

Try it yourself: cammelot.health

#healthcare #AI #Netherlands #zorginfarct
```

- Three versions: "Data-heavy", "Story-driven", "Provocative"
- Copy to clipboard button

**Acceptance**: Someone can go from "run simulation" to "LinkedIn post" in 30 seconds.

#### 23.4 — Social Meta & OG Preview
- Dynamic OG image generation: render current sim state as og:image
- Meta tags update based on simulation state
- Twitter/X card support with live preview
- URL parameters for sharing specific states: `?mode=ist&cycle=500`

**Acceptance**: When someone shares the URL, the preview shows a living simulation snapshot.

---

### Epic 24: The Explanation Layer

> "What am I looking at?" — Every visitor's first question.
> We need to answer it without making them read a README.

#### 24.1 — Interactive "About This" Page
- Accessible from landing page + in-sim "?" button
- Single-page scroll explaining:
  1. **What**: "This is a simulation of the Dutch healthcare crisis"
  2. **Why**: "301,000 worker shortage by 2035. 30% admin waste. 12-week waits."
  3. **How**: "Real CBS/RIVM data. Markov disease models. AI agents."
  4. **Who**: "Built by Simone Cammel. Powered by Applied Research."
  5. **IST vs SOLL**: Visual comparison with before/after
  6. **Methodology**: Expandable sections for data sources
  7. **FAQ**: Common questions answered
- Styled to match SNES aesthetic (pixel borders, game-menu look)

**Acceptance**: A journalist, professor, or LinkedIn visitor can understand the project
in 60 seconds without touching the simulation.

#### 24.2 — In-Sim Glossary Tooltips
- Hover/tap any metric → tooltip explains it in plain language:
  - "C_eff 62%" → "Effective Capacity: Only 62% of GP time goes to patients. The rest? Paperwork."
  - "Treeknorm 12w" → "The legal maximum wait time. The Netherlands says 4 weeks. Reality? 12+."
  - "HP 45" → "Health Points. When this reaches 0, this citizen dies. Not from disease — from waiting."
- "🔍 Learn More" link in each tooltip → opens About page section

**Acceptance**: Zero jargon. Every number tells a story.

#### 24.3 — Guided Tours (Post-Onboarding)
- "📚 Tours" menu with themed walkthroughs:
  1. "The Patient Journey" — follow one citizen from healthy to treatment
  2. "The GP's Day" — show admin burden, queue management, burnout
  3. "The Queue Problem" — why wait times kill
  4. "IST vs SOLL" — toggle comparison walkthrough
- Each tour: 6-8 steps, spotlight UI, narrative text, "Next" button
- Auto-highlights relevant agents/buildings during tour

**Acceptance**: Teachers can use tours in classrooms. Conference presenters can demo.

---

### Epic 25: Deep Interactivity (What-If Scenarios)

> The simulation currently runs with fixed parameters.
> What if visitors could tweak things and see what happens?

#### 25.1 — Parameter Playground
- "⚙ What If?" panel with sliders:
  - Admin burden: 5% ←——→ 50%
  - Wait time limit: 2 weeks ←——→ 20 weeks
  - Staff shortage: 0% ←——→ 20%
  - AI efficiency: 1.0× ←——→ 2.0×
  - Population size: 1,000 ←——→ 10,000
- Changes apply immediately — watch the simulation react in real-time
- "Reset to IST" / "Reset to SOLL" quick buttons
- Presets: "Netherlands 2025", "Netherlands 2035", "AI-Native 2030"

**Acceptance**: A health minister can drag the admin slider and see people stop dying.

#### 25.2 — Scenario Bookmarks
- Save current parameter set as a named scenario
- "📎 Bookmarks" dropdown with saved configurations
- Share scenarios via URL: `?admin=0.3&wait=12&staff=0.08`
- Built-in bookmarks: "Crisis Peak", "Transformation Complete", "Staff Collapse"

**Acceptance**: Researchers can reproducibly test specific hypotheses.

#### 25.3 — A/B Split View
- Split screen: two simulations running side-by-side
- Same initial population, different parameters
- Synced clocks, delta indicators:
  - "Left: 23 deaths | Right: 6 deaths | Δ: 17 lives saved"
  - "Left: €127k waste | Right: €38k waste | Δ: €89k saved"
- Share as comparison screenshot

**Acceptance**: The difference between crisis and solution is viscerally, visually undeniable.

---

### Epic 26: The Content Machine

> Cammelot should generate content continuously, even when nobody's watching.

#### 26.1 — Insight Engine
- Background process that runs the simulation and detects "interesting" patterns:
  - First death of the year → "Breaking: First preventable death in Year 2"
  - All GPs at burnout → "All three GPs reached burnout simultaneously"
  - Age bias detected → "Citizens over 70 wait 3.2 weeks longer than average"
  - Queue record broken → "Hospital queue hit 25 — highest ever"
- Each insight: headline, 2-sentence explanation, relevant data point
- Stored in EVENT_LOG with type `insight`

**Acceptance**: The simulation writes its own headlines.

#### 26.2 — Weekly Report Generator
- Every 700 cycles (1 "week"), generate a comprehensive report:
  - Deaths (total, preventable, by age, by condition)
  - Queue statistics (peak, average, Treeknorm violations)
  - Financial summary (admin waste, treatment costs, savings potential)
  - Bias check (any systematic inequities detected?)
  - Best/worst: "Best moment: Maria recovered. Worst moment: Queue reached 22."
- Exportable as formatted text, JSON, or a styled HTML page

**Acceptance**: Run the simulation for an hour → get a full research report.

#### 26.3 — Embedded Widget Mode
- URL parameter `?embed=true` → minimal chrome, no sidebar, auto-play
- Perfect for:
  - Blog posts: embed as `<iframe>`
  - LinkedIn articles: screenshot + link
  - Conference slides: full-screen attract mode
  - Academic papers: embed interactive figure
- Responsive sizing: adapts to container width
- "🏰 Powered by Cammelot" watermark link

**Acceptance**: Anyone can embed a live Cammelot simulation in their website.

---

### Epic 27: Go-Live Checklist

> What needs to happen to put this on `cammelot.health` and make it real?

#### 27.1 — Domain & Hosting
- Register `cammelot.health` (or `.nl`, `.io`)
- Deploy to Vercel/Netlify (free tier, auto-deploy from GitHub)
- CloudFlare CDN for global performance
- SSL certificate (automatic with Vercel/Netlify)
- Custom 404 page

**Acceptance**: `https://cammelot.health` loads the landing page. Fast globally.

#### 27.2 — Analytics & Monitoring
- Privacy-respecting analytics: Plausible.io or Simple Analytics
- Track: page views, time on site, IST/SOLL toggles, cycle count, share button clicks
- No cookies, no tracking pixels, GDPR-compliant
- Uptime monitoring (UptimeRobot or similar)
- Error tracking: capture JS errors without sending user data

**Acceptance**: We know how many people visit and what they do, without violating privacy.

#### 27.3 — SEO & Discoverability
- Structured data (JSON-LD): WebApplication, ResearchProject
- Sitemap.xml with landing page, about page, simulation
- robots.txt allowing all crawlers
- Meta descriptions optimized for "healthcare simulation", "zorginfarct", "AI healthcare"
- Blog/changelog page for SEO content (optional)

**Acceptance**: "dutch healthcare crisis simulation" on Google → Cammelot is top 5.

#### 27.4 — Performance Audit
- Lighthouse score > 90 on all categories
- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Core Web Vitals: all green
- Bundle analysis: ensure no unnecessary assets

**Acceptance**: Google PageSpeed Insights gives a green score.

#### 27.5 — Legal & Compliance
- MIT License clearly stated
- Data sources cited (CBS, RIVM, NZa, IZA) with links
- Disclaimer: "This is a simulation, not medical advice"
- Privacy policy: "We collect no personal data"
- Cookie banner: not needed (no cookies used!)
- Accessibility: basic WCAG 2.1 AA (alt text, keyboard nav, contrast)

**Acceptance**: No legal liability. Accessible to screen readers.

---

### Epic 28: Advanced Agent Intelligence

> Make the simulation feel ALIVE, not algorithmic.

#### 28.1 — Agent Memory & Personality
- Each agent remembers their last 5 major experiences
- Personality traits affect behavior (stoic, anxious, social, stubborn)
- Anxious patients visit GP earlier, stubborn patients wait too long
- Social agents form friendships (chat more with specific people)
- Memory affects speech: "Last time I waited 8 weeks. I can't do this again."

**Acceptance**: No two agents behave the same. Each feels like a person.

#### 28.2 — Emergent Social Dynamics
- Agents share healthcare experiences: "I waited 12 weeks. Don't go to that specialist."
- Word-of-mouth affects behavior: nearby agents may avoid certain specialists
- Grieving: agents near a death site slow down, show heart particles
- Community events: multiple agents gather at park, discuss health system
- "Protest": if queue exceeds 20, agents gather outside hospital with "!" bubbles

**Acceptance**: Social behavior is emergent, not scripted. The town feels organic.

#### 28.3 — Provider Burnout Cascade
- GP burnout is visible: overworked GPs walk slower, have "😓" emoji
- When one GP burns out, patients overflow to remaining GPs → cascade
- Specialist burnout: longer treatment times, more errors
- System collapse visualization: everything turns grey, movement slows
- SOLL comparison: AI assistance prevents cascade

**Acceptance**: The "zorginfarct" is visible as a cascading failure, not just a number.

---

### Epic 29: Technical Excellence

#### 29.1 — State Machine Visualization
- Debug mode: show agent state machines overlaid on the map
- Color-coded states: healthy=green, queuing=yellow, critical=red
- Transition arrows between states
- Useful for presentations about how the simulation works

**Acceptance**: Developers and researchers can see the engine running.

#### 29.2 — Replay & Time Travel
- Record full simulation state every 10 cycles
- Rewind to any point and replay from there
- "What if we intervened at cycle 300?" — rewind, change parameters, replay
- Export replay as shareable file

**Acceptance**: Reproducible experiments. "Here's exactly when the system failed."

#### 29.3 — Multi-Instance Comparison
- Run 10 simulations in parallel (web workers)
- Show statistical distribution of outcomes:
  - "Across 10 runs, IST averaged 22.4 deaths (σ=3.1)"
  - "SOLL averaged 6.8 deaths (σ=1.9)"
- Monte Carlo analysis of parameter sensitivity
- Academic-grade statistical output

**Acceptance**: Results are statistically significant, not anecdotal.

#### 29.4 — API Mode (Headless)
- `?headless=true` → runs simulation without rendering
- Returns JSON results via postMessage
- Enables: batch processing, academic research, CI/CD testing
- Python wrapper: `cammelot.run(cycles=10000, mode='ist', seed=42)`

**Acceptance**: Researchers can run thousands of simulations programmatically.

---

## Phase 7 Sprint Schedule

### Sprint 19 — The Gazette & Storytelling (HIGHEST PRIORITY)
| # | Task | Epic | Priority |
|---|------|------|----------|
| 1 | Cammelot Gazette panel (24h summary) | 22.1 | 🔴 CRITICAL |
| 2 | Mayor's Commentary system | 22.2 | 🔴 CRITICAL |
| 3 | Trend Analysis (week/month) | 22.3 | 🟡 High |

### Sprint 20 — Screenshot & Share Engine
| # | Task | Epic | Priority |
|---|------|------|----------|
| 4 | Screenshot button (📸) | 23.1 | 🔴 CRITICAL |
| 5 | Moment Cards (auto-generated) | 23.2 | 🔴 CRITICAL |
| 6 | LinkedIn Post Generator | 23.3 | 🟡 High |
| 7 | Social Meta & OG Preview | 23.4 | 🟡 High |

### Sprint 21 — Explanation Layer
| # | Task | Epic | Priority |
|---|------|------|----------|
| 8 | Interactive About Page | 24.1 | 🔴 CRITICAL |
| 9 | In-Sim Glossary Tooltips | 24.2 | 🟡 High |
| 10 | Guided Tours | 24.3 | 🟡 High |

### Sprint 22 — Deep Interactivity
| # | Task | Epic | Priority |
|---|------|------|----------|
| 11 | Parameter Playground | 25.1 | 🟡 High |
| 12 | Scenario Bookmarks | 25.2 | 🟢 Medium |
| 13 | A/B Split View | 25.3 | 🟢 Medium |

### Sprint 23 — Content Machine & Intelligence
| # | Task | Epic | Priority |
|---|------|------|----------|
| 14 | Insight Engine | 26.1 | 🟡 High |
| 15 | Weekly Report Generator | 26.2 | 🟡 High |
| 16 | Embedded Widget Mode | 26.3 | 🟡 High |
| 17 | Agent Memory & Personality | 28.1 | 🟡 High |
| 18 | Emergent Social Dynamics | 28.2 | 🟡 High |
| 19 | Provider Burnout Cascade | 28.3 | 🟡 High |

### Sprint 24 — Go Live & Technical
| # | Task | Epic | Priority |
|---|------|------|----------|
| 20 | Domain & Hosting (Vercel) | 27.1 | 🔴 CRITICAL |
| 21 | Analytics (Plausible) | 27.2 | 🟡 High |
| 22 | SEO & Structured Data | 27.3 | 🟡 High |
| 23 | Performance Audit | 27.4 | 🟡 High |
| 24 | Legal & Compliance | 27.5 | 🟡 High |
| 25 | Replay & Time Travel | 29.2 | 🟢 Medium |
| 26 | Multi-Instance Comparison | 29.3 | 🟢 Medium |
| 27 | API Mode (Headless) | 29.4 | 🟢 Medium |

---

## The Viral Strategy (LinkedIn Playbook)

### Phase 1: "I Built This" (Launch Post)
> Post the landing page screenshot + 3 key numbers.
> Hook: "I built a simulation of the Dutch healthcare crisis. 5,000 AI citizens.
> Real data. Here's what happened in the first 500 cycles."
> CTA: Link to cammelot.health

### Phase 2: "The Data Says" (Weekly Research Posts)
> Use the Insight Engine + Weekly Report to generate data-driven posts.
> Each post: one finding, one screenshot, one call to action.
> Examples:
> - "My simulation's AI agents developed age bias. Nobody programmed it."
> - "I let 5,000 citizens live for 10 years. The admin paradox killed more than disease."
> - "One slider change: admin from 30% to 5%. Result: 17 fewer deaths per year."

### Phase 3: "Try It Yourself" (Engagement Posts)
> Embed the simulation or share interactive scenarios.
> Let people tweak parameters and share their results.
> "I set admin burden to 50%. Within 200 cycles, every GP was burned out."

### Phase 4: "The Research" (Authority Posts)
> Publish the methodology, bias tracking results, ROI analysis.
> Position as Applied Research, not just a toy.
> Target: healthcare professionals, policy makers, tech leaders.

---

## README Pages Summary

### For Developers (README.md — Project Root) ✅ DONE
- Architecture, setup, contributing, technical decisions

### For Users (About Page — Frontend) 🔜 Sprint 21
- What is this, why it matters, how to use it, methodology

### For Social (OG Meta + Share Cards) 🔜 Sprint 20
- Branded screenshots, auto-generated posts, social previews

#### 18.2 — Improved Typography & Hierarchy
- Portrait + name: larger, more prominent, with subtle text shadow
- Section headers: small decorative line underneath (like ──── )
- Condition tags: pill-shaped with subtle gradient backgrounds
- Numbers in monospace, labels in sans-serif (already mostly done, refine)
- Consistent spacing rhythm: 8px grid alignment
- Subtle separator lines between sections (not harsh borders)

**Acceptance**: The panel looks like a designed product, not a debug view.

#### 18.3 — Dark Mode / Theme Toggle
- Default: Current warm parchment theme
- Dark mode: deep navy (#0d1117) panel background, light text, blue accents
- Toggle: small 🌙/☀ icon in top bar
- Preference saved to localStorage
- Canvas game area stays the same (the map doesn't change)

**Acceptance**: Late-night viewers get a comfortable dark mode.

#### 18.4 — Sound Design (Optional Toggle)
- Ambient: soft medieval/pastoral background loop (very quiet)
- UI sounds: subtle click for button press, page turn for panel switch
- Events: gentle chime for recovery, somber tone for death, crowd murmur for busy queues
- Volume slider + mute button in settings
- All sounds via Web Audio API (no external files — generate procedurally or use tiny base64 samples)
- Default: OFF (don't annoy visitors)

**Acceptance**: Turning sound on makes the simulation feel immersive. Turning it off feels normal.

---

### Epic 19: Data Visualization Polish

#### 19.1 — Animated Charts
- HP Sparkline: smooth line drawing animation on panel open
- Queue bar chart: animated bars growing/shrinking per tick
- Death counter: odometer-style number roll animation
- Wait time gauge: circular progress indicator with gradient (green→red)
- Population pie chart: alive vs dead vs in-treatment, animated segments

**Acceptance**: Every chart feels alive, not static.

#### 19.2 — Heatmap Overlay
- Toggle button: "🗺 Heatmap" shows overlay on map
- Color intensity = density of events in that area
- Red hotspots near hospital/GP when queues are long
- Death markers create persistent red zones
- Recovery zones glow green
- Opacity: 30-40% so map is still visible underneath

**Acceptance**: One glance at the heatmap tells the whole story of where the system is failing.

#### 19.3 — Timeline Scrubber
- Horizontal timeline bar at bottom: shows cycle range (0 → current)
- Key events marked as dots on timeline (red = death, green = recovery, blue = admission)
- Click/drag to "rewind" — shows stats at that point in time (from saved snapshots)
- Snap to significant moments: "3 deaths occurred here", "Treeknorm violated"
- Only stores snapshots every 50 cycles to save memory

**Acceptance**: A researcher can scrub through the simulation history and pinpoint when things went wrong.

#### 19.4 — Connection Lines (Relationship Visualization)
- When viewing an agent, draw faint lines to their GP, hospital, and recent chat partners
- Line color: green (GP), red (hospital), blue (social)
- Line style: dashed for "referred to", solid for "currently at"
- Pulse animation on active referral lines
- Shows the invisible network of care relationships

**Acceptance**: Click a citizen and see their care network visualized on the map.

---

### Epic 20: Loading & First Impression

#### 20.1 — Animated Loading Screen
- While map image loads: show Cammelot crest/logo with loading bar
- Pixel-art animation: tiny character walking across loading bar
- Loading text: "Spawning citizens...", "Building the healthcare system...", "Calibrating crisis..."
- Smooth transition: loading screen fades out, game fades in
- Total load should feel intentional, not broken (even if fast)

**Acceptance**: First 2 seconds feel polished, not like a broken page.

#### 20.2 — Intro Camera Pan
- After loading, camera starts zoomed in on the town center
- Slow cinematic pan showing the hospital, GP, citizens walking
- Text overlay: "Cammelot. Population: 45. A town like any other..."
- After 5 seconds, zoom out to full view and start simulation
- Skip button for returning visitors

**Acceptance**: First-time visitors feel like they're entering a world, not opening a tool.

#### 20.3 — Idle Animations & Attract Mode
- If no interaction for 60 seconds: camera slowly pans around town
- Occasional zoom-in on interesting events (death, admission, long queue)
- Ticker continues running with dramatic events
- Any click/touch exits attract mode

**Acceptance**: Left running on a screen at a conference, it looks compelling.

---

### Epic 21: Performance & Technical Polish

#### 21.1 — Canvas Rendering Optimization
- Double-buffering: render to offscreen canvas, blit to visible
- Only redraw dirty regions (track which agents moved)
- Layer separation: static map layer (rarely redrawn) + dynamic agent layer
- RequestAnimationFrame throttle to 30fps when tab is background
- WebGL fallback for devices that support it (optional, big lift)

**Acceptance**: 60fps with 60 agents on a 2020 MacBook Air.

#### 21.2 — Progressive Asset Loading
- Inline critical CSS (first paint in <100ms)
- Map image: show blurred placeholder, sharp version loads async
- Font loading: system font fallback → custom font swap (no FOIT)
- Lazy-generate portraits (only when panel opens, not all on init)

**Acceptance**: Lighthouse Performance score >90.

#### 21.3 — IndexedDB Migration
- Move from localStorage (5MB limit) to IndexedDB for saves
- Support multiple save slots ("Save 1", "Save 2", "Save 3")
- Auto-save indicator: small 💾 icon that pulses during save
- Save metadata: date, cycle count, alive/dead count, thumbnail

**Acceptance**: Save system feels like a real game. Multiple runs can be compared.

#### 21.4 — PWA (Progressive Web App)
- Service worker for offline capability
- manifest.json with app metadata
- "Add to Home Screen" support on mobile
- Offline mode: simulation runs without network
- App icon: Cammelot crest

**Acceptance**: Install on phone, works offline, feels like a native app.

---

## Sprint Schedule — Phase 6

### Sprint 13 — Environment & Atmosphere
| # | Task | Epic | Priority |
|---|------|------|----------|
| 33 | Day/Night Cycle | 16.1 | 🔴 Critical |
| 34 | Weather System | 16.2 | 🟡 High |
| 35 | Seasonal Foliage | 16.3 | 🟢 Medium |
| 36 | Ambient Particles | 16.4 | 🟢 Medium |

### Sprint 14 — Character Polish
| # | Task | Epic | Priority |
|---|------|------|----------|
| 37 | Smooth Movement | 17.1 | 🔴 Critical |
| 38 | Enhanced Sprite Animations | 17.2 | 🟡 High |
| 39 | Shadow & Lighting | 17.3 | 🟡 High |
| 40 | Status Visual Effects | 17.4 | 🟡 High |

### Sprint 15 — UI Polish
| # | Task | Epic | Priority |
|---|------|------|----------|
| 41 | Panel Micro-animations | 18.1 | 🔴 Critical |
| 42 | Typography & Hierarchy | 18.2 | 🟡 High |
| 43 | Dark Mode | 18.3 | 🟢 Medium |
| 44 | Sound Design | 18.4 | 🟢 Medium |

### Sprint 16 — Data Viz & Charts
| # | Task | Epic | Priority |
|---|------|------|----------|
| 45 | Animated Charts | 19.1 | 🟡 High |
| 46 | Heatmap Overlay | 19.2 | 🟡 High |
| 47 | Timeline Scrubber | 19.3 | 🟢 Medium |
| 48 | Connection Lines | 19.4 | 🟢 Medium |

### Sprint 17 — First Impression
| # | Task | Epic | Priority |
|---|------|------|----------|
| 49 | Animated Loading Screen | 20.1 | 🔴 Critical |
| 50 | Intro Camera Pan | 20.2 | 🟡 High |
| 51 | Idle / Attract Mode | 20.3 | 🟢 Medium |

### Sprint 18 — Technical Polish
| # | Task | Epic | Priority |
|---|------|------|----------|
| 52 | Canvas Optimization | 21.1 | 🔴 Critical |
| 53 | Progressive Asset Loading | 21.2 | 🟡 High |
| 54 | IndexedDB Migration | 21.3 | 🟢 Medium |
| 55 | PWA Support | 21.4 | 🟢 Medium |

---

## Delivered Sprints (1–12) ✅

| Sprint | Theme | Commit | Lines Added |
|--------|-------|--------|-------------|
| 1 | Disease Catalog, Population, Engine | `bb904c4` | +320 |
| 2 | Buildings, Doctors, Simulation Balance | `c87a0a8` | +265 |
| 3 | Event Log, History, Stats, Persistence | `be904de` | +459 |
| 4 | Vivid Characters (bios, portraits, chat, emotions) | `0aba735` | +467 |
| 5-6 | Visible Queues + Onboarding | `f2d02b8` | +544 |
| 7-8 | Panel Redesign + Mobile & Social | `5ee6d0b` | +230 |
| 9-10 | Security Gate + Docker + FHIR + Cognitive | `84c0dec` | +278 |
| 11-12 | Rigor, Research, ROI, Export + Logo Fix | `4c33f76` | +304 |
| **Total** | **55 features across 12 sprints** | **10 commits** | **~4300 lines** |

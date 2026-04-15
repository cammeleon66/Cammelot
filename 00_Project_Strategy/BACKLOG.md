# Cammelot Backlog

**Last updated:** 2026-04-15
**Progress:** 22/42 items done (52%) | P0: 9/9 | P1: 13/16 | P2: 0/13 | P3: 0/4

---


## 🔴 P0 — Fix Now

### Bug Fixes

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| fix-world-play | Fix "Play Simulation" button in world.html | S | Clicking Play Simulation does nothing. Debug the play button handler (~line 9485) and fix whatever is preventing the simulation from starting. |
| fix-world-map | Fix map not loading in world.html | M | The tile map is not loading/rendering in the simulation page. Debug canvas initialization and tile loading. |
| fix-mobile-darkmode | Fix mobile dark mode + hamburger menu | S | Dark mode toggle and hamburger menu not working on mobile. Check event listeners and CSS for mobile breakpoints. |
| fix-whitespace | Fix white space issues in blog chapters | S | Ch0-Ch3 pages have weird large white gaps. Compare against the old monolithic page styling. Likely missing CSS or extra margin/padding from the split. |

### Content — Quick Text Wins

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| text-skeptics-corner | Add Skeptic's Corner Q&A to homepage | S | "Is this a video game?" → "Runs on FHIR R4 + RIVM CDM. Not a game—a stress test for a 300k-worker shortage." · "Does AI help?" → "Detection without Capacity is useless. Admin relief giving GPs back 25% was the biggest mortality drop." |
| text-variables-vibes | Strengthen "Variables over Vibes" framing | S | Central thesis: transition from vibes-based policy to variable-based modeling. The 16-bit aesthetic "abstracts emotional weight into observable variables." Weave through site. |
| text-admin-roi | Admin ROI narrative with NZa €€€ | S | Automating a 20-min consult (Code 12001) saves €24.85 in redeployable labor. "Opportunity Cost of Paperwork" as primary KPI. Use the 3-tier scenario table (IST 30% / IZA 25% / SOLL 10%). |
| text-efficiency-trap | Efficiency Trap finding + fairness guardrails | S | 200-run finding: throughput optimization deprioritizes complex elderly. Fix: Fairness Score in Agent Cards + Priority Multiplier. "Prevents AI from creating Digital Selection that excludes those who need care most." |
| text-impact-counter | Rebrand Ghost Count → Impact Counter | S | Ghost Count → "Impact Counter" showing "Human Cost of Inaction." Aligns with Agema's crisis framing. Toggle between technical metrics and human narrative. |

---

## 🟠 P1 — Next Sprint

### Content

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| screenshots | Capture 14 screenshots for site | M | See `site/SCREENSHOTS_NEEDED.md`. Manual capture of hero, chapter headers, simulation views, mobile views. Required for visual richness. |
| text-data-tables | Embed research data tables in chapters | M | Add T2D prevalence table (ch2), NZa GP tariffs (ch1/ch2), MSZ specialist costs (ch2), admin scenarios (ch3). With source citations. |
| text-citations | Add 43 source citations from the doc | M | RIVM, NZa, CBS, Nictiz, PMC, ESC, WHO, etc. Add as footnotes to relevant chapters. Massive credibility boost. |
| text-wegiz-context | Add Wegiz mandate to tech chapters | S | Cammelot is "Wegiz-Ready": all interactions use HL7 FHIR R4 aligned with Nictiz nl-core. Wegiz mandates electronic data exchange for all Dutch providers. |
| text-preventive-econ | Preventive agent economics narrative | S | One prevented COPD hospitalization = €44,439.93 saved. "AI is an economic necessity for the Dutch treasury, not a luxury." |
| series3-posts | Write Series 3 blog posts (Policy) | L | Policy-focused series: admin burden analysis, IZA targets, Treeknorm violations, policymaker recommendations. |

### Data Layer

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| data-nza-gp-2025 | NZa 2025 GP tariff tiers | S | Registration: <65=€20.35, 65-75=€23.95, 75-85=€36.06, 85+=€56.70. Consult=€12.43, Extended=€24.85. MTVP=€3.23/patient/quarter. |
| data-admin-scenarios | Admin burden 3-tier scenario table | S | IST=30% admin / 120 consults / baseline mortality. IZA=25% / 135 / -3.5%. SOLL=10% / 180 / -12%. |
| data-t2d-prevalence | Age-stratified T2D prevalence (RIVM) | M | M30-39=1%, M40-49=3.5%, M50-59=7%, M60-70=14%, M70-79=18%. Women slightly lower. Age-decile lookup. |
| data-hypertension | Hypertension prevalence by age/gender | M | M30-39=17%/W8%, M40-49=27%/14%, M50-59=58%/32%, M60-70=62%/67%, M70-79=71%/69%. Gender crossover at 60+. |
| data-copd-cv-rr | COPD→CVD comorbidity multiplier (RR=2.5) | M | 90.3% of COPD patients high/very-high CV risk. Relative Risk 2.5x for cardiovascular events. |

### Simulation Logic

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| sim-comorbidity-markov | Comorbidity-aware Markov transitions | M | baseIncidence = getRIVMIncidence(age, gender). If COPD or Diabetes → ×2.5 CV risk. Agent-specific, not global random. |
| sim-fairness-guardrails | Fairness guardrails for elderly | M | If elderly waiting >50% Treeknorm → Priority Multiplier. Prevents digital ageism in throughput optimization. |

### UI/UX

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| ui-impact-counter | Impact Counter widget (IST vs SOLL) | S | Replace Ghost Count with Impact Counter + "Human Cost of Inaction" toggle. 16-bit aesthetic. |
| ui-life-stream | Life Stream: scrolling A2A event log | M | 16-bit terminal-style scrolling log: "GP_Agent_01 accepted referral for Citizen_45. State → COPD_Stage_2." |
| ui-sprite-emotion | Dynamic sprite states per Markov health | M | Healthy→Severe: vibrant→translucent/slower. Instant Vitality Index. Extend existing ghost sprites to intermediate states. |

---

## 🟡 P2 — Later

### Architecture

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| arch-a2a-jsonrpc | A2A Agent Cards → JSON-RPC 2.0 | L | Capabilities array, OAuth2 auth, capacity-based task bidding. Patient publishes Task → GPs bid on NZa budget + busy state. |
| arch-a2a-discovery | Dynamic A2A agent discovery service | L | Runtime Discovery Agent with live Agent Cards. Filter by capabilities + currentLoad < 1.0 (NAC norm). |
| arch-fhir-bundle | Refactor patient → FHIR Bundle | L | Patient = Bundle(Patient + Condition + Observation with LOINC). Agents carry parseable history. |
| arch-mcp-tools | MCP tool mapping (Disease Engine + FHIR) | L | Disease Engine as MCP tool (forecast_transition). Pull only relevant FHIR resources into context. |

### Data Layer

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| data-rivm-cdm | RIVM Chronic Disease Model equations | L | CDM formula: transition = baseIncidence(age,gender) × RR(comorbidities). Scientifically grounded ghost count. |
| data-nza-msz | NZa 2025 specialist (MSZ) DBC tariffs | M | Pulmonology extensive >6d=€44,439.93, COPD outpatient=€261.35, home ventilation=€12,451.95. |
| data-nac-capacity | NZa NAC capacity norm (1fte=36hrs) | M | Hard limit: 36hrs/week at €202,476/year. Budget consumed → capacity throttles. |

### Simulation

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| scale-500 | Scale population to 500 agents | L | From ~45 to 500 for statistical validity. Requires perf optimization. |
| sim-mtvp-throttle | MTVP budget throttling per quarter | M | GP exhausts €3.23×patients/quarter → complex consult capacity throttles. |
| sim-preventive-roi | Preventive agent ROI tracking | M | Digital Twin prevents hospitalization → track avoided €44,439 + total € savings as KPI. |

### UI/UX

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| ui-capacity-heatmap | GP capacity heatmap on tile map | M | GP practices: green→flashing red as NZa capacity exceeded. |
| ui-dashboard | Interactive Impact Counter dashboard | L | Ghosts IST vs SOLL, admin ROI, prevented hospitalizations, capacity utilization. |

### Infrastructure

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| replay-deploy | Deploy replay system to static site | M | Make replay/scenario system available on deployed site. |

---

## ⚪ P3 — Future

| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| arch-nictiz-nlcore | Nictiz nl-core FHIR profiles | XL | Full Wegiz compliance: open-world modeling, ZIB mappings, avoid mustSupport. |
| arch-gf-localization | Decentralized GF-Localization | XL | VWS standard: DocumentReference localization, pseudoBSN queries, Mitz consent. GDPR-compliant AI. |
| ui-fhir-dev-tab | FHIR Developer Tab (raw JSON viewer) | L | Hidden dev tab showing raw JSON-RPC + FHIR resources. "Variables over Vibes" proof. |
| series4-posts | Write Series 4 blog posts (Future) | L | SOLL vision, agentic mesh roadmap, sector expansion (education, retail, research). |

---

## Effort Key

| Size | Meaning |
|------|---------|
| **S** | < half day |
| **M** | 1-2 days |
| **L** | 3-5 days |
| **XL** | 1+ week |

## Totals

| Priority | Count |
|----------|-------|
| 🔴 P0 | 9 |
| 🟠 P1 | 16 |
| 🟡 P2 | 13 |
| ⚪ P3 | 4 |
| **Total** | **42** |

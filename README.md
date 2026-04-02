# 🏰 Cammelot — Healthcare Crisis Simulation

> **Watch a Dutch town of 5,000 souls navigate a healthcare system that's breaking.**
> Real medical data. Real consequences. Real crisis.

[![CI](https://img.shields.io/badge/tests-115%20passing-brightgreen)](.) [![Docker](https://img.shields.io/badge/docker-ready-blue)](.) [![License](https://img.shields.io/badge/license-MIT-yellow)](.)

## What Is This?

Cammelot is an interactive, browser-based simulation of the **Dutch healthcare crisis**. Tiny pixel-art citizens live, get sick, queue for care, and sometimes die — not from disease alone, but from a system that can't keep up.

It's built as an **Applied Research tool** for:
- 🎓 **Education**: Show anyone what "zorginfarct" (care infarction) actually looks like
- 📊 **Research**: Quantify the impact of admin burden, wait times, and staff shortages
- 💡 **Advocacy**: Demonstrate why AI-native healthcare transformation matters
- 🗣 **LinkedIn/Social**: Generate data-driven posts with real simulation evidence

**→ [Enter the Simulation](https://cammelot.health)** | **→ [Read the Methodology](#methodology)**

---

## The Crisis in Numbers

| What | Value | Source |
|------|-------|--------|
| GP time lost to admin | **30%** | NZa 2025 |
| Specialist wait times | **12+ weeks** (Ophthalmology) | Mediquest 2024 |
| Staff shortage by 2035 | **301,000 workers** | IZA/ABF Research |
| Citizens with chronic disease (75+) | **96%** | RIVM 2024 |
| MRI/CT exceeding 4-week norm | **28.9%** | NZa Treeknorm |
| Annual healthcare deaths (NL) | **172,000** | CBS 2024 |

Cammelot simulates **all of this** — every citizen has real conditions (ICD-10), real wait times, and real mortality risk based on CBS/RIVM data.

---

## How It Works

### IST Mode (Current Crisis)
The system as it exists today:
- GPs lose **30%** of their time to administrative tasks
- Specialist wait times exceed **12 weeks** (Treeknorm violation)
- **8%** of staff capacity lost to sick leave
- Effective clinical capacity: **62%**

### SOLL Mode (AI-Native Future)
What healthcare could look like with AI transformation:
- Admin burden drops to **<5%** (ambient AI scribes, auto-FHIR mapping)
- Wait times fall to **<4 weeks** (AI-driven triage + scheduling)
- Effective clinical capacity rises to **83%** (E_ai = 1.34×)

**Toggle between IST and SOLL** to see the difference in real-time. Watch mortality rates, queue lengths, and system costs change before your eyes.

### The HP Drain Formula
Citizens don't die randomly. Death is a **direct consequence of system delay**:

```
HP_drain = drainRate × (waitWeeks - Treeknorm) × severityMultiplier × (1 + adminBurden)
```

When HP reaches 0, the citizen becomes a ghost — a preventable death caused by the system, not by disease.

---

## Features

### 🧬 Clinical Simulation
- 10 ICD-10 conditions with Markov state transitions (I25, E11, J44, F03, M17, M81, I50, G30, C34, J18)
- Comorbidity interactions (diabetes + cardiovascular, COPD + heart failure)
- Condition-specific treatment effects and recovery rates
- CBS-distributed demographics (age, gender, chronic disease prevalence)

### 🏥 Healthcare System
- GP practices with admin burden, burnout tracking, patient queues
- Hospital with specialist capacity, Treeknorm compliance monitoring
- Referral pathways with A2A protocol messaging
- Physical queue visualization (agents line up outside buildings)

### 🧠 Agent Intelligence
- **Cognitive Loop**: Agents reflect on their health, plan actions, make decisions
- **Digital Twins**: Per-patient risk predictions driving care urgency
- **FHIR Memory Store**: Every medical event logged as FHIR-like resources
- **Social Interactions**: Citizens chat with contextual dialogue about the system

### 🎨 Visual Experience
- Day/night cycle with stars, moon, window glow
- Weather system (rain, snow, fog, storms)
- Seasonal foliage (spring flowers, autumn leaves, winter snow)
- Emotional sprites (happy bounce, worried slow, critical crawl, grieving hearts)
- Ghost trail with grave markers at death locations

### 📊 Research Tools
- **Bias Tracker**: Age, gender, condition, and GP assignment bias detection
- **ROI Dashboard**: Admin waste, preventable death costs, SOLL savings projections
- **QA Panel**: Automated simulation health checks (mortality bounds, condition spread)
- **Data Export**: JSON/CSV download of full simulation state for academic analysis
- **Timeline Scrubber**: Rewind through simulation history

### 📱 Deployment-Ready
- Mobile responsive (desktop, tablet, phone)
- Touch support (tap, pan, pinch-to-zoom)
- Docker + nginx with CSP security headers
- GitHub Actions CI/CD pipeline
- Social sharing meta tags (Open Graph, Twitter Card)

---

## Quick Start

### Run Locally (No Install)
```bash
cd Cammelot
python -m http.server 4200
# Open http://localhost:4200/src/frontend/index.html
```

### Run with Docker
```bash
docker build -t cammelot .
docker run -p 80:80 cammelot
# Open http://localhost
```

### Run Tests
```bash
node --test  # 115 tests, ~300ms
```

---

## Architecture

```
Zero backend. Zero framework. Zero npm dependencies.
One HTML file. One map image. Infinite healthcare crisis.
```

Cammelot is a **single-page application** (`v4.html`, ~4600 lines) that runs entirely in the browser. No server needed. No API calls. Everything — the disease engine, cognitive agents, FHIR store, A2A protocol — runs in one inline JavaScript file.

**Why?** Because:
- Free hosting (static files on any CDN)
- Instant load (no bundle, no compile)
- Offline-capable (works without network)
- Shareable (one URL, works everywhere)

### Key Architecture Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runtime | Frontend-only (v4.html) | Zero backend = free hosting |
| Memory | EVENT_LOG + FHIR store | Simple + semantically structured |
| Persistence | localStorage | No server, instant save/load |
| Hosting | Docker + nginx | Static files, CDN-friendly |
| Security | CSP + no inline handlers | OWASP-compliant for public site |
| Agent count | 45-60 active | Performance vs. meaningful data |

---

## Methodology

### Data Sources
All simulation parameters are derived from official Dutch healthcare data:

- **CBS (Centraal Bureau voor de Statistiek)**: Demographics, mortality rates, life expectancy
- **RIVM (Rijksinstituut voor Volksgezondheid en Milieu)**: Disease prevalence, chronic conditions
- **NZa (Nederlandse Zorgautoriteit)**: Consultation rates (€12.43/consult), Treeknorm standards
- **IZA (Integraal Zorgakkoord)**: Transformation targets, staff shortage projections
- **Mediquest**: Specialist wait time data by specialty

### Clinical Model
- Each condition uses a **Markov state transition model**: healthy → mild → moderate → severe → critical → deceased
- Transition probabilities are adjusted by wait time (longer wait = faster progression)
- Comorbidity multipliers increase HP drain when conditions interact
- Treatment effects downgrade severity states with condition-specific rates

### Mortality Model
Two types of death:
1. **Natural mortality**: Age-based background rate matching CBS 2024 data (48/5000/year)
2. **System failure**: HP drain from untreated conditions + system delay. This is the "preventable death" the simulation makes visible.

### Bias & Fairness
The simulation tracks systematic inequities across 4 dimensions:
- **Age**: Do elderly patients get systematically delayed?
- **Gender**: Any difference in treatment speed?
- **Condition**: Are certain ICD-10 codes undertreated?
- **GP Assignment**: Does GP proximity affect outcomes?

---

## Applied Research Scenarios

### 1. The Admin Paradox
> "If we automate 90% of admin with AI scribes, does consultation quality improve? Or do hospitals simply increase volume to bill more NZa tariffs?"

### 2. Digital Twin Triage
> "Can a Digital Twin predicting 32% heart failure risk reduce ER pressure by 30%+ through proactive primary care?"

### 3. Bias Detection
> "I let 5,000 AI agents live together for 10 years. Here's why their implicit bias increased by 40%."

### 4. ROI of Administrative Friction
> "In Cammelot, mortality risk increased by 12% purely from GP administrative interruptions. Cost: €X per preventable death."

---

## For LinkedIn / Social Media

Cammelot is designed to generate shareable, data-driven insights:

1. **Run a simulation** for 500+ cycles
2. **Open Stats Dashboard** (📊) to see outcomes
3. **Compare IST vs SOLL** to quantify the AI transformation impact
4. **Export data** (JSON/CSV) for detailed analysis
5. **Screenshot key moments**: deaths, queue congestion, bias reports

Example posts:
- *"In my simulation, 3 citizens died preventable deaths in 200 cycles. All were 65+. All waited 12+ weeks. The system isn't failing randomly — it's failing the elderly."*
- *"Switching from IST to SOLL saved €34,000 in admin waste and prevented 2 deaths in 500 cycles. That's what AI-native healthcare looks like."*

---

## Project Structure

```
Cammelot/
├── README.md                  ← You are here
├── CLAUDE.md                  ← Master project context
├── BACKLOG.md                 ← Engineering backlog (Phases 1-6)
├── Dockerfile                 ← nginx static file serving
├── docker-compose.yml         ← Local dev setup
├── nginx.conf                 ← CSP headers, security
├── package.json               ← Test runner config
├── .github/workflows/ci.yml   ← CI/CD pipeline
├── src/
│   ├── frontend/
│   │   ├── v4.html            ← THE app (~4600 lines, everything inline)
│   │   └── index.html         ← Landing page
│   ├── agents/                ← Backend reference implementations
│   ├── clinical_logic/        ← Disease engine, Markov models
│   ├── communication/         ← A2A protocol definitions
│   ├── data_layer/            ← FHIR store reference
│   └── orchestrator/          ← Simulation loop reference
├── assets/                    ← Map image, sprites
├── docs/
│   ├── CODEBASE_MAP.md        ← Code location guide
│   └── ADR.md                 ← Architecture Decision Records
├── tests/                     ← 115 tests (Node.js built-in runner)
└── .camelot/                  ← Fleet agent configs
```

---

## Credits & License

Built by **Simone Cammel** with AI assistance.

Data: CBS, RIVM, NZa, IZA (Netherlands, 2024-2025)
Aesthetic: Inspired by Park et al. "Generative Agents" / AI Town
Engine: Vanilla JavaScript, HTML5 Canvas, zero dependencies

MIT License

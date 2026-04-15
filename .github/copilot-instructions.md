# Copilot Instructions — Cammelot

## Project Overview

Cammelot is a browser-based healthcare simulation of a Dutch town (45 citizens, 3 GPs, 1 hospital). It models the Dutch "zorginfarct" (care crisis) using real CBS/RIVM/NZa data. The simulation runs in two modes: **IST** (current broken system) and **SOLL** (AI-augmented target). The public website is at [cammelot.org](https://cammelot.org).

## Build & Test

```bash
# Run all tests (Node.js built-in test runner, no dependencies needed)
npm test

# Run a single test file
node --test tests/disease_engine.test.js

# Start the backend orchestrator (not connected to frontend)
npm start
```

There are no build steps, linters, or bundlers. The site is static HTML served from `/site`.

## Architecture

### Two Disconnected Systems

The **frontend** (`site/world.html`, ~10,700 lines, ~510KB) is a self-contained simulation engine — it has its own disease engine, Markov chains, HP drain, population spawner, and rendering loop. It does NOT call the backend.

The **backend** (`src/`) is a Node.js ES module system with FHIR store, A2A protocol, cognitive loop, and disease engine. It shares the same *design* as the frontend but they are **architecturally disconnected** (see `docs/ADR.md`).

All site pages (`site/index.html`, `site/ch0-ch3.html`, `site/world.html`) have **inline CSS and JS** — no external stylesheets or bundled scripts.

### world.html Internal Structure

This is the core product — a single HTML file containing the entire simulation:

| Line Range | Component |
|------------|-----------|
| ~920–960 | Canvas setup, map image loading |
| ~1100–3200 | Disease DB, population spawner, agent definitions |
| ~3200–3400 | Disease progression (Markov), HP drain, Treeknorm |
| ~4020–4200 | `drawAgent()` — sprite rendering with emotion states |
| ~4738–4900 | `render()` — main canvas render loop |
| ~6175–7250 | `tick()` — simulation step (disease, queues, referrals, mortality) |
| ~8030–8050 | `sayA2A()` — A2A protocol chat messages |
| ~9207 | `loop()` — requestAnimationFrame render loop |
| ~9217 | `startNewGame()` — initialization entry point |
| ~9543–9558 | Auto-start (non-embed) or embed mode init |
| ~10460–10700 | Guided tour system |

### Key Simulation Parameters

- Tick interval: 500ms (website), 200ms (embed)
- HP drain: `drainRate × (waitWeeks - Treeknorm) × severityMultiplier × (1 + adminBurden)`
- Admin burden: IST=30%, SOLL=5%
- Treeknorm threshold: 12 weeks
- Ghost (death) at HP ≤ 0
- Comorbidity multipliers: COPD→CVD (RR=2.5), T2D→CVD (RR=2.0), HTN→CVD (RR=1.8)

## Critical Conventions

### Unicode in site/*.html — Use Python Scripts for Edits

The site HTML files contain raw Unicode (em-dashes, arrows, euro signs, smart quotes). The `edit` tool's pattern matching fails silently on these characters. **Always use Python scripts** with UTF-8 encoding for file modifications:

```python
with open('site/world.html', 'r', encoding='utf-8') as f:
    content = f.read()
# ... modify content ...
with open('site/world.html', 'w', encoding='utf-8') as f:
    f.write(content)
```

### Dual Remote Workflow

- `origin` = `msft-common-demos/Cammelot` (internal Microsoft)
- `personal` = `cammeleon66/Cammelot` (public GitHub Pages)
- Branch: `feature/agentic-overhaul`
- GitHub Pages deploys from `master` on `personal` — **merge to master and push** to deploy
- Personal remote needs `--force-with-lease` for pushes

### Visual Identity

Strict **16-bit SNES RPG aesthetic**. No corporate dashboards, flat grey UIs, or modern chart-heavy layouts. Use saturated pixel-art colors, speech bubbles, retro-game menus. Font: "Press Start 2P" for pixel elements, "Space Grotesk" for modern UI text.

### Data Sources

All simulation parameters must trace to real Dutch data:
- **CBS** — demographics, mortality rates, life expectancy
- **RIVM** — chronic disease prevalence, comorbidity
- **NZa** — GP tariffs, Treeknorm waiting norms
- **IZA** — transformation budget, staffing projections

Config files in `config/` store reference data (NZa tariffs, admin scenarios, prevalence tables).

### Content Tone

The website uses an **academic, grounded research tone** — not marketing language. The author (Simone Cammel) works at Microsoft and explicitly acknowledges potential bias. All claims must reference the 200 simulation runs and specific data sources.

## File Roles

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Master context document — read first for all architecture/data decisions |
| `docs/CODEBASE_MAP.md` | Detailed file inventory and architectural analysis |
| `docs/AGENT_SPEC.md` | Agent type definitions and behaviors |
| `00_Project_Strategy/BACKLOG.md` | Prioritized backlog (P0–P3) |
| `config/` | Epidemiological and economic data configs |
| `scripts/output/` | Simulation run results (100-run batches, scenarios) |

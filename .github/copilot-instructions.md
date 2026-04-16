# Copilot Instructions — Cammelot

## Project Overview

Cammelot is a browser-based healthcare simulation of a Dutch town (45 citizens, 3 GPs, 1 hospital). It models the Dutch "care gridlock" using real CBS/RIVM/NZa data. The simulation runs in two modes: **IST** (current broken system) and **SOLL** (AI-augmented target). The public website is at [cammelot.org](https://cammelot.org).

## Build & Test

```bash
# Run all tests (Node.js built-in test runner, zero npm dependencies)
npm test

# Run a single test file
node --test tests/disease_engine.test.js

# Start the backend orchestrator (not connected to frontend)
npm start
```

No build steps, linters, or bundlers exist. The site is static HTML served from `site/`. The project uses `"type": "module"` (ES modules) — any ad-hoc scripts that use `require()` must use the `.cjs` extension.

## Architecture

### Two Disconnected Systems

The **frontend** (`site/world.html`, ~10,700 lines, ~510KB) is a fully self-contained simulation engine with its own disease engine, Markov chains, HP drain, population spawner, and rendering loop. It does **not** call the backend.

The **backend** (`src/`) is a Node.js ES module system with FHIR store, A2A protocol, cognitive loop, and disease engine. It shares the same *design* as the frontend but they are **architecturally disconnected** (see `docs/ADR.md`).

All site pages (`site/index.html`, `site/ch0-ch3.html`, `site/world.html`) have **inline CSS and JS** — no external stylesheets or bundled scripts.

### world.html Simulation Loop

`world.html` is the core product. Key runtime flow:

1. **`startNewGame()`** — initializes population, sprites, waypoints, behaviors (each step in its own try/catch)
2. **Walkthrough** — 6-step guided tour with element highlighting; dismisses into `launchSimulation()`
3. **`launchSimulation()`** — idempotent entry point; pre-ticks 10 cycles for initial Town Feed content, starts `autoTimer`
4. **`loop()`** → `requestAnimationFrame` → **`render()`** — canvas drawing, agent movement interpolation (frame-rate independent `dt`)
5. **`tick()`** — game logic every 500ms: disease progression, HP drain, queue management, referrals, mortality

**Critical**: Agent movement happens in `render()`, not `tick()`. If `render()` throws, agents freeze but tick logic keeps running — this looks like "nobody is walking" but the simulation is actually advancing.

### Key Simulation Parameters

- Tick interval: 500ms (website), 200ms (embed)
- HP drain: `drainRate × (waitWeeks - Treeknorm) × severityMultiplier × (1 + adminBurden)`
- Admin burden: IST=30%, SOLL=5%
- Treeknorm threshold: 12 weeks
- Ghost (death) at HP ≤ 0
- Death types: `died` = system-failure (preventable, 💀), `natural_death` = old age (CBS life tables, 🕊)
- Comorbidity multipliers: COPD→CVD (RR=2.5), T2D→CVD (RR=2.0), HTN→CVD (RR=1.8)

## Critical Conventions

### Unicode in site/*.html — Use Python Scripts for Edits

The site HTML files contain raw Unicode (em-dashes, arrows, euro signs, smart quotes). The `edit` tool's pattern matching **fails silently** on these characters. **Always use Python scripts** with UTF-8 encoding for file modifications:

```python
with open('site/world.html', 'r', encoding='utf-8') as f:
    content = f.read()
# ... modify content ...
with open('site/world.html', 'w', encoding='utf-8') as f:
    f.write(content)
```

### Debugging world.html — Use Puppeteer

`world.html` errors are often invisible in code analysis because the render loop silently dies inside `requestAnimationFrame`. **Use Puppeteer headless Chrome** to catch runtime errors:

```bash
# Scripts must use .cjs extension (project is ES modules)
# Serve site/ on a local HTTP server, then test with puppeteer
```

A single missing variable declaration (e.g., `screenshotMode`) can kill `render()` via `ReferenceError` and freeze all agents with zero visible errors in the code.

### Dual Remote Workflow

- `origin` = `msft-common-demos/Cammelot` (internal Microsoft)
- `personal` = `cammeleon66/Cammelot` (public GitHub Pages)
- Branch: `feature/agentic-overhaul`
- GitHub Pages deploys from `master` on `personal` — **merge to master and push** to deploy
- Personal remote needs `--force-with-lease` for pushes

### Visual Identity

Strict **16-bit SNES RPG aesthetic**. No corporate dashboards, flat grey UIs, or modern chart-heavy layouts. Use saturated pixel-art colors, speech bubbles, retro-game menus. Font: "Press Start 2P" for pixel elements, "Space Grotesk" for modern UI text.

### Content Tone

The website uses an **academic, grounded research tone** — not marketing language. The author (Simone Cammel) works at Microsoft and explicitly acknowledges potential bias. All claims must reference simulation runs and specific data sources (CBS, RIVM, NZa, IZA).

### Mobile Breakpoints

- **1024px** — tablet: column layout, compact chatlog
- **768px** — phone: chatlog hidden, 40vh game / 60vh panel, compact top bar
- **480px** — small phone: 35vh/65vh split, minimal stats and buttons

## Key Reference Files

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Master context — read first for all architecture/data decisions |
| `docs/ADR.md` | Architecture Decision Records (frontend-first rationale) |
| `docs/AGENT_SPEC.md` | Agent type definitions and behaviors |
| `config/` | Epidemiological data (NZa tariffs, prevalence tables, comorbidity rules) |

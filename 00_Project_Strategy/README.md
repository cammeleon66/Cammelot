# Project Cammelot — Agentic Applied Research Sandbox

## Overview
Cammelot is an autonomous multi-agent system (MAS) simulating a Dutch town of 5,000 inhabitants.
It serves as an **Applied Research** proving ground for healthcare system analysis and LinkedIn thought leadership.

## Core Principles
- **Setting**: Cammelot, based on representative CBS/RIVM data (20% seniors, 172k deaths/yr on 18M pop)
- **Visual Style**: Strict 16-bit SNES RPG aesthetic (Park et al. AI Town). Saturated colors, tile-based grids, expressive sprites
- **System Failure (IST)**: Quantifies the "care infarction": 30% administrative burden, Treeknorm violations (wait >12 weeks), staffing shortages (8% absenteeism)
- **Mortality Ghosting**: Death is a direct consequence of system delay. When t_wait > T_Treeknorm, HP drain activates until agent becomes a grey Ghost Sprite

## Architecture Layers
1. **Data Layer (MCP + FHIR)**: FHIR-native memory store. Every agent action logged as Observation, Condition, or Encounter
2. **Communication Layer (A2A Protocol)**: Agent-to-Agent protocol with agent-card.json endpoints
3. **Cognitive Loop (Park et al.)**: Memory Stream → Reflection → Planning

## Agent Teams
- **Team Lead Agent**: Orchestrates sub-agents
- **Grid_Architect**: 2D tile-map with GP Practice and Hospital nodes
- **Clinical_Logic_Agent**: Markov models for disease progression and HP drain
- **Research_Monitor_Agent**: Bias Tracker + ROI Counter

## Directory Structure
```
Cammelot/
├── 00_Project_Strategy/    # Docs, strategy, architecture decisions
├── src/
│   ├── data_layer/         # FHIR memory store + MCP server
│   ├── communication/      # A2A protocol + agent cards
│   ├── agents/             # Agent definitions (patients, GPs, specialists)
│   ├── clinical_logic/     # Markov models, HP drain, Treeknorm engine
│   ├── grid_engine/        # 2D tile-map, pathfinding, congestion visualization
│   ├── research_monitor/   # Bias tracker, ROI counter, analytics
│   ├── frontend/           # 16-bit SNES-style web frontend
│   └── orchestrator/       # Team Lead agent, simulation loop
├── config/                 # Simulation parameters, CBS/RIVM data
├── assets/                 # Sprites, tiles, audio
└── tests/                  # Test suites
```

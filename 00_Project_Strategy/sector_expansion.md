# Sector Expansion Blueprints — Cammelot 2026+

## Overview

Cammelot starts as a **healthcare simulation** but expands into a full
multi-sector "Applied Research" sandbox. Each sector uses the same
Agentic Mesh infrastructure (A2A, MCP, FHIR/openEHR, Cognitive Loops).

---

## Cammelot Education

**Population**: 1,200 students (ages 6-18), 80 teachers, 5 schools

**IST Bottlenecks**:
- One-size-fits-all curriculum
- Teacher burn-out from administrative tasks (25% of time on admin)
- 15% of students below reading level
- Personalized attention impossible with 1:30 teacher-student ratio

**Agent Architecture**:
- **Student Agents**: Memory Stream of learning events, scores, engagement
- **Teacher Agents**: Cognitive loop balancing lesson prep, grading, admin
- **Tutor AI Agents**: Autonomous tutoring based on student's learning profile

**SOLL Vision**:
- AI tutors handle 60% of routine practice (spelling, math drills)
- Teacher admin drops from 25% to 5%
- Each student gets a "Learning Digital Twin" predicting struggles early
- Personalized learning paths based on openEHR-like education archetypes

**Research Questions**:
1. Does AI tutoring create a dependency on AI feedback?
2. Do students with lower digital literacy fall further behind?
3. What's the optimal ratio of AI-to-human teaching time?

---

## Cammelot Retail

**Infrastructure**: 50 shops, 3 supermarkets, 1 online marketplace

**IST Bottlenecks**:
- Manual inventory forecasting → frequent stockouts
- No personalization → generic promotions
- High operational overhead for small businesses

**Agent Architecture**:
- **Shop Agents**: Inventory management, pricing, customer flow
- **Customer Agents**: Purchase patterns based on demographics + health data
- **Supply Chain Twins**: Digital twins of the distribution network

**SOLL Vision**:
- Autonomous reordering via Agent-to-Agent negotiation (shop ↔ supplier)
- Personalized promotions based on purchase history (privacy-preserving)
- "Flash Crash" detection when AI agents create feedback loops

**Research Questions**:
1. What happens when retail agents use health FHIR data for "healthy food" recommendations? Prevention or privacy breach?
2. Do autonomous purchasing agents create market instability?
3. Can A2A commerce reduce small-business operational overhead by >30%?

**Cross-Sector Scenario**:
The pharmacy agent recommends a diabetes patient buy low-sugar products at the supermarket. The supermarket AI starts targeting all diabetics. Where is the ethical line?

---

## Cammelot Research (Scientific Discovery)

**Infrastructure**: 1 university lab, 2 research groups, access to synthetic literature database

**IST Bottlenecks**:
- Fragmented datasets across institutions
- Slow literature review (months of manual reading)
- Reproducibility crisis (60% of findings not replicable)

**Agent Architecture**:
- **Researcher Agents**: Hypothesis generation, experiment design, publication
- **Literature Review Agents**: Autonomous scanning of research databases
- **Peer Review Agents**: Evaluate claims against evidence

**SOLL Vision**:
- Agent teams autonomously generate hypotheses from Cammelot simulation data
- Cross-reference findings with real-world CBS/RIVM data
- Automated meta-analysis of 1,000+ simulation runs

**Research Questions**:
1. Can AI agents discover non-obvious correlations in healthcare data?
2. Does automated hypothesis generation introduce systematic bias?
3. Can peer-review agents catch p-hacking or cherry-picking?

---

## Implementation Priority

| Phase | Sector | Timeline | Dependencies |
|-------|--------|----------|-------------|
| 1 | Healthcare (IST + SOLL) | Now | Core mesh complete |
| 2 | Security Red Team | Week 2 | Healthcare agents running |
| 3 | Education | Month 2 | New agent types needed |
| 4 | Retail | Month 3 | Commerce protocol (UCP) |
| 5 | Research | Month 4 | Literature MCP server |

---

## Shared Infrastructure Requirements

All sectors use:
- **A2A Protocol**: Inter-agent communication with Agent Cards
- **MCP Servers**: Data access (FHIR for health, custom schemas for education/retail)
- **Cognitive Loop**: Memory Stream → Reflection → Planning (Park et al.)
- **Bias Tracker**: Cross-sector bias monitoring
- **ROI Counter**: Financial impact measurement per sector
- **Security Auditor**: Red team testing for each new sector mesh

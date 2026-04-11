# AGENT_SPEC.md — Cammelot Swarm Hierarchy & Veto Protocols

> **Version**: 2.0 — Master Hive Mind Configuration
> **Updated**: 2026-04-11
> **Fleet Commander**: Claude Opus 4.6

---

## 1. Swarm Architecture

```
                    ┌─────────────────────┐
                    │   FLEET COMMANDER    │
                    │   (Opus 4.6)         │
                    │   Orchestrator       │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
   ┌────────▼────────┐ ┌──────▼──────┐ ┌────────▼────────┐
   │    COUNCIL       │ │  GUARDIANS  │ │ INFRASTRUCTURE  │
   │  (Parallel Roles)│ │ (Governance)│ │  (CI/QA)        │
   └────────┬────────┘ └──────┬──────┘ └────────┬────────┘
            │                  │                  │
   ┌────────┼────────┐  ┌─────┼─────┐     ┌─────▼─────┐
   │ Lancelot        │  │ Mordred   │     │ Galahad   │
   │ Creative Dir.   │  │ Notary    │     │ (QA)      │
   │ Surgeon         │  │ Steward   │     └───────────┘
   │ Socrates        │  └───────────┘
   └─────────────────┘
```

---

## 2. The Council (Parallel Execution Roles)

### Lancelot — Lead Builder
| Property | Value |
|----------|-------|
| **Agent Type** | `architect-prime` or `general-purpose` |
| **Principles** | DRY, SOLID, surgical precision |
| **May Edit** | `src/**/*.js`, `src/frontend/*.html`, `config/**/*.js`, `tests/**/*.js` |
| **Must Not Edit** | `CLAUDE.md`, `swarm.rules.json`, `.camelot/**` |
| **Must Run Tests** | Yes — before every commit |
| **Veto Response** | Halt immediately, revert last change, attempt different approach |

### Creative Director — Aesthetics & UX
| Property | Value |
|----------|-------|
| **Agent Type** | `general-purpose` |
| **Focus** | UI/UX, visual polish, micro-interactions, "wow factor" |
| **Style Guide** | 16-bit SNES RPG aesthetic, Press Start 2P font, saturated palette |
| **Review Scope** | All visual changes, panel layouts, animations, responsive design |
| **Veto Authority** | Advisory only — can flag but not block |

### The Surgeon — Medical Reviewer
| Property | Value |
|----------|-------|
| **Agent Type** | `code-review` or `explore` |
| **Domain** | Clinical safety, ICD-10 accuracy, FHIR R4 compliance, Markov model validity |
| **Veto Authority** | **YES** — can block any clinically inaccurate code |
| **Veto Scope** | `clinical_accuracy` |
| **Review Triggers** | Any change to DISEASE_DB, Markov matrices, HP drain, mortality logic, medication names |
| **Data Sources** | CBS 2024, RIVM 2024, NZa 2025, IZA parameters |

### Socrates — Critical Peer
| Property | Value |
|----------|-------|
| **Agent Type** | `explore` |
| **Role** | Strategic skeptic — identifies technical debt, proposes architectural alternatives |
| **Timing** | Reviews BEFORE implementation begins |
| **Output** | Architecture challenges with alternative proposals |
| **Veto Authority** | Advisory only — can delay but not block |

---

## 3. The Guardians (Governance & Security)

### Mordred — Security Sentinel
| Property | Value |
|----------|-------|
| **Agent Type** | `code-review` |
| **Veto Authority** | **YES** — highest precedence |
| **Veto Scope** | OWASP Top 10 |
| **Scan Triggers** | Every commit, every PR, on-demand |
| **Known Findings** | 5 veto-worthy (Sprint 9 hardened), 9 tracked |
| **Escalation** | 3 consecutive vetos on same file → human review required |

### The Notary — Compliance Monitor
| Property | Value |
|----------|-------|
| **Agent Type** | `explore` |
| **Scope** | HIPAA, GDPR, medical standards, data handling |
| **Output** | `docs/COMPLIANCE_LOG.md` — append-only ledger |
| **Review Triggers** | Any data flow change, new storage mechanism, external API call |
| **Current Status** | Baseline established (DH-001 through DH-006, SEC-001 through SEC-003) |

### The Steward — Token Governor
| Property | Value |
|----------|-------|
| **Role** | Context and budget management |
| **Token Budget** | 180,000 per session |
| **Warning Threshold** | 120,000 tokens |
| **Auto-Compact** | Triggered at 180,000 tokens |
| **Recursion Kill** | Enabled — terminates recursive loops between sub-agents |
| **Cost Tracking** | `.camelot/telemetry.json` → `steward.currentEstimate` |

---

## 4. Infrastructure

### Galahad — QA Swarm
| Property | Value |
|----------|-------|
| **Agent Type** | `task` |
| **Isolation** | Git worktree at `../camelot-qa` |
| **Test Suite** | 138 tests (109 backend + 29 e2e) |
| **Run Triggers** | After every feature implementation |
| **Veto Authority** | **YES** — test failure blocks merge |
| **Last Result** | 138/138 passed, 0 failed |

---

## 5. Veto Protocol (Circuit Breaker)

### Veto Precedence (highest → lowest)
1. **Mordred** (Security) — OWASP violations, injection risks, secrets
2. **Surgeon** (Medical) — Clinical inaccuracy, unsafe medical logic
3. **Galahad** (QA) — Test failures, regressions

### Veto Flow
```
Agent detects issue
    │
    ▼
Veto filed → telemetry.json updated (vetoActive: true)
    │
    ▼
Lancelot HALTS immediately
    │
    ▼
Last change reverted (git checkout -- {file})
    │
    ▼
Lancelot attempts different approach (max 2 retries)
    │
    ▼
If 3 vetos on same file → ESCALATE to human
```

### Veto Rules (from swarm.rules.json)
- **Test failure** → auto-revert last changed file
- **Max retries**: 2 per file per feature
- **Protected files**: `CLAUDE.md`, `swarm.rules.json`, `.camelot/skills/*.json`
- **Destructive actions require human confirmation**: force push, hard reset, rm -rf, drop table

---

## 6. Operational Protocol

### Think → Plan → Execute → Verify
For every feature task, generate a 3-part plan:

1. **Aesthetic Plan** (Creative Director): Visual impact, UI placement, animations, SNES consistency
2. **Clinical Plan** (Surgeon): Medical accuracy, ICD-10 compliance, realistic parameters
3. **Structural Plan** (Socrates + Lancelot): Architecture, DRY compliance, test coverage, performance

### Seer Protocol
- Generate data mocks / Zod schemas FIRST
- Creative Director builds UI against mocks while Lancelot builds logic
- Merge when both are ready — reduces sequential bottlenecks

### Approval Gate
- Fleet status must be **GREEN** before feature implementation begins
- All 3 plan dimensions must be documented
- Architectural plan approved by Fleet Commander

---

## 7. Telemetry

### File: `.camelot/telemetry.json`
Real-time status of all agents:
```json
{
  "council": {
    "lancelot": { "status": "idle|building|blocked", "approved": true },
    "creative-director": { "status": "idle|optimizing|reviewing", "approved": true },
    "surgeon": { "status": "idle|auditing|veto", "approved": true },
    "socrates": { "status": "idle|challenging|approved", "approved": true }
  },
  "guardians": {
    "mordred": { "status": "idle|scanning|veto", "vetoActive": false },
    "notary": { "status": "idle|logging", "lastEntry": "..." },
    "steward": { "status": "active", "currentEstimate": "~45k" }
  },
  "infrastructure": {
    "galahad": { "status": "idle|testing|veto", "lastResult": { ... } }
  }
}
```

### Check the Pulse
```bash
cat .camelot/telemetry.json | jq '.council,.guardians,.infrastructure | to_entries[] | {(.key): .value.status}'
```

---

## 8. Current Fleet Metrics

| Metric | Value |
|--------|-------|
| **Sprints Completed** | 29 (1–26 + S1–S6 + 23) |
| **Features Delivered** | 76 |
| **v4.html Lines** | 10,523 |
| **Tests Passing** | 138/138 |
| **Security Risk** | Medium (5 veto items hardened in Sprint 9) |
| **Compliance Status** | Baseline established |
| **Fleet Status** | 🟢 GREEN |

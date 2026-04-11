# COMPLIANCE_LOG.md — Cammelot Data Handling & Compliance Ledger

> **Maintained by**: The Notary (Compliance Monitor Agent)
> **Purpose**: Document every data-handling decision for medical audit readiness.
> **Standard**: GDPR-aligned, HIPAA-aware (simulation context — no real patient data)

---

## Compliance Baseline — 2026-04-11

### Data Classification

| Data Type | Classification | Storage | Real PII? | Notes |
|-----------|---------------|---------|-----------|-------|
| Agent names | Synthetic | In-memory + localStorage | ❌ No | Generated Dutch names, not linked to real persons |
| Agent health data (HP, conditions) | Synthetic clinical | In-memory + localStorage | ❌ No | Simulated ICD-10 codes, not real diagnoses |
| ICD-10 codes | Public reference | Hardcoded in DISEASE_DB | ❌ No | WHO classification — public domain |
| CBS/RIVM statistics | Public data | Hardcoded in config | ❌ No | Government open data, cited with sources |
| NZa tariffs | Public data | Hardcoded constants | ❌ No | Published pricing, cited with sources |
| FHIR resources | Synthetic | In-memory (FHIR_STORE) | ❌ No | Simulated FHIR R4 resources for agent memory |
| User preferences | Non-sensitive | localStorage | ❌ No | Dark mode, sound, save slots |

### Key Decisions

#### DH-001: No Real Patient Data
- **Decision**: Cammelot uses exclusively synthetic/simulated data
- **Rationale**: Simulation demonstrates systemic patterns, not individual cases
- **Consequence**: HIPAA/GDPR patient data protections are technically N/A, but we follow best practices anyway
- **Date**: 2026-04-11

#### DH-002: No Server-Side Data Collection
- **Decision**: Zero backend, zero analytics cookies, zero tracking pixels
- **Rationale**: Static HTML deployment — no server to collect data
- **Consequence**: GDPR cookie consent banner not required (no cookies used)
- **Date**: 2026-04-11

#### DH-003: localStorage Data Handling
- **Decision**: Save data stored in browser localStorage with schema validation
- **Rationale**: Enables simulation persistence without server infrastructure
- **Security**: Schema validation on load (INTEGRITY-001 fix), version checking, property whitelisting
- **Risk**: localStorage is cleartext — acceptable for synthetic data only
- **Date**: 2026-04-11

#### DH-004: No External API Calls
- **Decision**: Simulation makes zero network requests after initial page load
- **Rationale**: Self-contained single-file application, works offline
- **Consequence**: No data exfiltration risk, no third-party data sharing
- **Date**: 2026-04-11

#### DH-005: Medical Disclaimer Required
- **Decision**: All public-facing pages must include "This is a simulation, not medical advice"
- **Rationale**: ICD-10 codes and treatment references could be mistaken for clinical guidance
- **Implementation**: Landing page footer + About page + meta description
- **Date**: 2026-04-11

#### DH-006: Data Source Attribution
- **Decision**: All statistical data must cite its source (CBS, RIVM, NZa, IZA)
- **Rationale**: Credibility requires verifiable data provenance
- **Implementation**: Methodology panel (Sprint S6), About page (Sprint 21)
- **Date**: 2026-04-11

---

## Encryption & Security Decisions

#### SEC-001: No Encryption Required (Synthetic Data)
- **Decision**: No at-rest or in-transit encryption for simulation data
- **Rationale**: All data is synthetic. No PII, no PHI, no credentials.
- **Note**: If real patient data integration is ever considered, this decision MUST be revisited immediately.

#### SEC-002: Content Security Policy
- **Decision**: CSP configured in nginx.conf (Sprint 9)
- **Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- **Status**: Implemented in nginx config, inline handlers partially migrated

#### SEC-003: Input Sanitization
- **Decision**: All user-facing text passes through `sanitizeText()` (Sprint S6)
- **Rationale**: Defense-in-depth against XSS, even with synthetic data
- **Implementation**: Template literal outputs sanitized before innerHTML assignment

---

## Audit Trail

| Date | Agent | Decision | Category | Details |
|------|-------|----------|----------|---------|
| 2026-04-11 | Notary | DH-001 through DH-006 | Data Handling | Initial compliance baseline established |
| 2026-04-11 | Notary | SEC-001 through SEC-003 | Security | Security posture documented |
| 2026-04-11 | Fleet Commander | Fleet initialization | Governance | Full Hive Mind swarm initialized with veto protocols |

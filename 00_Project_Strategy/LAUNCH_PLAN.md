# Cammelot — LinkedIn Launch Plan

> **HOW TO USE THIS PLAN WITH COPILOT CLI**
> Say: "work on the next sprint" or "start sprint 1" or "implement s1-queue-overflow".
> All todos are tracked in SQL. Copilot will pick up where you left off.
> Codebase: `C:\Users\Public\Cammelot` — main file: `src/frontend/v4.html`

## Goal
Post a LinkedIn series on Cammelot that is **credibly backed by a real, publicly accessible simulation**. No bullshit. Every claim in the post must be demonstrable in the live tool.

---

## The LinkedIn Post (Series 1, Post 1 — DRAFT)

See rewrite below. Hook: "Most AI discourse treats it as a personal productivity tool. I think that misses the point entirely."

---

## Current State (as of April 2026)

- **Clinical engine:** 95% done. Markov disease models, HP drain, real CBS/RIVM data. ✅
- **Frontend rendering:** 85% done. SNES aesthetic, day/night, animations. ✅
- **115 tests:** All passing. ✅
- **FHIR data layer + A2A protocol:** Implemented. ✅
- **Security:** 5 OWASP findings unfixed. ❌ BLOCKER for public URL.
- **Queue visualization:** Missing. ❌ Core visual metaphor not yet shown.
- **Onboarding:** Missing. ❌ Visitors won't understand what they see.
- **IST/SOLL toggle contrast:** Exists but not visually dramatic enough. ⚠️
- **Research panels (bias, ROI):** Partial. ⚠️
- **Mobile:** Desktop only. ⚠️

---

## Technical Sprint Plan (maps to blog posts)

### Sprint 1 — Make the IST crisis VISIBLE (Posts 1 & 2 screenshots)
- `s1-queue-overflow` — Sprites stack physically outside buildings, pulsing "!" icon, queue count badge
- `s1-ghost-drama` — Screen flash on death, floating ghost animation, grave tooltip with weeks waited
- `s1-ist-soll-transition` — Animated "system reboot" when toggling, queues visibly shrink over 5 ticks
- `s1-crisis-hud` — Top bar: Deaths this week, Avg Wait, GP Burnout %, Admin Burden, Treeknorm violations

### Sprint 2 — Answer Post 2: The Admin Tax
- `s2-admin-waste-live` — Live €€€ counter ticking up in real time like a taxi meter
- `s2-capacity-formula-vis` — Show C_eff formula as a bar chart in GP building panel
- `s2-burnout-indicator` — GP building glows red when overloaded; sprite disappears on sick leave

### Sprint 3 — Answer Post 3: The Wait List Is Not Neutral
- `s3-age-wait-chart` — Live bar chart: wait times by age group (0-44, 45-64, 65-79, 80+)
- `s3-severity-drain-vis` — HP drain breakdown in agent card: base + overdue + admin multiplier
- `s3-treeknorm-violation-log` — Filterable event log of all Treeknorm breaches

### Sprint 4 — Answer Post 4: Does AI Make Inequality Worse?
- `s4-gini-tracker` — Live Gini coefficient of care access with sparkline over time
- `s4-bias-over-time` — Time-series chart: bias score IST vs SOLL over simulation ticks
- `s4-digital-divide` — Digital literacy attribute (age-skewed) that delays SOLL benefits for elderly

### Sprint 5 — Answer Post 5: Digital Twin Triage
- `s5-digital-twin-panel` — Proper risk panel in agent card: score, time-to-critical, interventions
- `s5-proactive-alert` — SOLL mode: GP gets alert when risk > 25%, proactive contact before deterioration
- `s5-er-pressure-chart` — ER admissions per 100 agents: IST vs SOLL, with € saved counter

### Sprint 6 — Screenshot & Deployment Infrastructure
- `s6-screenshot-mode` — "📸 Screenshot Mode" exports clean canvas PNG with stat callout overlay
- `s6-methodology-panel` — Collapsible sources panel with CBS/RIVM/NZa/IZA links + formulas
- `s6-security-fix` — Fix 5 OWASP findings (CSP, XSS, inline handlers) — BLOCKER for public URL
- `s6-deploy` — Deploy to public URL (GitHub Pages or Vercel)

---

## Launch Checklist (Priority Order)

### 🔴 Blockers (must be done before posting)
1. **security-csp** — Fix OWASP findings (CSP, XSS, inline handlers)
2. **queue-visualization** — Sprites visually stacking outside buildings, ! icons, queue counters
3. **ghost-events** — Unmissable mortality events (grey ghost, grave, log entry with cause)
4. **ist-soll-impact** — Toggle must be visually dramatic — animate the transition
5. **onboarding-modal** — 30-second explainer for first-time visitors
6. **deploy-live** — Real public URL (depends on security fix)

### 🟡 Important (post can go up, but these make it better)
7. **ui-metric-callouts** — Live stats banner: deaths, wait times, GP burnout
8. **methodology-page** — Sources panel (CBS, RIVM, IZA links) — kills credibility objections
9. **bias-tracker-ui** — Panel showing care inequality by age/condition
10. **roi-counter** — Live € wasted on admin, € cost of preventable deaths

### 🟢 Nice to have
11. **mobile-responsive** — LinkedIn is mostly mobile; at least a zoomed-out view
12. **screenshot-assets** — High-quality screenshots for the post itself
13. **post-series-plan** — Map the 5-post series arc

---

## LinkedIn Post Series Arc (5 posts)

| # | Title Hook | Core Claim | Demo Feature Used |
|---|-----------|-----------|-------------------|
| 1 | "5,000 Dutch citizens. 1 simulation. Here's why AI-as-productivity is wrong." | Systemic AI vs personal AI | IST overview, ghost events |
| 2 | "The Dutch care system is dying. I have the receipts." | IST crisis in numbers (wait times, mortality, burnout) | Queue visualization, ROI counter |
| 3 | "What if we digitized everything from the bottom up?" | SOLL vs IST visual contrast | IST/SOLL toggle animation |
| 4 | "Applied research: Does AI worsen healthcare inequality?" | Bias findings across age/condition/location | Bias tracker panel |
| 5 | "What Cammelot taught me about AI policy in the Netherlands." | Policy implications for IZA/NZa | Full methodology panel |

---

## Technical Architecture Summary (for credibility)
- Zero npm dependencies — 100% vanilla JS + Canvas API
- Real statistical models: CBS demographics, RIVM condition prevalence
- FHIR R4-native memory per agent
- A2A protocol for inter-agent communication
- IST parameters: 30% admin burden, 12-week Treeknorm violations, 8% sick leave
- SOLL parameters: <5% admin, E_ai = 1.34, C_eff goes from 0.62 → 0.83

---

## Execution Notes (for Copilot CLI)

- All code changes go in `src/frontend/v4.html` (the monolith — ~4,600 lines, Canvas-based SPA)
- Run tests with: `node --test tests/*.test.js` (115 tests, all passing — keep them green)
- Preview locally: open `src/frontend/v4.html` directly in browser (no build step needed)
- Social content: `00_Project_Strategy/social/`
- Do sprints in order: Sprint 1 → 2 → 3 → 4 → 5 → 6
- Sprint 6 (security + deploy) can be done in parallel with Sprint 5

## Key Functions in v4.html (for navigation)
- `setMode()` — IST/SOLL toggle (line ~5808)
- `drawBuildingStatus()` — building rendering (line ~3698)
- `getQueuePosition()` — queue sprite positions (line ~3679)
- `drawGraveMarkers()` — death visualization (line ~3983)
- `buildStatsHTML()` — stats panel (line ~6795)
- `selectAgent()` / `renderAgentCard()` — agent detail card (line ~4430)
- `trackBiasData()` — bias tracking (line ~5710)
- `updateUI()` — top bar refresh (line ~5752)


# F04 finite-resource implementation evidence

**Issue:** #4. **Baseline parent:** `224412790e620920f34d2357e71bbfd06937a655`; inspected implementation-PR starting plan `061564e` (no source changes from that parent).
**Upcoming executable:** `minister-care-8-finite-resources`; **verified production remains** `minister-care-7-elapsed-time`. No deployment, new PR, branch merge, settings or production-data writes are part of this work.

## Current-source reproduction before edits

Browser fixtures executed the unchanged local Minister page via HTTP in Cabinet Crisis, seed 2468, with controlled RNG, unrelated residents isolated, and actual `tick()` handlers:

1. Set nominal routine rate to `0.25` starts/week (one declared routine place); place eight living emergency transports at completed arrival. One tick admitted **eight** emergency residents into `at_hospital`.
2. Put one resident in an active `gp1_bldg` consultation with eight ticks remaining and another in that GP's queue. One tick left the original consultation active (timer seven) and admitted the queued resident (timer four): **two simultaneous consultations at one provider**.

These reproduce the bounded audit findings on model 7, rather than assuming that the older model-5 audit applies.

## Criterion-by-criterion evidence

All fixtures below are named `F04 …` in `tests/minister_browser.test.js`. They execute the active player tick paths. Reference-policy mode is used only during setup and restored before any tested tick. RNG/progression are controlled to isolate resource rules, not to assert historical mortality scores. Tick loops have a maximum budget and fail explicitly on stalled progress. Assertions use floating-point tolerances for drain/waits/credit and observed visit timestamps for same-tick release/reallocation.

| Criterion | Evidence and expected result |
|---|---|
| Every admission accounts for declared resources | Eight-emergency fixture: one emergency start, seven queued, one routine start concurrently in its separate place. Initial occupancy, GP starts, routine starts and emergency starts use the same resource ledger; infrastructure staff are excluded. |
| Separately represented, bounded and visible overflow | Eight-emergency and whole-roster fixtures: one place, at most one waiting record per resident, bound equal to actual roster size. Repeated processing does not duplicate entries. Ministry live count and care detail report match snapshots; overflow deaths before treatment are separate from treatment deaths. |
| GP concurrency and exactly-once release | Simultaneous arrivals at both GPs: occupancy at most one per practice. Completion reallocates immediately. Death cleanup repeated twice does not release twice. Same-resident re-entry acquires a distinct visit; a stale prior-visit release cannot free it. Dawn preserves the consultation location. |
| Credit, absence, occupancy, recovery/discharge, re-entry under contention | Full routine occupancy preserves capped credit; repeated gate reads do not accrue credit twice. Discharge admits the more urgent routine resident; death frees occupancy but cannot invent credit. At `0.25` starts/week the next credit takes 16 ticks. GP absence pauses service and prevents overlapping starts. Recovery uses no treatment place. |
| Transfers and emergency priority | GP escalation releases its place for the next GP arrival. An already-referred critical resident preserves the same referral start/episode, queues for emergency care and takes the freed emergency place by clinical priority. Routine care remains independent; displacement count stays zero. Real burnout redistribution updates queue/provider metadata and still waits for the receiving GP's place. |
| Terminal release and shrinking resources | Whole-roster emergency fixture: death during treatment releases exactly once and admits the next emergency on the same observed tick, without recording a completion or death-before-treatment. Routine capacity reduction from three places to one exposes two retiring occupied places; no new start until existing care frees the target place. |
| Common deterioration rule, not an overflow-specific penalty | An overdue overflow resident loses the amount calculated by the existing untreated HP-drain/comorbidity rule at its elapsed referral wait (tolerance `1e-9`). No emergency-only mortality coefficient is added. |
| Preserve timing/terminal invariants | Existing regressions retain four ticks/week, 52/quarter, 208/year, display offset 30, Cabinet Crisis 416 ticks, Full Term 2,080 ticks, night-GP journeys, retirement during care, terminal disease/background deaths and exactly-once death finalization. |
| Incompatible version and focused release status | Model 8 identity is used by existing replay/reference/leaderboard machinery and browser assertions. Model/release docs explicitly mark it upcoming, not deployed. No calibration or improved-mortality claim. |

## Validation environment and commands

- Initial `node --test tests/minister_browser.test.js tests/minister_deployment_smoke.test.js` could not import `playwright-chromium` (`ERR_MODULE_NOT_FOUND`).
- `npm ci` failed once: the existing lockfile points to an unavailable Azure package mirror (`ENOTFOUND ms-feed-17.pkgs.visualstudio.com`). No retry against that mirror and no dependency/lockfile edits.
- Public npm was reachable. Existing declared test versions `playwright-chromium@1.62.1` and `acorn@8.18.0` were installed under `/tmp/cammelot-validation`, without lifecycle scripts or browser download. A temporary local `node_modules` symlink points there during validation and is removed before commits. The available system Chromium is used at Playwright's expected headless executable path. This validates system Chromium, not a newly downloaded Playwright browser build.
- Before source edits, the targeted suite ran **28 passing, one failing external-font/analytics assertion, one picker timeout**. The browser harness now stubs cosmetic third-party requests so these local regressions do not depend on external fonts/analytics.
- Focused command: `node --test --test-name-pattern='F04' tests/minister_browser.test.js`.
- Complete Minister command: `node --test tests/minister_browser.test.js tests/minister_deployment_smoke.test.js` — **37 passed, 0 failed**, including all seven F04 fixtures and both supported-host/reference scenarios.
- Repository command: `npm test` — **179 passed, 0 failed, 0 cancelled, 0 skipped** (48 suites).
- `node --check tests/minister_browser.test.js`, Acorn parsing of every inline Minister script block, and `git diff --check` passed.
- Independent read-only diff review found no significant issues.

Post-commit security-check status and final verification are recorded in the implementation PR progress and completion response. These tests use local HTTP and mocked/blocked publication, never production leaderboard writes. No frontend build step or new dependency is required.

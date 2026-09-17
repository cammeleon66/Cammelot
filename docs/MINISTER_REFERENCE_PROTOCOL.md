# Minister paired reference — version 1

Implemented 2026-09-16. Model: `minister-care-3-paired`. Protocol: `no-discretionary-action-v1`.

## What is compared

The reference starts with the same seeded population, scenario modifiers, logical clock and care engine. It continues existing care without discretionary purchases, laws, optional dilemmas or political decisions. Political dismissal does not stop it. This is a declared control policy, not an optimized alternative government.

The player can change care provision and incur policy-dependent political/digital risks. Therefore this comparison is not a clinical trial, not a real-world prediction, and not proof that a specific purchase caused an individual recovery. The legacy system-failure death classification still includes untreated disease; the interface calls it model-classified system deaths in the paired verdict.

## Shared environment

- External schedule depends only on seed and scenario horizon, not purchases, menu visits, rendering or the order of clinical random draws.
- Three external shock families: flu, regional grid disruption, regional staffing shortage. The older player-only outage/pathology/flu/medicine-shortage/ED-closure/retirement event draws are excluded from the council pool in this model version. This intentionally narrows the model rather than claiming that those old events were paired.
- Each scheduled event has identity, start/end tick and severity. Schedule identity travels with the reference payload.
- Flu increases modeled deterioration and absence. Prevention/resilience can mitigate impact. Grid capacity impact scales with digital dependence and resilience. Staffing shortages reduce routine capacity.
- Annual aging runs on the shared logical clock. It does not depend on opening a council; prevention can moderate deterioration pressure.
- Shock coefficients and the sparse quarterly schedule are gameplay assumptions, not measured Dutch incidence or effect estimates. Full calibration and strategy sensitivity analysis remain outstanding.
- No discretionary response is required for these external shocks: existing operations continue under the modeled disruption. Optional player choices and endogenous events are not silently auto-selected for the reference.
- Temporary event impacts record their applied magnitude and expiry. Policies bought during an event do not retroactively change its initial protection calculation.

## Matched-date results

The reference records snapshots per completed tick, not only a final score. Early endings compare at their exact ending tick. No fractional estimate of a final death count is used.

Paired values include model-classified system deaths, current referral count/mean, treatment starts, deaths before treatment, GP paperwork and workload score. Death difference is reference minus player; negative values are retained. A mean among surviving patients is accompanied by waiting/death counts, never presented alone as proof of access improvement.

Data is accepted only from the actual reference iframe with matching origin, seed, scenario, model version, protocol and schedule identity. The requested snapshot must have the same tick and identity. Missing/mismatched data remains pending/unavailable with no benefit claimed. Late valid data updates the care comparison and sharing text without resuming the game.

## Replay

“Try another approach” stores the previous attempt in version/scenario/seed-scoped local storage. The record includes snapshots, ending tick, decisions, council choices, election snapshot and external schedule/impacts. Replay keeps scenario and seed, starts with a clean government, and shows the previous result at the same date when available.

If the previous attempt ended earlier than the new comparison date, the game says no same-date previous snapshot exists. It does not compare unequal durations. Saving failures keep the player on the result screen with an explanation. Links carry a model version; opening an old-version link warns that its outcomes cannot be reproduced under the new model. This is a previous-attempt comparison, not automatic replay of every recorded choice.

## Regression evidence

Tests in [tests/minister_browser.test.js](../tests/minister_browser.test.js) cover:
- Same no-action policy through foreground and baseline paths over the two-year and ten-year horizons, including shared shocks/annual aging.
- Exact metric snapshots plus compact clinical-state traces (position, health, behavior, social timers and parameters).
- Different seeds can generate different schedules.
- Extra drawing and viewport changes do not advance care state.
- Actual iframe response, exact tick-75 early ending, delayed display refresh and rejection of messages from the wrong source.
- Negative care differences despite political survival, previous-run retention, same-seed/version replay and muted audio preference.

These are software invariants, not broad evidence of balance or clinical validity. More policy-path/seed coverage, event-interaction tests, real-device checks and domain/human playtests remain required before research claims or public release.
# Minister lifecycle economics (R04)

**Status:** Implemented for the R03 research pathway only, in the shared
`site/minister-model-core.js`. **Schema:** `r04-lifecycle-ledger-v1`. **R03 model
version:** `minister-r03-cardiology-pathway-3` (R01 protocol `r01-cardiology-v1.0`,
unchanged). The live Minister game, `MoC.MODEL_VERSION`
(`minister-care-10-access-time-replay`), its outcome rules, leaderboard and
replay schemas are **not** changed and do not call this code.

This is a software mechanism and ledger, not a cost base. It contains **no
sourced prices, tariffs, subsidies, funding eligibility or entitlements**, and no
built-in expectation that any technology repays. Every number in the tests is a
labelled scenario assumption. Results are model behaviour, not economic
evidence ([R01 protocol](RESEARCH_PROTOCOL_2027.md), cost provenance rules).

## What is distinguished

Each is a separate state or counter with an explicit tick in the snapshot
`lifecycle.timeline` and as an ordered event in the authoritative stream:

| Concept | Event / field | Rule |
|---|---|---|
| Approval | `lifecycle_approved`, `approvedAt` | Authorises the finite `cashCap` and `workCap`. Spends nothing. Nothing can be charged before `approvalTick`. |
| Spending | `cost_paid`, `implementation_progress`, `recovery_progress` | Cash and work are separate ledgers (below). |
| Implementation progress | `implementation_started/progress/stalled/completed` | `implementationWorkPerTick` staff hours per tick, capped by remaining work and remaining work budget. Not live. |
| Commissioning | `commissioned`, `commissioning_failed` | First attempt `commissioningDelayTicks` after completion. The first `failedCommissioningAttempts` attempts fail; each failure charges `on_commissioning_failure` items and adds `reworkWorkPerFailure` hours, then a retry. An attempt waits while any obligation is unpaid. |
| Adoption | `adoption_started`, `adoption.currentBasisPoints` | After commissioning, rises linearly to `adoptionTargetBasisPoints` over `adoptionRampTicks`. Adoption is not benefit. |
| Realized benefit | `benefit_realized`, `benefit` | First tick a handoff used fewer coordination units than the baseline process, or an adopted capacity unit was available. |

Adoption acts through the existing workflow mechanism, not an outcome score: a
`complete_handoff` uses the R01 intervention's handoff effort (and, for
organizational reform, its coordination-capacity bonus) only when an integer
credit says it is adopted; otherwise the baseline current-process effort (2
coordination units, no bonus) applies. Credit adds `basisPoints` per handoff
(per tick for capacity); at 10,000 the mechanism is used and 10,000 is
subtracted, so 5,000 bp alternates baseline/adopted. While the service is
interrupted, lapsed (unpaid obligation) or not yet commissioned the baseline
process applies. Specialist treatment starts, clinical events and the external
schedule are untouched, so downstream capacity can still cancel a local gain.

## Units and conservation

* **Cash:** `scenario_cash_minor_unit` (integer). No currency, price year or
  discounting is implied; `ledger.discounting` is `none` and every monetary
  input carries its own `provenance.priceYear` (`null` only for unsourced
  assumptions).
* **Non-cash work:** `staff_hour` (integer), including implementation labour,
  rework, oversight, clinician review/override and recovery work. Work is never
  converted to cash and cash never buys work.
* `staffHoursPerCoordinationUnit` converts coordination units *actually avoided*
  by adopted handoffs into staff hours for a work-only payback test
  (`economics.repaidInStaffHours`). Added capacity is reported
  (`capacityUnitsGranted`) but is **not** a saving; `recognisedCashSavings` is
  always 0. Care benefits are never counted as cost savings.

Ledger invariants, checked independently from the event stream in
`tests/minister_lifecycle.test.js`:

```
authorised = spent + remaining      (cash and work separately; remaining >= 0)
spent      = sum(cost_paid) [+ implementation_progress + recovery_progress for work]
spent      = sum(byPurpose) = sum(byCategory)
```

Budgets are finite and there is no treasury overdraw. An item is paid whole or
not at all. If the remaining cap cannot cover it, a `cost_deferred` obligation is
recorded (never debt, never counted as spent) and retried in order each tick; any
unpaid obligation blocks commissioning and, once live, lapses the service
(`service_lapsed`) until paid. Implementation and recovery work are divisible
and stall (`*_stalled`) when the work budget is exhausted. A per-adopted-handoff
item that cannot be paid makes that handoff fall back to the baseline process.
Unspent budget is never converted into a care bonus. One-time items scheduled
after the horizon (e.g. decommissioning) appear as `residualLiabilities` and are
not charged. Spending is sunk when paid: no salvage or refund is modelled;
`spentBeforeFirstBenefit` records spending sunk before any benefit, and
`byPurpose` separates implementation, investment, operating, failure/recovery
and decommissioning.

## Input schema (all required; no hidden defaults)

`inputs.lifecycle = { schema, id, parameters, costItems, interruptions }`.

Each `parameters.<name>` is `{ value, unit, mechanism, provenance }` with
`provenance = { status: 'assumption' | 'sourced' | 'placeholder_unsourced',
source, priceYear? }`. The unit must match exactly. Integers only.

| Parameter | Unit | Bounds | Status in this repository |
|---|---|---|---|
| `approvalTick` | tick | 0..horizon | Scenario assumption |
| `cashCap` | scenario_cash_minor_unit | 0..1e9 | Scenario assumption; R01 requires one common sourced cap before any cost-based winner |
| `workCap` | staff_hour | 0..1e7 | Scenario assumption |
| `implementationStartTick` | tick | >= approvalTick | Scenario assumption (R01 sweeps 0/6/12 months' delay) |
| `implementationWorkRequired` | staff_hour | 1..1e6 | Unsourced assumption |
| `implementationWorkPerTick` | staff_hour_per_tick | 1..1e5 | Unsourced assumption |
| `commissioningDelayTicks` | tick | 1..1e5 | Unsourced assumption |
| `failedCommissioningAttempts` | attempt | 0..10 | Stress setting, not a failure rate |
| `reworkWorkPerFailure` | staff_hour | 0..1e6 | Unsourced assumption |
| `adoptionTargetBasisPoints` | basis_point | 0..10000 | Stress setting (R01: 50/75/100%) |
| `adoptionRampTicks` | tick | 0..1e5 | Unsourced assumption |
| `recoveryWorkPerTick` | staff_hour_per_tick | 1..1e5 | Unsourced assumption |
| `staffHoursPerCoordinationUnit` | staff_hour_per_coordination_unit | 0..1000 | Unsourced assumption; no time-and-motion data |

`costItems` (max 32): `{ id, category, timing, cash, work, cashUnit, workUnit,
mechanism, provenance }`, with at least one of cash/work positive. Categories
follow R01 (design/procurement, data cleanup, migration/dual running,
training/backfill, implementation labour, licences/compute, human oversight,
incident handling, security/privacy, maintenance, upgrades, decommissioning,
clinician review/override). Timings: `one_time` (`tick`), `recurring`
(`from: approval|commissioning`, `periodTicks`; charged in advance at the anchor
and every period after), `on_commissioning_failure`, `on_interruption`,
`per_adopted_handoff`. `interruptions` (max 16): `{ id, startTick, recoveryWork,
workUnit, mechanism, provenance }`; an interruption starts only if the service is
commissioned at `startTick` (otherwise `interruption_not_applicable`), makes the
baseline process apply, charges its `on_interruption` items and needs
`recoveryWork` staff hours at `recoveryWorkPerTick` before the service is live
again (adoption progress is retained). Scheduled charges are bounded at 20,000.

Tick order within `lifecycleStep`: approval, retry deferred obligations,
implementation start/progress, commissioning, recovery, interruption starts,
scheduled one-time/recurring charges, lapse/adoption markers; then coordination
capacity is set; then the unchanged pathway tick (arrivals, external events,
clinical events, treatment starts) runs. Commands in a tick see that state.

## Funding scope

One visible common pool per currency (cash) and one for work. No restricted
funds, separate organisational budgets, insurer/provider rules, grants or
named programmes are modelled because the R01 question does not require them;
introducing any must add explicit rules and a new version.

## Absent lifecycle block

If `inputs.lifecycle` is omitted the R03 behaviour is unchanged and the
intervention mechanism applies immediately and free; the snapshot then reports
`lifecycle.modelled: false`. Fair R01 comparisons (R05) must pass a lifecycle
block for every arm with a common envelope; a current-process arm needs none
because its mechanism equals the baseline.

## Version decision

R03 moves from `minister-r03-cardiology-pathway-2` to
`minister-r03-cardiology-pathway-3`: the module adds events, a snapshot section
and optional outcome-affecting rules (availability and cost of an intervention
mechanism). Pathway runs without a lifecycle block keep v2 transitions. The
module bytes change `modelExecutableId`/`replayExecutableId`, so older records
are refused visibly; `minister.html` changes only the module's SRI digest. The
R01 protocol, game model version and replay/record schemas are unchanged; no
leaderboard or production data is written.

## Limits

No claim about real costs, benefits, ROI, funding eligibility, tariffs or
subsidies; no calibrated adoption, failure or downtime rates; no discounting,
inflation, salvage or asset-life model; no sensitivity sweeps (R05); no
integration with the general care game.

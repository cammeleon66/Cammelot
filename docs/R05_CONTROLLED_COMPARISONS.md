# R05 controlled comparisons: exploratory evidence

**Protocol:** R01, `r01-cardiology-v1.0`  
**Executable:** R03/R04 shared pathway, `minister-r03-cardiology-pathway-3`  
**Status:** Eight-seed development batch; exploratory and not confirmatory  
**Runner:** [`scripts/run_r05_comparison.mjs`](../scripts/run_r05_comparison.mjs)

This batch exercises the predeclared five-arm comparison and its falsification
checks through the shared `MinisterModelCore.createRun` pathway. It is not the
live Minister game (`minister-care-10-access-time-replay`). It does not write
to the production leaderboard or mutate persistent application state.

## Frozen workload and paired design

The runner constructs 336 synthetic referral episodes: 120 are pending at tick
zero and four arrive in each of 54 monthly intervals (216 further episodes).
Month *m* is mapped to `round(m × 208 / 12)` ticks, so the final arrival is at
tick 936. Each run advances the full 1,040-tick, five-model-year horizon. The
run captures lifecycle accounting at tick 208 (one year) and tick 1,040 (five
years) from the same complete trajectory; it does not truncate the five-year
cohort to create a shorter economic horizon. The final arrivals therefore have
104 ticks of observation.

The fixed development seeds are `1103, 2027, 3371, 4729, 5987, 6437, 7919,
9859`. For a given seed, every arm receives the same complete episode list and
the same identified information-availability schedule. The seed is used only
to generate those exogenous inputs. `createRun` itself does not draw random
values. Clinical critical-state and death times are supplied as episode
inputs, not as policy-dependent shocks; the pathway has no separate general
shock process. No policy action consumes or shifts the input-generation stream.

The experiment driver applies one explicit policy in all arms:

1. At tick zero and before each later tick transition, visit arrived,
   handoff-pending episodes by declared priority (descending), arrival tick
   (ascending), then identifier.
2. Request missing referral information; otherwise submit
   `complete_handoff`.
3. Stop after a coordination-capacity rejection and retry remaining work on
   the next tick. Advance simulation time only with `advanceOneTick`.

All attempted commands and receipts are retained. The model's authoritative
event stream is checked for contiguous sequence numbers and recorded as a SHA-256
digest and event-kind counts. Each run records the complete policy, lifecycle
input, horizon, seed, shared dataset reference and hash, model version,
protocol, `modelExecutableId`, runner `replayExecutableId`, and raw module
SHA-256. The JSON output contains each seed's full synthetic inputs once under
`datasets`, while every run carries its dataset and input hashes. Re-running the
same command regenerates the same event digests and episode outcomes.

## Arms and modeled boundaries

The five R01 arm identifiers and their pathway mechanisms are unchanged:

| Arm | Mechanism in this pathway |
|---|---|
| Current process | Two coordination work units per handoff; no new lifecycle program. |
| Organizational reform | One additional coordinator work unit per tick. |
| Conventional integration | One coordination unit per handoff. |
| Agentic coordination | The same one-unit handoff mechanism as conventional integration. |
| Non-agentic modernization | One coordination unit per handoff. |

Intervention arms use the R04 finite cash/work ledgers, commissioning, adoption,
and recurring cost mechanisms. Lifecycle inputs are fully included in each
record. All costs and timing values in this batch are explicit, unsourced
scenario assumptions. Cash is represented in
`scenario_cash_minor_unit`—not euros—and no monetary result is presented as a
price estimate or economic finding.

## Endpoints and uncertainty

The runner reports two R01-aligned **model proxies**, not validated clinical
outcomes:

- **84-day treatment proxy:** first treatment start within 48 ticks of episode
  entry (84 days at four ticks per week).
- **180-day success proxy:** first treatment start within 102 ticks (178.5 days,
  the greatest whole-tick interval not exceeding 180 days), without an earlier
  critical-state crossing. The model records no independent appropriateness
  judgement, so “appropriate treatment” cannot be assessed.

Critical crossings, deaths before treatment, refusal/relocation/other exits,
still-waiting referrals, handoff states, and treatment starts remain separate.
Both age bands (65–74 and 75–84) are reported with denominators. Sex, ethnicity,
disability, and deprivation are not measured; no unavailable attribute is
inferred from names or other proxies. The scalar game score is not used.

The independent unit is one complete run/seed, not an individual episode.
Paired agentic-minus-comparator differences are reported with two-sided 95%
Student-t intervals across seeds. Exact two-sided paired sign-flip p-values are
Holm-adjusted across the eight R01 co-primary-by-comparator tests. These
intervals describe only variability among the fixed synthetic seed inputs;
they do not quantify parameter, structural, or clinical uncertainty, and the
eight-seed design has no asserted power or confirmatory status.

## Prespecified controls and sensitivities

- **Zero-effect control:** Agentic coordination with zero target adoption retains
  its lifecycle costs but must match the current-process clinical/workflow
  outcomes under every paired seed.
- **Intervention failure:** One failed commissioning attempt adds explicit
  rework and incident costs before a later retry; it is not assumed to be a
  successful intervention merely because it was selected.
- **Downstream capacity counterexample:** A fixed specialist-start capacity can
  bind even when a policy routes more handoffs. Queue movement is not treated as
  an end-to-end benefit.
- **Mechanism parity:** The agentic and conventional mechanisms are identical
  in this R03 pathway. A claimed agent-specific benefit in this model would
  fail the parity control.
- **Simpler-alternative cost counterexample:** A separate paired stress test
  assigns the agentic arm twice the conventional arm's assumed cash costs while
  keeping their modeled process mechanism and timing equal. Equal modeled
  outcomes and lower conventional cost demonstrate a constructed case where a
  non-agentic alternative dominates; this is not an estimate of actual costs.
- **Lifecycle sensitivity:** Cash assumptions are scaled by 0.5×, 1.0× and
  1.5×; target adoption is varied over 50%, 75% and 100%; implementation begins
  at ticks 0, 104 and 208 (0, 6 and 12 model months). One-year and five-year
  ledger/benefit snapshots use the same complete five-year trajectories.

Any missing arrival, skipped tick, inconsistent event sequence, unbalanced
episode accounting, failed lifecycle ledger reconciliation, incomplete paired
seed set, or failed control aborts the runner before aggregate summaries are
returned.

## Results

Results from the fixed eight-seed batch are reported below after the reproducible
runner completes. Per-seed estimates and both interval bounds are retained; no
single seed, scalar score, or favorable endpoint is selectively substituted for
the paired comparison.

| Contrast / check | Estimate |
|---|---|
| Agentic versus current process, 84-day proxy | To be filled from the fixed batch output. |
| Agentic versus current process, 180-day proxy | To be filled from the fixed batch output. |
| Agentic versus conventional integration | Same pathway mechanism; report as a parity check. |
| Zero-adoption control | Expected null result; per-seed assertion required. |
| Commissioning failure | Per-seed lifecycle and failure-event assertion required. |
| Conventional cost counterexample | Constructed scenario result; not an economic estimate. |

## Interpretation and limitations

This is software evidence about one bounded, versioned pathway under transparent
synthetic inputs. It does not establish an intervention effect in real Dutch
healthcare, causal attribution, clinical validity, external validity, or a
cost-effective strategy. In particular:

- The R03 pathway does not independently model clinical appropriateness,
  calibrated disease probabilities, treatment recovery, or all R01 outcomes.
- The illustrative workload and event-time draws are not population estimates
  or evidence about actual Dutch referrals, waits, deterioration, or mortality.
- The runner does not model live agents, autonomous clinical decisions,
  cybersecurity incidents, a stochastic shared shock process, sex, or
  provenance-supported equity attributes beyond age bands.
- R04 provides a traceable ledger mechanism, not sourced prices, tariffs,
  subsidies, discounting, or a validated implementation-cost base. Therefore
  this batch cannot name an economic winner.
- Eight development seeds are not R01's confirmatory holdout. The R01 protocol
  calls for its frozen 100-seed design, a 20-seed execution/debug phase and an
  80-seed holdout; this runner's results must not be relabeled as that analysis.

Reproduce the batch without production writes:

```sh
node scripts/run_r05_comparison.mjs > /tmp/r05-exploratory-batch.json
```

The local R05 test command is `node --test tests/minister_r05.test.js`. The
repository-wide CI validation is tracked by the **Validate** check on the R05
pull request; cite its completed Actions run here before release.

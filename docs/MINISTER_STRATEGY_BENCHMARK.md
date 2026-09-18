# Minister strategy smoke benchmark

Generated: 2026-09-16
Model: `minister-care-3-paired`
Scenario: Cabinet Crisis
Seeds: 2468, 1357, 7777
Runner: [scripts/benchmark_minister_strategies.cjs](../scripts/benchmark_minister_strategies.cjs)
Raw results: [scripts/output/minister_strategy_benchmark.json](../scripts/output/minister_strategy_benchmark.json)

This is a three-seed smoke test, not a balance study. The runner always chooses the first mandatory dilemma/flash response and varies the purchase sequence. Outcomes therefore combine a fixed response policy with the named purchasing strategy. No result supports a real-world healthcare claim.

| Purchase strategy | Political outcomes | Mean score | Mean model-classified system deaths | Mean treatment starts | End mean wait | Mean budget |
|---|---:|---:|---:|---:|---:|---:|
| No purchases | 1 completed, 2 election losses | 342.7 | 4.7 | 16.7 | 1.8w | €354,667 |
| Staffing/support | 3 election losses | 292.0 | 4.7 | 13.3 | 10.5w | €53,167 |
| Fast digital | 2 election losses, 1 parliament removal | 181.7 | 4.3 | 14.0 | 7.0w | −€9,333 |
| Resilient mix | 1 completed, 2 election losses | 411.0 | 4.3 | 15.3 | 4.2w | €6,833 |
| Foundation/platform | 1 election loss, 1 parliament removal, 1 protest | 447.7 | 6.0 | 13.3 | 0.0w | €10,417 |

All requested purchases were reachable at least once. The fast-digital strategy could run a deficit. The zero end-wait in the foundation group is not automatically good: that group also had the highest mean deaths. Queue, treatment and death counts must remain adjacent in the UI.

## What this test found

1. **No dominant strategy is established.** Foundation scored highest while producing the worst mortality and no political completion. A single scalar score can obscure failure and should remain secondary.
2. **Political gates dominate Cabinet Crisis.** Twelve of fifteen runs ended politically before/at the final vote. The next larger run should separate care strategy from mandatory-response policy and inspect why active spending often reduces political viability.
3. **No purchases is competitive.** It completed one seed, had the most budget and most treatment starts on average. This can be a valid modeled result; do not add punishment solely to make purchasing win.
4. **Empty queues can mislead.** Foundation ended at zero mean waiting while also having six mean deaths. Reports must show deaths before treatment next to waiting.
5. **Three seeds are insufficient.** Do not tune prices/effects from this table. Run the planned versioned 100-seed matrix with holdout seeds after text/interaction stabilization.

## Runner policy

- Browser and application audio are muted.
- Each run uses the same scenario-specific external schedule for its seed.
- Mandatory decisions use the first available option. Laws are not enacted.
- Up to two affordable requested purchases are made per council; unavailable items are retried later through the ordered wishlist.
- Strategies: no purchase; staffing/support; fast digital; resilient mix; foundation/platform.
- Full ending is required. Partial runs fail the runner rather than entering the report.

## Next benchmark

Factor the experiment into purchase policy × dilemma-response policy, then use at least 20 development seeds and a separate holdout set before the final 100-seed report. Report distributions and paired care differences, not only means. Do not publish this smoke table as evidence that one strategy works.

## 20-seed development matrix — 2026-09-18

Raw results: [scripts/output/minister_strategy_matrix_20seeds.json](../scripts/output/minister_strategy_matrix_20seeds.json)

The runner now separates five purchase policies from four mandatory-response policies:

- Purchase: no action, staffing/support, rapid digital, resilient mix, foundation/platform.
- Response: first option control, trust protection, budget protection, care protection.

Twenty development seeds produced 400 completed Cabinet Crisis games. Each run used an isolated browser context and muted audio. Four bounded workers reduced runtime without sharing local storage or simulation state. This is development evidence, not a real-world healthcare result and not yet holdout validation.

### Purchase-policy marginals

| Purchase policy | Runs | Mean system deaths | Mean deaths waiting | Mean treatment starts | Mean final wait | Mean score | Mean budget |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rapid digital | 80 | 6.34 | 4.06 | 1.00 | 4.64w | 232.9 | €48K |
| No action | 80 | 6.58 | 4.14 | 1.01 | 6.20w | 271.7 | €387K |
| Foundation/platform | 80 | 6.58 | 3.99 | 0.86 | 4.94w | 434.0 | €13K |
| Resilient mix | 80 | 6.62 | 4.26 | 1.09 | 6.25w | 344.7 | €60K |
| Staffing/support | 80 | 6.69 | 4.34 | 1.00 | 5.90w | 294.3 | €61K |

### Paired differences from no action

Each purchase run is paired with no action at the same seed and response policy. Difference is purchase minus no action.

| Purchase policy | Pairs | Death difference | Deaths-waiting difference | Treatment difference | Wait difference | Budget difference | Deaths better / worse / equal |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rapid digital | 80 | −0.24 | −0.08 | −0.01 | −1.56w | −€339K | 35 / 25 / 20 |
| Foundation/platform | 80 | 0.00 | −0.15 | −0.15 | −1.26w | −€374K | 27 / 30 / 23 |
| Resilient mix | 80 | +0.05 | +0.12 | +0.08 | +0.05w | −€327K | 17 / 25 / 38 |
| Staffing/support | 80 | +0.11 | +0.20 | −0.01 | −0.30w | −€326K | 15 / 25 / 40 |

### Response-policy marginals

| Response policy | Runs | Mean system deaths | Mean deaths waiting | Mean treatment starts | Mean final wait | Mean score | Mean budget |
|---|---:|---:|---:|---:|---:|---:|---:|
| Budget protection | 100 | 6.43 | 4.00 | 0.95 | 5.46w | 302.8 | €156K |
| Care protection | 100 | 6.50 | 4.16 | 1.01 | 5.91w | 326.6 | €95K |
| Trust protection | 100 | 6.54 | 4.14 | 0.94 | 5.53w | 338.8 | €101K |
| First option | 100 | 6.77 | 4.33 | 1.07 | 5.43w | 293.8 | €104K |

### Findings

1. No purchase policy dominates care, workload and cost. The observed mortality range is narrow and pairwise directions vary across seeds.
2. Rapid digital has the lowest mean mortality and wait, but spends about €339K more than paired no action and has worse mortality in 25 of 80 pairs. This does not support a general mortality claim.
3. Foundation/platform has the highest scalar score while producing no mean mortality improvement, fewer treatment starts and the largest paired spending. Score remains a poor primary outcome.
4. Response policy materially changes results. Always choosing the first option is worst on mortality; budget protection is lowest in this development set. Holdout validation is required.
5. Political balance is the main defect signal: none of 400 runs passed the Cabinet Crisis final vote. Parliament trust was below 40 in 400/400 runs (observed maximum: 39), citizen trust was below 40 in 337/400, and the death cap was exceeded in 367/400. Most runs ended before the final vote through no-confidence or protest; the remainder failed the election. Do not tune this away blindly: diagnostic output now records exact decision logs, cascade stages and election failure reasons.

### Next validation

- Diagnose the final-vote target failures by criterion and quarter.
- Confirm at least one documented, non-cheating policy path can pass Cabinet Crisis.
- Run a separate holdout seed set after any justified correction.
- Keep the current care-first leaderboard ordering; do not promote scalar score.

## Versioned Cabinet Crisis correction — 2026-09-18

Model: `minister-care-4-political`
Raw results: [scripts/output/minister_strategy_matrix_political_20seeds.json](../scripts/output/minister_strategy_matrix_political_20seeds.json)
Summary: [scripts/output/minister_strategy_matrix_political_20seeds_summary.json](../scripts/output/minister_strategy_matrix_political_20seeds_summary.json)

The first matrix showed that parliament trust was below 40 in 400/400 runs and never exceeded 39. Cabinet Crisis was difficult in a way that eliminated the advertised possibility of re-election for all declared automated policies.

The smallest explicit political correction was applied only to Cabinet Crisis:

- final trust floor: 40 → 35 for citizens, doctors and parliament;
- system-death cap: 4 → 5;
- stage-3 cascade rule unchanged;
- Full Term election rules unchanged;
- clinical progression, care capacity and paired reference unchanged.

The identical 20-seed, 400-run matrix then produced 11 narrow re-elections (2.75%) across five seeds. Successful runs appeared in every purchase family, including no action, and across multiple response policies. No run earned a strong mandate. Re-election is therefore possible but remains rare; the correction did not create one mandatory purchase route.

This is development calibration, not holdout validation. Freeze this political rule and test it on unseen seeds before claiming a stable win rate.

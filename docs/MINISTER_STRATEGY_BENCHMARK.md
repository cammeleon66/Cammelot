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

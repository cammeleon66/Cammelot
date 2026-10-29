# Minister balance diagnosis (B01)

Issue: #52. Improvement plan step 1 in `docs/MINISTER_RELEASE_STATUS.md`.
This is a diagnosis only. No model rule, parameter or `MODEL_VERSION` changed.

## Method

- Model `minister-care-10-access-time-replay`, benchmark `scripts/benchmark_minister_strategies.cjs`
  (B01 version: separate purchase, response and governance policy axes, deferred purchases retried,
  trust/budget ledger with reconciliation).
- 20 development seeds (1001-1020) x 2 scenarios x 36 policy combinations
  (3 purchase x 3 response x 4 governance) = 1,440 strategy runs, plus 40 same-seed no-action references.
  Balanced repeats are excluded from the counts.
- Run sharded per scenario and seed in `.github/workflows/minister-balance-matrix.yml`
  (Actions run 40839267489, 42/42 jobs succeeded) and aggregated with
  `scripts/summarize_minister_balance.cjs`. Aggregate: `docs/evidence/minister_balance_b01_development_summary.json`.
- Seeds 1001-1020 are development seeds. The B05 holdout must use a disjoint seed set.
- A "win" is a completed term (`endReason = served`). Gate failures are evaluated against the
  final-vote criteria (trust floor 35 for citizens, doctors and parliament; at most 5 model system deaths;
  fewer than 3 stage-3 cascades; promises kept). For terms ending early they are an ending-state projection.

## Findings

1. **Cabinet Crisis is almost unwinnable: 21/720 (2.9%).** This matches the earlier 11/400 (2.75%).
   No-action wins 0/20.
2. **The death cap is the binding rule in Cabinet Crisis.** `model-system-deaths` fails in 94.2% of runs
   and is the *only* failing gate in 89 runs (12.4%). Mean model system deaths are 7.41 against a cap of 5.
   Specialist treatments average 0.74 per run and are zero in 339/720 runs (47%): patients die waiting
   for a downstream specialist slot that no strategy can create. This agrees with R05, where
   `treatmentStartsPerTick = 1` binds every arm. The cap therefore measures model structure, not play.
3. **Year 10 is reachable, but rarely: 98/720 (13.6%) Full Term runs complete the term.** This revises L07
   ("no strategy reaches Year 10"); the difference comes from the B01 policy separation and purchase retries,
   not from a model change. Full Term failures are mainly political: parliament support fails in 73.6% of runs
   (the only failing gate in 68), citizen trust in 68.9%.
4. **Player levers move the wrong constituency.** Doctor trust almost never fails a gate (1.1% / 0.1%), yet
   purchases and responses add most of their trust to doctors (Cabinet Crisis: +15.6 purchase, +9.4 response
   per run). Parliament, which fails most often, receives about +10 per run from all player levers
   (response 5.8, laws 3.7, purchases 0.5) against -26.6 from simulation-driven drain. Citizens lose 31.7 per run
   to the simulation and regain about 10.8 from levers.
5. **Strategy coherence is rewarded, but from too low a base.** `no-laws` never wins Cabinet Crisis (0/180) and is
   the weakest in Full Term; `resilience-first` and `parliament-first` governance and `care-first` responses
   roughly double win rates. The best single strategy wins 3/20 (Cabinet Crisis) and 6/20 (Full Term).
6. **Telemetry is complete.** The trust and budget ledger reconciles with the final state in all 1,440 runs
   (0 mismatches), and every run records ending tick, end reason and per-gate pass/fail.

## Implications for B03 (#54)

- Make the death gate respond to play: either give the minister a lever on downstream specialist throughput,
  or express the cap relative to the same-seed no-action reference instead of an absolute 5.
- Rebalance the political economy at its source: player actions should be able to offset simulation-driven
  citizen and parliament drain, rather than mostly lifting doctor trust.
- Keep `no-laws` and incoherent strategies losing; the target is 20-40% wins for coherent strategies,
  with Year 10 reachable.
- Any of these changes is outcome-changing and requires a `MODEL_VERSION` bump.

## Results

### Cabinet Crisis (`cabinetcrisis`, 416 ticks)

Seeds: 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020; 720 strategy runs (repeats excluded).

| Measure | Value |
|---|---|
| Wins | 21 (2.9%) |
| Completed declared horizon | 524 (72.8%) |
| Final vote held | 524 (72.8%) |
| No-action reference wins | 0/20 |
| Ending tick min/median/max | 156 / 416 / 416 |
| Mean model system deaths | 7.41 |
| Mean specialist treatments | 0.74 (zero in 339 runs) |
| Ledger reconciliation mismatches | 0 |

| End reason | Runs |
|---|---|
| election | 503 (69.9%) |
| protest | 102 (14.2%) |
| noconfidence | 94 (13.1%) |
| served | 21 (2.9%) |

| Failed final-vote gate | Runs failing | Only failing gate |
|---|---|---|
| model-system-deaths | 678 (94.2%) | 89 |
| citizen-trust | 526 (73.1%) | 6 |
| parliament-support | 497 (69.0%) | 6 |
| doctor-trust | 8 (1.1%) | 0 |

| Trust loss source (mean points per run) |  |
|---|---|
| simulation:citizens | 31.74 |
| simulation:parliament | 26.56 |
| simulation:doctors | 18.35 |
| event:parliament | 4.08 |
| response:citizens | 2.34 |
| response:doctors | 1.87 |
| event:citizens | 1.35 |
| event:doctors | 1.35 |

| purchasePolicy | Wins / runs |
|---|---|
| balanced | 5/240 (2.1%) |
| capacity-first | 7/240 (2.9%) |
| structural | 9/240 (3.8%) |

| responsePolicy | Wins / runs |
|---|---|
| trust-first | 6/240 (2.5%) |
| budget-first | 6/240 (2.5%) |
| care-first | 9/240 (3.8%) |

| governancePolicy | Wins / runs |
|---|---|
| no-laws | 0/180 (0.0%) |
| parliament-first | 6/180 (3.3%) |
| care-bottleneck | 4/180 (2.2%) |
| resilience-first | 11/180 (6.1%) |

| Top strategies | Wins / runs | Completed horizon |
|---|---|---|
| balanced/care-first/resilience-first | 3/20 | 16/20 |
| balanced/budget-first/resilience-first | 1/20 | 16/20 |
| balanced/trust-first/resilience-first | 1/20 | 16/20 |
| capacity-first/budget-first/parliament-first | 1/20 | 14/20 |
| capacity-first/budget-first/resilience-first | 1/20 | 18/20 |

### Full Term (`campaign`, 2080 ticks, Year 10)

Seeds: 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020; 720 strategy runs (repeats excluded).

| Measure | Value |
|---|---|
| Wins | 98 (13.6%) |
| Completed declared horizon | 98 (13.6%) |
| Final vote held | 566 (78.6%) |
| No-action reference wins | 0/20 |
| Ending tick min/median/max | 312 / 988 / 2080 |
| Mean model system deaths | 10.03 |
| Mean specialist treatments | 2.16 (zero in 163 runs) |
| Ledger reconciliation mismatches | 0 |

| End reason | Runs |
|---|---|
| election | 454 (63.1%) |
| noconfidence | 115 (16.0%) |
| protest | 50 (6.9%) |
| served | 98 (13.6%) |
| scandal | 3 (0.4%) |

| Failed final-vote gate | Runs failing | Only failing gate |
|---|---|---|
| parliament-support | 530 (73.6%) | 68 |
| citizen-trust | 496 (68.9%) | 33 |
| model-system-deaths | 485 (67.4%) | 19 |
| promises-kept | 97 (13.5%) | 20 |
| stage-3-cascade | 25 (3.5%) | 0 |
| doctor-trust | 1 (0.1%) | 0 |

| Trust loss source (mean points per run) |  |
|---|---|
| simulation:citizens | 45.6 |
| simulation:parliament | 37.76 |
| simulation:doctors | 25.39 |
| event:parliament | 10.44 |
| response:citizens | 6.39 |
| response:doctors | 5.7 |
| event:doctors | 4.64 |
| event:citizens | 4.61 |

| purchasePolicy | Wins / runs |
|---|---|
| balanced | 21/240 (8.8%) |
| capacity-first | 38/240 (15.8%) |
| structural | 39/240 (16.3%) |

| responsePolicy | Wins / runs |
|---|---|
| trust-first | 26/240 (10.8%) |
| budget-first | 26/240 (10.8%) |
| care-first | 46/240 (19.2%) |

| governancePolicy | Wins / runs |
|---|---|
| no-laws | 16/180 (8.9%) |
| parliament-first | 40/180 (22.2%) |
| care-bottleneck | 6/180 (3.3%) |
| resilience-first | 36/180 (20.0%) |

| Top strategies | Wins / runs | Completed horizon |
|---|---|---|
| capacity-first/budget-first/parliament-first | 6/20 | 6/20 |
| capacity-first/care-first/resilience-first | 6/20 | 6/20 |
| capacity-first/trust-first/parliament-first | 6/20 | 6/20 |
| structural/care-first/care-bottleneck | 6/20 | 6/20 |
| structural/care-first/resilience-first | 6/20 | 6/20 |

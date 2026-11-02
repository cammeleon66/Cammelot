# Minister balance holdout validation (B05)

## Predeclared protocol

The holdout protocol was frozen before any holdout results were generated.
The tested executable is `minister-care-11-political-trust-balance`, paired
with `no-discretionary-action-v1`. The executable is the current B03 model
with no holdout-driven changes.

- Runner: `scripts/benchmark_minister_strategies.cjs`
- `site/minister.html` SHA-256: `5228567fb1abc382bc9bef2b1f7fd1e230193cf48b13a117bc629e2b06fdb210`
- Runner SHA-256: `c1e7fbbf1596601f51e6a55ff8e8fd386978724876c90aecfe9b8c2ecc34f6b7`
- Holdout seeds: 3001–3020, inclusive. These are disjoint from the B03
  development seeds 1001–1020 and the earlier three-seed strategy sample
  (2468, 1357, 7777).
- Scenarios: Cabinet Crisis (`cabinetcrisis`, 416 ticks) and The Full Term
  (`campaign`, 2,080 ticks).
- Strategy matrix: the runner's complete B03 matrix, all 36 combinations of
  purchase policy (`balanced`, `capacity-first`, `structural`), response policy
  (`trust-first`, `budget-first`, `care-first`), and governance policy
  (`no-laws`, `parliament-first`, `care-bottleneck`, `resilience-first`).
- Named strategy families: `balanced`, `technology-first`, `capacity-first`,
  `structural`, and `adversarial`, using the corresponding runner aliases and
  `resilience-first` governance. These five presets supplement the complete
  matrix so the documented technology-first and adversarial families are
  included even though they are not defaults in its policy axes. The
  capacity-first preset duplicates one matrix cell and is excluded from
  primary counts. The no-laws control is represented across all 9 combinations
  of the matrix's purchase and response policies.
- The runner's balanced/resilience-first replay repeat is retained as a
  reproducibility check and excluded from primary win-rate denominators.
- Each seed/scenario pair has a full-horizon no-discretionary-action reference.
  Care comparisons use only the no-action snapshot at the player's ending tick.
- A win is `endReason = served`. Final-vote criteria use the game's recorded
  final vote when held and an explicitly labelled ending-state projection when
  a run ends before the vote. Win-rate intervals are two-sided 95% Wilson
  intervals over the 20 holdout seeds.
- The 20–40% development target is evaluated descriptively against the point
  win rate of each named coherent family (`balanced`, `technology-first`,
  `capacity-first`, and `structural`) in each scenario. The adversarial family
  and no-laws governance control are reported, not required to meet that
  target. Year 10 is considered reachable if at least one coherent Full Term
  run reaches `served` at tick 2,080.
- No model parameters, strategy rules, clinical coefficients, or paired
  reference behavior will be changed in response to these results.

The family and target clarifications were made after checking the runner's
available policies but before reviewing any holdout outcomes. They do not
change the seed list or the frozen model.

The holdout is a predeclared reproducibility sample, not a random sample from
real-world outcomes or a clinical validation. The complete results and
summaries are appended below.

## Results

Run on 2026-11-02 in `.github/workflows/minister-balance-matrix.yml` (Actions run 41426924958, 42/42 jobs succeeded),
source revision `59c6fec`. The executed `site/minister.html` (SHA-256 `5228567f...db210`) and runner
(SHA-256 `c1e7fbbf...4f6b7`) match the frozen fingerprints above, with model `minister-care-11-political-trust-balance`.
Nothing was retuned. Aggregates: `docs/evidence/minister_balance_b05_holdout_summary.json` (matrix) and
`docs/evidence/minister_balance_b05_holdout_families_summary.json` (named families).

Paired differences are player minus the same-seed no-action reference at the player's ending tick
(positive deaths = worse; positive treatments = more starts). Ending ticks: Cabinet Crisis horizon 416, Full Term 2,080.
In Full Term, a win is a served Year 10 term, so every win reaches tick 2,080.

### Cabinet Crisis

| Strategy | Wins | 95% Wilson | Seeds won | Ending tick median [range] | Paired deaths median [range] | Paired treatments median [range] |
|---|---:|---:|---:|---|---|---|
| balanced | 6/20 (30.0%) | 14.5-51.9% | 6/20 | 416 [416, 416] | 0 [-2, 1] | 0 [-2, 2] |
| technology-first | 7/20 (35.0%) | 18.1-56.7% | 7/20 | 416 [364, 416] | 0 [-3, 3] | 0 [-2, 3] |
| capacity-first | 7/20 (35.0%) | 18.1-56.7% | 7/20 | 416 [416, 416] | 0 [-2, 2] | 0 [-3, 1] |
| structural | 7/20 (35.0%) | 18.1-56.7% | 7/20 | 416 [416, 416] | 0 [-2, 2] | 0 [-2, 1] |
| adversarial (control) | 6/20 (30.0%) | 14.5-51.9% | 6/20 | 416 [416, 416] | 0 [-2, 1] | 0 [-2, 1] |
| 36-policy matrix, law-enacting (27 policies) | 151/540 (28.0%) | 24.3-31.9% | 11/20 | 416 [312, 416] | 0 [-3, 3] | 0 [-3, 3] |
| 36-policy matrix, no-laws control (9 policies) | 19/180 (10.6%) | 6.9-15.9% | 8/20 | 416 [312, 416] | 0 [-2, 2] | 0 [-2, 2] |

Matrix (720 runs): end reasons election 525, served 170, noconfidence 20, protest 5. Failed final-vote gates: model-system-deaths 490 (68.1%), parliament-support 222 (30.8%), citizen-trust 141 (19.6%), doctor-trust 5 (0.7%). Only failing gate: parliament-support 48, model-system-deaths 260, citizen-trust 4. Mean model system deaths 7.11. No-action reference wins 0/20. Ledger mismatches 0.

### The Full Term

| Strategy | Wins | 95% Wilson | Seeds won | Ending tick median [range] | Paired deaths median [range] | Paired treatments median [range] |
|---|---:|---:|---:|---|---|---|
| balanced | 11/20 (55.0%) | 34.2-74.2% | 11/20 | 2080 [572, 2080] | 0 [-4, 3] | 0 [-7, 5] |
| technology-first | 9/20 (45.0%) | 25.8-65.8% | 9/20 | 988 [676, 2080] | 0 [-5, 3] | 0 [-4, 7] |
| capacity-first | 7/20 (35.0%) | 18.1-56.7% | 7/20 | 988 [676, 2080] | 1 [-3, 3] | 0 [-6, 2] |
| structural | 5/20 (25.0%) | 11.2-46.9% | 5/20 | 988 [728, 2080] | 0 [-5, 3] | 0 [-7, 6] |
| adversarial (control) | 2/20 (10.0%) | 2.8-30.1% | 2/20 | 988 [780, 2080] | 0 [-2, 4] | 0 [-4, 6] |
| 36-policy matrix, law-enacting (27 policies) | 145/540 (26.9%) | 23.3-30.7% | 14/20 | 988 [572, 2080] | 0 [-5, 7] | 0 [-7, 7] |
| 36-policy matrix, no-laws control (9 policies) | 47/180 (26.1%) | 20.2-33.0% | 10/20 | 988 [572, 2080] | 0 [-4, 4] | 0 [-5, 6] |

Matrix (720 runs): end reasons election 445, served 192, scandal 79, noconfidence 4. Failed final-vote gates: model-system-deaths 451 (62.6%), citizen-trust 183 (25.4%), promises-kept 161 (22.4%), parliament-support 160 (22.2%), stage-3-cascade 17 (2.4%), doctor-trust 2 (0.3%). Only failing gate: model-system-deaths 212, citizen-trust 30, promises-kept 69, parliament-support 27, stage-3-cascade 1. Mean model system deaths 10.60. No-action reference wins 0/20. Ledger mismatches 0.

## Assessment against the predeclared target

| Criterion | Result |
|---|---|
| Coherent families 20-40% (Cabinet Crisis) | **Met:** 30-35% for all four coherent families. |
| Coherent families 20-40% (Full Term) | **Partly met:** capacity-first 35%, structural 25%; technology-first 45% and balanced 55% are above the range. |
| Year 10 reachable | **Met:** 192/720 matrix runs and every coherent family served a Year 10 term. |
| No-action never wins | **Met:** 0/40 references. |
| Ledger reconciles | **Met:** 0 mismatches in 1,640 runs. |

### Misses and caveats (not retuned)

1. **Cabinet Crisis outcomes are mostly decided by the seed, not by play.** 9/20 holdout seeds are lost by all 36
   matrix policies; their no-action references already record 7-13 model system deaths against a cap of 5, and player
   strategies move deaths by about -3 to +3 (paired median 0). On winnable seeds, most strategies win.
2. **The adversarial control wins as often as coherent play in Cabinet Crisis** (6/20 vs 6-7/20). B03 relaxed the trust
   cost of deaths but left nothing that rewards coherent play in the 2-year scenario. In Full Term the control falls
   to 2/20 (10%), so coherence still matters there.
3. **Laws matter in Cabinet Crisis** (law-enacting 28.0% vs no-laws 10.6%), but not in Full Term (26.9% vs 26.1%).
4. **The model-system-deaths gate is still the most frequent failure** (68% Cabinet Crisis, 63% Full Term) and the only
   failing gate in 260 and 212 runs. B03 deliberately kept the cap and care rules unchanged.
5. **Full Term now ends by scandal in 79 runs (11%),** up from 3 in the B01 development matrix (model 10); this was
   not predicted and should be explained before release.

### Proposed follow-up

Make the death outcome responsive to play rather than to the seed: either give the minister a lever on downstream
specialist throughput, or express the death gate relative to the same-seed no-action reference (for example, no more
deaths than the no-action path) instead of an absolute cap. Then require that the adversarial control loses clearly in
both scenarios and that no holdout seed is unwinnable by every coherent family. That is an outcome-changing rule and
needs a new model version and a new holdout seed set (not 3001-3020).

Human release gates (owner review, wording, public announcement) remain open.

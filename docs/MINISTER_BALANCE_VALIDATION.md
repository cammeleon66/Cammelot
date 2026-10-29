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
- No model parameters, strategy rules, clinical coefficients, or paired
  reference behavior will be changed in response to these results.

The family clarification was made after checking the runner's available
policies but before reviewing any holdout outcomes. It does not change the
seed list or the frozen model.

The holdout is a predeclared reproducibility sample, not a random sample from
real-world outcomes or a clinical validation. The complete results and
summaries will be appended after the run.

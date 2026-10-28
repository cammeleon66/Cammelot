# Minister strategy validation — 2026-10-28

This bounded browser experiment records behavior of the current Minister executable. It is not a clinical validation, calibration study, holdout study, or estimate of win probability.

## Reproducibility

- Model: `minister-care-10-access-time-replay`
- Reference protocol: `no-discretionary-action-v1`
- Inline executable SHA-256: `6d8da15da7c3f21b23882542f1f5739012246df26e2687087f2153a2bf2cb588`
- `site/minister.html` SHA-256: `78080d5fbf7308be8beeb51ef8903c81179df4f5b8b673d8b71ce00133e2009b`
- Source revision when captured: `897a7fdef3498f98abdf987dcccc8fab873221f1`
- Seeds: `2468`, `1357`, `7777`
- Scenarios: Cabinet Crisis (416 ticks) and The Full Term (2,080 ticks)
- Runs: 30 initial strategy runs, six repeated balanced runs, and six full-horizon no-action references.

Re-run from the repository root with:

```bash
node scripts/benchmark_minister_strategies.cjs \
  --seeds 2468,1357,7777 \
  --scenarios cabinetcrisis,campaign \
  --policies balanced,technology-first,capacity-first,structural,adversarial \
  --concurrency 3 \
  --output scripts/output/minister_strategy_validation_2026-10-28.json
```

The script serves `site/` on loopback only. It blocks every non-GET/HEAD request before network access and stubs external reads. The captured run contained 31 local `/api/leaderboard` POST attempts, all aborted by Playwright routing; the static server also accepts only GET/HEAD. No production URL or production leaderboard was contacted.

Each player run retains its seed, model/protocol/schedule identity, ending tick and reason, final ending label, actual decisions, enacted law IDs/quarters, interventions, selected promises and their outcomes, skipped purchase attempts, policy fallbacks, care snapshot, and exact-tick comparison with the no-action reference. The Full Term promises and Year 5 election use the player-facing UI. The six no-action references completed their full declared horizons.

## Observed outcomes

These are labels from the declared runs, not generalized rates or rankings. Each cell represents the three listed seeds.

| Policy | Cabinet Crisis | The Full Term |
|---|---|---|
| Balanced | Lost election ×3 | Lost election ×2; public protest ×1 |
| Technology-first | Lost election ×2; public protest ×1 | Public protest ×2; removed by parliament ×1 |
| Capacity-first | Lost election ×3 | Lost election ×3 |
| Structural | Lost election ×3 | Lost election ×3 |
| Adversarial | Public protest ×3 | Public protest ×3 |

Cabinet Crisis ended at tick 416 for the 11 election failures and tick 312 for the four protest endings. None of the sampled cabinet votes passed. For example, balanced seed 2468 ended at tick 416 with six model-classified system deaths against the game's cap of five.

All 15 initial Full Term player runs ended before the 2,080-tick horizon (ticks 312–988); the three repeated balanced runs also ended early. Eight initial runs reached the Year 5 election at tick 988 and lost; the other seven ended earlier in protest or a parliamentary no-confidence outcome. No discretionary run reached the Year 10 `served` ending, so full-term player exposure through year 10 remains unverified. At the Year 5 election, balanced seed 2468 kept its waits and doctor-trust promises but missed its fewer-than-three-deaths promise, recording 11 model-classified system deaths; its election also failed the citizen/parliament trust and death gates.

Every strategy run had a reference snapshot at its exact ending tick. For all six seed/scenario pairs, the balanced repeat was launched through the actual “Try another approach” control; its ending, score, care snapshot, laws, interventions, decisions, and purchase trace matched the first run, and the previous-attempt comparison reported zero differences in deaths, treatment starts, waiting count, and mean wait at that tick. This demonstrates repeatability for these runs only.

The full machine-readable trace is [`scripts/output/minister_strategy_validation_2026-10-28.json`](../scripts/output/minister_strategy_validation_2026-10-28.json). It includes negative outcomes, law and purchase traces, unavailable/deferred purchases, fallbacks, election reasons, all reference samples, and the matched comparisons.

## Release checks and limitations

- Focused regression: `node --test tests/minister_strategy_benchmark.test.js` passed 1/1. The full `npm test` suite was **NOT RUN** under the time constraint for this task.
- Physical-device checks: **NOT PERFORMED**. No physical Android Chrome or iPhone Safari checks were conducted.
- Human checks: **NOT PERFORMED**. No uncoached playtests or healthcare-domain review were conducted. These remain release limitations; automated browser tests do not substitute for them.
- Unresolved evidence risks: the sample contains three predeclared seeds, the strategies use fixed UI-text heuristics, and there is no random-seed or holdout study. No sampled discretionary Full Term run reached year 10. Several policies ended in failed votes, protest, or no-confidence, and these adverse outcomes are retained.
- No clinical validity, causal effect, or universal strategy advantage is established by software tests or these simulation runs.

No simulation rules or `site/minister.html` content were changed for this evidence capture; the model version remains unchanged.

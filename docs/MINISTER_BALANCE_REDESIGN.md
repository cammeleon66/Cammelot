# Minister political-balance redesign (B03)

**Status:** Implemented in the working B03 branch; not a verified public release.
The branch uses `minister-care-11-political-trust-balance`. This is an authored
game-rule change, not a clinical calibration or claim that mortality is reduced.

## Evidence and problem

B01's development matrix covered seeds 1001–1020, both public scenarios and 36
purchase/response/governance combinations per seed. The source ledger is
[`minister_balance_b01_development_summary.json`](evidence/minister_balance_b01_development_summary.json);
the methodology and full aggregate tables are in
[`MINISTER_BALANCE_DIAGNOSIS.md`](MINISTER_BALANCE_DIAGNOSIS.md).

The relevant ledger evidence was:

| B01 observation | Cabinet Crisis | Full Term |
|---|---:|---:|
| Win rate | 21/720 (2.9%) | 98/720 (13.6%) |
| Trust loss attributed to simulation: citizens, mean points/run | 31.74 | 45.60 |
| Trust loss attributed to simulation: parliament, mean points/run | 26.56 | 37.76 |
| Trust loss attributed to simulation: doctors, mean points/run | 18.35 | 25.39 |
| Player purchase gains to doctors, mean points/run | 15.57 | 24.09 |
| Player purchase gains to parliament, mean points/run | 0.53 | 0.84 |
| Player response gains to doctors, mean points/run | 9.35 | 17.75 |
| Player response gains to parliament, mean points/run | 5.77 | 10.90 |

Cabinet Crisis failed the model-system-deaths gate in 678/720 runs (94.2%); in
89 runs it was the only failed gate. Full Term failed parliament support in
530/720 runs (73.6%) and citizen trust in 496/720 (68.9%). The ledger is useful
for diagnosing the rules as implemented: it does not establish a real-world
relationship between deaths and political support. The mismatch is that model
classified deaths already face an independent final-vote cap, while each death
also imposed large additional citizen and parliament penalties. Meanwhile,
player-purchase trust gains accrued mostly to doctors, whose trust gate almost
never failed.

## Implemented rule

The quarterly political response to newly recorded model-system deaths is now:

| Stakeholder | Previous delta per new death | B03 delta per new death |
|---|---:|---:|
| Citizens | -4 | -2 |
| Doctors | -1 | -1 |
| Parliament | -2 | -1 |

The existing no-new-death quarterly change (+1 to each group), doctor workload
bands, event and cascade effects, player-action effects, trust end conditions,
and trust synchronization are unchanged. Citizens still receive the largest
death-related trust penalty. The revised response remains proportional to
observed within-run deaths; it is not a flat trust bonus.

The final-vote trust floors (35 in Cabinet Crisis, 45 in Full Term), death caps
(5 and 8), cascade gate, promise gate, end conditions, care rules, and 12-week
authored model threshold are unchanged. No mortality, deterioration, capacity,
resource, schedule, RNG, or paired-reference rule was changed. The rule only
changes the political response applied in the player council; the no-action
reference still follows its existing no-discretionary-action path.

This is deliberately narrower than changing the death cap, creating specialist
throughput, or rewarding a player for a score proxy. Those changes would violate
the B03 clinical/paired-reference scope and would not address the ledger's
duplicated political consequence. The numerical coefficients remain explicit
game assumptions and are not derived from external clinical evidence.

## Identity and compatibility

The new immutable model identity is
`minister-care-11-political-trust-balance`. Model 10 records are not compatible
with this outcome-affecting rule. Leaderboard reads remain filtered to the
current model identity, so model-10 entries remain historical and are not
ranked alongside model 11. Replay records must match both model version and
executable identity; model-10 replays are refused rather than migrated or
reinterpreted. The paired-reference protocol remains
`no-discretionary-action-v1`; its matching policy is unchanged.

The version change is local to the inline Minister executable. The shared
`site/minister-model-core.js` did not change, so its SRI value does not need
recomputation.

## Validation

Validation uses only development seeds 1001–1020; no holdout seeds are used.
The matrix is intentionally a selected set of coherent families plus an
adversarial/no-law control, not the full B01 matrix. Win-rate intervals are
Wilson 95% intervals over the 20 seed runs in each scenario/family. Paired care
differences are player minus the same-seed, same-scenario no-action reference at
the player's ending tick; positive deaths/waits mean a worse player value, and
positive treatments mean more starts. Early-ending gate evaluations are
projections, not a final vote. The browser benchmark drives the actual Minister
UI and blocks production writes.

Results, including ending ticks, failed gates, paired care differences,
no-action checks, and any Year 10 served run, will be recorded here after the
selected runs complete. B02's preview-equals-applied-effect regression remains
required.

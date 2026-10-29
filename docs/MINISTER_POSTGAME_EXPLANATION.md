# Minister post-game explanation (B04)

Issue: [#55](https://github.com/cammeleon66/Cammelot/issues/55). Presentation only: no mortality, deterioration,
care capacity, score, paired no-action reference or leaderboard payload changed, and `MoC.MODEL_VERSION`
(`minister-care-11-political-trust-balance`) is unchanged. These are authored game rules and software checks, not
clinical evidence. The L01 wording (“model system deaths”) is retained.

## What the end screen now shows

A section directly under the political outcome explains the ending from the **final state**
(the `GS._finalSnapshot` tick; the section carries `data-tick`).

| Part | Source |
|---|---|
| Deciding gates, `actual / required needed`, MET / NOT MET | Final trust scores, model system deaths, government cash, crisis-escalation stage, promises and the live `evaluateElection()` gates |
| Top 3 contributors to the failed metric | Trust: an in-game trust ledger (below). Cash: the existing treasury ledger. Deaths: model system deaths per model year. Promises, cascade and household gates list the unmet items |
| Care outcome vs same-seed no-action reference | `MoC.care.compare` against `MoC.referenceAt(finalTick)`; shows “pending or unavailable. No benefit claimed” until a matched reference exists, then refreshes with the existing late-reference path |
| One “what you could try” hint | One sentence chosen from the largest recorded contributor (or the closest margin after a win). It states a same-seed replay could test a different choice; it makes no claim that the change would help |

Gates by ending:

| Ending | Deciding gates (final-state value vs requirement) |
|---|---|
| `noconfidence` | Parliament trust > 15, or the confidence-vote line (trust > 22) when the vote was lost |
| `protest` | Citizen trust > 15, or household departures < 4 |
| `strike` | Doctor trust > 15, or ≥ 22 while a strike is unresolved |
| `scandal` | Model system deaths < 15 |
| `bankrupt` | Government cash ≥ −€150K |
| `election` | Final-vote gates: promises kept (Full Term), each trust ≥ floor (45 Full Term, 35 Cabinet Crisis), model system deaths ≤ cap, crisis escalation below stage 3 |
| `served` | Win conditions: Cabinet Crisis strong-mandate tier (trust ≥ 60, zero model system deaths); Full Term mid-term result strong (recorded earlier, labelled with its tick) and score ≥ 400; other scenarios score ≥ 400. All met → “Why you won”; otherwise “Why this was not a win” |

Term limits not in question are listed under “Other limits at the end of the term”. Every gate row carries
`data-gate`, `data-actual`, `data-required` and `data-op`, which the tests compare with the live state.

## Trust ledger

`adjustStakeholders` records each applied (post-clamp) change per stakeholder with a cause label (policy/law/decision label,
quarterly model-system-death response, workload, resident request, confidence vote, election). It is the in-game counterpart
of the B01 benchmark ledger (`scripts/benchmark_minister_strategies.cjs`), which instruments the same fields from outside
the page. It never writes a score. If a score is set directly (debug/test paths), the gap is shown as
“Direct state change outside the ledger” so the reconciliation line (`opening + recorded changes = final`) stays true.

## Verification

`tests/minister_b04_endings.test.js` covers no-confidence, protest (trust and household departures), strike, scandal,
budget, Cabinet Crisis and Full Term lost votes, Cabinet Crisis won/served, Full Term and Sprint served, the paired
reference present and pending, the unchanged leaderboard payload keys (mocked, no live service), ledger reconciliation
and no-overflow layouts at 1024, 768, 480 and 375 px. Screenshots: `docs/screenshots/b04-*.png`.

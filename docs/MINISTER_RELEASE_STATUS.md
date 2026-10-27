# Minister of Cammelot — release status

Updated: 2026-10-27
Public game: https://cammelot.org/minister.html
Verified public model: `minister-care-9-workforce-productivity` (publication evidence below)
Reference protocol: `no-discretionary-action-v1`

This is the canonical status list. Older plans describe how the current release was built; their unchecked boxes are not active tasks.

## Model 9: workforce/productivity (F05)

## Upcoming model 10 foundation fixes — UNRELEASED

Implementation branch `fix/foundation-time-and-replay`, base
`86d53e02ed5dc4bb5c8a2c26782a5008f831923d`; single writer in the isolated Windows
worktree. No publication, backend, settings or leaderboard writes.

F06 baseline command: `node --test --test-name-pattern='F06' tests/minister_browser.test.js`.
Before runtime changes the real council callback failed **10 !== 4**: six weeks
were invented in the resident field, absent from authoritative elapsed time.
The episode now carries an idempotent future hold; see the model contract for
no-referral and mitigation rules. Targeted `F06|F04` run: **10/10 passed**
(17.29s), including expiry at 24 ticks, treatment completion, emergency eligibility,
duplicate synchronization/dispatch, absent referral and all exit classifications.
Existing finite-resource regressions pass. Model identity is
`minister-care-10-access-time-replay`; reference protocol unchanged.
F07/F08 implementation and full-suite evidence follow before handoff.

## Model 9 implementation and publication (historical)

Issue [#5](https://github.com/cammeleon66/Cammelot/issues/5) is implemented and published as `minister-care-9-workforce-productivity`, based on `ba0c19ba4d6ca06618961327f742e677b44b0322`. **Model 9 is the verified public model.** The coordinator reviewed and published it through the existing gated workflow; no workflows, settings, backend or production leaderboard state were changed. Publication evidence is recorded separately below.

### Mechanism and scope

Aggregate absence and AI productivity were disconnected from GP service on the current base, not merely hidden by hospital bottlenecks. Named GP sick-leave timers instead came from burnout. Model 9 consumes the existing 3–5-unit consultation workload at:

`min(on-duty GPs, total GPs × (1 - absence)) / on-duty GPs × (1 - admin) × AI`

per present GP per tick (zero when none are present). Aggregate absence is a minimum unavailable fraction, with named absences counted toward it, not charged again. The old random admin admission gate is removed; admin reduces clinical work once and still affects the existing overdue-wait drain once. Recruitment retains the nominal routine-rate/credit/place mechanism; AI does not create specialist starts or change disease coefficients. Idle work is not stored, and a practice can complete at most one consultation per tick. These are explicit engineering assumptions, not empirical workforce effects or a guarantee of fewer deaths.

The [model contract](MINISTER_MODEL_CONTRACT.md#f05-implementation-model-9-workforceproductivity) traces shop, law, decision/shock and parameter paths through service to metrics. Reporting distinguishes nominal/available GP work, actual GP visits, routine starts and occupancy. Previews share effect projection with execution. Bounds reject invalid effects observably instead of silently clamping them; valid zeros and positive small drain factors survive. Effect arithmetic retains precision instead of rounding to hundredths (the 70%-adopted pilot now produces admin 0.184, displayed as 18%). Scheduled effects/reversals receive the same bounds checking; their coefficients and schedule generation are unchanged.

This is an outcome change and therefore incompatible with model 8 replay/reference/leaderboard results. Protocol `no-discretionary-action-v1` remains unchanged. Clock, horizons, terminal mortality, night GP routing, retirement in care and finite-resource conservation remain regression requirements. No F06/F07 work, score reweighting, scheduler replacement or wholesale rebalance is included.

### F05 local implementation evidence

The actual-path fixture command is `node --test --test-name-pattern='F05' tests/minister_browser.test.js`. Local HTTP, locked Playwright 1.62.1 and the existing Node test runner are used; no new dependency or tooling. Tests block non-GET requests and production writes. The supported `Browser` context-event offline routing is retained.

Before implementation, two minimized tests failed on the unchanged base: absence 10% vs 80% and productivity ×1 vs ×3 each produced **4 starts / 3 completions** in 16 active ticks with six queued residents. An initial 32-tick fixture reached a real game pause at tick 26; reducing it to 16 ticks removed that unrelated interruption rather than bypassing active handlers.

| Fixture | Observed mechanism evidence |
|---|---|
| Absence alone, 10% → 80% | Available town GP work/week 7.2 → 1.6; starts 4 → 1; completions 3 → 0 in 16 ticks. Routine rate remains 0.25 and routine starts zero. |
| AI alone, ×1 → ×3 | GP work/week 8 → 24; starts/completions 4/3 → 6/6. No routine rate change. Not a mortality assertion. |
| Admin alone, 10% → 80% | GP work/week 7.2 → 1.6; completions 3 → 0. Separate overdue fixture matches the single `(1+admin)` charge and executable HP breakdown within `1e-9`. |
| Recruitment, 0.25 → 1.25 nominal starts/week | Routine starts 1 → 4; places 1 → 4 over 16 ticks; GP work unchanged. The existing capped-credit rule means this fixture realizes four starts, not an assumed five. |
| Combined admin 25%, absence 60%, AI ×2 | Both present: 0.6 work per GP per tick; one absent: remaining GP supplies 1.2 work/tick. Town work is 4.8/week in either case. At 25% aggregate absence and one named absence, the remaining GP supplies 1.5 work/tick without a second absence penalty. |
| Zero and invalid boundaries | Admin 1/absence 1 block starts and pause active work; both named GPs absent give zero work despite high AI. Admin/absence/adoption 0 and healthy severity factor 0 are preserved. Negative/out-of-range/nonfinite inputs and derived overflow reject, with no partial budget or care mutation. Positive drain 0.001 survives; URL replacement is atomic. |
| Downstream constraint | With the routine place occupied for the fixture, AI ×1 → ×3 gives GP completions 3 → 6 but **zero routine starts in both**; credit remains capped at one. More referrals are not assumed to be better outcomes. |
| Real purchase/preview | Zero-adoption scribe purchase applies only its declared temporary rollout admin cost, not a hidden benefit. Full-adoption reduction below zero is visibly unavailable and the button disabled. |

The seven F05 tests pass. Every service fixture uses stable RNG, isolated unrelated residents, bounded loops and active player `tick()` processing; `referencePolicy` is setup-only and restored before testing. Existing F04 fixtures run at neutral workforce parameters to isolate their original resource invariants; combined F05 fixtures exercise the new workforce mechanism with the same conservation checks.

The first complete-suite attempt exposed two implementation follow-ups: rejecting the existing `deceased` **condition** state broke reference execution on non-finalizing paths, and an old purchase assertion assumed hundredth rounding. The inherited condition-state factor 1 is now explicit (terminal resident rules unchanged), and the purchase assertion checks exact retained effect precision. The focused F05/reference/preview/replay rerun passed **10/10**.

Initial implementation validation (`1d4a313a31d3ea362fffc89b2d351510e74ea180`): `npm test` **187/187 passed**, 48 suites, zero failures/cancellations/skips (180.36 seconds). This includes all seven F05 fixtures, all seven F04 resource fixtures, offline routing, both supported HTTP host paths, both scenario references, versioned replay/publication mocks, clock, terminal death, night routing and retirement regressions. Supported no-action runs additionally assert that scenario/scheduled effects produce no care-input error. `node --check tests/minister_browser.test.js`, Acorn parsing of the inline Minister script, and `git diff --check` passed. Self-review was local and single-writer; no other agent or workflow was launched. This is repository evidence, not publication or clinical validation.

### F05 review follow-up: atomic choices, expiry precision and honest storm copy

Review against pinned `1d4a313` exposed a complete-choice validation gap. The real ransomware decision at dependence 8 / routine rate 0.5 charged €50K and installed temporary paperwork before its final -0.5 rate step failed. Two active browser clicks reproduced budget €200K → €100K, admin 0.30 → 0.5666666666666667 and two pending inverses, with no completed decision. Independent red fixtures reproduced a permanent reduction consuming temporary paperwork needed at expiry and an in-house build charging €70K before an invalid future -0.03 admin delivery.

The follow-up validates explicit complete plans, cumulative immediate state/cost and all known dated inverses/deliveries **before any mutation**. Availability uses the same plans, with click-time revalidation and exactly-once completion. Later choices reserve known obligations; expired work is removed only after successful application. Invalid restored-state batches remain pending with an observable error. An all-invalid mandatory council has an explicit no-effect deferral, rather than a repeatable rejected action or navigation deadlock. Random choices require all possible outcomes to be feasible without speculative execution. This is a conservative known-obligation rule, not a scheduler replacement or a forecast of unknown events.

Additional real-path regressions caught valid full-adoption scribe/platform purchases being disabled by floating point residue, and two Pilot Grants whose scheduled inverses failed near zero (complete-plan validation initially moved this failure earlier, into purchase availability). A narrow machine-epsilon correction of computed bound crossings now permits these valid zero results; direct invalid inputs and substantive overshoots still reject. The active storm safe-mode copy now explicitly says score-only/no modeled service effect; its existing score decrement is unchanged.

`node --test --test-name-pattern='F05 review' tests/minister_browser.test.js`: **11/11 passed** at `56aca266b652a578c4f63162543b08263e3d4d11` (23.60 seconds). Coverage includes:

- All-invalid ransomware choices: no budget/trust/admin/pending mutation, disabled reasons, no-effect continuation to funding.
- Valid ransomware: one charge, one temporary record, one rate reduction and one decision record; duplicate and stale button events cannot partially reapply it.
- Permanent-policy and delayed-benefit reservations, valid delivery exactly once, cumulative admin failure and conservative random-outcome availability.
- Failed expiry retained and retried after inconsistent state is repaired; council remains navigable.
- Two actual Pilot Grant purchases at admin 0 / adoption 0.7: admin 0.04, Q3 about 0.02, Q4 **exactly 0**, no pending inverses or care-input errors.
- Actual full-adoption scribe pilot/full rollout/platform purchases: final admin **exactly 0**, no care-input errors.
- Nonfinite inputs, invalid raw fractions, zero-to-negative deltas and meaningful overshoots rejected without cost.
- Active storm safe mode: score 100 → 96, unchanged GP work (5.152/week), parameters, routine rate and scheduled effects.

Windows validation at `56aca266b652a578c4f63162543b08263e3d4d11`: `npm test` **198/198 passed**, 48 suites, zero failures/cancellations/skips (254.51 seconds). This includes all 18 then-current F05 tests, existing finite-resource/clock/death/retirement checks, both supported scenario references (including the no-care-input-error assertions), offline browser isolation, and both supported HTTP host paths. `node --check tests/minister_browser.test.js`, Acorn parsing of the inline Minister script, and `git diff --check` passed. No dependencies or tooling were added. At this implementation checkpoint, model 9 was not deployed and public model 8 remained unchanged.

### F05 scope follow-up: executable horizons and conditional recoveries

Review pinned to `56aca266b652a578c4f63162543b08263e3d4d11` found that reservations exceeded the scenario's executable horizon and omitted conditional work-to-rule recovery. Active-browser regressions went red before the runtime fix:

- Cabinet Crisis, admin 0.04, Q2 in-house build: the Q10/tick 468 delivery disabled Task Differentiation Act even though its immediate admin 0.01 was valid and the game ends at tick 416.
- Work-to-rule installed sick +0.02 on a valid 0.01 base; overtime and GP Retention could spend that temporary amount, leaving the recovery inverse invalid. The recovery flag was cleared before the rejection, forgetting the obligation.
- Synthetic dated boundary records, exercised through real ticks/councils, reproduced the same incorrect terminal reservation. Inspection also found and reproduced success flags advancing after rejected workforce-cascade and carer-burnout effects.

The reservation now distinguishes callback phases: quarter work must precede terminal (`< H`); environmental inverses still execute at terminal (`<= H`). Active conditional recoveries are checked at remaining council starts against both still-active and recovered views, including dated changes at each prefix. This is bounded to the two existing morale conditions (at most four views), not an unbounded scheduler. Flags/counters change only after successful application. Strike expiry is linked to its dated source record; failed conditional/dated recovery retains the obligation for retry. The two earlier Q10 delayed-delivery tests now use **Full Term**, where Q10 is executable; their former Cabinet Crisis expectation was over-restrictive.

Targeted command: `node --test --test-name-pattern='F05' tests/minister_browser.test.js` — **29/29 passed** (72.46 seconds), including 11 new scope/lifecycle regressions:

- Real in-house build → valid Task Differentiation Act → admin 0.01 in Cabinet Crisis.
- Real work-to-rule onset, unavailable unsafe overtime, valid alternative policy/GP Retention/press choices, and successful trust-based recovery with no care-input error.
- Both scenarios: last councils at ticks 364/2028 execute dated deliveries; terminal ticks 416/2080 end the term without terminal-council delivery or conditional recovery.
- Both scenarios, deterministic seed 13: actual final-quarter flu inverses remain reserved and execute on the terminal tick before term completion.
- Combined work-to-rule/dated strike inverses reject a reduction that either obligation alone could allow; a later positive delivery cannot fund an earlier conditional inverse.
- Rejected work-to-rule/citizen/strike onsets do not install flags or records; failed conditional and strike recovery retains flags/records and succeeds after inconsistent restored state is repaired.
- Rejected exodus/carer effects remain retryable and apply once a feasible state is available.

Audit scope: named GP burnout timers and queue transfers are unchanged and do not duplicate aggregate absence; active morale, strike, exodus and carer paths were checked. Inactive legacy aging/finale helpers remain inactive. This final repair changed no reference protocol, service coefficient, dependency, workflow, backend or leaderboard state; publication followed coordinator review.

Final-source Windows verification at `238c750a838dd56d8692677236b6ee3d9f2983a1`: `npm test` **209/209 passed**, 48 suites, zero failures/cancellations/skips (226.53 seconds). All 29 F05 tests, existing finite-resource/clock/death/retirement checks, both supported scenario references (including no-care-input-error assertions), offline browser isolation and both supported HTTP host paths pass. `node --check tests/minister_browser.test.js`, Acorn parsing of the inline executable and `git diff --check` pass. Standards and Spec follow-up reviews have no outstanding findings.

### Verified model 9 publication

- Protected master merge: `12564e3273fb7c48ef000a97ce635372e04e27f9` through [PR34](https://github.com/cammeleon66/Cammelot/pull/34); release: `65175d704439bded68934b7db3d9dd4be36993d2`, preserving `feature/agentic-overhaul` history and matching the reviewed tree.
- [Pages run 40489766345, attempt 3](https://github.com/cammeleon66/Cammelot/actions/runs/40489766345/attempts/3) passed on 2026-10-27: full validation completed at 10:56:08 UTC, before deployment began at 10:56:12 UTC. No gate was bypassed.
- Attempt 1 was canceled after Chromium installation stalled. Attempt 2 passed 208/209 tests but hit the unchanged random-name fixture: six generated names included a non-consecutive repeat. The generator only excludes the immediate previous name, while the fixture requires global uniqueness. This pre-existing nondeterministic assertion remains a test-maintenance limitation; no test or gameplay change was made to hide it. The unchanged release passed attempt 3.
- Public `/minister.html` SHA-256 matched the canonical Git blob: `5231f563d8440513863e02a706da8013ccff91c0216690f1893e03479737b1ff`.
- Live Cabinet Crisis and Full Term references completed at 416 and 2,080 ticks respectively for seed 2468. Scenario, model 9, protocol and schedule identities matched; player openings remained at elapsed tick zero with four ticks/week, 52/quarter and 208/year.
- No browser, same-origin HTTP or care-input errors occurred in either player or reference. External requests were fulfilled locally, non-GET requests blocked, and leaderboard reads stubbed; no scores were submitted. This verifies the static game/reference path, not physical devices, leaderboard writes, clinical calibration or guaranteed outcome improvement.

## Model 8: finite resources (F04)

Issue [#4](https://github.com/cammeleon66/Cammelot/issues/4) replaces unlimited emergency admission with one separate emergency place and visible queued overflow, and bounds simultaneous GP consultations to one per practice. Routine treatment retains its named finite places and starts/week credit, independent of emergency care. Releases, initial occupancy, starts and completions are separately accounted; reduction of the routine target retires occupied places without evicting residents. See the [implemented resource contract](MINISTER_MODEL_CONTRACT.md#f04-implementation-model-8-finite-resources) and [criterion evidence](#f04-implementation-evidence).

This changes outcomes and is incompatible with model 7 replay/reference/leaderboard records. The implementation changed no workflow, backend, production leaderboard or repository settings; the coordinator published it through the existing gated branch after review. Model 8 was the verified public executable before model 9. The one-place rule and overflow outcomes are unvalidated gameplay assumptions, not calibration or a claim of lower mortality. F05 is recorded above; F07 effects remain separate work.

Local implementation evidence: Minister browser/supported-host tests **37/37 passed**; `npm test` **179/179 passed** using system Chromium and temporary existing test dependencies (the locked Azure mirror was unavailable). This is repository validation, not publication evidence; see the focused evidence below for exact limitations.

### F04 implementation evidence

**Baseline parent:** `224412790e620920f34d2357e71bbfd06937a655`; inspected implementation-PR starting plan `061564e` (no source changes from that parent).

#### Current-source reproduction before edits

Browser fixtures executed the unchanged local Minister page via HTTP in Cabinet Crisis, seed 2468, with controlled RNG, unrelated residents isolated, and actual `tick()` handlers:

1. Set nominal routine rate to `0.25` starts/week (one declared routine place); place eight living emergency transports at completed arrival. One tick admitted **eight** emergency residents into `at_hospital`.
2. Put one resident in an active `gp1_bldg` consultation with eight ticks remaining and another in that GP's queue. One tick left the original consultation active (timer seven) and admitted the queued resident (timer four): **two simultaneous consultations at one provider**.

These reproduce the bounded audit findings on model 7, rather than assuming that the older model-5 audit applies.

#### Criterion-by-criterion evidence

All fixtures below are named `F04 …` in `tests/minister_browser.test.js`. They execute the active player tick paths. Reference-policy mode is used only during setup and restored before any tested tick. RNG/progression are controlled to isolate resource rules, not to assert historical mortality scores. Tick loops have a maximum budget and fail explicitly on stalled progress. Assertions use floating-point tolerances for drain/waits/credit and observed visit timestamps for same-tick release/reallocation.

| Criterion | Evidence and expected result |
|---|---|
| Every admission accounts for declared resources | Eight-emergency fixture: one emergency start, seven queued, one routine start concurrently in its separate place. Initial occupancy, GP starts, routine starts and emergency starts use the same resource ledger; infrastructure staff are excluded. |
| Separately represented, bounded and visible overflow | Eight-emergency and whole-roster fixtures: one place, at most one waiting record per resident, bound equal to actual roster size. Repeated processing does not duplicate entries. Ministry live count and care detail report match snapshots; overflow deaths before treatment are separate from treatment deaths. |
| GP concurrency and exactly-once release | Simultaneous arrivals at both GPs: occupancy at most one per practice. Completion reallocates immediately. Death cleanup repeated twice does not release twice. Same-resident re-entry acquires a distinct visit; a stale prior-visit release cannot free it. Dawn preserves the consultation location. |
| Credit, absence, occupancy, recovery/discharge, re-entry under contention | Full routine occupancy preserves capped credit; repeated gate reads do not accrue credit twice. Discharge admits the more urgent routine resident; death frees occupancy but cannot invent credit. At `0.25` starts/week the next credit takes 16 ticks. GP absence pauses service and prevents overlapping starts. Recovery uses no treatment place. |
| Transfers and emergency priority | GP escalation releases its place for the next GP arrival. An already-referred critical resident preserves the same referral start/episode, queues for emergency care and takes the freed emergency place by clinical priority. Routine care remains independent; displacement count stays zero. Real burnout redistribution updates queue/provider metadata and still waits for the receiving GP's place. |
| Terminal release and shrinking resources | Whole-roster emergency fixture: death during treatment releases exactly once and admits the next emergency on the same observed tick, without recording a completion or death-before-treatment. Routine capacity reduction from three places to one exposes two retiring occupied places; no new start until existing care frees the target place. |
| Common deterioration rule, not an overflow-specific penalty | An overdue overflow resident loses the amount calculated by the existing untreated HP-drain/comorbidity rule at its elapsed referral wait (tolerance `1e-9`). No emergency-only mortality coefficient is added. |
| Preserve timing/terminal invariants | Existing regressions retain four ticks/week, 52/quarter, 208/year, display offset 30, Cabinet Crisis 416 ticks, Full Term 2,080 ticks, night-GP journeys, retirement during care, terminal disease/background deaths and exactly-once death finalization. |
| Incompatible version and focused release status | Model 8 identity is used by existing replay/reference/leaderboard machinery and browser assertions. Implementation evidence was recorded before publication; verified publication is recorded separately below. No calibration or improved-mortality claim. |

#### Validation environment and commands

- Initial `node --test tests/minister_browser.test.js tests/minister_deployment_smoke.test.js` could not import `playwright-chromium` (`ERR_MODULE_NOT_FOUND`).
- `npm ci` failed once: the existing lockfile points to an unavailable Azure package mirror (`ENOTFOUND ms-feed-17.pkgs.visualstudio.com`). No retry against that mirror and no dependency/lockfile edits.
- Public npm was reachable. Existing declared test versions `playwright-chromium@1.62.1` and `acorn@8.18.0` were installed under `/tmp/cammelot-validation`, without lifecycle scripts or browser download. A temporary local `node_modules` symlink pointed there during validation and was removed before commits. The available system Chromium was used at Playwright's expected headless executable path. This validates system Chromium, not a newly downloaded Playwright browser build.
- Before source edits, the targeted suite ran **28 passing, one failing external-font/analytics assertion, one picker timeout**. The browser harness now stubs cosmetic third-party requests so these local regressions do not depend on external fonts/analytics.
- Focused command: `node --test --test-name-pattern='F04' tests/minister_browser.test.js`.
- Complete Minister command: `node --test tests/minister_browser.test.js tests/minister_deployment_smoke.test.js` — **37 passed, 0 failed**, including all seven F04 fixtures and both supported-host/reference scenarios.
- Repository command: `npm test` — **179 passed, 0 failed, 0 cancelled, 0 skipped** (48 suites).
- `node --check tests/minister_browser.test.js`, Acorn parsing of every inline Minister script block, and `git diff --check` passed.
- Independent read-only diff review found no significant issues.
- Post-commit CodeQL reported **0 alerts**; care/clock final verification passed **18 tests**.

These tests use local HTTP and mocked/blocked publication, never production leaderboard writes. No frontend build step or new dependency is required.

#### Coordinator review follow-up (2026-10-26)

The browser-isolation review finding did not reproduce with the locked Playwright 1.62.1: its `Browser` API declares and emits the `context` event. A new offline regression exercises both `browser.newPage()` and explicit `browser.newContext()` creation, verifies all three cosmetic hosts are fulfilled without network access, and checks page-route precedence. Removing the route listener makes that regression fail with `ERR_INTERNET_DISCONNECTED`; restoring it passes. The isolated worktree restored dependencies with `npm ci` without changing the lockfile. The offline regression and all seven F04 resource fixtures passed together. This is regression evidence, not a clinical-validation or deployment claim.

The complete repository suite passed **180/180** on Windows at reviewed source `c351bf3`. Independent Standards and Spec reviews found no significant issues. The required `Validate` check passed for that source before the protected merge.

## Model 7 timing change

Model 7 was merged through cammeleon66/Cammelot#30 and published on 2026-10-22 through `feature/agentic-overhaul`. Both supported public scenarios were verified after deployment.

Model 7 uses one elapsed clock: four ticks per week, 52 ticks per quarter, and 208 ticks per model year. The initial displayed cycle of 30 is only a presentation offset. These timing semantics change scenario outcomes, so model 6 and model 7 results are incompatible and must not be compared or ranked as equivalent.

The annual mortality input conversion is mathematical bookkeeping, not clinical validation. The `48/5000` annual baseline, age multipliers, and 3 HP/week overdue-wait drain remain unvalidated model assumptions; neither the conversion nor the elapsed-time repair validates mortality probabilities or clinical coefficients.

Cabinet Crisis ends after 416 elapsed ticks, with seven allocation councils at Q2-Q8; The Full Term ends after 2,080 ticks. Aging uses fractional model years internally and completed years in resident-facing text. Regression coverage includes GP journeys across night ticks and retirement during GP or hospital treatment.

## Live and verified

- [x] Two public modes: Cabinet Crisis and The Full Term.
- [x] Fixed logical simulation independent of rendering, speed and reading time.
- [x] Hard pause at quarter boundaries with a prominent Council ready action.
- [x] Fixed 12-week model norm separated from specialist treatment capacity.
- [x] Referral episodes record waiting, treatment, death before treatment, relocation and other exits.
- [x] Same-seed, same-date no-discretionary-action reference with exact-tick snapshots.
- [x] Signed care differences; political and care verdicts are separate.
- [x] Same-town replay through Try another approach.
- [x] Compact mobile KPI dashboard and simplified Ministry-first panel.
- [x] Followed residents and clinicians show current context, thoughts and recorded care history.
- [x] Road-safe citizen movement with no blocked route nodes or teleport fallback.
- [x] Town requests pause without a timer and show the immediate modeled effect before closing.
- [x] Continuous soundtrack through gameplay and councils; Android unmute starts media in the tap gesture.
- [x] Public player-name entry with five random-name styles.
- [x] Opening top-five board uses persisted results, with transparent simulation examples only when a new model board is empty.
- [x] Completed runs publish automatically; failed publication preserves the local result and offers retry.
- [x] Empty referral queues say `No one currently waiting` and keep deaths-before-treatment adjacent.
- [x] Mobile council flow separates Briefing, Decision, Law and Fund; action priorities remain visible.
- [x] Low-adoption digital rollouts add visible temporary paperwork and GP burnout strain; change management reduces it.
- [x] Care-first, same-seed community leaderboard labeled as unverified submissions.
- [x] Azure App Service backend with HTTPS, exact-origin CORS and persistent `/home` storage.
- [x] Managed-identity ACR pull; no registry password enabled.
- [x] Production submit, restart, read, backup and test-entry removal proven.
- [x] Offline moderation command creates a backup before removal.
- [x] Superseded Azure experiments and identities removed.
- [x] GitHub Pages and CI deployment workflow operational.
- [x] Automated desktop and emulated mobile regression coverage; repository suite passed with 155 tests on the main release checkpoint.

## Supported-host smoke evidence

Only these Minister hosting paths are supported:

- **Public release:** static GitHub Pages artifact copied from the repository's `site/` directory; the Minister URL is `/minister.html`.
- **Development/test:** local HTTP from the repository root (for example, `python3 -m http.server 4200` and `/site/minister.html`). It does not provide the community leaderboard.
- **Unsupported:** Docker/nginx, `file://`, and other hosting providers. The legacy container files and nginx headers are not Minister release targets; this verification makes no header changes.

`tests/minister_deployment_smoke.test.js` exercises the `site/` artifact at Pages' root path and the documented Python HTTP path. It starts both public scenarios, waits for the same-origin no-action iframe to complete, and checks its scenario, seed, model/protocol identity, schedule and snapshots. The test blocks external requests, stubs leaderboard reads, and fails if a score submission is attempted. The local static artifact host does not contact or mutate production and does not claim to verify the live CDN's response headers.

Run the focused evidence with `node --test tests/minister_deployment_smoke.test.js`; `npm test` includes the same test and is the release regression command. CI installs the declared dependencies and Chromium before running `npm test`. `tests/e2e_checks.test.js` is deliberately omitted from `npm test`: its legacy static string/file-existence checks concern the older World/Docker/nginx setup and do not exercise supported Minister behavior or hosting.

Development PRs target `master`, whose required `Minister backlog checks / Validate` check applies including to administrators. The intentional publishing branch is **`feature/agentic-overhaul`**, not `master`. Integrate reviewed changes into that branch without discarding its history.

The Pages workflow triggers only on publishing-branch changes to `site/` or its deployment/CI workflows. Its `validate` job reuses `.github/workflows/ci.yml` to install dependencies and Chromium and run `npm test` on the release commit. The `deploy` job has `needs: validate`, so failed or cancelled validation prevents artifact upload and deployment. The job also checks the publishing ref; only that job receives Pages and OIDC write permissions. There is no ungated manual deployment trigger.

The `github-pages` environment must allow only `feature/agentic-overhaul`. The failed `master` deployment `39807566702` reflected a branch-target mismatch, not a broken feature-branch configuration. The original environment allowlist was restored, and release `5261e337aa3adaae7bfeab89a9872c0de1018be7` deployed successfully in run `39811223426`; its public Minister bytes and browser/reference model identity were verified. Branch and environment protection are repository settings; verify them separately from this source file.

### Verified model 7 publication

- Protected master merge: `9b52bfe3cdfab232ab73d50b24b9606b9804dc5f`; release: `98cb5e0c002ba96110d4d9600691232284717144`.
- [Pages run 39829114600](https://github.com/cammeleon66/Cammelot/actions/runs/39829114600) passed: `validate / test` completed before deployment began. The release tree matched the reviewed source exactly.
- Public `/minister.html` SHA-256 matched the release bytes: `e2294793de8ff356166058c1f87dbdedad7837c16064f414919b312f4ac4aac9`.
- Live browser verification completed same-origin model 7 references for seed 2468 in Cabinet Crisis (416 snapshots, final tick 416) and The Full Term (2,080 snapshots, final tick 2,080). Both player openings remained at elapsed tick zero with four ticks/week, 52/quarter and 208/year.
- No browser errors, same-origin HTTP errors or score submissions were observed. External requests and non-GET requests were blocked; leaderboard reads were stubbed. This verifies the static game/reference path, not production leaderboard writes, clinical validity or physical-device behavior.

### Verified model 8 publication

- Protected master merge: `708ece881ac8545d5e866e1ff0620140cdf133d6` through [PR32](https://github.com/cammeleon66/Cammelot/pull/32); release: `38074e3d2c21caabe6834ebfcc2ebaa9cff220bc`, preserving `feature/agentic-overhaul` history.
- [Pages run 40318807708](https://github.com/cammeleon66/Cammelot/actions/runs/40318807708) passed on 2026-10-26: `validate / test` completed before deployment began. The release tree matched the reviewed source.
- Public `/minister.html` SHA-256 matched the canonical release blob: `5b7dd20877f38732f6020119d62e8b1ea0ec4e599c0f3718279241c3934cfa7c`. Comparison used Git blob bytes, not Windows checkout line endings.
- Live browser verification completed same-origin model 8 references for seed 2468 in Cabinet Crisis (416 snapshots, final tick 416) and The Full Term (2,080 snapshots, final tick 2,080). Scenario, model, protocol and schedule identities matched; both player openings remained at elapsed tick zero with four ticks/week, 52/quarter and 208/year.
- No browser errors, same-origin HTTP errors or score submissions were observed. External requests were fulfilled locally, non-GET requests were blocked, and leaderboard reads were stubbed. This verifies the static game/reference path, not leaderboard writes, clinical validity or physical-device behavior.

## Remaining agent work

These improve evidence and quality; they do not mean the currently deployed game or leaderboard is offline.

- [x] Complete the active-copy pass: council newspaper, escalation banners, aging/flu updates and confidence-vote choices now report actual mechanics without invented testimonials or moralizing verdicts.
- [ ] Complete balance validation: the versioned Cabinet Crisis correction produced 11/400 narrow re-elections (2.75%) across five development seeds and every purchase family; freeze it and validate on unseen holdout seeds.
- [x] Reproduce the legacy emergency/GP admission violations, implement finite resources in model 8, and verify publication as recorded above.

## Human validation

These require people or physical devices and cannot be honestly checked by automation.

- [ ] Test the latest build on physical Android Chrome and iPhone Safari in portrait and landscape, including sound and end-screen publishing; record devices, OS and browser versions.
- [ ] Complete five uncoached playtests; at least four players should explain the target, one followed person, one trade-off, political versus care outcome and a replay choice.
- [ ] Include one healthcare-domain reviewer for the system-death classification, deterioration assumptions and emergency-capacity model.
- [ ] Assign an operational owner and retention period for production leaderboard backups.

## Deliberate limitations

- Community submissions are not server-replayed and remain explicitly labeled unverified.
- A single run is an illustration, not causal or statistical evidence.
- The playable engine uses 45 named residents scaled to a town of 5,000.
- `model-classified system deaths` remains cautious terminology pending domain review.
- The scalar score is secondary; leaderboard order prioritizes care outcomes.

## Next action

Follow the improvement plan below while physical-device and human playtests proceed in parallel.

## Improvement plan

### 1. Make the balance experiment complete

The 20-seed purchase × response matrix is valid for those two dimensions, but it enacts no laws. It cannot establish that Cabinet Crisis is unwinnable.

- Add a separate governance policy: no laws, parliament-first laws, care-bottleneck laws and resilience-first laws.
- Keep purchase, response and governance policies independent in output.
- Retry wishlist purchases at later councils when they are temporarily unavailable instead of discarding them permanently.
- Record every ending tick, final-vote reason, trust delta source, law, purchase, response and cascade stage.
- Add parser tests for representative option text so trust/budget/care heuristics select what their names claim.

**Exit:** sampled traces reconstruct every trust and budget change; policies actually enact distinct laws and purchases.

### 2. Prove Cabinet Crisis has a legitimate winning path

- Build one documented survival policy using only information visible to a player; no direct state mutation or hidden future knowledge.
- Run it through the real UI on fixed development seeds.
- Identify which condition blocks a win: parliament, citizen trust, doctor trust, death cap or cascade.
- Check whether a player can discover the required actions from previews and target cards.

**Exit:** at least one reproducible, non-cheating path passes the final vote. If none exists after laws are included, treat that as a model defect.

### 3. Correct political balance at its source

Do not lower every target or add arbitrary bonuses. Use the trust ledger from steps 1–2.

- Fix contradictory, duplicated or unavoidable parliament penalties first.
- Align option previews with the trust changes they actually apply.
- If the 40-point threshold remains unreachable under coherent play, adjust the smallest responsible penalty/gain or threshold and document why.
- Keep mortality, care capacity and the paired reference unchanged unless a separate clinical defect is found.
- Ensure no single law or purchase becomes a mandatory obvious answer.

**Exit:** multiple coherent strategies can reach the final vote, but none is uniformly best on care, politics and cost.

### 4. Revalidate without tuning to the test seeds

- Rerun the 20 development seeds after the justified correction.
- Freeze parameters, then run a separate holdout set not used during correction.
- Report medians, ranges, ending ticks, final-vote criteria and paired care differences.
- Continue ranking community scores by same-seed care outcomes, not scalar score.

**Exit:** the winning path remains feasible on holdout seeds; worse care is not rewarded merely by a higher score.

### 5. Audit the remaining care-model risk

- Completed in published model 8: trace the bypass, enforce one emergency place with visible overflow and independent routine resources.
- Active-path fixtures cover simultaneous emergency/routine demand, GP concurrency and absence, terminal releases, re-entry, routine credit and shrinking capacity.
- Retain cautious `model-classified system deaths` language until domain review.

**Exit:** emergency priority cannot create unlimited hospital throughput or silently displace routine care without being measured.

### 6. Human release gates

- Test the latest build on physical Android Chrome and iPhone Safari.
- Run five uncoached playtests, including one healthcare-domain reviewer.
- Require players to explain the target, a followed person, a trade-off, political versus care outcome and what they would change on replay.
- Resolve comprehension blockers before adding scenarios or mechanics.

**Exit:** four of five players complete and explain the loop without coaching; no physical-device blocker remains.

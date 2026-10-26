# Minister of Cammelot — release status

Updated: 2026-10-26
Public game: https://cammelot.org/minister.html
Verified public model: `minister-care-7-elapsed-time` (publication evidence below)
Upcoming repository model: `minister-care-8-finite-resources` — implementation only, **not deployed**
Reference protocol: `no-discretionary-action-v1`

This is the canonical status list. Older plans describe how the current release was built; their unchecked boxes are not active tasks.

## Upcoming model 8: finite resources (F04)

Issue [#4](https://github.com/cammeleon66/Cammelot/issues/4) replaces unlimited emergency admission with one separate emergency place and visible queued overflow, and bounds simultaneous GP consultations to one per practice. Routine treatment retains its named finite places and starts/week credit, independent of emergency care. Releases, initial occupancy, starts and completions are separately accounted; reduction of the routine target retires occupied places without evicting residents. See the [implemented resource contract](MINISTER_MODEL_CONTRACT.md#f04-implementation-upcoming-model-8-not-deployed) and [criterion evidence](#f04-implementation-evidence).

This changes outcomes and is incompatible with model 7 replay/reference/leaderboard records. No release, workflow, backend, production leaderboard or repository-setting change is included. Model 7 remains the verified public executable. The one-place rule and overflow outcomes are unvalidated gameplay assumptions, not calibration or a claim of lower mortality. F05 workforce/productivity tuning and F07 effects remain separate work.

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
| Incompatible version and focused release status | Model 8 identity is used by existing replay/reference/leaderboard machinery and browser assertions. Model/release docs explicitly mark it upcoming, not deployed. No calibration or improved-mortality claim. |

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

## Remaining agent work

These improve evidence and quality; they do not mean the currently deployed game or leaderboard is offline.

- [x] Complete the active-copy pass: council newspaper, escalation banners, aging/flu updates and confidence-vote choices now report actual mechanics without invented testimonials or moralizing verdicts.
- [ ] Complete balance validation: the versioned Cabinet Crisis correction produced 11/400 narrow re-elections (2.75%) across five development seeds and every purchase family; freeze it and validate on unseen holdout seeds.
- [x] Reproduce the legacy emergency/GP admission violations and implement finite resources in upcoming model 8; not a deployment claim.

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

- Completed in upcoming model 8: trace the bypass, enforce one emergency place with visible overflow and independent routine resources.
- Active-path fixtures cover simultaneous emergency/routine demand, GP concurrency and absence, terminal releases, re-entry, routine credit and shrinking capacity.
- Retain cautious `model-classified system deaths` language until domain review.

**Exit:** emergency priority cannot create unlimited hospital throughput or silently displace routine care without being measured.

### 6. Human release gates

- Test the latest build on physical Android Chrome and iPhone Safari.
- Run five uncoached playtests, including one healthcare-domain reviewer.
- Require players to explain the target, a followed person, a trade-off, political versus care outcome and what they would change on replay.
- Resolve comprehension blockers before adding scenarios or mechanics.

**Exit:** four of five players complete and explain the loop without coaching; no physical-device blocker remains.

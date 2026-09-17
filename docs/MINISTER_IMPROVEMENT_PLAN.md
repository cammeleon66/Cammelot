# Minister of Cammelot — Trustworthy Simulation, Playable Consequences

Date: 2026-09-16
Status: Historical implementation plan; the production release is live. Do not count unchecked planning boxes here as current TODOs.
Scope: the two public modes in [site/minister.html](../site/minister.html).
Owner: Simone Cammel; implementation and automated verification by the coding agent.

Current completion state and remaining release evidence are tracked only in [MINISTER_RELEASE_STATUS.md](MINISTER_RELEASE_STATUS.md).

## Implementation checkpoint — 2026-09-16

### Second checkpoint: paired reference and previous-attempt replay

Model `minister-care-3-paired` adds seed-keyed external shocks, aging in the shared clock, a declared no-discretionary-action reference, exact-date care comparison and local same-seed replay. Both full scenario horizons are covered by no-action equality tests. The longer test caught foreground-only annual aging; that was moved into the shared environment before enabling comparisons. Early results update when the actual reference iframe finishes; negative differences remain visible. Political and care judgments are distinct.

The paired audit also caught hospital infrastructure agents being counted as occupied patient treatment slots, which had prevented routine admissions. Slot occupancy now counts patients/citizens only and has a regression test.

See [MINISTER_REFERENCE_PROTOCOL.md](MINISTER_REFERENCE_PROTOCOL.md) for assumptions, narrowed external-event scope, message identity checks and limits. This supersedes the first checkpoint's “reference benefits disabled” status. It does **not** complete strategy calibration, clinical attribution, device validation or human playtests. Previous attempts are compared; recorded decisions are not yet automatically replayed as a full action script.

### Third checkpoint: factual results, strategy smoke test and community scores

- Replaced the generated end-of-term lesson (“not heroic,” “your successor inherits…,” presumed technology lesson) with the political cause and measured ending facts. Handover is a list of systems, laws, deaths and dependence. Research context is optional detail.
- Policy-triggered invented citizen testimonials no longer enter the town dialogue pool; citizen status uses recorded care history and snapshots.
- Primary intervention descriptions now state mechanics and units rather than praising a preferred strategy. Initial funding remains three cards; additional choices are explicit.
- A muted automated player completed five purchasing strategies over three seeds. See [MINISTER_STRATEGY_BENCHMARK.md](MINISTER_STRATEGY_BENCHMARK.md). No clear winner was established; the foundation route had the highest score but worst mean deaths and no political completion. This confirms the scalar score must remain secondary. This is smoke evidence, not balancing evidence.
- Added an optional community leaderboard service and replaced PNG score-card sharing. Players can enter a public display name or receive a stable seed-generated name. No account/email/IP storage; syntax validation, in-memory rate limiting, de-duplication, atomic bounded JSON persistence, model/scenario filtering and a persistent Docker volume are implemented. Scores are explicitly unverified because the server does not yet replay submitted decisions. See [COMMUNITY_LEADERBOARD.md](COMMUNITY_LEADERBOARD.md).
- The static Python preview cannot reach the backend and shows a graceful unavailable state. Docker configuration was written but could not be built locally because Docker is not installed in this environment; deployment remains separately blocked pending container validation and authorization.

### First checkpoint (historical)

Implemented in `minister-care-2-preview`:
- Logical travel/social updates run in ticks; rendering no longer changes clinical positions/chat/grief timers. Visual position interpolation remains in drawing.
- An 80-tick replay fixture matches clinical state, queues and events across no drawing, extra drawing/desktop viewport, and the baseline batch path with identical policy hooks. This is targeted evidence, **not complete G0 certification** across all event sequences.
- Specialist hiring adds one routine treatment start/week; base capacity is two/week (Cabinet Crisis 1.5). Capacity credits and staffed routine slots govern hospital queue starts. These are explicit gameplay assumptions, not calibrated staffing estimates.
- The clinical norm stays at twelve weeks. All policy `tree` effects were migrated to capacity effects; an old one-week policy effect maps provisionally to 0.5 starts/week. This mapping requires balance/domain review.
- Persistent referral episodes track treatment starts, deaths while waiting, relocation and other exits; elapsed waiting uses logical time, not AI speed. The KPI uses current pending referrals.
- Recruitment, drawing invariance, signed comparisons, mismatched reference identities, no artificial quarter-six death, and scribe preview/application have regression coverage.
- Removed the manufactured death, fixed-percentage prevention claim, final negative-difference clamp and prorated live comparison.
- **Reference benefit claims are disabled** until shared external conditions and reference response policy are validated. Identity-checked, versioned, tick-indexed baseline data is collected but is not presented as a valid control experiment.
- Structured purchase records and a “Since your decision” panel show admissions, deaths before treatment and waiting, plus the followed person's actual care history.
- Initial funding reduced to three cards; laws optional; events without choices skip the empty decision step. Phone portrait map uses 50% of viewport height.
- A muted manual run at seed 2468 showed recruitment capacity 1.5→2.5/week, followed by four treatment starts and two deaths before treatment by tick 104. The followed resident entered treatment at tick 87 and completed it at 96. These are one-run observations, not benefits attributed to hiring.
- Results use a separate preview-version local leaderboard and explain political survival vs care outcomes.

Still required before release:
1. Shared exogenous-event schedule and declared baseline responses; complete speed/background/agent-RNG audit and matching-date comparison validation.
2. Emergency care currently retains the legacy queue-bypass pathway; routine staffed-slot limits are implemented, a unified emergency/ward capacity policy is not.
3. Broader preview/temporary-effect invariants, full outcome-attribution audit (the legacy system-failure category includes untreated disease), and adoption over time.
4. Complete compact Ministry sheet/focus-preserving UI, full copy audit, immutable election snapshot and versioned decision-path replay/export.
5. 100-seed strategy matrix, holdout validation, actual iPhone/Android checks and human/domain playtests.

Do not publish revised research claims or mark G0–G5 complete from the pilot alone. The next coding slice is the shared-event/reference protocol, not new content.

## 1. The product promise

**Choose how to improve care, watch what happens to people, and discover whether your approach actually helped.**

The game should explore a transition, not advertise a predetermined destination. Staff, technology, implementation capacity and resilience compete for a limited budget. Doing nothing must remain a legitimate comparison. Political survival and better care are different outcomes.

The source material supports this:
- [Game LinkedIn carousel source](../scripts/make_carousel.cjs): “Doing nothing is also a policy” and “The more you digitize, the more you depend. And dependence has a price.”
- [Research introduction](../00_Project_Strategy/social/series1_health_post0_intro.md): which interventions, in which order, with which side effects; publish unwelcome findings too.
- [Game design](GAME_DESIGN.md): the living town is the emotional core; players should encounter consequences, not only dashboard numbers.

Success is not “more mechanics” or “all tests green.” After playing, a newcomer should be able to name someone they followed, explain one trade-off, and distinguish a simulated finding from an assumption.

## 2. Decisions and guardrails

1. Keep Cabinet Crisis and Full Term. Preserve legacy scenario links; add no public modes.
2. Fix correctness before balancing difficulty or redesigning the result screen.
3. Keep quarterly clinical accounting. Initially retain the existing council cadence; evaluate fewer meetings only after the new loop is playtested. Never skip clinical ticks to shorten a session.
4. Keep the static frontend and SNES identity. No backend migration, framework rewrite, LLM integration or new disease model in this work.
5. Retain hard pauses, explicit Council ready, normal-speed council exit and optional inspection. No timers that punish reading.
6. No invented clinical successes, deaths or percentages to make the lesson more dramatic.
7. No automatic conclusion that platforms, AI or the builder's preferred strategy must win.
8. No unrelated worktree cleanup, commits, pushes or deployment as part of planning. Preserve the existing dirty worktree.
9. All player-facing copy remains concise English. Keep previews muted; automated audio tests must also use muted audio output at the browser/process level while the user is in calls.

## 3. Starting evidence and open questions

### Verified in the current implementation/review

| Finding | Why it matters | Required response |
|---|---|---|
| Hiring reduces `M.IST.tree`; the same value is the overdue threshold in health deterioration | The displayed benefit can lower the threshold for harm rather than add treatment capacity | Separate capacity, observed waiting and clinical norm |
| At fixed 11-week waiting, changing that threshold from 12 to 10 increases moderate I25 drain from 0.30 to 0.495 per tick in the controlled calculation | A concrete incorrect coupling, not proof that every hire worsens every run | Lock down with a regression test before replacing the coupling |
| Quarter six can force a death when no paid intervention/law was made | The experiment imposes its lesson | Remove this branch and route all clinical deaths through the clinical lifecycle |
| Final `livesSaved` clamps a negative difference to zero | Harm is softened in results and shared output | Preserve signed differences everywhere |
| Live comparison prorates end-of-term baseline deaths | It is not an observed comparison at the current date | Use matched-date snapshots, not interpolation |
| Scribe preview promises 30% to 12%; default adoption produces 17% after purchase | Players cannot plan from the information provided | Preview and application use one effect calculation |
| Some event text states fixed 14%/20% improvements | Fictional narrative resembles measured research | Remove or derive from an actual numerator/denominator |
| First observed action screen had 316 words, 3 law choices and 6 intervention cards, plus more hidden options | The entry is simpler but the decision surface still overwhelms | Progressive disclosure and fewer primary options |
| At 390×844 the town occupied about 232 pixels of height | More KPI cards can displace the emotional core | A compact default HUD and town-first mobile layout |

### Must be investigated before promising reproducibility

- `render()` advances movement; clinical transitions depend on arrival/path completion. Verify whether frame rate, speed, inspection and background-tab throttling alter care outcomes.
- The hidden baseline batches ticks while the foreground game animates. Verify identical logical travel and queue processing, warm-up, population and observation horizon.
- Per-tick reseeding does not by itself ensure independent clinical, UI and event randomness. Inventory all random draws and their consumers.
- Audit real provider counts, time units, initial `cycle=30` and warm-up. The first council must be labeled consistently with the time actually simulated.
- Current older design/architecture documents describe different populations and parameters. Record the implemented model explicitly; do not silently treat old prose as calibration evidence.

These are release blockers if they invalidate the matched-run comparison, not optional future architecture work.

## 4. Measurement contract — agree before implementing the HUD

One metric definition must drive the HUD, promises, events, result screen and exports. Every snapshot carries scenario, seed, model version, tick, units and relevant population counts.

| Concept | Definition for this revision |
|---|---|
| Clinical norm | Fixed scenario-independent clinical threshold used by the current specialist-delay model; retain 12 weeks provisionally. This is a simplifying model assumption, not a universal legal deadline. Procurement cannot change it. Source/clinical review may revise it explicitly in a future version. |
| Specialist capacity | Available treatment starts per simulated week, constrained by staffing, availability and downstream treatment slots. Queue processing consumes capacity; hiring changes this, not the norm. |
| Current referral waiting time | Mean elapsed weeks among living, non-relocated people with an outstanding specialist referral. Exclude GP-only queues and completed referrals. Show the number waiting. If the complete known queue is empty, show “No one waiting”; if data is missing, show “Unavailable,” never zero. |
| Waiting distribution | Show longest current wait and count/share over the fixed norm in details. Record completed referral-to-first-treatment waits and their sample size separately; never merge those with current queue age. |
| Wait promise | Initially retain the familiar ≤8-week threshold, but evaluate the observed current referral queue at documented quarter snapshots, not a policy parameter. Report the denominator and separate mortality gate so a queue emptied by deaths is not presented as a care success. Validate the target in phase 5; label it a political target, not an official norm. |
| Citizen/doctor/parliament trust | Three game scores on 0–100. Citizen trust is not a measured happiness percentage. Use consistent terms and show the same thresholds that determine political judgment. |
| Preventable/system-delay deaths | The model's recorded system-failure death category, distinguished from natural deaths. Audit its attribution: not every untreated disease death can automatically be claimed to be caused by a minister. Use cautious player-facing labeling until attribution is defensible. |
| Difference versus reference | Reference minus player deaths at the same tick. Positive, zero and negative are all valid. Also report wait, treatment throughput, workload and remaining budget. A single pair is an illustration, not causal proof or statistical significance. |
| Effect preview | Effective change given current adoption, caps, costs, prerequisites and temporary effects. Calculated by the same function used when committing a choice. Show immediate changes separately from scheduled implementation and uncertain later outcomes. |
| Targets and bonuses | Signed promises and political safety limits are distinct from annual optional score bonuses. Persist the election-time verdict; later live changes must not rewrite an election already held. |

**Queue accounting invariant:** for each referral episode and assessment period, reconcile opening queue + new referrals − treatment starts − deaths before treatment − relocations/other explicitly labeled exits = closing queue. Record the reasons separately. A lower mean among survivors can meet a political arithmetic target, but must not be described as improved access without this context. Show untreated deaths alongside changes in waiting; never erase closed episodes from the outcome record. Include a fixture where the longest-waiting patient dies: the mean drops, but the report must not credit the minister with improving that patient's access.

### Comparison protocol

- Same model version, initial population, scenario modifiers, clock start and elapsed simulated time.
- The reference applies no discretionary minister purchases or laws, and does not end because a fictional cabinet falls.
- External conditions such as flu or grid disruption must follow a shared exogenous schedule. Choice-dependent events may differ, but their rules and exposure must be recorded. A “no minister” run cannot simply omit every difficult event.
- Define and document reference handling for unavoidable choices before comparing. Reference responses must be deterministic, declared and not optimized after seeing player results.
- Prefer random streams keyed by seed, logical tick, agent/process/event identity. Rendering, audio, browsing details and camera movement must consume no clinical randomness.
- Compare at the player's end tick on early political loss. If the reference has not reached that tick, show pending/unavailable and update when valid data arrives.
- Validate message source, origin, seed, scenario and model version when accepting hidden-run results. An unrelated frame must not overwrite the reference.
- Save exact quarterly snapshots and final snapshots. Do not estimate interim deaths as a fraction of a final total.

## 5. Implementation phases and exit gates

### Phase 0 — Establish a reliable test harness

**Deliverable:** executable evidence about clock, movement and comparison, plus a versioned run record.

1. Preserve current behavior in regression fixtures without freezing known bugs as correct outputs.
2. Add deterministic scenarios for a queued patient, a patient in transit, clinical deterioration, a blocked council and an early ending.
3. Record starting population/state, decisions with application ticks, exogenous events and snapshots.
4. Replay identical decisions at 1×/4×, different rendering schedules, inspected/paused states, and the hidden-run path.
5. If logical travel depends on render frequency, move the care-relevant arrival progression into fixed simulation updates. Keep smooth visual interpolation in `render()`. This is a targeted separation, not a rewrite of the whole engine.
6. Separate stochastic process streams where necessary and pin the initial logical clock/warm-up contract.

**Gate G0:** identical inputs and decisions produce identical clinical/queue/event snapshots regardless of animation, speed or time spent reading. Player and reference with identical policies match. No tick is lost at a pause or processed twice on resume.

**Stop condition:** do not rebalance mortality or advertise paired evidence while this gate fails.

If the correction is larger than expected, deliver the audit and a revised estimate before more feature work. Keep the work in a non-public preview with comparison claims disabled until they are valid; do not substitute a separate simplified simulator or silently weaken G0 to meet a deadline.

### Phase 1 — Repair clinical effects and reporting honesty

**Deliverable:** truthful core outcomes and a working capacity-based hiring intervention.

1. Remove the scripted do-nothing death. Retain honest warnings from observed queues; do not replace it with a disguised mortality multiplier.
2. Remove the signed-difference clamp and final-total interpolation. Update score, verdict, history, downloaded share text and image outputs consistently.
3. Implement the measurement contract and shared snapshots.
4. Replace `tree` effect semantics across hiring, referrals, laws, scenario setup, events, temporary effects, warnings and scoring. Do not fix only the hiring card and leave other writers of the old parameter.
5. Add explicit specialist throughput/availability and occupancy limits to queue processing. Use an accumulated service budget if fractional capacity is needed. New capacity must not create simultaneous treatment beyond staffed slots.
6. Model initial scenario pressure through demand, backlog or available capacity, not by changing the clinical norm.
7. Define capacity units and the gameplay assumption behind each increase; do not claim an arbitrary conversion as NZa/RIVM evidence.
8. Move all effect previews/application through one pure calculation, including rounding, adoption, repeated-purchase costs, caps and delayed effects. Store a structured receipt, not only formatted text.
9. Audit and remove fabricated numeric success claims and incorrect causal death labels.

**Gate G1:**
- Hiring leaves the clinical norm and same-wait patient's drain unchanged.
- In a controlled fixed-arrival queue fixture, adding capacity increases available starts and cannot worsen queue waiting purely by lowering the overdue threshold. Whole stochastic runs may still have trade-offs; do not assert that every outcome always improves.
- Norm thresholds still trigger deterioration correctly above/below the fixed limit.
- No discretionary action produces exactly the declared no-action/reference behavior; no quarter-six artificial death.
- A run with two more deaths than reference displays the negative difference in every output.
- Every tested preview equals the committed immediate effect; delayed benefits are not reported as already achieved.
- Counters and metrics remain internally consistent after deaths, relocation, discharge and repeat referrals.

**Minimum capacity fixture (synthetic, not clinical calibration):** four living patients with outstanding referrals, the same moderate condition and equal triage priority; no new arrivals, random deaths or disease transitions during this isolated logistics test. Baseline supplies one staffed appointment start per simulated week; intervention supplies two, with sufficient treatment slots and one-week service duration. After two weeks, expect two versus four starts and a shorter time to service with the additional capacity. The service accumulator must not lose fractional credits or exceed staffed slots. In a separate clinical fixture, retain a moderate I25 patient waiting eleven weeks and assert identical drain before/after hiring at the unchanged twelve-week norm. Test capacity activation at the declared implementation tick, not at button-render time. Actual production capacity and costs are calibrated separately and documented as assumptions where evidence is unavailable.

### Phase 2 — One complete playable loop: hire a specialist

**Deliverable:** a short, coherent experience demonstrating a real choice and its limits.

Use a reproducible scenario with an actual referral queue, not a scripted successful patient outcome:

1. **Meet:** highlight a patient already waiting and their real referral history. Give a name, the problem and a short current status.
2. **Choose:** compare hiring with a workforce/support alternative and holding funds. Show cost, implementation time and the actual capacity change. No option is labeled morally correct.
3. **Implement:** show staffing/capacity becoming available at its defined time. Do not spawn a decorative doctor that has no connection to the capacity ledger.
4. **Observe:** let the town run; show real admissions, queue changes and the followed patient's next event. The patient may not be next in clinical priority and may not improve.
5. **Reflect:** one compact “Since your decision” update: treatments started, queue size/wait distribution, workload, spending and the patient's real event. Reference comparison appears only for matched snapshots.
6. **Continue:** the next council becomes available without covering the town. Reading/inspection never advances the clock.

**Gate G2:** a player can trace purchase → capacity → queue processing → patient event → measured report. Include test cases where the patient is treated, remains waiting, deteriorates, or has no new event. Never fabricate a happy ending to satisfy the tutorial.

Include a rough 375×667 mobile layout at this checkpoint; verify the town/control space budget before expanding the pilot to other interventions. Visual polish can wait for phase 3, fundamental fit cannot.

### Phase 3 — Town-first pacing, interface and language

**Deliverable:** the same loop is pleasant on desktop, Android and iPhone.

**Default layout**
- Desktop: town with a compact Ministry summary; expand details on demand.
- Phone portrait: aim for at least 50% of usable height for the town in normal observation mode. One compact active-target row, budget and a visible council/inspection action. Full KPI cards and histories open in a sheet and may temporarily cover the town at the player's request.
- Prefer one active citizen and two small switch controls over three permanently expanded status blocks.
- Preserve focus and open details across live updates; do not rebuild focused controls on every tick.
- Pixel typography for names/headings; readable body text; consistent font loading/fallbacks. Controls at least 44×44 CSS pixels, safe-area aware. Status is communicated with words/icons as well as color.

**Council simplification**
- One report headline, one meaningful decision if present, and optional spending.
- If an event has no choice, keep it in the report; remove the empty “Decision → Next” step.
- Show at most three relevant funding options initially, plus “All options.” Relevance is explained by the affected bottleneck, not by the author's preferred AI path. Do not remove access to alternative strategies.
- Laws become an optional section, not a mandatory block above every purchase.
- Keep eight-quarter accounting in Cabinet Crisis. First test the condensed council flow. Only if meetings still dominate should a separate versioned pacing change group routine decisions into fewer meetings; preserve clinical ticks, choice access and consistent reference behavior.
- Normal-speed observation currently gives about 18 seconds per quarter. Test an observation target of 20–30 seconds without forcing idle waiting: allow pause/inspect and skip to the next scheduled decision. Never change disease time to manufacture screen time.

**Copy rules**
- Outcome before terminology. Explain dependence/fragility once rather than repeating slogans.
- Each primary option: short title, one consequence sentence, effective cost/change, and a stated trade-off.
- No “the strongest AI outcome,” “the classic long game,” congratulatory invented citizen quotes or placeholder `roaming` labels.
- Citizen updates are derived from logged events; no silent event means “No new care event,” not generated drama.
- Audit all player-visible surfaces: picker, onboarding, manifesto, targets, shop, laws, tooltips, news/events, citizen history, yearly screens, verdict, share text and error/pending states. Use a checklist; fixing only the first screen is insufficient.

**Gate G3:** first action surface ≤120 words before optional details (initial design budget, validate in playtests); no empty decision screens; essential controls remain reachable at 375×667; no horizontal overflow at 200% text zoom; simulated outcomes unaffected by layout and inspection.

Measure town share against the browser's usable visual viewport, after safe-area insets, with sheets closed and default text size. Reserve at least half for the map and fit the compact HUD into the remainder; put additional details behind explicit expansion rather than shrinking touch targets. At enlarged text sizes prioritize readable reflow and reachable controls over preserving a fixed map ratio. Record screenshots and measured rectangles, including short landscape viewports; keyboard focus must not scroll the council action out of reach without a return path.

### Phase 4 — Two verdicts and a reproducible replay

**Deliverable:** an ending that distinguishes political success from care results.

- **Political verdict:** kept promises, missed promises, election-time values and reason for leaving office.
- **Care results:** side-by-side player/reference at the same horizon, with signed differences, denominators and uncertainties. Deaths, actual waits, treatments and workforce pressure; do not hide trade-offs in one score.
- **Personal record:** up to three short event histories for followed residents, including uneventful/recovery outcomes. Show temporal association, not unsupported “your purchase saved this person.”
- **Explanation:** two or three observed sequences such as “Capacity increased in Q3; treatment starts rose in Q4.” Avoid causal proof claims from one pair.
- **Replay:** replay the exact scenario/seed/model version with a different decision path. Preserve the previous outcome for side-by-side comparison. Record effect/order so the run can be reproduced.
- Keep score secondary. Explain that surviving the cabinet does not prove improved healthcare.
- Mark old local scores as a previous model version; do not compare them with the repaired model's leaderboard. Legacy scenario URLs continue opening, but reproducibility links need a version or an explicit version-mismatch notice.

**Gate G4:** fixture outcomes include politically successful but clinically worse; politically failed but clinically better; equal outcomes; early end; missing reference. None is forced into a celebratory success message.

### Phase 5 — Balance, human playtests and release

**Deliverable:** evidence that the game is understandable, replayable and does not prescribe a winning ideology.

1. Smoke-test 10 fixed seeds while implementing; after G0–G4 run a versioned 100-seed matrix for both public modes.
2. Compare documented deterministic strategies: no discretionary action, staffing/support first, rapid digitization, foundation-first, and mixed/resilient. Policies must respect affordability/prerequisites and record their actual actions.
3. Report distributions, failures, unreachable purchases and outcomes, not just averages. Record sample counts and uncertainty. Do not tune against these seeds until the builder's preferred strategy wins; retain a holdout seed set for validation.
4. Inspect one strategy's dominance if it occurs. It can reveal a genuine modeled constraint or missing costs; it is not automatically something to remove by arbitrary penalties.
5. Short mode must offer credible choices whose principal effects can be observed before its end. Flag investments whose main payoff lies beyond the term instead of suggesting they already helped.
6. Run five initial human playtests: include at least one healthcare-domain reviewer and real desktop, Android Chrome and iPhone Safari sessions. Viewport emulation is not device/browser validation.
7. Observe without coaching; record time to first choice, time spent looking at the town, misunderstandings, stalls, and reasons to replay. Do not equate a shorter session with a better session.
8. Update the LinkedIn carousel and research/game descriptions only after rules stabilize. Existing copy about scenario count, promise count and election timing is stale. Clearly distinguish a participatory game from the separate IST/SOLL research study.

Before release, review any strategy that is consistently no worse on care, workload and cost than all alternatives. Classify the finding as a defect, a stated model limitation, or a credible result within this model. Fix defects; disclose limitations/results. If doing nothing wins, say so. Do not impose arbitrary win-rate quotas, additional disasters or mandatory spending to force three strategies to look equally good. Challenge or expand the model only through a separately documented assumption change and rerun the holdout set.

**Gate G5 — initial usability target, not statistical proof:** at least four of five players can independently state their main target, name a followed citizen, explain one effect/trade-off, distinguish political success from care results, and propose a different next-run choice. All can pause, inspect, resume and exit a council without help. No critical fairness or device blocker remains.

## 6. Technical structure and work ownership

Use a few deep modules with small interfaces inside the existing frontend first. Do not create a parallel “test simulator” whose behavior can drift from the actual game.

| Module | Interface responsibility | Primary areas to inspect/change |
|---|---|---|
| Simulation clock | Advance one logical step; deterministic travel/arrival; pause never advances it | `tick`, `render`, `loop`, initialization, hidden-run batching |
| Care logistics | Allocate staffed service capacity; create/update/close referral episodes | Queue processing, referral/admission/discharge/death paths |
| Metrics | Produce immutable, timestamped snapshots with population counts | `EVENT_LOG`, queue records, existing HUD/report builders |
| Policy effects | Preview and commit from the same effective-change calculation | `buy`, `applyFx`, `deltaHtml`, laws, delayed/temporary effects |
| Mandate | Evaluate signed promises and safety limits using metrics; preserve past verdicts | `PROMISES`, `getMandate`, election and end-term logic |
| Comparison | Match player/reference snapshots and produce signed differences | Baseline iframe, message handling, scoring/share/replay |
| Presentation | Show metrics/events without mutating clinical state | Ministry, town watch, Gazette, council, ending, CSS/audio |

Existing source: [site/minister.html](../site/minister.html). Existing regression entry point: [tests/minister_browser.test.js](../tests/minister_browser.test.js). Current test registration: [package.json](../package.json). Add focused tests through actual module interfaces and register them in the test script when needed.

- Primary coding agent: implement one slice at a time, preserve unrelated edits, run tests and browser validation.
- Independent review: inspect metric semantics, baseline comparability and claims after phase 1; inspect UX/device results after phase 3.
- Simone: judge the pilot's clarity and feel after phase 2; approve revised model assumptions/public claims before release.
- Healthcare reviewer: review terminology, clinical assumptions and attribution; do not portray gameplay parameters as validated care predictions.

## 7. Delivery order — small, reviewable slices

| Slice | Work | Depends on | Evidence required before the next slice |
|---|---|---|---|
| 0A | Regression fixtures, run/version record, RNG/arrival audit | None | Reproducible failing cases and verified model inventory |
| 0B | Logical-clock/arrival/randomness corrections where required | 0A | G0 replay equality |
| 1A | Remove manufactured outcomes; signed, matched-time comparison | 0B | Negative/equal/pending reference fixtures; no artificial death |
| 1B | Capacity/norm split, referral metrics and all old `tree` writers migrated | 0B | Queue and health invariants |
| 1C | Shared effective effects; honest previews, events and target evaluators | 1A, 1B | G1 correctness suite and independent review |
| 2 | Specialist-hiring pilot and actual citizen event follow-up | 1C | G2 complete loop; Simone plays it before expansion |
| 3 | Mobile/desktop hierarchy, concise councils and systematic copy pass | 2 | G3 browser and device evidence |
| 4 | Two-part verdict, versioned replay and comparison | 3 | G4 opposing/equal outcome fixtures |
| 5 | Cross-strategy runs, human tests, publication alignment | 4 | G5 and release checklist |

The critical path is **0 → 1 → 2 → 3 → 4 → 5**. Copy inventory can run alongside phase 0; rewrites that depend on metrics must wait. Do not parallel-edit the same inline game engine across multiple coding agents. Estimate effort after 0A, especially the movement/reference audit; no unsupported calendar promise now.

## 8. Release checklist and stop rules

Historical checkpoint outcome:

- Automated repository and Minister invariants pass, including pause, audio, resize and deterministic-comparison regressions.
- Required assets load; negative outcomes remain signed; previews and committed effects share calculations.
- Both public modes, replay, model-version separation and deployment rollback history are present.
- Audio preference and muted automation are covered.
- Research outputs remain separate from the participatory game and community submissions remain labeled unverified.
- Physical-device, human-playtest, domain-review and final publication-evidence work remains in [MINISTER_RELEASE_STATUS.md](MINISTER_RELEASE_STATUS.md); it is intentionally not duplicated here.

If the hiring pilot is still confusing, stop adding content and simplify it. If deterministic comparison fails, stop making paired-outcome claims. If a domain assumption remains unsupported, label it explicitly or remove the claim rather than inventing precision.

## 9. First execution instruction

Start with **0A**, not a redesign: add the failing no-action, negative-difference, hiring/norm, effect-preview and render-rate/reference fixtures; produce a concise run/clock audit. Then implement **0B and phase 1** until G0/G1 are green. The first playable checkpoint is the **specialist-hiring loop**, not another set of menus.
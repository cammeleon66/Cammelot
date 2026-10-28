# Minister simulation boundary (R02)

**Status:** Design contract; not an extracted module or gameplay change. **Boundary
contract:** `minister-simulation-boundary-v1` (proposed). It is separate from the
current model `minister-care-10-access-time-replay`, the paired-reference protocol
`no-discretionary-action-v1`, the replay schemas, and R01 protocol version 1.0.
This document selects an interface for implementation; it is not evidence that
the R01 experiment has run or that any model effect is clinically valid.

## Decision

Keep the Minister model as the sole authority for Minister state and outcomes.
Give it one small, deterministic run interface which the browser and a future
experiment driver both call. The interface owns initialization, validated
commands, one logical tick, ordered domain events, and immutable snapshots.
Policies decide which command to request; they do not implement care effects.
The renderer and experiment driver are clients of the same run, not alternate
simulation engines.

The proposed boundary is deliberately smaller than a general simulation
framework:

```js
const run = createRun({ scenario, seed, inputs, schedule });
const receipt = run.applyCommand(command);
const tickResult = run.advanceOneTick();
const events = run.eventsSince(cursor);
const snapshot = run.snapshot();
```

These are proposed ports, not current exported functions. `createRun` validates
the scenario, seed, versioned input manifest and external schedule, then returns
the initial snapshot at elapsed tick zero. `applyCommand` accepts only a
whitelisted command valid in the current model context and returns its applied,
no-effect or rejected receipt. `advanceOneTick` advances exactly one synchronous
logical tick and returns its ending tick and ordered events; it does not read
wall-clock time. `eventsSince` returns the ordered command/model facts after a
cursor, including the next cursor. `snapshot` returns a detached,
JSON-serializable point-in-time value; callers cannot mutate model state through
it. Commands, events and snapshots carry stable IDs/order and the applicable
model, scenario, seed, elapsed tick and protocol/schedule identities.

| Responsibility | Owns | Must not own |
|---|---|---|
| Simulation run | Validated state, seeded random streams, policy-independent care/resource rules, command application, one-tick transitions, event order and snapshot creation | DOM, rendering, UI choices, experiment-arm interpretation, wall-clock cadence, persistence or network calls |
| Policy | Read-only observations from snapshots/events; choose and explain a candidate command | Direct state writes, hidden care-rule changes, extra resources or unrecorded random draws |
| Browser shell | Translate user actions into commands; drive ticks while running; render snapshots/events; audio and navigation | A second care transition or policy implementation |
| Experiment driver | Create one run per seed/arm, provide policy commands, advance it, retain versioned events/snapshots and calculate declared analyses | Source scraping/patching, synthetic outcomes, private model copies, or a second baseline implementation |

The browser clock driver may choose *when* to call `advanceOneTick`; only that
call changes logical time. Rendering, pausing, opening a council and reading a
snapshot do not. This makes the current fixed-step clock and render-independence
tests explicit boundary invariants.

## Walk-through against the approved R01 design

This trace shows how existing game concepts fit the seam and where R01 still
needs implementation. It does not claim the current council game implements the
R01 referral cohort or its five strategies.

1. **Council action.** The player-facing policy layer chooses a currently
   available offer and submits a command such as
   `{ id, sequence, kind: "purchase", controlId: "hire", context: { council: 2 } }`.
   The run validates its context, applies the declared effect once, and records
   the command receipt plus the budget/care-state domain events. The UI shows
   that receipt; it does not apply the purchase a second time. This is the
   proposed port for the actual council handler and complete F08 command record.
2. **Patient transition.** The browser clock or experiment driver calls
   `advanceOneTick()` once. The shared run advances its seeded clinical process,
   resource/queue rules and elapsed clock, records patient-state changes and
   referral-episode outcomes (`treatment_started`, `died_waiting`, `relocated`
   or `other_exit`) as ordered events, and produces its ending-tick snapshot. A
   renderer can animate the transition from those outputs but cannot create or
   skip it. For R01, the endpoint adapter must additionally keep death before
   treatment, withdrawal/refusal, deterioration and still-waiting distinct as
   the protocol specifies; the current Minister episode labels are not a
   substitute for that R01 ledger.
3. **Reference snapshot.** A separate reference run is initialized from the
   same frozen inputs, seed and exogenous schedule; its reference policy issues
   no discretionary commands. At the requested tick, the driver retains
   `snapshot()` with model, scenario, seed, tick, protocol and schedule
   identity. A treatment arm is compared only with the snapshot having matching
   identities and the same exact tick; absent or mismatched data is unavailable,
   not a benefit. The browser’s paired-reference display follows the same rule.
   R01’s **current-process reference** is not automatically the game's
   `no-discretionary-action-v1` paired policy; R01 must define and version its
   control policy before treating it as a control arm.
4. **R01 experiment.** R01 protocol v1.0 specifies the current-process,
   organizational-reform, conventional-integration, agentic-coordination and
   non-agentic-modernization arms; common referral demand, clinical rules,
   staffed capacity, external shocks and implementation envelope; and run/seed
   as the analysis unit. An experiment driver can vary only each arm’s
   versioned policy, sending its allowed workflow commands to `applyCommand`.
   It must create arms from the same frozen inputs and paired seed/schedule,
   use the same `advanceOneTick` model, and retain every referral outcome and
   requested snapshot. These workflow commands, the 336-episode workload and
   its R01 endpoint adapter are not implemented by this design or the current
   Minister council UI; implement and validate them incrementally under R03.

## Authority, versions and historical outputs

- **Minister:** `site/minister.html` is the current supported Minister
  executable; its inline code owns model 10. Its `MoC.care.snapshot`,
  `MoC.care.compare`, `MoC.record`, per-tick `tick()` and paired-reference
  messages are existing implementation points, not yet this public interface.
  The existing `scripts/benchmark_minister_strategies.cjs` opens the Minister
  page in Playwright and drives that page, so it uses the page’s current source
  when run; it is a strategy smoke runner, not the R01 harness.
- **Minister archived results:** `scripts/output/minister_strategy_benchmark.json`
  and `minister_strategy_matrix_20seeds.json` identify model 3;
  `minister_strategy_matrix_political_20seeds.json` identifies model 4.
  Their summaries describe those historical executables and policies. They
  are not model 10 results, not R01 arms, and must not be relabeled or pooled
  with future R01 runs.
- **World:** `site/world.html` is a separate, independently maintained browser
  simulation. `scripts/research_run.cjs` and `scripts/replay_recorder.cjs`
  extract its inline script; `scripts/scenario_runner.cjs` patches that
  extracted source. The `deep_research`, `replay_*`, `scenario_*` and
  `persona_*` outputs under `scripts/output/` are historical World-run
  artifacts. Their own README/metadata may record a date, runner or mode, but
  they do not establish equivalence to Minister or to a versioned R01 model.
- **Backend:** `src/` is a third, independently implemented Node.js
  development/research model. Its FHIR, agent, disease and orchestration
  modules do not execute Minister’s care rules. No output from World or the
  backend is a Minister result merely because it uses similarly named
  parameters or agents.

Therefore World, backend and Minister retain separate owners and model-version
spaces. Do not port rules between them as part of this boundary task. Any future
reuse requires an explicit source/owner decision, parity fixtures and its own
versioned evidence. Preserve old outputs as archives with their known
provenance and limits; rerun an experiment from the selected authoritative
model rather than attempting to repair historical labels.

## Incremental migration and verification

1. **Freeze the baseline.** Keep the supported Minister scenarios, model 10
   outcomes, `no-discretionary-action-v1` matching rules, named-resident
   consequences, F08 command/event/replay behavior and public shell unchanged.
   Record golden initial, post-council, per-tick patient and exact-tick paired
   snapshots from the current page before moving code.
2. **Introduce the seam in place.** Route one real council command and the
   existing clock through the proposed ports while the implementation remains
   in the page. Verify no render/pause action advances care, command receipts
   and F08 events agree, and same-seed tick snapshots are unchanged.
3. **Extract only the proved deterministic core.** Move the smallest state,
   command-validation, clinical/resource transition, event and snapshot code
   needed by those fixtures into one browser-and-Node importable module. Keep
   canvas/DOM, policy UI, audio, persistence, reference transport and analysis
   outside it. The browser and experiment driver must import that same module;
   do not extract/patch HTML strings or copy the tick logic into a runner.
4. **Prove parity before research runs.** Run the existing Minister browser,
   care, paired-reference and F08 replay regressions against the extracted
   implementation. Add direct module fixtures for identical seeded
   initialization, command receipts, patient transition/event order, exact
   paired snapshots, renderer-independent ticks and same-record replay. Compare
   full state/events, not only summary metrics.
5. **Unlock R01 separately.** Implement its cohort, strategy policies,
   resource/cost ledger and endpoints only after this parity gate and the
   R01 input/analysis freeze. Run development seeds first; label any protocol
   or outcome-affecting rule changes with new versions before confirmatory
   runs.

Keep `modelVersion` for outcome-affecting rules, `protocolVersion` for the
paired policy/schedule/matching contract, and command/event/replay schema
versions distinct. A behavior-preserving extraction does not by itself change
the model or R01 protocol; changed outcomes or comparison semantics do. The
F08 executable identity must still reject a record from different executable
bytes, even when the declared model version is unchanged. Existing replay
schema and its visible incompatibility behavior remain the compatibility
contract.

No dependency or build tooling is needed for this design. Native browser and
Node.js ES modules, the existing Node test runner and installed Playwright
support the proposed shared-module seam without a framework or bundler.

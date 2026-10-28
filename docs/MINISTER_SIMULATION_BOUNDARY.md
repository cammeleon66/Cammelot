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
const tickResult = run.advanceOneTick(cursor);
const events = run.eventsSince(cursor); // exactly tickResult.events
const snapshot = run.snapshot();
```

These are proposed ports, not current exported functions. `createRun` validates
the scenario, seed, versioned input manifest and external schedule, then returns
the initial snapshot at elapsed tick zero. `applyCommand` accepts only a
whitelisted command valid in the current model context and returns its applied,
no-effect or rejected receipt plus an event cursor; events are read from the one
authoritative event stream. `advanceOneTick(previousCursor)` advances exactly
one synchronous logical tick and returns its ending tick, snapshot and exactly
the ordered events returned by `eventsSince(previousCursor)`; it does not read
wall-clock time. `eventsSince(cursor)` is the sole event source for commands and
ticks and returns the ordered facts plus the next cursor. `snapshot` returns a
detached, JSON-serializable point-in-time value; callers cannot mutate model
state through it.

Every event and snapshot carries one immutable `RunIdentity`, compared as a
whole rather than field-by-field with omitted identity fields:

```js
{
  modelVersion,
  modelExecutableId,
  scenario,
  seed,
  tick,
  protocolVersion,
  scheduleId
}
```

`modelExecutableId` is SHA-256 over a canonical UTF-8 manifest of sorted logical
source-unit names and SHA-256 digests of the exact bytes for every shared,
outcome-producing model module. Concretely, hash each module's raw bytes to
lowercase hex, sort entries by logical name, serialize as
`JSON.stringify(entries.map(({ name, sha256 }) => [name, sha256]))`, encode as
UTF-8 and SHA-256 that manifest. The browser uses Web Crypto on the verified
same-origin module response bytes it loads; Node reads those same module files
and hashes their raw bytes with `node:crypto`. Both use the same manifest names,
ordering, encoding and hash operation, so the common model identity is equal
across runtimes and changes when a shared module changes. Browser module assets
must remain byte-stable for run initialization and their digests must be
verified before the run starts. Do not use DOM source extraction or a Git
revision as a substitute for the module bytes.

F08 now carries separate `modelExecutableId` and `replayExecutableId` values.
The browser computes the model identity from the raw bytes of
`site/minister-model-core.js`; its replay identity uses a canonical manifest of
those bytes and the inline command/replay adapter. The Node identity helper reads
the same module bytes and uses the same canonical manifest algorithm.
`executableId` remains an alias for the replay identity in command-record schema
2. The declared model version remains unchanged by this behavior-preserving
extraction. The shared module currently contains deterministic clock and random
primitives; it is not yet the complete `createRun` boundary described above.
A Node experiment run records its own versioned policy/driver identity and does
not claim to be the browser replay executable. Any host adapter that can affect
outcomes must be included in that host's execution identity. A module-only byte
change changes the model and replay identities and refuses an older record.
Incompatible records must fail visibly rather than silently matching.

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
   `snapshot()` and its complete `RunIdentity`. A treatment arm is compared only
   with the snapshot whose entire `RunIdentity` matches, including exact tick,
   model executable, protocol and schedule; any mismatch is unavailable, not a
   benefit. The browser’s paired-reference display follows the same rule.
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
   requested snapshot. A bounded command/run fixture is implemented under R03;
   the 336-episode workload, full five-arm policies and R01 endpoint adapter
   remain unimplemented by this design and the current Minister council UI.

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
  World outputs currently have no stable model-version identity or executable
  content hash, and do not establish equivalence to Minister or to a versioned
  R01 model. Cammelot maintainers of the World page own any future World-only
  version space.
- **Backend:** `src/` is a third, independently implemented Node.js
  development/research model. Its FHIR, agent, disease and orchestration
  modules do not execute Minister’s care rules. Backend outputs likewise
  currently have no stable model-version identity or executable content hash.
  Cammelot maintainers of `src/` own any future backend-only version space. No
  output from World or the backend is a Minister result merely because it uses
  similarly named parameters or agents.

Therefore World, backend and Minister retain separate owners and model-version
spaces; those spaces are not interchangeable. Minister already has a declared
model version and F08 executable hash, while World and backend outputs are
currently unversioned and unidentified by executable. Do not port rules between
them as part of this boundary task. Any future reuse requires an explicit
source/owner decision, parity fixtures and its own versioned evidence. Preserve
old outputs as archives with their known provenance and limits; rerun an
experiment from the selected authoritative model rather than attempting to
repair historical labels.

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
   Compute `modelExecutableId` over the shared module bytes in both runtimes as
   specified above. The browser's F08 `replayExecutableId` must also cover the
   command/replay adapter bytes, not just `document.currentScript`. A
   module-only source change with the page shell unchanged must change the
   identity and make replay of the prior record fail visibly.
4. **Prove parity before research runs.** Run the existing Minister browser,
   care, paired-reference and F08 replay regressions against the extracted
   implementation. Add direct module fixtures for identical seeded
   initialization, command receipts, patient transition/event order, exact
   paired snapshots, renderer-independent ticks and same-record replay. Add a
   negative replay fixture that changes only the shared module bytes while
   keeping the page shell, declared model version and record unchanged; verify
   the old record is refused. Compare full state/events, not only summary
   metrics.
5. **Unlock R01 separately.** Implement its cohort, strategy policies,
   resource/cost ledger and endpoints only after this parity gate and the
   R01 input/analysis freeze. Run development seeds first; label any protocol
   or outcome-affecting rule changes with new versions before confirmatory
   runs.

### R03 bounded workflow implementation

The shared `site/minister-model-core.js` exports a deterministic R03 `createRun`
for a bounded workflow fixture; it is separate from Minister model 10 and does
not route the live game through this new workflow. It accepts a frozen episode
list, identified external schedule, seed, capacities, intervention identifier,
and executable identity. Its run methods are `applyCommand`, `advanceOneTick`,
`eventsSince`, and `snapshot`. State mutation is limited to one tick transition
or a validated, whitelisted non-clinical command. The experiment driver—not the
renderer—chooses policy commands.

The stage states are:

| State | Meaning |
|---|---|
| `scheduled` | Demand has not arrived yet. |
| `handoff_pending` | Referral is present and awaits non-clinical handoff work. |
| `information_required` | A coordinator requested missing information; it remains in this state until the shared external schedule supplies it. |
| `specialist_waiting` | Handoff is complete and the episode is waiting for an existing treatment-start slot. |
| `treatment_started` | Terminal: a shared specialist treatment-start slot was consumed. |
| `died_waiting` | Terminal: death occurred before treatment under the frozen fixture schedule. |
| `refused`, `relocated`, `other_exit` | Distinct terminal exits; none is counted as treatment or a successful referral. |

Clinical condition is orthogonal to workflow stage. The fixture records
`clinicalState` (`stable` or `critical`), `everCritical`, and `criticalAt`;
therefore later treatment does not erase a prior critical-state crossing.
Scheduled death is processed before treatment starts at the same tick. The
current fixture does not model recovery, an intermediate treated state, live
clinical validation, or the full 180-day R01 endpoint adapter.

Each snapshot contains the entire run identity, named resource capacities and
use, stage/outcome counts, and each episode's trace. A trace item is an ordered
pointer to the authoritative run event:

```json
{
  "id": "patient-17",
  "arrivalTick": 0,
  "startingWaitTicks": 8,
  "elapsedWaitTicks": 9,
  "stage": "specialist_waiting",
  "clinicalState": "stable",
  "everCritical": false,
  "criticalAt": null,
  "trace": [{
    "eventId": "event-4",
    "tick": 1,
    "kind": "handoff_completed",
    "from": "handoff_pending",
    "to": "specialist_waiting",
    "reason": "The complete referral was handed to the specialist queue.",
    "resource": "coordination"
  }]
}
```

Events have a monotonically increasing sequence, elapsed tick, patient (or
`null` for a run-level receipt), transition, reason, and complete run identity.
`eventsSince(cursor)` is the authoritative ordered stream; a tick returns the
same event slice and next cursor. Snapshots and event slices are detached JSON
values. Each command receipt records applied, rejected, or no-effect status;
rejected commands do not change pathway state or consume a clinical slot.

The deterministic R01 intervention configurations alter named workflow
mechanisms, not outcome scores:

| R01 alternative | Declared mechanism in the fixture |
|---|---|
| Current process | Two coordination work units per handoff. |
| Organizational reform | Adds one bounded human-coordinator work unit per tick; handoff effort stays two units. |
| Conventional integration | Shared referral status/records reduce handoff effort to one unit. |
| Agentic coordination | Non-clinical agent commands use the same one-unit integrated handoff and capacity as conventional integration; no autonomous outcome or capacity bonus is applied. |
| Non-agentic modernization | One rules-based workflow reduces handoff effort to one unit by removing duplicate entry. |

These are explicit illustrative mechanism assumptions, not estimated effects
or a complete implementation of the five R01 arms. All arms retain identical
specialist treatment-start capacity, clinical event rules, patient inputs and
external schedule. Policies must submit allowed commands; configuration alone
never starts treatment. The hand-checkable four-referral fixture shows the
local metric move: conventional integration routes three referrals to the
specialist side while the fragmented workflow routes one. With one available
specialist start in the tick, both arms start exactly one treatment. The
downstream treatment slot is the reason the local handoff improvement does not
change the end-to-end treatment count in this fixture.

**Model-version decision.** R03 is a distinct executable with model version
`minister-r03-cardiology-pathway-2` and protocol `r01-cardiology-v1.0`; its
version is bumped from R03 v1 because the explicit intervention-to-resource
mapping changes pathway outcomes. This does not change Minister
`minister-care-10-access-time-replay` or its public browser care rules. Browser
parity was checked against commit `4e6616b` with the same Cabinet Crisis seed
60475 through elapsed tick 80: the complete JSON state, care snapshot, resident
outcomes, queues, event log (excluding wall-clock timestamps), graves, and
environment log were byte-identical. The unchanged Minister browser/care/
paired-reference/F08 tests also passed in the full 238-test run. The separate
module parity test confirms Node and browser load the same deterministic
primitives, and the negative replay test refuses a record after only the shared
module bytes change.

This bounded fixture does not implement the approved 336-episode workload, five
years of follow-up, implementation lifecycle costs, policy drivers for all
arms, named-resident mapping, 180-day/84-day endpoints, uncertainty analysis,
equity reporting, or confirmatory R01 runs. Its results are software fixtures
and modeled process illustrations, not clinical or economic evidence.

Keep `modelVersion` for outcome-affecting rules, `modelExecutableId` for the
shared module bytes, `protocolVersion` for the paired policy/schedule/matching
contract, and command/event/replay schema versions distinct. A
behavior-preserving extraction does not by itself change the model or R01
protocol; changed outcomes or comparison semantics do. `RunIdentity` compares
these version and run fields as a unit. F08's `replayExecutableId` must still
reject a record from different page-adapter or module bytes even when the
declared model version is unchanged. Existing replay incompatibility must be
visible and fail closed.

No dependency or build tooling is needed for this design. Native browser and
Node.js ES modules, the existing Node test runner and installed Playwright
support the proposed shared-module seam without a framework or bundler.

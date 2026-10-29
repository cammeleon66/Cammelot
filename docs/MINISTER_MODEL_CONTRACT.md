# Minister model contract

**Status:** Selected engineering target contract; not clinical validation. **Audited baseline:** [`bb6df6490ceb56e68cc8922ae167660ac6079b18`](https://github.com/cammeleon66/Cammelot/commit/bb6df6490ceb56e68cc8922ae167660ac6079b18), model `minister-care-5-rollout`. **Verified deployed model:** `minister-care-10-access-time-replay` ([publication evidence](MINISTER_RELEASE_STATUS.md#verified-model-10-publication)); the unreleased B03 worktree successor is documented below. **Paired-reference protocol:** `no-discretionary-action-v1`.

The proposed, non-implementation simulation boundary for R02 is documented in [MINISTER_SIMULATION_BOUNDARY.md](MINISTER_SIMULATION_BOUNDARY.md).

This contract describes the Minister policy game only. Verified behavior below is distinct from selected target rules. The target rules are bounded engineering choices for subsequent implementation, not evidence of clinical validity, calibrated parameters, or claims that outcomes will improve. The audit summary and browser evidence in issue [#1](https://github.com/cammeleon66/Cammelot/issues/1) are the supplied evidence; no private audit artifacts are assumed.

## Verified current behavior

### Authority, public modes, and hosting

- The authoritative Minister executable is the inline simulation and policy code in [`site/minister.html`](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html). It runs the care model in the browser. The two cards exposed by the public picker are **Cabinet Crisis** (`cabinetcrisis`, 8 quarters) and **The Full Term** (`campaign`, 40 quarters). They share the same executable and care rules, with different scenario initial conditions and horizons; they are not IST/SOLL toggles. See [scenario and clock definitions](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L1419-L1501) and [picker regression coverage](../tests/minister_browser.test.js#L45-L87).
- `sprint`, `zeeland`, `codeblack` and `sandbox` remain addressable in source as legacy hash scenarios, but are not public picker modes and are not covered by this support contract.
- The release-status record identifies [cammelot.org/minister.html](https://cammelot.org/minister.html) as the public game and reports GitHub Pages/CI and the optional Azure App Service leaderboard as operational. The supported public game path is therefore the static Minister page on that site. The leaderboard is a separate optional service; it is not part of clinical execution. See [release status](MINISTER_RELEASE_STATUS.md) and [leaderboard operations and limitations](COMMUNITY_LEADERBOARD.md).
- Local HTTP serving is a documented development/test path (`python -m http.server` in the [README](../README.md)); it does not provide the public leaderboard service. Docker/nginx is documented but is not a supported release path under this contract. `file://` and other hosts are unsupported.
- `site/world.html` is a separately implemented, publicly accessible simulation; the modular `src/` backend is also separate and does not execute Minister care. Neither has a support or validation claim under this Minister contract. Older architecture descriptions are historical context, not evidence of Minister execution ([ADR-001](ADR.md#adr-001-frontend-first-architecture-all-simulation-logic-in-v4html-no-bundler), [README](../README.md)).

### Time, state, and units

- A logical `cycle` is an integer simulation tick; the Minister policy calendar uses **4 ticks per week**, **52 ticks per quarter**, and **208 ticks per 4-quarter year**. Disease progression is also evaluated every fourth cycle. Tick execution is fixed-step and separate from rendering, pausing, and reading time; wall-clock speed controls how quickly ticks are run, not their model duration. See [clock constants](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L1483-L1486), [tick](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L7237-L7249), and [regression checks](../tests/minister_browser.test.js#L89-L151).
- The initialized `cycle` is **30**, not zero. The calendar boundary is calculated from absolute cycle (`floor(cycle / 52) + 1`), so the first displayed quarter is shorter than 52 advances. This offset is not currently normalized into an explicit elapsed-term clock. The annual background-pressure update also uses absolute cycles.
- Current model state uses health points (HP; nominally 0–100), age in years, ordinal disease severities, waiting time in weeks, capacity in routine treatment starts per week, budget in euros, trust/adoption/absence as fractions or percentage-like scores, AI/drain as multipliers, and scenario/horizon in integer quarters. The source does not validate a unified parameter schema or upper bounds for every control. Observed starting values include IST admin 0.30, staff absence 0.08, norm 12 weeks, AI multiplier 1.0, drain multiplier 1.0; SOLL values are 0.05, 0.05, 4 weeks, 1.34 and 0.30 respectively. Minister starts with IST policy state; the standalone World mode switch is not this game's mode switch. See [parameter defaults](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L1825-L1833).
- The code's background mortality calculation uses `48/5000/(365*4)` per tick and labels its divisor “4 ticks/day”; its age multipliers are 1.5, 5 and 15 at ages 45, 65 and 80. Resident ages are not advanced by the Minister tick. This differs from the 4-tick/week policy clock and is not a validated annual mortality implementation. Do not present the displayed result as calibrated annual mortality. See [background mortality and disease progression](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L7338-L7352).

### Care resources, waits, and deaths

- `specialistCapacity` is a nominal rate of **routine treatment starts per week**, not beds, available staff headcount, completed treatments, or realized throughput. Routine admission starts accrue service credit per tick; the current helper also limits them by an occupancy-like `staffedSlots = ceil(rate × 2.5)` (minimum one) less the count already receiving hospital care. Started treatment has its own simulated duration. The number actually started is realized throughput and can be below the nominal rate due to demand, occupancy, or integer credit. See [capacity helper](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L12501-L12535) and [routine admissions](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L8012-L8061).
- A tracked referral episode has a start and end tick and currently ends as `treatment_started`, `died_waiting`, `relocated`, or `other_exit`. The live “waiting” snapshot includes patients travelling to hospital, emergency patients, and those in the hospital queue; it is not simply queue length. In particular, an emergency episode can have zero displayed wait. These episode counts are model bookkeeping, not a complete measure of access.
- Critical/low-HP patients can enter the emergency pathway and bypass the hospital queue and routine admission gate (`availableStarts`), going directly to treatment. After admission, they are set to `at_hospital` and included in the shared occupancy count passed to `availableStarts`; an emergency resident therefore counts against the shared occupancy limit and can reduce or block subsequent routine starts until treatment ends. The current path has no separately bounded emergency resource or overflow queue. See [emergency trigger](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L7392-L7412), [emergency admission](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L7828-L7844), and [shared occupancy check](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L8016-L8017).
- A `system_failure` grave marker means the model assigned the system-failure cause when HP reached zero, including a terminal disease transition for selected conditions. A `natural` marker is assigned by the separate background hazard. The result UI calls the first category “model-classified system deaths”; neither label establishes real-world causation or preventability. “Deaths before treatment” counts tracked referral episodes ending in death, not all system-classified deaths. See [death handling](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L7278-L7307), [disease terminal states](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L7380-L7387), and [paired result wording](MINISTER_REFERENCE_PROTOCOL.md#matched-date-results).
- The executable declares model `minister-care-5-rollout` and paired-reference protocol `no-discretionary-action-v1`. Matched snapshots require matching model, scenario, seed, and tick; reference data also checks protocol and schedule identity. Previous-attempt local storage is keyed by model/scenario/seed; leaderboard requests include model version and scenario; old-version links warn that the current town cannot reproduce the older outcome. This warning does not provide an old executable. See [version and snapshot checks](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L12501-L12575), [previous-attempt record](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L12667-L12673), and [leaderboard filtering](COMMUNITY_LEADERBOARD.md#public-data).

### Inputs, rules, controls, and outputs

- **Empirical context:** project documentation attributes population, disease, mortality, tariff, and workforce context to sources including CBS, RIVM, NZa and IZA. A source label alone does not make a game coefficient calibrated. Each empirical input used quantitatively should have a traceable source, reference date, transformation, unit, and uncertainty.
- **Assumptions:** the 45 named-resident implementation, scenario starting values and horizons, age multipliers, disease transitions, the 12-week policy norm, routine capacity/occupancy algorithm, deterministic shock schedule and shock effects are model assumptions or gameplay abstractions unless separately evidenced. The [paired-reference protocol](MINISTER_REFERENCE_PROTOCOL.md#shared-environment) explicitly labels its shock coefficients and schedule as assumptions.
- **Authored policy rules:** interventions, laws, eligibility, adoption scaling, political thresholds, and effects in the Minister executable are game rules, not empirical findings. For example, recruitment increases the routine start rate; scribes change admin burden; law effects are applied through the same policy-effect mechanism. See [representative intervention definitions and application](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L12774-L12857) and [law enactment](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L14480-L14499).
- **Measured outputs:** tick-indexed counts and summaries (e.g. queue/episode state, treatment starts, deaths by model classification, HP, trust, budget, admin and burnout) describe this run under this executable and seed. Seeded repeatability is a software property, not clinical validation, causal attribution, or evidence that every beneficially described intervention must improve every outcome.
- Current executable paths show admin burden affecting GP queue blocking and overdue-wait HP drain; the referral norm affects deterioration and norm reporting; drain multipliers affect passive disease drain; routine capacity affects routine starts. The aggregate sick-leave percentage is displayed and changed by policies/shocks, while individual GP timers gate some GP queue service; the aggregate percentage is not itself the timer/queue gate. The AI multiplier is included in displayed effective-capacity arithmetic but is not the routine hospital start-rate control. Recruitment changes starts/week. See [HP drain and policy rule](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L4248-L4283), [GP queue and capacity path](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L7978-L8017), and [effective policy scaling](https://github.com/cammeleon66/Cammelot/blob/bb6df6490ceb56e68cc8922ae167660ac6079b18/site/minister.html#L12903-L12923).

## Selected target contract

These are bounded engineering decisions for subsequent work. They are selected to make behavior explicit and testable while retaining the two public modes and current game shell. They do not claim clinical validation, empirical calibration, or delegated clinical approval.

1. **One supported Minister model.** `site/minister.html` is the authoritative executable for Minister. Support the public static GitHub Pages path for that page and local HTTP only for development/tests. The two supported scenarios remain Cabinet Crisis (8 quarters) and Full Term (40 quarters), each identified separately in results. The optional leaderboard is not required to run the care model. World remains a separately accessible but independently unsupported/unvalidated model under this contract; the modular backend is research/development code, not an alternate Minister runtime. Docker/nginx and `file://` are not supported release paths.
2. **One elapsed simulation clock.** Define one tick as ¼ policy week; 4 ticks = 1 week, 52 weeks = 1 model year, 13 weeks = 1 quarter, 52 ticks = 1 quarter, and 208 ticks = 1 model year. Preserve the current cycle-30 initialization only as a startup/render offset; all model time starts at elapsed tick 0. Quarter boundaries, wait duration, disease transitions, aging, scheduled shocks, and background mortality must use elapsed ticks, not the startup offset or wall time. Convert an annual mortality probability `p` to the equivalent per-tick probability `1 - (1-p)^(1/208)` when such an input is explicitly defined. This resolves the clocks as an engineering convention; it does not establish that existing mortality rates or disease rates are clinically valid. [F02](https://github.com/cammeleon66/Cammelot/issues/2) owns implementation and regression evidence.
3. **Units and bounds.** Store the unit with each parameter. Use integer elapsed ticks `>= 0`; waits in weeks `>= 0`; age in years in `[0,130]`; HP in `[0,100]`; disease severities from the declared enum; probability/admin/absence/adoption fractions in `[0,1]`; stakeholder trust in points `[0,100]`; nominal service rates in starts/week `>= 0.25`; scenario duration as a positive integer number of quarters; scenario initial budget and intervention cost in euros `>= 0`; and AI/drain multipliers as finite values `> 0`. Invalid, non-finite, or out-of-range inputs are rejected or made explicitly unavailable, never silently clamped into a different claim. These are data-contract bounds, not epidemiological assertions. Preserve current observed values where in range; any changed numeric parameter still requires explicit model-versioning and provenance.
4. **Capacity and occupancy.** Report nominal routine capacity as treatment starts/week, actual starts and completions as separate realized-throughput counts over a stated interval, and occupancy as patients currently receiving treatment in a named finite resource. Routine treatment occupancy is limited by the current declared slot rule until F04 replaces it with an explicitly named resource; do not label it bed count or staff headcount. Emergencies use one separately declared emergency treatment place (a gameplay engineering assumption, not an empirical estimate), with its own occupancy counter. It does not increase routine capacity.
5. **Emergency overflow is queued.** Preserve emergency clinical priority, but do not allow unlimited direct admission or silently deny admission. If the one emergency place is occupied, the patient enters a visible emergency overflow queue, retains a referral/wait episode, and begins emergency treatment when the place frees. Count overflow and emergency treatment starts separately; record routine displacement only if the implementation actually causes it. Apply the same declared elapsed-time disease/HP rules during overflow, without adding an emergency-only mortality coefficient. This is the smallest explicit finite-resource rule that preserves access bookkeeping and avoids inventing an outcome penalty; the one-place assumption and resulting outcomes remain unvalidated gameplay assumptions. [F04](https://github.com/cammeleon66/Cammelot/issues/4) owns implementation and fixtures.
6. **Wait and death reporting.** A waiting episode starts at referral/entry to the specialist pathway and ends at treatment start, death, relocation, or another explicitly named exit. Report current waiting, completed episode waits, emergency overflow, and treatment starts separately; all durations use the common clock. Continue using `model-classified system deaths` for the existing system-failure category and `background-hazard deaths` for the background mortality category. Do not call either category proven preventable or real-world causal. Report deaths before treatment only for episodes ending in death before treatment; do not equate this with all system-classified deaths.
7. **Tie controls to observable mechanisms.** Admin fraction changes GP queue/service delay and the declared overdue-wait rule, not specialist capacity. Absence fraction reduces available GP service opportunities, not hospital starts. Recruitment changes nominal routine specialist starts/week and corresponding routine occupancy slots. AI productivity multiplier scales declared GP clinical service opportunities only; triage may change priority ordering, but AI does not silently create specialist starts or change disease outcomes. Adoption scales only the intervention mechanisms it names. Drain multipliers affect the documented HP-drain process. Report nominal GP/service capacity and realized visits/starts independently. These mappings describe intended software mechanisms, not empirical causal effects; a policy may have mixed or worse outcomes.
8. **Evidence classes.** Keep externally sourced context separate from numerical model inputs. Every empirical input used quantitatively must record source, reference date, transformation, unit, and uncertainty; missing evidence is labeled unknown rather than inferred. Scenario values, age multipliers, transitions, resource sizes, event schedules/effects, and policy coefficients are assumptions or authored game rules unless independently sourced and validated. Measurements describe only the run and executable. Same-seed repeatability is a software invariant, not calibration, causal attribution, or clinical validation.
9. **Versioning and incompatible records.** Assign a new immutable, unique model version for any outcome-affecting change to clock/initialization, scenario identity or starting state, parameter values/semantics, transitions, resource/overflow rules, policy mapping, event schedule/RNG, wait/death classifications, or score semantics. UI-only changes need not change the model version. Change the reference protocol version when the comparison policy, schedule contract, or matching rules change. Every result and leaderboard row is keyed by model version, scenario, seed, ending tick, and source revision; paired results additionally carry protocol and schedule/reference identity. Never rank or compare across incompatible versions or unequal ending ticks. Keep historical leaderboard rows version-filtered. A replay record retains those identifiers and decisions; it is replayable only when that exact executable is available, otherwise show it as an archived, non-reproducible prior result. “Try another approach” remains a comparison, not automatic re-execution ([reference protocol](MINISTER_REFERENCE_PROTOCOL.md#replay), [leaderboard contract](COMMUNITY_LEADERBOARD.md#public-data)).

## Follow-on implementation ownership

| Selected rule or evidence task | Owner |
|---|---|
| Common elapsed clock, cycle-30 offset, waiting, disease progression, aging, and background hazard conversion | [F02](https://github.com/cammeleon66/Cammelot/issues/2) |
| Explicit finite routine/emergency resources, overflow queue, occupancy, and throughput counters | [F04](https://github.com/cammeleon66/Cammelot/issues/4) |
| Make admin, absence, recruitment, AI productivity, and adoption affect the named service processes above | [F05](https://github.com/cammeleon66/Cammelot/issues/5) |
| Verify the supported hosting paths and gate releases on regression evidence | [F09](https://github.com/cammeleon66/Cammelot/issues/9) |
| Maintain provenance and external evidence for empirical inputs; retain uncertainty where evidence is absent | Model documentation/research work; no claim of clinical validation is made by F01 |

F01 selects these semantics and records ownership; it does not implement these follow-on changes or claim that any dependent issue is complete.

## F04 implementation: model 8 finite resources

The “Verified current behavior” section above records the original model-5 audit, not the new executable's resource rules. Model 8 publication was verified on 2026-10-26. Model 8 implements the finite-resource target as follows; [focused evidence](MINISTER_RELEASE_STATUS.md#f04-implementation-evidence) records reproduction and regression criteria.

- **Named resources:** one concurrent consultation at each of `gp1_bldg` and `gp2_bldg`, `ceil(specialistCapacity × 2.5)` routine hospital treatment places (minimum one), and **one separate emergency treatment place**. These are gameplay places, not empirical beds or staffing estimates. Infrastructure staff do not occupy resident treatment places.
- **Routine credit:** accrue `specialistCapacity / 4` starts per elapsed tick, once per tick, capped at `max(1, specialistCapacity / 4)`; spend one credit only on an actual routine admission. Full occupancy, absent demand and stale/duplicate queue entries cannot create extra credit. Recruitment retains its existing starts/week mapping; F04 does not retune workforce or policy effects.
- **Emergency access:** low-HP critical/severe residents can escalate from GP care, routine queues or travel, including already-referred residents. Escalation releases the GP place and preserves the referral start. Ready emergencies compete by existing clinical priority, then elapsed wait and resident ID. They use only the emergency place, not routine places or credit. Routine admissions retain their existing clinical triage and can run concurrently; **routine displacement is zero by construction**, not an inferred clinical benefit.
- **Overflow bound:** one waiting record per living, non-relocated named resident, bounded by the finite resident roster size (45 generated residents nominally; use the actual roster count, not a fixed queue truncation). No patient is dropped when the place is full. Overflow is not treatment or extra capacity. It is separately visible in the Ministry, resident context, result care report and tick snapshots. Overflow entries, emergency starts/completions and overflow deaths before treatment are reported separately. Travel/overflow use the existing untreated HP/wait and weekly disease rules, with **no new emergency mortality coefficient**.
- **Lifecycle conservation:** a visit acquires one named resource and releases it once, with completion, death, transfer, relocation or other exit recorded. Initial ongoing care is counted separately from new starts. Recovery occupies no treatment place. Releases occur before queued admissions, including terminal death cleanup. Stale releases from a completed visit cannot free a re-entered visit. GP sick-leave timers block new consultations and pause active service while retaining occupancy; aggregate absence/productivity mechanisms remain F05 work.
- **Capacity reductions:** already occupied routine places are not evicted when the nominal rate falls. Occupancy above the new target is displayed as **retiring places**; those places disappear as their current visits end. No new routine admission is allowed until occupancy is below the new target. Initial/restored occupancy uses the finite gate; excess occupants enter the appropriate waiting queue.
- **Reporting interval:** resource starts, completions, initial occupants and releases are cumulative from elapsed tick 0 through the snapshot tick; occupancy and overflow are point-in-time counts. For each resource, `initial + starts = occupancy + releases`; completions are a subset of releases, excluding deaths and transfers.

These outcome-affecting rules require model 8. Replay keys, reference matching and leaderboard filters use that new model identity; model 7 results must not be compared or ranked as equivalent. The reference-policy protocol is unchanged. F02's elapsed clock, startup display offset and terminal mortality ordering remain intact. This is software conservation evidence, not calibration, validation of the one-place assumption, or a prediction of improved mortality. F05 workforce tuning and F07 effect corrections are not implemented here.

## F05 implementation: model 9 workforce/productivity

The working executable is `minister-care-9-workforce-productivity`. **The verified public release remains model 8.** This section supersedes the model-5 audit and model-8 deferral only for workforce/productivity semantics. Protocol `no-discretionary-action-v1`, schedule generation, matching rules, scenario inputs and horizons are unchanged. These are bounded engineering assumptions, not empirical effectiveness estimates, clinical validation or a technology preference.

### Executed GP mechanism and non-double-counting assumption

Model 8's aggregate absence and AI fields did not reach GP processing: with fixed RNG and six queued residents, 16 actual ticks produced four starts/three completions both at absence 10% versus 80% and productivity ×1 versus ×3. Named GP sick-leave timers instead came from burnout. The old GP admission gate randomly blocked with probability `admin × 0.3`, then every active consultation consumed one tick regardless of aggregate absence/productivity.

Model 9 keeps the two one-place GP practices and the existing random **3–5-unit consultation workload**. Each active consultation now consumes clinical work rather than one unconditional timer unit:

```
N = number of named GPs (currently 2)
P = number whose sickLeaveTimer is zero
available provider-equivalents = min(P, N × (1 - aggregate absence))
work per on-duty GP per tick =
    P > 0 ? available provider-equivalents / P × (1 - admin) × AI productivity : 0
nominal GP work/week = 4 × N
available GP clinical work/week = 4 × P × work per on-duty GP per tick
```

**Absence is a town-wide minimum unavailable fraction.** Named burnout absences count toward that floor; they are not multiplied by a second aggregate absence penalty. For example, with one of two GPs absent and aggregate absence 25%, the remaining GP is not penalized again. At aggregate absence 60%, only 0.8 provider-equivalents remain available across the town. This overlap assumption is deliberately simple; it is not a fitted workforce model. Burnout accumulation, recovery, timer duration and queue redistribution are unchanged.

Admin reduces the remaining work once; the old random admission-admin gate is removed. Admission requires positive available work and a free GP place. Active work stops at admin 1, absence 1 or named provider absence while retaining the consultation place. Productivity multiplies GP work only, not admin savings again, not hospital starts and not disease progression. Idle or excess work is **not banked**; one consultation can complete per practice per tick at most, with a new admission after release. Fractional work can lengthen the consultation across many ticks. This is not a full scheduler: very high productivity encounters a tick/concurrency ceiling, and absent demand, travel, downstream places and routine credit can prevent additional throughput.

### Surfaced controls → state → service → measured output

Shop effects pass through `effectivePolicy` → `shopPlan` → `projectCarePlan` → `commitCarePlan`. Council choices and laws use the same complete-plan projection/commit boundary; `applyFx` and `applyTimedFx` are single-plan wrappers. Care-bearing flash choices use declared possible effects, not mutating preview callbacks. Scheduled shocks use the same care projection and future-obligation validation before state mutation. Playground presets, sliders and URL parameters validate before replacing parameters (legacy presets are not additional supported Minister scenarios).

| Control / named sources | Executed state and process | Player-visible measurement / limits |
|---|---|---|
| Paperwork: EchoScribe pilot/full rollout, Health Data Platform, Platform AI Applications; Cloud-First Records and Task Differentiation laws; admin-bearing decisions/temporary rollout and silo costs; admin slider/URL | `M.IST.admin` → `gpServiceCapacity` → active `at_gp.stateTimer` work consumption and positive-work queue gate. Also existing `overdueWaitDrainPerTick` multiplier `(1+admin)`, once, on overdue drain only. | Admin %, available GP work/week, GP starts/completions and queue; referral wait/HP drain downstream. Does **not** change specialist capacity. HP breakdown no longer adds an extra admin charge absent from execution. |
| Absence: GP Retention Fund, Regional Staffing Pool; morale/strike/flu/aging effects; absence slider/URL | `M.IST.sick` → aggregate-floor calculation above; named GP timers still pause their own service. | Aggregate absence %, on-duty service work, GP realized starts/completions; not hospital starts or specialist places. |
| Productivity: EchoScribe full rollout and AI-bearing decisions/outages; AI slider/URL | `M.IST.ai` → remaining GP work × multiplier, after admin and aggregate/named absence overlap. Existing political/event thresholds remain. | GP work/week and realized visits; no guaranteed mortality benefit. No implied cross-provider or disease multiplier. |
| Recruitment | `capacity:+1` → `GS.specialistCapacity` → existing routine service credit (`rate/4` per tick, capped at `max(1,rate/4)`) and `ceil(rate×2.5)` routine places. | Nominal starts/week, actual routine starts/completions, occupancy and retiring places. GP work is unchanged. |
| Referral mesh; AI Triage Gate / AI-Gated Specialist Access laws; capacity-bearing decisions/shocks | Explicit authored **routine rate** changes (mesh +1.5 at full adoption; laws +0.5/+1), not consequences of the AI productivity multiplier. The AI Triage Gate description no longer asserts an implemented GP request-screening mechanism. | Same routine rate/credit/place metrics as recruitment. No new specialist-rate mechanism or outcome coefficient is introduced in F05. |
| Adoption / Change Management Programme | `GS.adoptionRate` scales named admin/AI/routine-rate deltas for `scribes1`, `scribes2`, `a2a`, `twin`, `platformai`; drain factor becomes `1-(1-factor)×adoption`. No global adoption capacity factor. Change management retains its authored +0.15 increase up to full adoption. | Preview uses exactly the effective effect; 0 adoption means 0 named benefit, not fallback 0.7. The separate existing temporary rollout paperwork (+0.01 below 0.85) and burnout strain still apply. `platform` and `pilotgrant` have rollout costs but are not in the adoption-scaled-benefit list. Pilot copy discloses these costs rather than claiming no clinical effect. |
| Drain: Mirrorware twins, More Time for the Patient, Platform AI Applications, Community Health Workers, drain-bearing decisions/shocks and slider/URL | Positive `M.IST.drain` multiplier on passive disease HP drain in `calculateHPDrain`; existing overdue-wait, treatment/persona and comorbidity rules retain their separate roles. | HP-drain factor, per-resident breakdown, HP and model-classified deaths. It is **not** a GP/hospital capacity multiplier. |
| Storm warning: Use safe mode | Existing `liveScore = max(0, liveScore - 4)` only. | Explicitly labeled **score-only, no modeled service effect**. No GP work, routine rate, parameter or timed-effect change; no invented one-evening capacity modifier. |

Care snapshots now include `gpService` (nominal/available work per week, per-present-provider work per tick and provider counts). The care detail report separately shows GP starts/completions, routine starts/completions, occupancy and nominal routine rate. Resource counters retain the cumulative elapsed-tick-0-to-snapshot interval and `initial + starts = occupancy + releases`. GP chart, practice panel, council system panel and HUD use the executed work calculation rather than the disconnected “62%/83%” or “slots/day” arithmetic. Display rounding is not an extra model effect.

### Bounds, zeros, and changed numerical semantics

- Admin/absence/adoption are finite fractions `[0,1]`; nominal routine rate is finite `>=0.25`; AI and drain multipliers are finite `>0`. Derived work/place/drain arithmetic must also remain representable and finite. Effect deltas must be finite; a drain effect factor must be positive. Wait/norm inputs are finite nonnegative weeks.
- Legitimate zero admin, absence and adoption survive URL parsing, presets, policy effects and displays. Zero disease severity factor (`healthy`) yields zero overdue drain; no `||` substitution. The existing severity factors remain healthy 0, mild 0.5, moderate 1, severe 2, critical 4. The inherited fallback factor **1 for `deceased` condition state** is now explicit to preserve existing non-finalizing condition paths; terminal resident mortality ordering is not changed. Unknown severities are rejected.
- Projection throws `RangeError("Invalid care input: …")`. Effect boundaries expose the message through `MoC.lastInputError` and a toast, return failure and do not apply any step's care, budget, trust or scheduled changes. Invalid shop/law/council offers are disabled with the same reason; purchase cost/ownership is not recorded for an invalid purchase. Invalid direct model state pauses before tick advancement. Low-level service/drain validation throws the same observable error. URL parameter replacement is atomic.
- Removed the silent 3% admin / 2% absence floors and policy-effect rounding to hundredths. Values retain arithmetic precision (e.g. 70%-adopted pilot with rollout cost changes 0.30 to **0.184**, displayed as 18%). Positive drain 0.001 is not rounded to zero. Out-of-bounds reductions are **unavailable/rejected**, not partial benefits clamped to a floor.
- A narrow representational correction applies **only to computed additive results** crossing a closed admin/absence/routine-rate bound by at most `4 × Number.EPSILON × max(1, abs(bound))`, from an in-range operand not already at that bound. It restores the bound, not a gameplay floor. Raw parameter inputs stay strict; zero-to-negative effects and substantive overshoots still reject. Thus `0.30 - 0.18 - 0.07 - 0.05` reaches exactly zero, and sequential Pilot Grant reversals do not leave a phantom 2% cost. No rounding to hundredths or adjustment of positive small drain/AI factors is introduced.
- Scheduled workforce/rate/drain effects and their reversals validate too: a shock whose requested result would violate bounds is recorded as unavailable rather than silently capped at 0.25; rejected effects have no inverse installed. Annual workforce/drain changes likewise retain precision. Schedule generation/comparison policy and existing effect coefficients are unchanged; these boundary/precision changes are nevertheless outcome-affecting and included in model 9.

### Complete decisions and known future obligations

The F05 follow-up replaces after-the-callback error counting with pure effect plans. Immediate steps are projected cumulatively, including costs; executable temporary inverses and delayed deliveries are combined with existing pending work. Same-date feasibility order is environmental reversal, possible conditional morale recovery, council temporary reversal, then delayed delivery. Only a completely valid plan commits; flags, citizen-specific changes and presentation callbacks run afterward. Availability is rechecked on click, and a decided choice cannot execute twice.

This is a bounded engineering reservation rule, not a new simulation scheduler: subsequent effects, purchases and laws must leave **known obligations executable within this scenario** feasible. They cannot spend a temporary adjustment needed by an executable inverse, nor make an in-horizon delayed benefit cross a bound. Unknown future events are not predicted or guaranteed; they validate when encountered. Random choices conservatively require **every declared outcome** to be feasible; previews do not execute callbacks or consume the choice's random draw.

The terminal cutoff is **phase-specific**, not uniformly inclusive. For horizon `H = TOTAL_QUARTERS × 52`, quarter inverses/deliveries execute only at `(quarter - 1) × 52 < H`: `onTermEnd` preempts the terminal quarter callback. Cabinet Crisis's final council is Q8/tick 364, terminal tick 416; Full Term's is Q40/tick 2028, terminal tick 2080. Environmental expiry runs earlier inside `tick`, so an external inverse at **`endTick <= H`** still executes, including at the terminal tick. Post-term records remain descriptive records, but neither reserve capacity nor deliver a modeled benefit. Thus a Cabinet Crisis Q2 in-house build's Q10/tick 468 delivery cannot prevent an otherwise valid current law.

Active work-to-rule (`docWTR`, sick +0.02 / inverse -0.02) and citizen avoidance (`citAvoid`, drain ×1.12 / inverse ÷1.12) have **conditional**, not invented fixed-date, recoveries. At each remaining council after the current one and before terminal, feasibility checks both still-active and recovered possibilities. The two independent active conditions require at most four views. Their additive/multiplicative inverses commute with the authored dated care effects; every dated prefix and eligible recovery point is checked, not just a final net balance. This prevents a later positive adjustment from funding an earlier recovery and checks dated strike expiry together with work-to-rule recovery. It conservatively assumes an active condition could recover at any remaining council; it does not forecast stakeholder trust or create new future onsets. At the final council there is no later conditional recovery to reserve.

Conditional flags change only after a successful validated onset/recovery; rejection retains the existing obligation. Doctor strike records carry source `doctor-strike`; its lifecycle clears only once trust has recovered and its dated records have successfully settled. Rejected strike onset/renewal does not advance its lifecycle counter. Exodus cascade progression and one-shot carer burnout likewise mark an effect applied only on success, allowing a rejected effect to retry. Named GP burnout leave was inspected separately: its existing 15–25/45–55-tick timers decrement and release directly, with no additive `M.IST.sick` inverse. Those timers, queue transfers and the non-double-counted aggregate-absence formula are unchanged. Inactive legacy aging/finale helpers are not re-enabled.

Due quarter effects are projected as one ordered batch against the remaining schedule and conditional views, then removed only after successful validation. Environmental expiries likewise remove their own pending inverse only on success. If an inconsistent restored/directly edited state prevents expiry, recovery or delivery, the standard error is exposed and pending records/conditional flags remain available for retry; no partial dated batch is committed. A mandatory council with no feasible choices offers **Defer unavailable decision**, an explicit no-effect/no-charge continuation to laws and funding. This prevents a mandatory-decision dead end without silently weakening bounds or applying partial benefits.

No model-8 record is reused: existing versioned replay, reference and leaderboard filters pick up model 9. No protocol bump is needed because matching/comparison rules are unchanged. F06/F07, empirical calibration, balance tuning and backend/leaderboard changes remain outside this implementation. See [F05 evidence](MINISTER_RELEASE_STATUS.md#model-9-workforceproductivity-f05) and the separate [verified publication](MINISTER_RELEASE_STATUS.md#verified-model-9-publication).

## Model 10 — access, logical effects and replay

Published identity: `minister-care-10-access-time-replay`, verified on 2026-10-27.
Reference protocol `no-discretionary-action-v1` remains unchanged. Implementation
and publication evidence are software evidence, not clinical calibration or an
outcome-improvement claim.

### F06: exclusion belongs to the referral episode

The actual digital-gate council callback changed `waitWeeks` from 4 to 10 while
the episode still reported 4. Model 10 instead records an identified six-week
**future access hold**, preserving referral start and elapsed history. Repeated
events extend the remaining hold; repeated dispatch of the same event ID does
not. Synchronization and later ticks cannot erase it. Both routine and emergency
admission honor it; an emergency remains in visible overflow, not a fictional
treatment place. Eligible routine residents behind a held resident can enter.
This intentionally models the authored access exclusion, not diagnostic accuracy
or a new clinical-priority model.

The story selects an older named resident, not necessarily someone referred.
With no active referral, record exclusion and its existing political/score
consequence, but impose **no wait and no future referral**. This smallest rule
does not manufacture a clinical episode. Manual exceptions release the named
resident's existing holds; an Inclusion Officer releases all current holds and
prevents pending/recurring events. Neither erases elapsed wait or past exclusion counts.
Expiry is at `event tick + 24` (plus existing remaining hold); treatment start,
death, relocation and other exit close the same episode and preserve hold history.
Reports separate elapsed weeks from remaining imposed weeks.

### F07: logical delayed effects and terminal settlement

The strike's “wait them out” choice previously reduced doctor trust six points
after four wall-clock seconds even while council was paused. It now has an
identified, exactly-once consequence due **four elapsed ticks / one model week**
after the choice, processed before quarter/terminal handling. This is the chosen
logical delay, not a conversion from reading speed or an empirical strike duration.
Its immediate +2-point absence is ongoing as before; political changes are not
temporary care effects. Duplicate scheduling is inert. Reset reloads a fresh term.

Existing temporary care effects continue to reverse their declared additive or
multiplicative changes in the F05 validated boundary, not by restoring an old
whole-state snapshot. Permanent changes survive stacked expiry; no clamped
political inverse is invented. Quarter effects remain strictly before the horizon;
external inverses remain executable on the terminal tick. Pending sub-quarter
effects are canceled at termination with reason/time; pending quarter deliveries
and reversals are marked canceled, without reversing care after the result.
Election loss and fourth-household protest end synchronously at the triggering
boundary, not after an animation timeout.

Fragility objective failure is sampled on policy effects and ticks, not by rendering
`check()`. Objective settlement is once per objective, including terminal settlement.
Stale decision/vote/manifesto callbacks and effect APIs cannot mutate ended gameplay.
Published score payload is retained for retries; a late matching reference may
still populate comparison detail under the unchanged reference protocol.

Async audit: remaining timers/animation frames implement audio, visual effects,
layout, tooltips, onboarding/clock driving, baseline tick batching and optional
publication. Clock drivers still execute guarded integer ticks. The name-completion
sweep now runs synchronously at initialization rather than consuming RNG after
1.5 seconds. Offline cognition is not initialized in this build; its dormant async
completion/fallback is nevertheless terminal-guarded. Clipboard, soundtrack and
leaderboard promises do not feed clinical or political state. Legacy IndexedDB
helpers are not a supported Minister restore path. This is not a general job service.

### F08: complete local command/event record and executable replay

The previous `saveReplay` record was a comparison artifact, not an executable
command log: a real mid-quarter case-manager request spent €5,000 without adding
a decision or cash reason to that artifact. Model 10 retains **Try another
approach** as a previous-attempt comparison and adds a separate complete export
and executable replay. No online event store, leaderboard verification service or
mid-term restore mechanism is introduced.

**Separate identities**

- `schema: minister-command-record-2` describes the export envelope, including
  separate model-module and replay-adapter identities.
- `eventSchema: minister-domain-event-1` describes observed domain events.
- `replayVersion: minister-command-replay-2` describes command interpretation
  and the identity checks required before replay.
- `modelVersion: minister-care-10-access-time-replay` identifies the outcome rules.
- `modelExecutableId` is SHA-256 over the canonical manifest of raw shared model
  module bytes. The browser and Node compute it from the same `minister-model-core.js`
  source bytes; it is not a Git commit hash, a signature or a server attestation.
- `replayExecutableId` is SHA-256 over the canonical manifest of the inline
  command/replay adapter and shared model module bytes. `executableId` remains
  an alias for this value in schema 2. Changing either source unit refuses an
  older record even when the declared model version is unchanged.
- `protocol: no-discretionary-action-v1` and the complete generated external
  schedule retain the existing paired-reference contract. No matching rule changed.

**Envelope and initial inputs.** Recording starts immediately before the normal
`launchSimulation` opening advances, at elapsed tick zero. The record includes
scenario, seed, horizon, initial parameters, mode, query string, whether a manifesto
was declared and its chosen indices, the initial agreed state, external schedule,
ordered commands/events, final agreed state, ending tick/reason and completeness.
Population, conditions and authored coefficients are regenerated by the exact
executable and seed; the regenerated initial state must equal the recorded state
before any replay tick. Recorded snapshots are **never installed as model state**.
Public name, audio, viewport and previous-attempt browser storage do not supply
clinical inputs; replay does not publish under a recorded name.

**Commands.** Each has a stable sequence ID, total ordering number, elapsed tick,
kind (`purchase`, `law`, `decision`, `request`, `confidence`, `navigation`), a
whitelisted control identifier, current council/request context, reason/choice
text, before/after state checksums and outcome. Navigation is retained because
the current council stage determines command availability. The recorder observes
the actual synchronous handlers in event capture/bubble order; the replay invokes
those same controls, not a second implementation of policies. A command-specific
seed is supplied before execution; the existing council-specific RNG remains
deterministic. Outcomes distinguish applied, no-effect and rejected commands.
Disabled offers are not executed commands; attempts to dispatch unavailable
controls are visibly refused. Empty effects/declines remain explicit records.

**Events.** Every event has an ID, total order, logical tick, kind, reason and
optional originating command ID. The record retains clinical events; policy cost
and applied plans; scheduled/canceled strike effects; objective settlement;
environment onset/expiry and annual pressure; and before/after changes at each
command and completed tick. Changes include budget, trust, live score, care
parameters, schedules, policy/law ownership, political flags and named residents'
HP, care state, waits, workload and exits. Tick changes name the clinical,
environment and quarter-rule boundary; more specific authored effects carry
their own labels. Agreement checks additionally cover exact care snapshots,
resident ages/conditions/positions/paths and social timers, queues, referral/hold
history, resource visits and environmental impacts. Checksums are compact
regression checks, not cryptographic proof of authentic play.

**Replay execution and rejection.** Start on a fresh matching scenario/seed at
tick zero and import through “Replay a complete command record”, or call
`MoC.record.run(record)`. It validates all version identities, executable hash,
initial inputs/schedule, bounded command/event ordering and the command vocabulary.
It advances actual integer `tick()` calls only while no model-owned council,
request or interstitial is blocking, then validates the available command/context
and before-state. The exact executed outcome, complete event trace and final
agreed snapshot must match. Errors are visible as **Replay refused**, pause
execution and do not silently substitute defaults. A divergence after valid
earlier commands leaves that failed replay paused; it is not rolled back or
continued. Reload a fresh town before retrying. Repeated replay in the same
already-used page is rejected.

**Export versus display.** Export downloads all commands and events without
truncation, including late resident requests and automatic changes. The
previous-attempt storage artifact embeds the same full record; quota failures
remain visible through its existing failure message, never by dropping entries.
Human-readable handover and local top-run summaries may remain short. File import
is bounded to 32 MiB; API validation bounds commands to 20,000 and events to
200,000, in addition to the scenario's tick horizon.

**Limits and external conditions.** Only the two public Minister player scenarios
and this exact available executable are supported. World mode changes,
mid-term playground overrides, debug/direct state edits, optional future
nondeterministic clinical services and historical executables not supplied here
are not reconstructed. Known mid-term playground/World controls explicitly mark
an export unsupported; other altered state is rejected by initial/trace checks.
This is replay from initial inputs, not arbitrary mid-term save/restore.
The static website does not initialize its dormant LLM subsystem.

The shared external schedule is paired by seed/scenario. Realized shock impacts
may legitimately depend on prevention, resilience and dependence; dilemmas,
requests, strike/morale consequences, clinical paths and endings may depend on
policy/state. The record neither makes those endogenous events “paired” nor
claims seed-only causality. Scalar leaderboard scores incorporate separately
arriving reference data; agreement here is on the documented gameplay/clinical
snapshots, live score and ending, not network timing or leaderboard rank. Late
matching reference presentation remains allowed, but replay suppresses both
remote publication and new local leaderboard entries.

Prepublication evidence covers Cabinet Crisis through tick 416; a Full Term run
ending at its actual tick-988 election (before its 2,080-tick horizon); and a
seed-2 strike through tick 108. It is not evidence that every command sequence,
every seed or a full 2,080-tick discretionary campaign has been replay-tested.
Existing full-horizon no-action/reference regressions remain separate evidence.
None of these software invariants implies clinical calibration, improved mortality
or universal causal attribution.

## Public evidence wording (L01)

The public landing, chapter, About, World and Minister surfaces distinguish:
dated empirical input data; unvalidated model assumptions; authored game rules;
and outputs observed in a particular executable/run. The claim-level source
audit is [MINISTER_CLAIM_SOURCES.md](MINISTER_CLAIM_SOURCES.md); unresolved source,
definition and provenance questions are explicitly marked, not treated as facts.

The 45 residents have synthetic identities and medical histories. The setting's
5,000-person town scale is not 5,000 individually simulated agents. Minister's
role, budget, intervention prices and legal powers are authored abstractions,
not a proportional allocation of national funds. System-death labels include
the model's terminal-disease and HP rules; neither that label nor a difference
from the no-action reference establishes clinical preventability.

The legacy research runner `scripts/deep_research.cjs` calls
`scripts/research_run.cjs`, which extracts `site/world.html`, not Minister or the
modular backend. `scripts/output/deep_research_100runs.json` records 100 runs per
mode, 3,000 cycles and 2026-06-09, but no executable revision. This identifies a
research path, not a verified correspondence between every chapter figure and
that artifact. Historical tables remain unverified and do not validate Minister.

L01 changes public wording, not clinical numbers, identifiers or control flow.
The model identifier remains `minister-care-10-access-time-replay`. The exact
HTML executable fingerprint nevertheless changes: complete command records from
the previous HTML are rejected by the existing exact-executable replay check.
Display strings can also occur in recorded context/events; no cross-executable
record migration or replay-compatibility claim is made.

## Model 11 — political trust balance (B03 working branch)

The unreleased B03 working executable is
`minister-care-11-political-trust-balance`. This identity supersedes model 10
for results produced by this branch; it is not evidence that model 11 has been
published. The paired-reference protocol remains
`no-discretionary-action-v1`.

The sole outcome-affecting rule change is the quarterly political response to
new model-system deaths in the player council: citizens -2 trust per death
(previously -4), doctors -1 (unchanged), and parliament -1 (previously -2).
The +1-per-group no-new-death response, doctor-workload trust rules, other
stakeholder effects, trust end conditions, final-vote gates and numeric targets
are unchanged. This moderates the additional political penalty because deaths
already count against a separate final-vote death cap, while retaining a
citizen-first response. These coefficients are authored game rules informed by
the B01 within-model trust ledger, not empirically estimated effects; the
rationale and selected-seed results are recorded in
[`MINISTER_BALANCE_REDESIGN.md`](MINISTER_BALANCE_REDESIGN.md).

No care mechanism or care parameter changed: mortality, deterioration, routine
or emergency capacity, treatment resources, the 12-week authored threshold,
scenario clocks, external schedule, RNG, and paired-reference execution are
unchanged. The reference protocol and no-action policy are unchanged. Identical
outcomes are not guaranteed for discretionary player runs because revised
political state can change which policies remain affordable or available.

Model-10 and earlier leaderboard rows remain historical and are excluded from
model-11 queries by the existing model-version filter; no migration or
cross-version ranking is performed. Replay records from model 10 are refused
by model-version and executable-identity checks, not rewritten to model 11.
Model-11 records require the exact matching executable. The shared
`minister-model-core.js` did not change, so its SRI value is unchanged.

## Glossary

- **Model version:** immutable identifier for a particular outcome-affecting model and policy implementation.
- **Protocol version:** identifier for the paired-reference policy and comparison rules.
- **Nominal capacity:** declared service rate before demand and resource constraints are applied.
- **Realized throughput:** number of services actually started or completed during a stated interval.
- **Occupancy:** number of patients using a stated care resource at a stated time.
- **Waiting episode:** one named interval between a defined wait-start event and treatment or another defined exit.
- **Model-classified system death:** a death assigned to the model's system-failure category; not proof of preventability or real-world cause.

# Cammelot 2027 research protocol: coordinating a cardiology referral pathway

**Protocol:** R01, version 1.0  
**Status:** Design proposal; freeze model, inputs and analysis plan before confirmatory runs.  
**Scope:** One bounded simulation experiment. No gameplay implementation or claim of real-world effectiveness.

## Decision this experiment is meant to inform

Can coordination across fragmented GP-to-specialist processes improve the end-to-end experience of a patient awaiting routine cardiology care, and does agentic coordination add enough benefit over organizational reform, conventional integration or non-agentic modernization to justify its full lifecycle cost?

**Primary hypothesis (not an established finding):** Under the same referral demand, clinical rules, staffed care capacity and finite implementation-resource envelope, better coordination will increase the share of referrals receiving appropriate treatment without prior serious deterioration or death. Agentic coordination will be preferable only if it improves end-to-end outcomes over each non-agentic alternative, remains within the common resource envelope, does not create a material safety or equity disadvantage, and is not dominated on lifecycle cost.

This is deliberately a difficult test for the agentic option. If simpler reform achieves the same care outcomes at lower cost or with fewer implementation risks, the result counts against using agents for this workflow.

## Scope and scenario

- **Workflow:** Routine outpatient referral from a GP to one cardiology service for suspected chronic cardiovascular disease (the existing model's I25 pathway). Acute emergencies and unrelated specialties are excluded; emergency routing is not treated as a routine queue.
- **Population:** A fixed synthetic workload of 336 referral episodes among adults aged 65–84: 120 referrals pending at the start, then four new referrals per month for 54 months. Follow each episode for 180 days. The final arrival occurs at month 54, so every episode has complete follow-up by month 60.
- **Interpretation:** These cohort, age, backlog and arrival counts are experimental workload settings, not estimates of Dutch prevalence, incidence, service demand or Cammelot population composition. Episodes have the same clinically relevant eligibility and baseline triage rules in every arm. Use the existing named-resident model where available; do not script a favorable outcome for any resident.
- **Horizon:** Five simulated years, with 180-day referral follow-up, and five years of intervention lifecycle-cost accounting. No post-horizon benefits are extrapolated. Delayed or residual effects are shown separately rather than counted as realized.
- **Unit of assignment and analysis:** The whole town/run receives one strategy, because shared queues and staffing make patient-level assignment contaminate alternatives. The primary analysis is at the run/seed level; referral counts are denominators, not independent replicates.
- **Exclusions:** No live LLM, national forecast, claim about actual Dutch patient outcomes, or change to the game shell. This protocol does not prescribe an agentic implementation.

## Alternatives

Run five strategies against the same starting state and care service goal:

| Arm | Intervention being tested | Explicit boundary |
|---|---|---|
| **Current-process reference** | Continue the existing referral workflow with no new program. | A genuine status-quo policy, not a deliberately weakened or scripted-failure control. |
| **Organizational reform** | Assign a human referral coordinator; use a shared checklist, escalation rules and scheduled cross-team review. | Clinicians retain decisions; no new software integration or autonomous routing. Include coordinator, training and backfill time. |
| **Conventional integration** | Connect existing systems for shared referral status and required records; use rules-based routing, reminders and work queues. | Clinicians retain decisions; no autonomous agent. Include interfaces, data mapping, support and security work. |
| **Agentic coordination** | Agents monitor the same referral state, identify handoff gaps and propose or execute non-clinical coordination actions through the same connected systems as the conventional-integration arm. | Same data, clinical rules and care capacity as conventional integration. A qualified clinician makes or approves clinical decisions; agents cannot create appointments, staffing or treatment slots. Log agent actions, failures and overrides. |
| **Non-agentic modernization** | Replace the fragmented workflow systems with one modern, rules-based referral and scheduling platform. | No autonomous agent. Include migration, dual running, training, service interruption risk, maintenance and retirement of legacy systems. |

The conventional-integration versus agentic contrast isolates the proposed contribution of agentic coordination: it must not receive more or better data, extra appointments, looser clinical rules, a higher budget, or a more favorable outcome function. The modernization arm tests a larger systems change, not an “AI” bundle.

## Fair-comparison contract

Before implementation or confirmatory runs, publish one versioned input ledger and freeze:

1. **Common service goal:** For every eligible referral, deliver the same appropriate clinical assessment and first indicated treatment under the same safety, eligibility and triage rules. “Faster” routing is not success if it causes inappropriate treatment or leaves patients untreated.
2. **Common operating resources:** Identical baseline GP and specialist staffing, staffed appointment slots, clinical capacity, demand, patient states, care costs and external shocks in every arm. No arm gets extra clinical FTE or treatment capacity unless it purchases that capacity from the same capped envelope and its cost is charged.
3. **Common finite implementation envelope:** One auditable five-year cash/resource cap and one implementation-staff-hours cap for every intervention arm. Set and cite both from a documented, service-neutral scenario budget before running the comparison. If no defensible base cost can be sourced, report physical resource use and cost ranges, and do not declare a cost-based winner. Show results at 0.5×, 1.0× and 1.5× the frozen base envelope; unused funds are not converted into a care bonus.
4. **Full lifecycle accounting:** Separately record initial design/procurement, data cleanup, migration and dual-running, training/backfill, implementation labor, licenses/compute, human oversight, incident handling, cybersecurity/privacy work, maintenance, upgrades, decommissioning and residual liabilities. Count clinician time spent on coordination, review and overrides. State price year, source and discount assumption for each monetary input. Do not count a modeled capacity or health benefit as a cost saving unless a separately measured resource is actually avoided.
5. **No outcome bonuses:** There is no score, reward, cost offset or scripted transition for adopting a technology, reducing paperwork, shrinking a queue or choosing a favored arm. Clinical transitions and patient outcomes use the same frozen rules in all arms. Any action that changes care must act through the explicit workflow and resource ledger.
6. **Comparable implementation:** Charge implementation delay, adoption, training, downtime and failure consistently. Strategies begin at the same date; outcomes during deployment count. Do not compare an established agent system with a not-yet-implemented alternative.

Report both the capped-budget comparison and the cost/outcome frontier. A result inside the common cap does not itself establish value for money.

## Outcomes declared before runs

All outcomes use all eligible referral episodes as the denominator unless stated otherwise. Report counts, denominators and uncertainty; retain deaths, refusals, transfers and unresolved referrals as distinct states.

### Co-primary end-to-end outcomes

1. **180-day referral success:** proportion receiving the first appropriate treatment within 180 days without first crossing into the frozen model's `critical` disease state (HP ≤20 where the model uses HP) or dying before treatment. Report each component separately as well as the prespecified joint endpoint. This is a model-defined endpoint, not a validated clinical composite; freeze the state definition across arms and do not tune it to the results.
2. **Timely treatment:** cumulative proportion receiving first appropriate treatment by day 84. Also show death before treatment, deterioration before treatment, refusal/withdrawal and still waiting as separate competing outcomes. The 84-day cutoff is an experimental reporting window, not a statement of a Dutch legal or clinical norm.

Do not collapse the co-primary outcomes, mortality, cost or equity into one score. Compare the paired run-level arm differences with 95% uncertainty intervals and report their direction and magnitude. Account for all eight prespecified endpoint-by-comparator tests (two co-primary outcomes × four agentic-versus-comparator contrasts) with a family-wise procedure (Holm adjustment). If model uncertainty or interval width prevents a clear decision, the result is inconclusive—not a tie or a win.

### Secondary local and safety measures

- Referral-to-treatment time and distribution, including longest wait and counts over the chosen reporting window.
- Current queue size **alongside** arrivals, treatment starts, deaths before treatment, withdrawals and other exits; reconcile opening queue + arrivals − each exit = closing queue.
- Handoff completeness, rejected/returned referrals, duplicate work, lost referrals, time to acknowledge, and time spent on paperwork/coordination.
- GP and specialist workload, staffed-slot utilization, idle capacity, treatment starts and total clinical resource use.
- Implementation time, adoption, service interruption, agent/automation errors, clinician overrides, privacy/security incidents and recovery time.
- Five-year lifecycle cost by category and cost per observed primary outcome, with no claim that an uncertain ratio is a clinical recommendation.

A smaller queue, lower paperwork, faster acknowledgement, higher utilization or higher scalar game score is not by itself an end-to-end improvement. Queue exits due to death or withdrawal cannot count as improved access.

### Equity measures

Report primary outcomes, waiting and harm separately for ages 65–74 and 75–84, and by sex where the model records it. Also report multimorbidity strata only if their definition and source are frozen before the run. Show group denominators and absolute as well as relative gaps; do not interpret small or absent groups as evidence of equity. Do not infer ethnicity, deprivation or disability from names, location or other proxies. If the model lacks a provenance-supported attribute, mark that equity question unmeasured.

## Run and analysis plan

- Use 100 prespecified paired seeds across all five arms. For each seed, share initial patients, arrival schedule, disease-state draws where the same process applies, and exogenous shock timing/severity. Use strategy-keyed random streams for intervention-specific behavior so extra agent actions cannot shift clinical draws in another arm.
- Use 20 seeds only to check execution and debug the frozen protocol; exclude them from confirmatory estimates. Freeze code, policy rules, inputs and analysis before opening the remaining 80 holdout seeds. Confirmatory intervals and conclusions use the 80 holdout seeds only. If the protocol changes after inspecting holdout results, label the comparison exploratory and use a new holdout set.
- Report paired run-level differences and 95% intervals, with the run/seed as the independent unit. Publish per-seed results, missing-run reasons, distributions and all comparator contrasts; do not report means alone. Keep the analysis code and input ledger versioned with the model.
- Treat 100 seeds as a bounded design choice, not a guarantee of statistical power or calibration. If intervals are too wide to distinguish the predeclared decision conditions, report uncertainty and do not selectively add seeds or change endpoints after seeing results.
- Publish model version, protocol version, seed list, scenario, arm policies, source-data versions, cost ledger and exact endpoint definitions with any result. A change to the intervention contract or endpoint requires a new model/protocol version.

## What would count against agentic coordination

Any of the following is evidence against preferring the agentic arm for this pathway:

- It fails to improve both co-primary outcomes over conventional integration, or a simpler arm matches its care outcomes at lower lifecycle cost or with less implementation burden.
- Its apparent gain is confined to current queue length, paperwork, acknowledgement time, utilization or a scalar score, without improved patient-level end-to-end outcomes.
- Treatment starts rise but serious deterioration, death before treatment, inappropriate routing, or unresolved referrals rise as well.
- Its advantage disappears under no-effect, delayed implementation, lower uptake, higher operating cost, ordinary system downtime or demand/capacity sensitivity conditions.
- It exceeds the common budget or staff-hours cap, requires extra care capacity not charged to the arm, creates a material subgroup disadvantage, or depends on a differential clinical rule/data feed.
- Missing or invalid referral state, agent failure, overrides or security incidents negate the proposed coordination gain.

“Preferable” requires adjusted intervals for both co-primary outcomes to favor the agentic arm over each non-agentic alternative, no safety/equity disadvantage beyond margins agreed and documented by clinical reviewers before the confirmatory runs, and acceptable lifecycle cost under the shared cap. If no defensible clinical/equity margin or cost basis is available, the experiment may compare modeled outcomes but must not claim overall clinical or economic preference or clinical importance.

## Uncertainty, provenance and limits

The present code and project documents motivate a question; they do not establish that any strategy improves real care. The existing Minister reference protocol says that shock coefficients and schedule are gameplay assumptions and that calibration remains outstanding. Its strategy benchmark also cautions that small-seed results are not balance or healthcare evidence. This experiment must preserve those distinctions.

| Input or mechanism | Current status | Required treatment before a confirmatory claim |
|---|---|---|
| Cohort size, backlog and arrival rate | Synthetic workload settings selected for this protocol; not population data. | Keep identical by seed and arm; stress test demand and baseline capacity at 0.75×, 1.0× and 1.25×. |
| Referral completeness, handoff delay and coordination effect | No calibrated treatment effect for organizational, integration or agentic coordination established by this protocol. | Implement as transparent process mechanisms. Include a zero-benefit setting and show a 0–50% stress range for the reducible handoff-failure/delay component; label every value as an assumption, not an estimate. |
| Uptake and implementation delay | Unknown for this modeled service. | Sweep 50%, 75% and 100% uptake and 0, 6 and 12 months' deployment delay as stress scenarios, not empirical forecasts. |
| Costs and asset life | Project tariff/configuration values are not a complete intervention lifecycle-cost base. | Trace each input to a public tariff, procurement/operations source or clearly labeled assumption. Sensitivity-test sourced/assumed lifecycle totals at 0.5×, 1.0× and 1.5×; no sourced base means no economic winner. |
| Staffed capacity and shocks | Scenario-dependent model inputs, not validated estimates of national service supply or disruption frequency. | Keep schedules paired; vary demand/capacity and report shock-free and shocked results separately. Do not call the seed distribution a forecast. |
| Deterioration, death and appropriateness | Existing game health states and death classifications are model mechanics, not calibrated clinical probabilities. | Freeze transitions across arms, validate definitions with clinical reviewers and show component outcomes. Without clinical validation, describe results only as model behavior. |
| Equity attributes | Available attributes and their provenance may not support all relevant comparisons. | Use only explicit, documented model attributes; report unavailable dimensions as gaps, not as parity. |

These sensitivity values define transparent stress tests; they are not confidence intervals, empirically plausible ranges or estimates of technology effectiveness. Additional ranges must be source-backed or marked as scenario assumptions before examining confirmatory outcomes. Separate stochastic uncertainty across seeds from parameter uncertainty, structural uncertainty and missing data. No choice of sensitivity values may silently favor one arm.

This simulation cannot establish that coordination causes better outcomes in real patients, estimate national effects or budgets, validate a clinical decision rule, show that agents are safer or more autonomous than people, establish generalizability beyond this pathway, or demonstrate that an architecture is politically or operationally deployable. It can identify which explicit modeled mechanisms matter, which alternatives are dominated under the declared assumptions, and which evidence gaps block a stronger claim.

## Provenance and related project evidence

- [Issue #17 and audit summary](https://github.com/cammeleon66/Cammelot/issues/17) (audit context dated 22 October 2026; the report notes that its audit artifacts were not uploaded).
- [Audit source-baseline commit `bb6df6490ceb`](https://github.com/cammeleon66/Cammelot/commit/bb6df6490ceb56e68cc8922ae167660ac6079b18). The audit describes live-game observations on its date and does not establish that this commit was deployed.
- [Minister reference protocol](MINISTER_REFERENCE_PROTOCOL.md): paired-scenario invariants, exact-date comparisons and explicit limits.
- [Minister strategy benchmark](MINISTER_STRATEGY_BENCHMARK.md): small-seed results and cautions against scalar-score or healthcare claims.
- [Minister improvement plan](MINISTER_IMPROVEMENT_PLAN.md): capacity, queue accounting, assumptions and limits of the existing simulation.
- [Agent specification](AGENT_SPEC.md), [NZa tariff configuration](../config/nza_tariffs_2025.json) and [administrative-scenario configuration](../config/admin_scenarios.json): repository inputs to audit for provenance before use; their presence is not evidence that they price or calibrate the alternatives in this protocol.
- [Architecture decision records](ADR.md): the current frontend/backend separation and architecture context.

## Versioning and next boundary

This document fixes the research question and comparison contract for R01. Before any implementation is compared, its protocol identifier, arm interfaces, event ledger, cost schema, endpoint definitions and uncertainty inputs must be versioned with the model. The separate design of the smallest testable software boundary belongs to [R02 (#18)](https://github.com/cammeleon66/Cammelot/issues/18); implementation lifecycle costing is further specified by [R04 (#20)](https://github.com/cammeleon66/Cammelot/issues/20). Neither dependency changes the scope or conclusions of this protocol.

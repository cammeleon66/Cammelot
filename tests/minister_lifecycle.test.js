import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../site/minister-model-core.js';
import { ministerModelExecutableId } from '../scripts/minister_model_identity.mjs';
import { costItem, driveLifecycleRun, lifecycleInput, lifecycleRunInput } from './fixtures/r04_lifecycle_fixture.mjs';

const core = globalThis.MinisterModelCore;

async function run(options = {}) {
  const { lifecycleOptions, ...runOptions } = options;
  const fixture = lifecycleRunInput({ ...runOptions,
    ...(lifecycleOptions ? { lifecycle: lifecycleInput(lifecycleOptions) } : {}) });
  return driveLifecycleRun({ fixture, modelExecutableId: await ministerModelExecutableId() });
}

const lifecycleEvents = (result, kind) => result.events.filter(event => event.kind === kind);
const sum = (events, field) => events.reduce((total, event) => total + (event[field] ?? 0), 0);

// Independent re-derivation of the ledger from the authoritative event stream.
function assertConserved(result) {
  const { ledger } = result.snapshot.lifecycle;
  const paid = lifecycleEvents(result, 'cost_paid');
  const cash = sum(paid, 'cash');
  const work = sum(paid, 'work') + sum(lifecycleEvents(result, 'implementation_progress'), 'work')
    + sum(lifecycleEvents(result, 'recovery_progress'), 'work');
  assert.equal(ledger.cash.spent, cash, 'cash spent equals the sum of paid-cost events');
  assert.equal(ledger.work.spent, work, 'work spent equals paid items plus implementation and recovery work');
  assert.equal(ledger.cash.authorised, ledger.cash.spent + ledger.cash.remaining, 'cash is conserved');
  assert.equal(ledger.work.authorised, ledger.work.spent + ledger.work.remaining, 'work is conserved');
  assert.ok(ledger.cash.remaining >= 0 && ledger.work.remaining >= 0, 'no hidden overdraw');
  for (const key of ['byPurpose', 'byCategory']) {
    const buckets = Object.values(ledger[key]);
    assert.equal(sum(buckets, 'cash'), ledger.cash.spent, `${key} cash sums to spent`);
    assert.equal(sum(buckets, 'work'), ledger.work.spent, `${key} work sums to spent`);
  }
  const deferred = ledger.deferredObligations;
  assert.equal(lifecycleEvents(result, 'cost_deferred').length,
    deferred.length + lifecycleEvents(result, 'cost_paid').filter(event => event.deferredSinceTick !== undefined).length,
  'every deferred obligation is either still unpaid or later paid exactly once');
  return ledger;
}

const handoffs = result => lifecycleEvents(result, 'handoff_completed');

test('hand-checked ledger: approval, implementation, commissioning, adoption and benefit have explicit ticks', async () => {
  const result = await run();
  const { lifecycle } = result.snapshot;
  assert.equal(lifecycle.modelled, true);
  assert.deepEqual(lifecycle.timeline, { approvedAt: 0, implementationStartedAt: 0, implementationCompletedAt: 2,
    commissionedAt: 4, firstAdoptionAt: 4, firstBenefitAt: 4 });
  // 12 h at 4 h/tick -> ticks 0,1,2; completion 2 + 2-tick delay -> commissioning at tick 4.
  assert.deepEqual(lifecycle.commissioning.attempts, [{ attempt: 1, tick: 4, outcome: 'passed' }]);
  const ledger = assertConserved(result);
  // cash: design 3000 + licence 100 at ticks 4,8,12,16,20,24 = 3600; work: 12 impl + 10 design + 2 x 6 oversight = 34.
  assert.deepEqual([ledger.cash.spent, ledger.cash.remaining, ledger.work.spent, ledger.work.remaining],
    [3600, 6400, 34, 466]);
  assert.deepEqual(ledger.spentBeforeFirstBenefit, { cash: 3100, work: 24 });
  assert.deepEqual(ledger.byPurpose.implementation, { cash: 0, work: 12 });
  assert.deepEqual(ledger.byPurpose.investment, { cash: 3000, work: 10 });
  assert.deepEqual(ledger.byPurpose.operating, { cash: 600, work: 12 });
  // Two baseline-process handoffs per two ticks precede commissioning: 4 of 24 handoffs; 20 adopted.
  assert.equal(handoffs(result).filter(event => event.adoptedMechanism).length, 20);
  assert.deepEqual(lifecycle.benefit, { adoptedHandoffs: 20, coordinationUnitsAvoided: 20, avoidedStaffHours: 60,
    capacityUnitsGranted: 0 });
  assert.equal(lifecycle.economics.recognisedCashSavings, 0);
});

test('approval authorises budget without spending, and spending precedes implementation start', async () => {
  const result = await run({ lifecycleOptions: { parameters: { approvalTick: 3, implementationStartTick: 5 },
    costItems: [costItem('design', 'design_procurement', 'one_time', 3000, 10, { tick: 4 })] } });
  const at = tick => result.ticks[tick - 1].snapshot.lifecycle;
  assert.equal(at(2).phase, 'not_approved');
  assert.deepEqual([at(2).ledger.cash.authorised, at(2).ledger.cash.spent], [0, 0]);
  assert.deepEqual([at(3).phase, at(3).ledger.cash.authorised, at(3).ledger.cash.spent], ['approved', 10000, 0]);
  assert.deepEqual([at(4).phase, at(4).ledger.cash.spent], ['approved', 3000]);
  assert.equal(at(5).phase, 'implementing');
  assert.equal(at(5).timeline.implementationStartedAt, 5);
  assertConserved(result);
});

test('zero adoption incurs lifecycle cost and leaves pathway outcomes at the baseline process', async () => {
  const zero = await run({ lifecycleOptions: { parameters: { adoptionTargetBasisPoints: 0 } } });
  const baseline = await run({ interventionId: 'current_process', withLifecycle: false });
  assert.equal(baseline.snapshot.lifecycle.modelled, false);
  assert.deepEqual(zero.snapshot.metrics, baseline.snapshot.metrics);
  assert.equal(zero.snapshot.lifecycle.timeline.commissionedAt, 4);
  assert.equal(zero.snapshot.lifecycle.timeline.firstAdoptionAt, null);
  assert.equal(zero.snapshot.lifecycle.timeline.firstBenefitAt, null);
  assert.equal(zero.snapshot.lifecycle.ledger.spentBeforeFirstBenefit, null);
  assert.equal(zero.snapshot.lifecycle.benefit.adoptedHandoffs, 0);
  assert.equal(zero.snapshot.lifecycle.economics.cashSpent, 3600);
  assert.equal(zero.snapshot.lifecycle.economics.repaidInStaffHours, false);
  assertConserved(zero);
});

test('partial adoption uses a deterministic integer credit and costs more than it saves at low uptake', async () => {
  const half = await run({ lifecycleOptions: { parameters: { adoptionTargetBasisPoints: 5000 } } });
  const full = await run();
  const postCommissioning = handoffs(half).filter(event => event.tick >= 4);
  assert.equal(postCommissioning.filter(event => event.adoptedMechanism).length, Math.floor(postCommissioning.length / 2));
  assert.deepEqual(postCommissioning.slice(0, 4).map(event => event.adoptedMechanism), [false, true, false, true]);
  assert.ok(half.snapshot.lifecycle.benefit.coordinationUnitsAvoided < full.snapshot.lifecycle.benefit.coordinationUnitsAvoided);
  assert.equal(half.snapshot.lifecycle.economics.cashSpent, full.snapshot.lifecycle.economics.cashSpent,
    'recurring cost does not depend on realised adoption');
  const ramp = await run({ lifecycleOptions: { parameters: { adoptionRampTicks: 4 } } });
  assert.deepEqual([4, 5, 6, 7, 8].map(tick => ramp.ticks[tick - 1].snapshot.lifecycle.adoption.currentBasisPoints),
    [0, 2500, 5000, 7500, 10000]);
  assert.equal(ramp.snapshot.lifecycle.timeline.firstAdoptionAt, 5);
  assertConserved(half);
  assertConserved(ramp);
});

test('failed commissioning delays adoption, adds rework and failure cost, and is a distinct state', async () => {
  const failing = await run({ lifecycleOptions: {
    parameters: { failedCommissioningAttempts: 2, reworkWorkPerFailure: 4 },
    costItems: [costItem('design', 'design_procurement', 'one_time', 3000, 10, { tick: 0 }),
      costItem('diagnosis', 'incident_handling', 'on_commissioning_failure', 200, 2)] } });
  const { lifecycle } = failing.snapshot;
  assert.deepEqual(lifecycle.commissioning.attempts, [{ attempt: 1, tick: 4, outcome: 'failed' },
    { attempt: 2, tick: 7, outcome: 'failed' }, { attempt: 3, tick: 10, outcome: 'passed' }]);
  assert.equal(lifecycle.timeline.commissionedAt, 10);
  assert.equal(lifecycle.timeline.implementationCompletedAt, 2, 'first completion is retained');
  assert.equal(lifecycle.implementation.reworkWorkAdded, 8);
  assert.deepEqual(lifecycle.ledger.byPurpose.failure_recovery, { cash: 400, work: 12 }, '2 x (200 cash, 2 h) + 8 h rework');
  assert.ok(lifecycleEvents(failing, 'commissioning_failed').length === 2);
  assert.ok(handoffs(failing).filter(event => event.tick < 10).every(event => !event.adoptedMechanism));
  const timely = await run();
  assert.ok(lifecycle.benefit.coordinationUnitsAvoided < timely.snapshot.lifecycle.benefit.coordinationUnitsAvoided);
  assertConserved(failing);
});

test('commissioning that never succeeds under a finite work budget stalls without overdraw or benefit', async () => {
  const stalled = await run({ lifecycleOptions: { parameters: { failedCommissioningAttempts: 10, reworkWorkPerFailure: 4,
    workCap: 40 } } });
  const { lifecycle } = stalled.snapshot;
  assert.notEqual(lifecycle.phase, 'commissioned');
  assert.equal(lifecycle.timeline.commissionedAt, null);
  assert.equal(lifecycle.timeline.firstBenefitAt, null);
  assert.equal(lifecycle.ledger.work.remaining, 0);
  assert.equal(lifecycle.ledger.work.spent, 40);
  assert.equal(lifecycleEvents(stalled, 'implementation_stalled').length, 1);
  assert.equal(lifecycle.benefit.adoptedHandoffs, 0);
  assertConserved(stalled);
});

test('interruption suspends the mechanism, charges incident and recovery work, then restores it', async () => {
  const result = await run({ lifecycleOptions: {
    costItems: [costItem('design', 'design_procurement', 'one_time', 3000, 10, { tick: 0 }),
      costItem('incident', 'incident_handling', 'on_interruption', 500, 3)],
    interruptions: [{ id: 'outage', startTick: 8, recoveryWork: 6 }, { id: 'early', startTick: 2, recoveryWork: 1 }] } });
  const { lifecycle } = result.snapshot;
  assert.deepEqual(lifecycle.interruptions.map(item => [item.id, item.status, item.startedAt, item.recoveredAt]),
    [['outage', 'recovered', 8, 11], ['early', 'not_applicable', null, null]]);
  // recovery: 2 h per tick at ticks 9, 10, 11 = 6 h; incident item 500 cash + 3 h at tick 8.
  assert.equal(sum(lifecycleEvents(result, 'recovery_progress'), 'work'), 6);
  assert.deepEqual(lifecycle.ledger.byCategory.incident_handling, { cash: 500, work: 9 });
  assert.deepEqual(handoffs(result).filter(event => event.tick >= 8 && event.tick <= 10).map(event => event.adoptedMechanism),
    [false, false, false], 'baseline process applies while the service is interrupted');
  assert.equal(handoffs(result).find(event => event.tick === 11).adoptedMechanism, true);
  assert.equal(lifecycle.timeline.commissionedAt, 4, 'recovery does not recommission');
  assert.deepEqual(lifecycleEvents(result, 'service_interrupted').map(event => event.tick), [8]);
  assertConserved(result);
});

test('recovery that exhausts the finite work budget stays interrupted and never overdraws', async () => {
  const result = await run({ lifecycleOptions: {
    parameters: { workCap: 25 },
    costItems: [costItem('design', 'design_procurement', 'one_time', 3000, 10, { tick: 0 })],
    interruptions: [{ id: 'outage', startTick: 5, recoveryWork: 10 }] } });
  const { lifecycle } = result.snapshot;
  assert.equal(lifecycle.phase, 'interrupted');
  assert.deepEqual([lifecycle.ledger.work.spent, lifecycle.interruptions[0].remainingWork], [25, 7]);
  assert.equal(lifecycleEvents(result, 'recovery_stalled').length, 1);
  assertConserved(result);
});

test('finite budgets: unaffordable obligations stay deferred, lapse the service and never become debt', async () => {
  const lapsed = await run({ lifecycleOptions: { parameters: { cashCap: 3000 } } });
  assert.equal(lapsed.snapshot.lifecycle.ledger.cash.remaining, 0);
  assert.equal(lapsed.snapshot.lifecycle.ledger.deferredObligations.filter(item => item.itemId === 'licence').length, 6);
  assert.equal(lifecycleEvents(lapsed, 'service_lapsed').length, 1);
  assert.equal(lapsed.snapshot.lifecycle.benefit.adoptedHandoffs, 0, 'a lapsed service gives the baseline process');
  assertConserved(lapsed);

  const unfunded = await run({ lifecycleOptions: { parameters: { cashCap: 2999 } } });
  assert.equal(unfunded.snapshot.lifecycle.phase, 'awaiting_commissioning');
  assert.equal(unfunded.snapshot.lifecycle.ledger.cash.spent, 0);
  assert.equal(unfunded.snapshot.lifecycle.timeline.commissionedAt, null);
  assertConserved(unfunded);

  const tightWork = await run({ lifecycleOptions: { parameters: { workCap: 6 } } });
  assert.equal(tightWork.snapshot.lifecycle.ledger.work.spent, 6);
  assert.equal(tightWork.snapshot.lifecycle.implementation.workRemaining, 6);
  assertConserved(tightWork);

  const zeroCash = await run({ lifecycleOptions: { parameters: { cashCap: 0, workCap: 0 } } });
  assert.deepEqual([zeroCash.snapshot.lifecycle.ledger.cash.spent, zeroCash.snapshot.lifecycle.ledger.work.spent], [0, 0]);
  assertConserved(zeroCash);
});

test('exactly sufficient budgets pay in full and unspent budget is not an outcome bonus', async () => {
  const generous = await run();
  const exact = await run({ lifecycleOptions: { parameters: { cashCap: 3600, workCap: 34 } } });
  assert.deepEqual([exact.snapshot.lifecycle.ledger.cash.remaining, exact.snapshot.lifecycle.ledger.work.remaining], [0, 0]);
  assert.deepEqual(exact.snapshot.lifecycle.ledger.deferredObligations, []);
  assert.deepEqual(exact.snapshot.metrics, generous.snapshot.metrics);
  assert.deepEqual(exact.snapshot.lifecycle.benefit, generous.snapshot.lifecycle.benefit);
  assertConserved(exact);
});

test('per-handoff review work falls back to the baseline process when the work budget cannot cover it', async () => {
  const result = await run({ lifecycleOptions: {
    parameters: { workCap: 23 },
    costItems: [costItem('design', 'design_procurement', 'one_time', 3000, 10, { tick: 0 }),
      costItem('review', 'clinician_review_override', 'per_adopted_handoff', 0, 1)] } });
  assert.equal(result.snapshot.lifecycle.adoption.adoptedHandoffs, 1, '23 h = 12 implementation + 10 design + 1 review');
  assert.equal(result.snapshot.lifecycle.ledger.work.remaining, 0);
  assert.ok(result.snapshot.lifecycle.adoption.baselineHandoffs > 1);
  assertConserved(result);
});

test('short horizons end before the investment repays; longer horizons can repay staff time but not cash', async () => {
  const parameters = { staffHoursPerCoordinationUnit: 2 };
  const short = await run({ horizonTicks: 8, lifecycleOptions: { parameters } });
  const long = await run({ horizonTicks: 48, arrivalTicks: 24, lifecycleOptions: { parameters } });
  // Short: 10 adopted handoffs (ticks 4..8) save 10 units = 20 h; work spent 12 + 10 + 2 x 2 = 26 h.
  assert.deepEqual([short.snapshot.lifecycle.economics.avoidedStaffHours, short.snapshot.lifecycle.economics.staffHoursSpent,
    short.snapshot.lifecycle.economics.repaidInStaffHours], [20, 26, false]);
  // Long: 44 of 48 handoffs adopted = 88 h avoided; work spent 12 + 10 + 2 x 12 = 46 h.
  assert.deepEqual([long.snapshot.lifecycle.economics.avoidedStaffHours, long.snapshot.lifecycle.economics.staffHoursSpent,
    long.snapshot.lifecycle.economics.repaidInStaffHours], [88, 46, true]);
  assert.equal(long.snapshot.lifecycle.economics.cashSpent, 4200);
  assert.equal(long.snapshot.lifecycle.economics.recognisedCashSavings, 0);
  assertConserved(short);
  assertConserved(long);
});

test('residual liabilities beyond the horizon are disclosed, not charged or discounted', async () => {
  const result = await run({ lifecycleOptions: {
    costItems: [costItem('design', 'design_procurement', 'one_time', 3000, 10, { tick: 0 }),
      costItem('retire', 'decommissioning', 'one_time', 700, 5, { tick: 60 })] } });
  assert.deepEqual(result.snapshot.lifecycle.ledger.residualLiabilities, [{ itemId: 'retire', tick: 60, cash: 700, work: 5 }]);
  assert.equal(result.snapshot.lifecycle.ledger.cash.spent, 3000);
  assert.equal(result.snapshot.lifecycle.ledger.discounting, 'none');
  assertConserved(result);
});

test('a local pathway improvement can fail lifecycle economics when downstream capacity binds', async () => {
  const baseline = await run({ interventionId: 'current_process', withLifecycle: false, startsPerTick: 1,
    lifecycleOptions: undefined });
  const integrated = await run({ startsPerTick: 1,
    lifecycleOptions: { parameters: { staffHoursPerCoordinationUnit: 1 } } });
  const midway = result => result.ticks[11].snapshot.metrics;
  assert.deepEqual([midway(baseline).handoffPending, midway(integrated).handoffPending], [12, 4],
    'integration clears the upstream handoff backlog');
  assert.ok(midway(integrated).specialistWaiting > midway(baseline).specialistWaiting,
    'integration moves more referrals into the specialist queue');
  assert.equal(midway(integrated).treatmentStarts, midway(baseline).treatmentStarts,
    'end-to-end treatment starts are bound by the specialist slot');
  assert.equal(integrated.snapshot.metrics.treatmentStarts, baseline.snapshot.metrics.treatmentStarts);
  assert.equal(integrated.snapshot.resources.specialist.startsPerTick, 1);
  const { economics } = integrated.snapshot.lifecycle;
  assert.ok(economics.cashSpent > 0 && economics.recognisedCashSavings === 0);
  assert.equal(economics.repaidInStaffHours, false, 'avoided staff time does not repay the lifecycle work');
  assertConserved(integrated);
});

test('organizational reform capacity is granted only by adopted, live service and carries its own cost', async () => {
  const result = await run({ interventionId: 'organizational_reform', lifecycleOptions: {
    parameters: { adoptionTargetBasisPoints: 5000 } } });
  const capacity = result.ticks.map(item => item.snapshot.resources.coordination.capacityPerTick);
  assert.deepEqual(capacity.slice(0, 3), [2, 2, 2], 'no bonus before commissioning');
  assert.deepEqual(capacity.slice(3, 7), [2, 3, 2, 3], '5,000 bp of credit per tick alternates the one-unit bonus');
  assert.equal(result.snapshot.lifecycle.benefit.capacityUnitsGranted, 10);
  assert.equal(result.snapshot.lifecycle.benefit.coordinationUnitsAvoided, 0, 'handoff effort is unchanged for reform');
  assert.equal(result.snapshot.lifecycle.economics.avoidedStaffHours, 0, 'granted capacity is not a cost saving');
  assertConserved(result);
});

test('lifecycle runs are deterministic over complete events and tick outputs', async () => {
  assert.deepEqual(await run({ lifecycleOptions: { parameters: { failedCommissioningAttempts: 1, reworkWorkPerFailure: 2 },
    interruptions: [{ id: 'outage', startTick: 9, recoveryWork: 4 }] } }),
  await run({ lifecycleOptions: { parameters: { failedCommissioningAttempts: 1, reworkWorkPerFailure: 2 },
    interruptions: [{ id: 'outage', startTick: 9, recoveryWork: 4 }] } }));
});

test('without a lifecycle block the mechanism is applied immediately and the snapshot says so', async () => {
  const legacy = await run({ withLifecycle: false });
  assert.equal(legacy.snapshot.lifecycle.modelled, false);
  assert.equal(legacy.snapshot.runIdentity.modelVersion, 'minister-r03-cardiology-pathway-3');
  assert.equal(handoffs(legacy).some(event => 'adoptedMechanism' in event), false);
});

test('lifecycle inputs must name units, mechanisms and provenance and stay bounded', async () => {
  const modelExecutableId = await ministerModelExecutableId();
  const create = lifecycle => () => {
    const fixture = lifecycleRunInput({ lifecycle });
    return core.createRun({ scenario: core.R03_SCENARIO, seed: 1, modelExecutableId,
      protocolVersion: core.R01_PROTOCOL_VERSION, ...fixture });
  };
  assert.doesNotThrow(create(lifecycleInput()));
  const mutate = change => { const input = lifecycleInput(); change(input); return input; };
  assert.throws(create(mutate(input => { input.parameters.cashCap.unit = 'EUR'; })), /unit/);
  assert.throws(create(mutate(input => { delete input.parameters.workCap; })), /workCap/);
  assert.throws(create(mutate(input => { input.parameters.surprise = input.parameters.workCap; })), /Unknown/);
  assert.throws(create(mutate(input => { input.parameters.workCap.mechanism = ''; })), /mechanism/);
  assert.throws(create(mutate(input => { delete input.parameters.workCap.provenance; })), /provenance/);
  assert.throws(create(mutate(input => { input.parameters.cashCap.provenance = { status: 'sourced', source: 'x', priceYear: null }; })), /price year/);
  assert.throws(create(mutate(input => { input.parameters.cashCap.value = 1.5; })), /integer/);
  assert.throws(create(mutate(input => { input.costItems[0].cashUnit = 'EUR'; })), /units/);
  assert.throws(create(mutate(input => { input.costItems[0].mechanism = ''; })), /mechanism/);
  assert.throws(create(mutate(input => { input.costItems[0].tick = -1; })), /tick/);
  assert.throws(create(mutate(input => { input.costItems[0].category = 'subsidy_entitlement'; })), /category/);
  assert.throws(create(mutate(input => { input.costItems[0].cash = 0; input.costItems[0].work = 0; })), /charge/);
  assert.throws(create(mutate(input => { input.costItems.push({ ...input.costItems[0] }); })), /unique/);
  assert.throws(create(mutate(input => { input.costItems[1].periodTicks = 0; })), /period/);
  assert.throws(create(mutate(input => { input.parameters.approvalTick.value = 99; })), /approvalTick/);
  assert.throws(create(mutate(input => { input.parameters.implementationStartTick.value = 0; input.parameters.approvalTick.value = 1; })), /before approval/);
  assert.throws(create(mutate(input => { input.schema = 'other'; })), /lifecycle/);
});

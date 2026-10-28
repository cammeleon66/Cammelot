import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../site/minister-model-core.js';
import { ministerModelExecutableId } from '../scripts/minister_model_identity.mjs';

const core = globalThis.MinisterModelCore;

async function createFixture(overrides = {}) {
  return core.createRun({
    scenario: core.R03_SCENARIO,
    seed: 60475,
    modelExecutableId: await ministerModelExecutableId(),
    protocolVersion: core.R01_PROTOCOL_VERSION,
    interventionId: overrides.interventionId || 'conventional_integration',
    inputs: {
      horizonTicks: 8,
      coordinationUnitsPerTick: 2,
      treatmentStartsPerTick: 1,
      episodes: [
        { id: 'pending-a', age: 70, arrivalTick: 0, startingWaitTicks: 8,
          criticalAtTick: 1, deathAtTick: 1 },
        { id: 'pending-b', age: 80, arrivalTick: 0, startingWaitTicks: 4, criticalAtTick: 1 },
        { id: 'new-c', age: 75, arrivalTick: 1, startingWaitTicks: 0, informationComplete: false },
      ],
      ...overrides.inputs,
    },
    schedule: overrides.schedule || {
      id: 'fixture-schedule-v1',
      events: [{ tick: 2, patientId: 'new-c', kind: 'information_available' }],
    },
  });
}

async function deterministicTrace() {
  const run = await createFixture();
  const cursor = run.eventsSince(0).cursor;
  assert.equal(run.snapshot().metrics.arrivals, 2);
  assert.equal(run.snapshot().runIdentity.tick, 0);

  assert.equal(run.applyCommand({ id: 'handoff-a', sequence: 1,
    kind: 'complete_handoff', patientId: 'pending-a' }).status, 'applied');
  assert.equal(run.applyCommand({ id: 'handoff-b', sequence: 2,
    kind: 'complete_handoff', patientId: 'pending-b' }).status, 'applied');

  const firstTick = run.advanceOneTick(cursor);
  assert.equal(firstTick.tick, 1);
  assert.deepEqual(firstTick.events, run.eventsSince(cursor).events);
  const firstTickKinds = firstTick.events.map(event => [event.patientId, event.kind]);
  assert.ok(firstTickKinds.findIndex(([id, kind]) => id === 'pending-a' && kind === 'died_waiting')
    < firstTickKinds.findIndex(([id, kind]) => id === 'pending-b' && kind === 'treatment_started'),
  'death is processed before a treatment start at the same tick');
  assert.equal(firstTick.snapshot.resources.specialist.startsThisTick, 1);

  const informationRequest = run.applyCommand({ id: 'request-info', sequence: 3,
    kind: 'request_information', patientId: 'new-c' });
  assert.equal(informationRequest.status, 'applied');
  assert.equal(run.snapshot().episodes.find(episode => episode.id === 'new-c').stage, 'information_required');

  const secondTick = run.advanceOneTick(informationRequest.eventCursor);
  assert.deepEqual(secondTick.events, run.eventsSince(informationRequest.eventCursor).events);
  assert.deepEqual(secondTick.events.filter(event => event.patientId === 'new-c').map(event => event.kind),
    ['information_available', 'information_received']);
  assert.equal(run.snapshot().episodes.find(episode => episode.id === 'new-c').stage, 'handoff_pending');
  assert.equal(run.applyCommand({ id: 'handoff-c', sequence: 4,
    kind: 'complete_handoff', patientId: 'new-c' }).status, 'applied');
  const thirdTick = run.advanceOneTick(secondTick.cursor);
  assert.equal(thirdTick.snapshot.episodes.find(episode => episode.id === 'new-c').stage, 'treatment_started');

  const snapshot = run.snapshot();
  const pendingB = snapshot.episodes.find(episode => episode.id === 'pending-b');
  assert.equal(pendingB.everCritical, true, 'later treatment must not erase a critical-state crossing');
  assert.equal(pendingB.criticalAt, 1);
  assert.deepEqual(snapshot.metrics, {
    arrivals: 3,
    scheduled: 0,
    handoffPending: 0,
    informationRequired: 0,
    specialistWaiting: 0,
    criticalWaiting: 0,
    treatmentStarts: 2,
    diedWaiting: 1,
    refused: 0,
    relocated: 0,
    otherExit: 0,
    openEpisodes: 0,
  });
  assert.equal(snapshot.resources.coordination.unitsUsed, 4);
  assert.equal(snapshot.metrics.arrivals,
    snapshot.metrics.openEpisodes + snapshot.metrics.treatmentStarts + snapshot.metrics.diedWaiting
      + snapshot.metrics.refused + snapshot.metrics.relocated + snapshot.metrics.otherExit);

  snapshot.episodes[0].trace[0].reason = 'caller mutation';
  assert.notEqual(run.snapshot().episodes[0].trace[0].reason, 'caller mutation');
  assert.throws(() => run.eventsSince(-1), /cursor/);
  assert.throws(() => run.advanceOneTick(999), /cursor/);
  return { events: run.eventsSince(0).events, snapshot: run.snapshot() };
}

test('bounded pathway records ordered patient traces, resource use, and distinct exits', async () => {
  const result = await deterministicTrace();
  assert.equal(result.snapshot.runIdentity.modelVersion, 'minister-r03-cardiology-pathway-3');
  assert.equal(result.snapshot.runIdentity.protocolVersion, 'r01-cardiology-v1.0');
  assert.equal(result.snapshot.runIdentity.scheduleId, 'fixture-schedule-v1');
  assert.ok(result.events.every((event, index) => event.sequence === index + 1));
});

test('same seed, inputs, and schedule reproduce full events and snapshots', async () => {
  assert.deepEqual(await deterministicTrace(), await deterministicTrace());
});

async function handoffCapacity(interventionId) {
  const run = await createFixture({
    interventionId,
    inputs: {
      horizonTicks: 1,
      coordinationUnitsPerTick: 3,
      treatmentStartsPerTick: 1,
      episodes: [0, 1, 2, 3].map(index => ({
        id: `referral-${index}`, age: 70 + index, arrivalTick: 0, startingWaitTicks: 0,
      })),
    },
    schedule: { id: 'paired-handoff-capacity-v1', events: [] },
  });
  let commandSequence = 1;
  for (let index = 0; index < 4; index++) {
    const receipt = run.applyCommand({
      id: `handoff-${index}`,
      sequence: commandSequence,
      kind: 'complete_handoff',
      patientId: `referral-${index}`,
    });
    if (receipt.status === 'applied') commandSequence++;
  }
  const startCursor = run.snapshot().eventCursor;
  const result = run.advanceOneTick(startCursor);
  return { run, result, snapshot: run.snapshot() };
}

test('hand-checkable pathway fixture shows a bottleneck shift, not added care capacity', async () => {
  const fragmented = await handoffCapacity('current_process');
  const integrated = await handoffCapacity('conventional_integration');
  assert.deepEqual({
    routed: fragmented.snapshot.metrics.specialistWaiting + fragmented.snapshot.metrics.treatmentStarts,
    handoffPending: fragmented.snapshot.metrics.handoffPending,
    starts: fragmented.snapshot.metrics.treatmentStarts,
    capacity: fragmented.snapshot.resources.specialist.startsPerTick,
  }, { routed: 1, handoffPending: 3, starts: 1, capacity: 1 });
  assert.deepEqual({
    routed: integrated.snapshot.metrics.specialistWaiting + integrated.snapshot.metrics.treatmentStarts,
    handoffPending: integrated.snapshot.metrics.handoffPending,
    starts: integrated.snapshot.metrics.treatmentStarts,
    capacity: integrated.snapshot.resources.specialist.startsPerTick,
  }, { routed: 3, handoffPending: 1, starts: 1, capacity: 1 });
  assert.equal(fragmented.snapshot.metrics.arrivals, integrated.snapshot.metrics.arrivals);
  assert.equal(fragmented.snapshot.runIdentity.seed, integrated.snapshot.runIdentity.seed);
  assert.equal(fragmented.snapshot.runIdentity.scheduleId, integrated.snapshot.runIdentity.scheduleId);
  assert.equal(fragmented.result.snapshot.resources.specialist.startsThisTick, 1);
});

test('local handoff improvement fails to improve timely treatment when specialist starts bind', async () => {
  const baseline = await handoffCapacity('current_process');
  const improvedHandoff = await handoffCapacity('conventional_integration');
  const timelyTreatment = snapshot => snapshot.metrics.treatmentStarts;
  assert.equal(improvedHandoff.snapshot.metrics.specialistWaiting
      + improvedHandoff.snapshot.metrics.treatmentStarts,
    3, 'integration routes more patients into the downstream queue');
  assert.equal(baseline.snapshot.metrics.specialistWaiting
      + baseline.snapshot.metrics.treatmentStarts,
    1, 'baseline leaves referrals in the upstream handoff stage');
  assert.equal(timelyTreatment(improvedHandoff.snapshot), timelyTreatment(baseline.snapshot),
    'one specialist treatment-start slot per tick binds the end-to-end result');
  assert.equal(improvedHandoff.snapshot.resources.specialist.startsPerTick, 1);
  assert.equal(baseline.snapshot.resources.specialist.startsPerTick, 1);
});

test('R01 alternatives change named workflow mechanisms without bonuses or care-capacity changes', async () => {
  const ids = ['current_process', 'organizational_reform', 'conventional_integration',
    'agentic_coordination', 'non_agentic_modernization'];
  const runs = await Promise.all(ids.map(id => handoffCapacity(id)));
  const profiles = runs.map(({ snapshot }) => snapshot.resources.coordination);
  assert.deepEqual(profiles.map(profile => profile.mechanism),
    ids.map(id => core.R01_INTERVENTIONS[id].mechanism));
  assert.deepEqual(profiles.map(profile => profile.handoffActionUnits), [2, 2, 1, 1, 1]);
  assert.deepEqual(profiles.map(profile => profile.capacityPerTick), [3, 4, 3, 3, 3]);
  assert.ok(profiles.every(profile => !/bonus/i.test(profile.mechanism)),
    'intervention descriptions specify mechanisms, not outcome bonuses');
  assert.deepEqual(runs.map(({ snapshot }) => snapshot.resources.specialist.startsPerTick), [1, 1, 1, 1, 1]);
  assert.deepEqual(runs.map(({ snapshot }) => snapshot.metrics.treatmentStarts), [1, 1, 1, 1, 1]);
  assert.deepEqual(runs[2].snapshot.metrics, runs[3].snapshot.metrics,
    'agentic coordination receives no automatic advantage over conventional integration');
});

test('refusal, relocation, and other exit remain separate terminal states', async () => {
  const run = await createFixture({ inputs: { episodes: [
    { id: 'refused', age: 70, arrivalTick: 0, startingWaitTicks: 0 },
    { id: 'relocated', age: 71, arrivalTick: 0, startingWaitTicks: 0 },
    { id: 'other', age: 72, arrivalTick: 0, startingWaitTicks: 0 },
  ] }, schedule: { id: 'exit-fixture-v1', events: [] } });
  for (const [sequence, [patientId, kind]] of [
    [1, ['refused', 'refuse']],
    [2, ['relocated', 'relocate']],
    [3, ['other', 'other_exit']],
  ]) {
    assert.equal(run.applyCommand({ id: `exit-${sequence}`, sequence, patientId, kind }).status, 'applied');
  }
  const snapshot = run.snapshot();
  assert.deepEqual(snapshot.episodes.map(episode => episode.stage), ['refused', 'relocated', 'other_exit']);
  assert.equal(snapshot.metrics.arrivals, 3);
  assert.equal(snapshot.metrics.openEpisodes, 0);
  assert.deepEqual([snapshot.metrics.refused, snapshot.metrics.relocated, snapshot.metrics.otherExit], [1, 1, 1]);
});

test('pathway rejects invalid bounds, missing identity, and unsupported clinical commands', async () => {
  const modelExecutableId = await ministerModelExecutableId();
  const create = overrides => core.createRun({
    scenario: core.R03_SCENARIO,
    seed: 1,
    modelExecutableId,
    protocolVersion: core.R01_PROTOCOL_VERSION,
    inputs: {
      horizonTicks: 4,
      coordinationUnitsPerTick: 1,
      treatmentStartsPerTick: 1,
      episodes: [{ id: 'patient-1', age: 70, arrivalTick: 0, startingWaitTicks: 0 }],
    },
    schedule: { id: 'test', events: [] },
    ...overrides,
  });
  assert.throws(() => create({ modelExecutableId: null }), /identity/);
  assert.throws(() => create({ seed: -1 }), /Seed/);
  assert.throws(() => create({ inputs: { horizonTicks: 4, coordinationUnitsPerTick: 0,
    treatmentStartsPerTick: 1,
    episodes: [{ id: 'patient-1', age: 70, arrivalTick: 0, startingWaitTicks: 0 }] } }), /capacity/);

  const run = await createFixture();
  const before = run.snapshot();
  const denied = run.applyCommand({ id: 'clinical-bonus', sequence: 1,
    kind: 'start_treatment', patientId: 'pending-a' });
  assert.equal(denied.status, 'rejected');
  assert.equal(denied.reason, 'command_not_allowed');
  assert.equal(run.snapshot().episodes[0].stage, before.episodes[0].stage);
  assert.equal(run.snapshot().resources.specialist.starts, 0);
});

test('coordination capacity is separate from specialist starts and rejected commands do not change state', async () => {
  const run = await createFixture({ inputs: { coordinationUnitsPerTick: 1 } });
  const first = run.applyCommand({ id: 'first', sequence: 1,
    kind: 'complete_handoff', patientId: 'pending-a' });
  const blocked = run.applyCommand({ id: 'second', sequence: 2,
    kind: 'complete_handoff', patientId: 'pending-b' });
  assert.equal(first.status, 'applied');
  assert.equal(blocked.status, 'rejected');
  assert.equal(blocked.reason, 'coordination_capacity');
  assert.equal(run.snapshot().resources.coordination.usedThisTick, 1);
  assert.equal(run.snapshot().resources.specialist.starts, 0);
  const repeated = run.applyCommand({ id: 'first', sequence: 2,
    kind: 'complete_handoff', patientId: 'pending-b' });
  assert.equal(repeated.status, 'no_effect');
  assert.equal(run.snapshot().episodes.find(episode => episode.id === 'pending-b').stage, 'handoff_pending');
});

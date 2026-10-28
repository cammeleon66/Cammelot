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
  assert.equal(result.snapshot.runIdentity.modelVersion, 'minister-r03-cardiology-pathway-1');
  assert.equal(result.snapshot.runIdentity.protocolVersion, 'r01-cardiology-v1.0');
  assert.equal(result.snapshot.runIdentity.scheduleId, 'fixture-schedule-v1');
  assert.ok(result.events.every((event, index) => event.sequence === index + 1));
});

test('same seed, inputs, and schedule reproduce full events and snapshots', async () => {
  assert.deepEqual(await deterministicTrace(), await deterministicTrace());
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

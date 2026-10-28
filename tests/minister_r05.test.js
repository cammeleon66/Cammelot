import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARMS,
  DEFAULT_SEEDS,
  R01_EPISODE_COUNT,
  R01_HORIZON_TICKS,
  executeRun,
  initializeExecutable,
  makeDataset,
  pairedInterval,
} from '../scripts/run_r05_comparison.mjs';

let executable;

before(async () => {
  executable = await initializeExecutable();
});

function smallDataset(seed = 1103) {
  return {
    seed,
    sha256: 'test-dataset',
    episodes: Array.from({ length: R01_EPISODE_COUNT }, (_, index) => ({
      id: `test-${String(index).padStart(3, '0')}`,
      age: 70,
      arrivalTick: 0,
      startingWaitTicks: 0,
      priority: index % 3,
      informationComplete: true,
      criticalAtTick: 3,
      deathAtTick: 4,
    })),
    schedule: { id: `test-shocks-${seed}`, events: [] },
  };
}

test('R01 exogenous datasets reproduce the 336 episodes, monthly arrivals and common schedule', () => {
  const first = makeDataset(DEFAULT_SEEDS[0]);
  const replay = makeDataset(DEFAULT_SEEDS[0]);
  assert.deepEqual(replay, first);
  assert.equal(first.episodes.length, R01_EPISODE_COUNT);
  assert.equal(first.episodes.filter(episode => episode.arrivalTick === 0).length, 120);
  assert.equal(first.episodes.at(-1).arrivalTick, 936);
  assert.equal(first.episodes.filter(episode => episode.arrivalTick > 0).length, 216);
  assert.ok(first.episodes.every(episode => episode.age >= 65 && episode.age <= 84));
  assert.ok(first.schedule.events.every(event => event.kind === 'information_available'
    && event.tick >= first.episodes.find(episode => episode.id === event.patientId).arrivalTick));
  assert.notDeepEqual(makeDataset(DEFAULT_SEEDS[1]).episodes, first.episodes);
});

test('full-horizon policy replay records identities, commands, event digest and milestone accounting', () => {
  const dataset = smallDataset();
  const first = executeRun({
    analysis: 'replay_fixture', seed: dataset.seed,
    arm: { id: 'conventional_fixture', interventionId: 'conventional_integration', lifecycle: false },
    dataset, horizonTicks: 4,
  });
  const replay = executeRun({
    analysis: 'replay_fixture', seed: dataset.seed,
    arm: { id: 'conventional_fixture', interventionId: 'conventional_integration', lifecycle: false },
    dataset, horizonTicks: 4,
  });
  assert.equal(first.complete, true);
  assert.equal(first.finalTick, 4);
  assert.equal(first.outcomes.denominator, R01_EPISODE_COUNT);
  assert.equal(first.commands.length > 0, true);
  assert.ok(first.commands.every(item => item.receipt && item.command.patientId));
  assert.deepEqual(first.eventStream, replay.eventStream);
  assert.deepEqual(first.episodeOutcomes, replay.episodeOutcomes);
  assert.equal(first.modelVersion, 'minister-r03-cardiology-pathway-3');
  assert.equal(first.protocolVersion, 'r01-cardiology-v1.0');
  for (const id of [first.modelExecutableId, first.replayExecutableId, first.moduleSha256]) {
    assert.match(id, /^[a-f0-9]{64}$/);
  }
  assert.equal(first.moduleSha256, executable.moduleSha256);
  assert.equal(first.modelExecutableId, executable.modelExecutableId);
  assert.equal(first.replayExecutableId, executable.replayExecutableId);
  assert.equal(first.scheduleId, replay.scheduleId);
});

test('known mechanism can improve handoff throughput without increasing specialist starts', () => {
  const dataset = smallDataset();
  const baseline = executeRun({
    analysis: 'bottleneck_fixture', seed: dataset.seed, arm: ARMS[0], dataset, horizonTicks: 4,
  });
  const integration = executeRun({
    analysis: 'bottleneck_fixture', seed: dataset.seed,
    arm: { id: 'integration_without_lifecycle', interventionId: 'conventional_integration', lifecycle: false },
    dataset, horizonTicks: 4,
  });
  const handoffs = record => record.eventStream.kinds.handoff_completed;
  assert.ok(handoffs(integration) > handoffs(baseline));
  assert.equal(integration.outcomes.treatmentStarts, baseline.outcomes.treatmentStarts);
  assert.equal(integration.outcomes.treatmentStarts, 3,
    'one specialist slot per tick binds the four-tick end-to-end result');
});

test('zero adoption is a null control and a commissioning failure is explicitly recorded', () => {
  const dataset = smallDataset();
  const baseline = executeRun({
    analysis: 'null_fixture', seed: dataset.seed, arm: ARMS[0], dataset, horizonTicks: 8,
  });
  const noAdoption = executeRun({
    analysis: 'null_fixture', seed: dataset.seed,
    arm: { id: 'agentic_zero', interventionId: 'agentic_coordination', lifecycle: true },
    dataset,
    horizonTicks: 8,
    lifecycleOptions: {
      adoptionTargetBasisPoints: 0,
      implementationWorkRequired: 1,
      implementationWorkPerTick: 1,
      commissioningDelayTicks: 1,
      adoptionRampTicks: 0,
    },
  });
  const { lifecycle: _baselineLifecycle, ...baselineClinical } = baseline.outcomes;
  const { lifecycle: _zeroLifecycle, ...zeroClinical } = noAdoption.outcomes;
  assert.deepEqual(zeroClinical, baselineClinical);

  const failed = executeRun({
    analysis: 'failure_fixture', seed: dataset.seed,
    arm: { id: 'agentic_failure', interventionId: 'agentic_coordination', lifecycle: true },
    dataset,
    horizonTicks: 8,
    lifecycleOptions: {
      implementationWorkRequired: 1,
      implementationWorkPerTick: 1,
      commissioningDelayTicks: 1,
      adoptionRampTicks: 0,
      failedCommissioningAttempts: 1,
      reworkWorkPerFailure: 1,
    },
  });
  assert.deepEqual(failed.finalSnapshot.lifecycle.commissioning.attempts.map(attempt => attempt.outcome),
    ['failed', 'passed']);
  assert.ok(failed.eventStream.kinds.commissioning_failed > 0);
  assert.ok(failed.finalSnapshot.lifecycle.ledger.byCategory.incident_handling.cash > 0);
  assert.ok(failed.finalSnapshot.lifecycle.ledger.byCategory.upgrades.cash > 0);
  assert.ok(failed.finalSnapshot.lifecycle.ledger.byCategory.clinician_review_override.work > 0);
  assert.ok(failed.finalSnapshot.lifecycle.ledger.residualLiabilities
    .some(item => item.itemId === 'decommissioning-liability'));
});

test('incomplete run is rejected before a partial summary can be returned', () => {
  assert.throws(() => executeRun({
    analysis: 'incomplete_fixture', seed: 1103, arm: ARMS[0], dataset: smallDataset(),
    horizonTicks: 4, stopAfterTicksForTest: 1,
  }), /incomplete run\/horizon\/accounting/);
});

test('paired uncertainty intervals use seed-level differences and stay finite', () => {
  assert.deepEqual(pairedInterval([0.1, 0.1, 0.1, 0.1]), {
    mean: 0.1, lower95: 0.1, upper95: 0.1,
  });
  const interval = pairedInterval([-0.1, 0, 0.05, 0.15]);
  assert.ok(interval.lower95 <= interval.mean && interval.mean <= interval.upper95);
  assert.throws(() => pairedInterval([1]), /2–21 seed pairs/);
});

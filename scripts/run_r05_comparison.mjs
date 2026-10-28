import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import '../site/minister-model-core.js';
import { ministerModelExecutableId } from './minister_model_identity.mjs';

const core = globalThis.MinisterModelCore;
const MODULE_URL = new URL('../site/minister-model-core.js', import.meta.url);
const RUNNER_URL = new URL(import.meta.url);
export const DEFAULT_SEEDS = Object.freeze([1103, 2027, 3371, 4729, 5987, 6437, 7919, 9859]);
export const R01_HORIZON_TICKS = 5 * core.TICKS_PER_YEAR;
export const R01_EPISODE_COUNT = 336;
export const R01_TIMELY_TICKS = 48;
export const R01_SUCCESS_180D_TICKS = Math.floor(180 / (7 / 4));

export const POLICY = Object.freeze({
  version: 'r05-uniform-referral-policy-v1',
  action: 'complete_handoff',
  missingInformationAction: 'request_information',
  commandTiming: 'At tick 0 and after each completed tick, before the next tick transition.',
  eligibility: 'All arrived episodes in handoff_pending; request missing referral information, otherwise complete the handoff.',
  priority: 'Higher declared referral priority first, then earlier arrival tick, then ascending episode ID.',
  capacity: 'Stop submitting for the tick after the first coordination_capacity rejection; retry pending work next tick.',
  sequence: 'Increment sequence only after an applied command; record every attempted command and receipt.',
  clinicalBoundary: 'No clinical decision, treatment start, appointment, capacity purchase, or outcome bonus is commanded by policy.',
});

export const ARMS = Object.freeze([
  Object.freeze({ id: 'current_process', interventionId: 'current_process', lifecycle: false }),
  Object.freeze({ id: 'organizational_reform', interventionId: 'organizational_reform', lifecycle: true }),
  Object.freeze({ id: 'conventional_integration', interventionId: 'conventional_integration', lifecycle: true }),
  Object.freeze({ id: 'agentic_coordination', interventionId: 'agentic_coordination', lifecycle: true }),
  Object.freeze({ id: 'non_agentic_modernization', interventionId: 'non_agentic_modernization', lifecycle: true }),
]);
const PROJECT_ARMS = ARMS.filter(arm => arm.lifecycle);
const COUNTERFACTUAL_FAILURE = Object.freeze({
  commissioning: Object.freeze({ failedCommissioningAttempts: 1, reworkWorkPerFailure: 16 }),
});
const T_CRITICAL_95 = Object.freeze({
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365,
  8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145,
  15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
});
const COST_PROFILE = Object.freeze({
  organizational_reform: Object.freeze({
    design: 500, data: 0, migration: 0, training: 400, security: 0,
    license: 0, maintenance: 100, upgrades: 30, decommissioning: 100, oversight: 8, clinicianReview: 6,
  }),
  conventional_integration: Object.freeze({
    design: 800, data: 300, migration: 600, training: 400, security: 100,
    license: 80, maintenance: 50, upgrades: 45, decommissioning: 200, oversight: 12, clinicianReview: 8,
  }),
  agentic_coordination: Object.freeze({
    design: 2400, data: 300, migration: 600, training: 800, security: 300,
    license: 250, maintenance: 200, upgrades: 120, decommissioning: 400, oversight: 24, clinicianReview: 16,
  }),
  non_agentic_modernization: Object.freeze({
    design: 1600, data: 300, migration: 1200, training: 600, security: 200,
    license: 130, maintenance: 100, upgrades: 80, decommissioning: 300, oversight: 16, clinicianReview: 12,
  }),
});
const COMMON_CAPACITIES = Object.freeze({ coordinationUnitsPerTick: 2, treatmentStartsPerTick: 1 });
const BASE_LIFECYCLE = Object.freeze({
  implementationWorkRequired: 104,
  implementationWorkPerTick: 8,
  commissioningDelayTicks: 4,
  adoptionRampTicks: 104,
});

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestId = entries => sha256(Buffer.from(JSON.stringify(entries
  .map(({ name, sha256: digest }) => [name, digest])
  .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)), 'utf8'));
const round = value => Number(value.toFixed(6));
const sum = values => values.reduce((total, value) => total + value, 0);
const stableString = value => JSON.stringify(value);

function assertSeeds(seeds) {
  if (!Array.isArray(seeds) || seeds.length < 2 || seeds.length > 20
      || new Set(seeds).size !== seeds.length
      || seeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF)) {
    throw new RangeError('R05 requires 2–20 unique unsigned 32-bit seeds.');
  }
}

function makeEpisode({ id, age, arrivalTick, startingWaitTicks, priority, random }) {
  const informationComplete = random() >= 0.15;
  const criticalAtTick = arrivalTick + 8 + Math.floor(random() * 24);
  const deathAtTick = arrivalTick + 52 + Math.floor(random() * 51);
  return {
    id,
    age,
    arrivalTick,
    startingWaitTicks,
    priority,
    informationComplete,
    criticalAtTick,
    deathAtTick,
  };
}

export function makeDataset(seed) {
  const random = core.seededRandom(seed);
  const episodes = [];
  for (let index = 0; index < 120; index++) {
    episodes.push(makeEpisode({
      id: `backlog-${String(index).padStart(3, '0')}`,
      age: 65 + Math.floor(random() * 20),
      arrivalTick: 0,
      startingWaitTicks: Math.floor(random() * (13 * core.TICKS_PER_WEEK)),
      priority: Math.floor(random() * 3),
      random,
    }));
  }
  for (let month = 1; month <= 54; month++) {
    const arrivalTick = Math.round(month * core.TICKS_PER_YEAR / 12);
    for (let index = 0; index < 4; index++) {
      episodes.push(makeEpisode({
        id: `new-${String(month).padStart(2, '0')}-${index}`,
        age: 65 + Math.floor(random() * 20),
        arrivalTick,
        startingWaitTicks: 0,
        priority: Math.floor(random() * 3),
        random,
      }));
    }
  }
  const schedule = {
    id: `r05-exogenous-schedule-${seed}-v1`,
    events: episodes.flatMap(episode => episode.informationComplete ? [] : [{
      tick: episode.arrivalTick + 1 + Math.floor(random() * 12),
      patientId: episode.id,
      kind: 'information_available',
    }]).sort((left, right) => left.tick - right.tick || left.patientId.localeCompare(right.patientId)),
  };
  if (episodes.length !== R01_EPISODE_COUNT || episodes.at(-1).arrivalTick !== 936
      || episodes.some(episode => episode.arrivalTick > R01_HORIZON_TICKS
        || episode.criticalAtTick < episode.arrivalTick || episode.deathAtTick < episode.arrivalTick
        || episode.criticalAtTick > R01_HORIZON_TICKS || episode.deathAtTick > R01_HORIZON_TICKS)
      || schedule.events.some(event => event.tick < episodes.find(item => item.id === event.patientId).arrivalTick
        || event.tick > R01_HORIZON_TICKS)) {
    throw new Error(`Seed ${seed}: generated demand or exogenous schedule violates the frozen R01 bounds.`);
  }
  return { seed, episodes, schedule };
}

const provenance = source => ({ status: 'assumption', source, priceYear: null });
const parameter = (value, unit, mechanism, source) => ({
  value, unit, mechanism, provenance: provenance(source),
});

function costItem({ id, category, timing = 'one_time', tick = 0, from, periodTicks,
  cash = 0, work = 0, source }) {
  return {
    id, category, timing, tick, ...(from ? { from, periodTicks } : {}),
    cash, work,
    cashUnit: 'scenario_cash_minor_unit',
    workUnit: 'staff_hour',
    mechanism: `R05 illustrative ${id} lifecycle assumption.`,
    provenance: provenance(source),
  };
}

export function makeLifecycleInput({ id, armId, horizonTicks = R01_HORIZON_TICKS,
  adoptionTargetBasisPoints = 10000, implementationStartTick = 0, cashMultiplier = 1,
  failedCommissioningAttempts = 0, reworkWorkPerFailure = 0, profileMultiplier = 1,
  implementationWorkRequired = BASE_LIFECYCLE.implementationWorkRequired,
  implementationWorkPerTick = BASE_LIFECYCLE.implementationWorkPerTick,
  commissioningDelayTicks = BASE_LIFECYCLE.commissioningDelayTicks,
  adoptionRampTicks = BASE_LIFECYCLE.adoptionRampTicks } = {}) {
  const source = 'R05 scenario assumption only; not a sourced price, rate, or forecast.';
  const profile = COST_PROFILE[armId];
  if (!profile) throw new RangeError(`No lifecycle profile exists for ${armId}.`);
  const cash = amount => Math.round(amount * cashMultiplier * profileMultiplier);
  const parameters = {
    approvalTick: parameter(0, 'tick', 'Approve the common finite envelope at tick zero.', source),
    cashCap: parameter(100000, 'scenario_cash_minor_unit', 'Common illustrative envelope; not euros.', source),
    workCap: parameter(5000, 'staff_hour', 'Common illustrative work envelope.', source),
    implementationStartTick: parameter(implementationStartTick, 'tick',
      'Prespecified deployment-start sensitivity in model ticks.', source),
    implementationWorkRequired: parameter(implementationWorkRequired, 'staff_hour',
      'Common illustrative implementation work.', source),
    implementationWorkPerTick: parameter(implementationWorkPerTick, 'staff_hour_per_tick',
      'Common bounded implementation rate.', source),
    commissioningDelayTicks: parameter(commissioningDelayTicks, 'tick',
      'Common delay between implementation and commissioning attempt.', source),
    failedCommissioningAttempts: parameter(failedCommissioningAttempts, 'attempt',
      'Deterministic stress setting; not a failure probability.', source),
    reworkWorkPerFailure: parameter(reworkWorkPerFailure, 'staff_hour',
      'Explicit rework work after the commissioning-failure control.', source),
    adoptionTargetBasisPoints: parameter(adoptionTargetBasisPoints, 'basis_point',
      'Adoption sensitivity; not an observed uptake rate.', source),
    adoptionRampTicks: parameter(adoptionRampTicks, 'tick',
      'Common illustrative linear adoption ramp.', source),
    recoveryWorkPerTick: parameter(8, 'staff_hour_per_tick', 'Illustrative recovery work rate.', source),
    staffHoursPerCoordinationUnit: parameter(1, 'staff_hour_per_coordination_unit',
      'Illustrative work-only payback conversion.', source),
  };
  const costItems = [
    costItem({ id: 'design-procurement', category: 'design_procurement',
      cash: cash(profile.design), source }),
    ...(profile.data ? [costItem({ id: 'data-cleanup', category: 'data_cleanup',
      cash: cash(profile.data), source })] : []),
    ...(profile.migration ? [costItem({ id: 'migration-dual-running', category: 'migration_dual_running',
      cash: cash(profile.migration), source })] : []),
    costItem({ id: 'training-backfill', category: 'training_backfill',
      cash: cash(profile.training), work: 40, source }),
    ...(profile.security ? [costItem({ id: 'security-privacy', category: 'security_privacy',
      cash: cash(profile.security), source })] : []),
    ...(profile.license ? [costItem({ id: 'license-compute', category: 'licenses_compute',
      timing: 'recurring', from: 'commissioning', periodTicks: core.TICKS_PER_YEAR,
      cash: cash(profile.license), source })] : []),
    ...(profile.maintenance ? [costItem({ id: 'maintenance-upgrades', category: 'maintenance',
      timing: 'recurring', from: 'commissioning', periodTicks: core.TICKS_PER_YEAR,
      cash: cash(profile.maintenance), source })] : []),
    costItem({ id: 'system-upgrades', category: 'upgrades',
      timing: 'recurring', from: 'commissioning', periodTicks: core.TICKS_PER_YEAR,
      cash: cash(profile.upgrades), source }),
    costItem({ id: 'human-oversight', category: 'human_oversight',
      timing: 'recurring', from: 'commissioning', periodTicks: core.TICKS_PER_YEAR,
      work: profile.oversight, source }),
    costItem({ id: 'clinician-review-override', category: 'clinician_review_override',
      timing: 'recurring', from: 'commissioning', periodTicks: core.TICKS_PER_YEAR,
      work: profile.clinicianReview, source }),
    costItem({ id: 'decommissioning-liability', category: 'decommissioning',
      tick: horizonTicks + 1, cash: cash(profile.decommissioning), work: 4, source }),
    ...(failedCommissioningAttempts > 0 ? [costItem({ id: 'commissioning-incident',
      category: 'incident_handling', timing: 'on_commissioning_failure',
      cash: cash(120), work: 4, source })] : []),
  ].filter(item => item.cash > 0 || item.work > 0);
  return { schema: 'r04-lifecycle-ledger-v1', id, parameters, costItems, interruptions: [] };
}

function policyOrder(left, right) {
  return right.priority - left.priority || left.arrivalTick - right.arrivalTick
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function assertLifecycleLedger(snapshot, events, label) {
  if (!snapshot.lifecycle.modelled) return;
  const ledger = snapshot.lifecycle.ledger;
  const paid = events.filter(event => event.kind === 'cost_paid');
  const workSpent = sum(paid.map(event => event.work ?? 0))
    + sum(events.filter(event => event.kind === 'implementation_progress')
      .map(event => event.work ?? 0))
    + sum(events.filter(event => event.kind === 'recovery_progress')
      .map(event => event.work ?? 0));
  const cashSpent = sum(paid.map(event => event.cash ?? 0));
  if (ledger.cash.spent !== cashSpent || ledger.work.spent !== workSpent
      || ledger.cash.authorised !== ledger.cash.spent + ledger.cash.remaining
      || ledger.work.authorised !== ledger.work.spent + ledger.work.remaining
      || ledger.cash.remaining < 0 || ledger.work.remaining < 0) {
    throw new Error(`${label}: lifecycle cash/work ledger failed event-derived conservation checks.`);
  }
  for (const bucketType of ['byPurpose', 'byCategory']) {
    const buckets = Object.values(ledger[bucketType]);
    if (sum(buckets.map(bucket => bucket.cash)) !== cashSpent
        || sum(buckets.map(bucket => bucket.work)) !== workSpent) {
      throw new Error(`${label}: lifecycle ${bucketType} does not reconcile to event totals.`);
    }
  }
}

function endpointRecord(episode) {
  const treatment = episode.trace.find(event => event.kind === 'treatment_started');
  const treatmentTick = treatment?.tick ?? null;
  const waitAfterEntryTicks = treatmentTick === null ? null : treatmentTick - episode.arrivalTick;
  const terminalEvent = episode.trace.find(event => ['treatment_started', 'died_waiting', 'refuse',
    'relocate', 'other_exit'].includes(event.kind));
  const observedEndTick = terminalEvent?.tick ?? R01_HORIZON_TICKS;
  const observedWaitThroughExitTicks = episode.startingWaitTicks + observedEndTick - episode.arrivalTick;
  return {
    id: episode.id,
    age: episode.age,
    ageBand: episode.age < 75 ? '65-74' : '75-84',
    arrivalTick: episode.arrivalTick,
    startingWaitTicks: episode.startingWaitTicks,
    finalStage: episode.stage,
    everCritical: episode.everCritical,
    criticalAt: episode.criticalAt,
    treatmentTick,
    waitAfterEntryTicks,
    totalReferralToTreatmentTicks: treatmentTick === null
      ? null : episode.startingWaitTicks + waitAfterEntryTicks,
    observedWaitThroughExitTicks,
    timely84Days: waitAfterEntryTicks !== null && waitAfterEntryTicks <= R01_TIMELY_TICKS,
    success180Days: waitAfterEntryTicks !== null && waitAfterEntryTicks <= R01_SUCCESS_180D_TICKS
      && !episode.everCritical,
  };
}

function outcomeFromEpisodes(episodes, lifecycle) {
  const denominator = episodes.length;
  const count = predicate => episodes.filter(predicate).length;
  const treated = episodes.filter(episode => episode.treatmentTick !== null);
  const open = episodes.filter(episode => ['handoff_pending', 'information_required', 'specialist_waiting']
    .includes(episode.finalStage));
  const completedWaits = treated.map(episode => episode.totalReferralToTreatmentTicks);
  const observedWaits = episodes.map(episode => episode.observedWaitThroughExitTicks);
  return {
    denominator,
    timely84Days: count(episode => episode.timely84Days),
    timely84DayShare: denominator ? count(episode => episode.timely84Days) / denominator : 0,
    success180Days: count(episode => episode.success180Days),
    success180DayShare: denominator ? count(episode => episode.success180Days) / denominator : 0,
    criticalBeforeTreatment: count(episode => episode.everCritical
      && (episode.treatmentTick === null || episode.criticalAt <= episode.treatmentTick)),
    deathsBeforeTreatment: count(episode => episode.finalStage === 'died_waiting'),
    stillWaiting: count(episode => ['handoff_pending', 'information_required', 'specialist_waiting']
      .includes(episode.finalStage)),
    completedTotalWait: {
      count: completedWaits.length,
      meanTicks: completedWaits.length ? round(mean(completedWaits)) : null,
      longestTicks: completedWaits.length ? Math.max(...completedWaits) : null,
    },
    waitObservedThroughExit: {
      meanTicks: round(mean(observedWaits)),
      longestTicks: observedWaits.length ? Math.max(...observedWaits) : null,
      longestOpenWaitTicks: open.length ? Math.max(...open.map(episode => episode.observedWaitThroughExitTicks)) : null,
    },
    byAgeBand: Object.fromEntries(['65-74', '75-84'].map(ageBand => {
      const band = episodes.filter(episode => episode.ageBand === ageBand);
      return [ageBand, {
        denominator: band.length,
        timely84Days: band.filter(episode => episode.timely84Days).length,
        success180Days: band.filter(episode => episode.success180Days).length,
        criticalBeforeTreatment: band.filter(episode => episode.everCritical
          && (episode.treatmentTick === null || episode.criticalAt <= episode.treatmentTick)).length,
      }];
    })),
    sexEquity: { status: 'not-measured', reason: 'Sex is not an input in this R03 pathway.' },
    lifecycle,
  };
}

function makeMilestone(snapshot) {
  return {
    tick: snapshot.runIdentity.tick,
    metrics: snapshot.metrics,
    resources: snapshot.resources,
    lifecycle: snapshot.lifecycle,
  };
}

function assertCompleteRun({ snapshot, horizonTicks, tickCount, episodeCount, eventCount, label }) {
  if (tickCount !== horizonTicks || snapshot.runIdentity.tick !== horizonTicks
      || snapshot.metrics.arrivals !== episodeCount || snapshot.metrics.scheduled !== 0
      || snapshot.metrics.arrivals !== snapshot.metrics.handoffPending + snapshot.metrics.informationRequired
        + snapshot.metrics.specialistWaiting + snapshot.metrics.treatmentStarts
        + snapshot.metrics.diedWaiting + snapshot.metrics.refused + snapshot.metrics.relocated
        + snapshot.metrics.otherExit
      || eventCount < episodeCount) {
    throw new Error(`${label}: incomplete run/horizon/accounting; no summary may be emitted.`);
  }
}

export function executeRun({ analysis, seed, arm, dataset, horizonTicks = R01_HORIZON_TICKS,
  lifecycleOptions = {}, costMultiplier = 1, profileMultiplier = 1, treatmentStartsPerTick = 1,
  stopAfterTicksForTest } = {}) {
  if (!Number.isInteger(horizonTicks) || horizonTicks < 1 || horizonTicks > 100000) {
    throw new RangeError('R05 comparison horizon must be a positive bounded tick count.');
  }
  const label = `${analysis}/${seed}/${arm.id}`;
  const lifecycle = arm.lifecycle ? makeLifecycleInput({
    id: `r05-${seed}-${sha256(Buffer.from(stableString({
      analysis, arm: arm.id, horizonTicks, lifecycleOptions, costMultiplier, profileMultiplier,
    }), 'utf8')).slice(0, 24)}`,
    armId: arm.interventionId,
    horizonTicks,
    cashMultiplier: costMultiplier,
    profileMultiplier,
    ...lifecycleOptions,
  }) : undefined;
  const inputs = {
    horizonTicks,
    ...COMMON_CAPACITIES,
    treatmentStartsPerTick,
    episodes: dataset.episodes,
    ...(lifecycle ? { lifecycle } : {}),
  };
  const run = core.createRun({
    scenario: core.R03_SCENARIO,
    seed,
    modelExecutableId: EXECUTABLE.modelExecutableId,
    protocolVersion: core.R01_PROTOCOL_VERSION,
    interventionId: arm.interventionId,
    inputs,
    schedule: structuredClone(dataset.schedule),
  });
  let commandSequence = 1;
  let commandOrdinal = 0;
  let cursor = run.eventsSince(0).cursor;
  const informationAvailable = new Set(dataset.episodes
    .filter(episode => episode.informationComplete !== false).map(episode => episode.id));
  const commands = [];
  const milestoneTicks = new Set([208, R01_HORIZON_TICKS].filter(tick => tick <= horizonTicks));
  const milestones = {};
  let currentSnapshot = run.snapshot();
  const actualTickCount = stopAfterTicksForTest ?? horizonTicks;
  if (!Number.isInteger(actualTickCount) || actualTickCount < 0 || actualTickCount > horizonTicks) {
    throw new RangeError('The test-only tick limit must be within the declared comparison horizon.');
  }
  for (let tick = 0; tick < actualTickCount; tick++) {
    const pending = currentSnapshot.episodes.filter(episode => episode.stage === 'handoff_pending')
      .sort(policyOrder);
    for (const episode of pending) {
      const command = {
        id: `cmd-${++commandOrdinal}`,
        sequence: commandSequence,
        kind: informationAvailable.has(episode.id) ? 'complete_handoff' : 'request_information',
        patientId: episode.id,
      };
      const receipt = run.applyCommand(command);
      commands.push({ tick, command, receipt });
      if (receipt.status === 'applied') {
        commandSequence++;
      } else if (receipt.reason === 'coordination_capacity') {
        break;
      } else if (receipt.reason !== 'required_information_missing'
          && receipt.reason !== 'information_not_required') {
        throw new Error(`${label}: unexpected policy rejection: ${receipt.reason}.`);
      }
    }
    const result = run.advanceOneTick(cursor);
    if (result.tick !== tick + 1) throw new Error(`${label}: non-consecutive tick transition.`);
    cursor = result.cursor;
    currentSnapshot = result.snapshot;
    for (const event of result.events) {
      if (event.kind === 'information_available' && event.patientId) informationAvailable.add(event.patientId);
    }
    if (milestoneTicks.has(result.tick)) milestones[result.tick] = makeMilestone(result.snapshot);
  }

  const snapshot = currentSnapshot;
  const events = run.eventsSince(0).events;
  assertCompleteRun({
    snapshot, horizonTicks, tickCount: actualTickCount, episodeCount: R01_EPISODE_COUNT,
    eventCount: events.length, label,
  });
  if (events.some((event, index) => event.sequence !== index + 1)) {
    throw new Error(`${label}: authoritative event sequence is incomplete.`);
  }
  assertLifecycleLedger(snapshot, events, label);
  if (milestoneTicks.has(208) && !milestones[208]) throw new Error(`${label}: missing one-year lifecycle checkpoint.`);
  if (milestoneTicks.has(R01_HORIZON_TICKS) && !milestones[R01_HORIZON_TICKS]) {
    throw new Error(`${label}: missing five-year lifecycle checkpoint.`);
  }
  const endpointEpisodes = snapshot.episodes.map(endpointRecord);
  const intervention = core.R01_INTERVENTIONS[arm.interventionId];
  const inputSha256 = sha256(Buffer.from(stableString({
    horizonTicks, coordinationUnitsPerTick: inputs.coordinationUnitsPerTick,
    treatmentStartsPerTick: inputs.treatmentStartsPerTick,
    episodes: inputs.episodes, schedule: dataset.schedule, lifecycle: lifecycle ?? null,
  }), 'utf8'));
  const eventKinds = {};
  for (const event of events) eventKinds[event.kind] = (eventKinds[event.kind] || 0) + 1;
  const lifecycleOutcome = snapshot.lifecycle.modelled ? {
    phase: snapshot.lifecycle.phase,
    commissionedAt: snapshot.lifecycle.timeline.commissionedAt,
    adoptionBasisPointsAtEnd: snapshot.lifecycle.adoption.currentBasisPoints,
    adoptedHandoffs: snapshot.lifecycle.benefit.adoptedHandoffs,
    cashSpent: snapshot.lifecycle.ledger.cash.spent,
    workSpent: snapshot.lifecycle.ledger.work.spent,
    avoidedStaffHours: snapshot.lifecycle.benefit.avoidedStaffHours,
    repaidInStaffHours: snapshot.lifecycle.economics.repaidInStaffHours,
    residualLiabilities: snapshot.lifecycle.ledger.residualLiabilities,
  } : null;
  const outcome = outcomeFromEpisodes(endpointEpisodes, lifecycleOutcome);
  return {
    runId: label,
    analysis,
    seed,
    arm: arm.id,
    interventionId: arm.interventionId,
    scenario: snapshot.runIdentity.scenario,
    modelVersion: snapshot.runIdentity.modelVersion,
    modelExecutableId: EXECUTABLE.modelExecutableId,
    replayExecutableId: EXECUTABLE.replayExecutableId,
    moduleSha256: EXECUTABLE.moduleSha256,
    replayExecutableSha256: EXECUTABLE.runnerSha256,
    protocolVersion: snapshot.runIdentity.protocolVersion,
    scheduleId: snapshot.runIdentity.scheduleId,
    datasetId: `r05-seed-${seed}`,
    datasetSha256: dataset.sha256,
    inputSha256,
    comparisonHorizonTicks: horizonTicks,
    finalTick: snapshot.runIdentity.tick,
    complete: true,
    policy: POLICY,
    intervention: {
      mechanism: intervention.mechanism,
      handoffActionUnits: intervention.handoffActionUnits,
      coordinationCapacityBonus: intervention.coordinationCapacityBonus,
      lifecycle: lifecycle ?? null,
    },
    inputs: {
      horizonTicks,
      coordinationUnitsPerTick: inputs.coordinationUnitsPerTick,
      treatmentStartsPerTick: inputs.treatmentStartsPerTick,
      lifecycle: lifecycle ?? null,
    },
    commands,
    eventStream: {
      sha256: sha256(Buffer.from(stableString(events), 'utf8')),
      count: events.length,
      kinds: eventKinds,
      events,
    },
    lifecycleAtTicks: milestones,
    episodeOutcomes: endpointEpisodes,
    finalSnapshot: {
      runIdentity: snapshot.runIdentity,
      resources: snapshot.resources,
      metrics: snapshot.metrics,
      lifecycle: snapshot.lifecycle,
    },
    outcomes: {
      ...outcome,
      treatmentStarts: snapshot.metrics.treatmentStarts,
      handoffPendingAtEnd: snapshot.metrics.handoffPending,
      informationRequiredAtEnd: snapshot.metrics.informationRequired,
      specialistWaitingAtEnd: snapshot.metrics.specialistWaiting,
      refused: snapshot.metrics.refused,
      relocated: snapshot.metrics.relocated,
      otherExit: snapshot.metrics.otherExit,
    },
  };
}

const EXECUTABLE_PROMISE = Promise.all([readFile(MODULE_URL), readFile(RUNNER_URL)])
  .then(async ([moduleBytes, runnerBytes]) => {
    const runnerSha256 = sha256(runnerBytes);
    return {
      moduleSha256: sha256(moduleBytes),
      modelExecutableId: await ministerModelExecutableId(moduleBytes),
      replayExecutableId: manifestId([{ name: 'run_r05_comparison.mjs', sha256: runnerSha256 }]),
      runnerSha256,
    };
  });
let EXECUTABLE;

export async function initializeExecutable() {
  EXECUTABLE ??= await EXECUTABLE_PROMISE;
  return EXECUTABLE;
}

function mean(values) {
  return sum(values) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(sum(values.map(value => (value - average) ** 2)) / (values.length - 1));
}

export function pairedInterval(differences) {
  if (differences.length < 2 || differences.length - 1 > 20) {
    throw new RangeError('R05 paired t intervals require 2–21 seed pairs.');
  }
  const average = mean(differences);
  const margin = T_CRITICAL_95[differences.length - 1] * standardDeviation(differences)
    / Math.sqrt(differences.length);
  return { mean: round(average), lower95: round(average - margin), upper95: round(average + margin) };
}

function exactSignFlipP(differences) {
  const observed = Math.abs(mean(differences));
  const assignments = 2 ** differences.length;
  let atLeastAsExtreme = 0;
  for (let mask = 0; mask < assignments; mask++) {
    const signedMean = mean(differences.map((value, index) => (mask & (1 << index)) ? value : -value));
    if (Math.abs(signedMean) >= observed - 1e-12) atLeastAsExtreme++;
  }
  return atLeastAsExtreme / assignments;
}

function holmAdjust(testRows) {
  const ordered = testRows.map((row, index) => ({ ...row, index }))
    .sort((left, right) => left.pValue - right.pValue);
  let previous = 0;
  for (let index = 0; index < ordered.length; index++) {
    const adjusted = Math.min(1, (ordered.length - index) * ordered[index].pValue);
    ordered[index].holmAdjustedP = Math.max(previous, adjusted);
    previous = ordered[index].holmAdjustedP;
  }
  return ordered.sort((left, right) => left.index - right.index)
    .map(({ index: _index, ...row }) => row);
}

function pairedContrasts(records, analysis, treatmentArm, comparisonArm, endpointNames) {
  const selected = records.filter(record => record.analysis === analysis);
  return endpointNames.map(endpoint => {
    const left = new Map(selected.filter(record => record.arm === treatmentArm)
      .map(record => [record.seed, record.outcomes[endpoint]]));
    const right = new Map(selected.filter(record => record.arm === comparisonArm)
      .map(record => [record.seed, record.outcomes[endpoint]]));
    const seeds = [...left.keys()].filter(seed => right.has(seed)).sort((a, b) => a - b);
    if (seeds.length !== left.size || seeds.length !== right.size || seeds.length < 2) {
      throw new Error(`${analysis}: incomplete pair set for ${treatmentArm} vs ${comparisonArm}.`);
    }
    const differences = seeds.map(seed => left.get(seed) - right.get(seed));
    return {
      analysis,
      treatment: treatmentArm,
      comparator: comparisonArm,
      endpoint,
      seeds,
      pairedDifferences: differences.map(round),
      confidenceInterval95: pairedInterval(differences),
      exactSignFlipP: exactSignFlipP(differences),
    };
  });
}

function summarizeDistribution(records, analysis, arm, value) {
  const rows = records.filter(record => record.analysis === analysis && record.arm === arm)
    .sort((left, right) => left.seed - right.seed);
  if (rows.length < 2) throw new Error(`${analysis}/${arm}: incomplete seed distribution.`);
  const values = rows.map(value);
  return {
    analysis,
    arm,
    seeds: rows.map(record => record.seed),
    values: values.map(round),
    mean: round(mean(values)),
    confidenceInterval95: pairedInterval(values),
    minimum: round(Math.min(...values)),
    maximum: round(Math.max(...values)),
  };
}

function rowsFor(records, analysis) {
  return records.filter(record => record.analysis === analysis);
}

function clinicalOutcomes(outcomes) {
  const { lifecycle: _lifecycle, ...clinical } = outcomes;
  return clinical;
}

function analysisReport(records, seeds) {
  const mainTests = [];
  for (const comparator of ['current_process', 'organizational_reform',
    'conventional_integration', 'non_agentic_modernization']) {
    mainTests.push(...pairedContrasts(records, 'primary', 'agentic_coordination', comparator, [
      'timely84DayShare', 'success180DayShare',
    ]));
  }
  const primaryFamily = holmAdjust(mainTests.map(test => ({ ...test, pValue: test.exactSignFlipP })));
  const yearToFiveYearEconomics = PROJECT_ARMS.map(arm => {
    const rows = rowsFor(records, 'primary').filter(record => record.arm === arm.id);
    const atOneYear = rows.map(record => record.lifecycleAtTicks[208]?.lifecycle);
    const atFiveYears = rows.map(record => record.lifecycleAtTicks[R01_HORIZON_TICKS]?.lifecycle);
    return {
      arm: arm.id,
      seeds,
      cumulativeCashAtTick208: atOneYear.map(life => life?.ledger.cash.spent ?? 0),
      cumulativeCashAtTick1040: atFiveYears.map(life => life?.ledger.cash.spent ?? 0),
      cumulativeWorkAtTick208: atOneYear.map(life => life?.ledger.work.spent ?? 0),
      cumulativeWorkAtTick1040: atFiveYears.map(life => life?.ledger.work.spent ?? 0),
      // Handoff-efficiency arms avoid coordination units; organizational reform adds capacity units instead.
      cumulativeCoordinationUnitsAvoidedAtTick208: atOneYear.map(life => life?.benefit.coordinationUnitsAvoided ?? 0),
      cumulativeCoordinationUnitsAvoidedAtTick1040: atFiveYears.map(life => life?.benefit.coordinationUnitsAvoided ?? 0),
      cumulativeCapacityUnitsGrantedAtTick208: atOneYear.map(life => life?.benefit.capacityUnitsGranted ?? 0),
      cumulativeCapacityUnitsGrantedAtTick1040: atFiveYears.map(life => life?.benefit.capacityUnitsGranted ?? 0),
    };
  });
  const lowAdoption = [5000, 7500].flatMap(basisPoints => PROJECT_ARMS
    .filter(arm => ['agentic_coordination', 'conventional_integration'].includes(arm.id))
    .map(arm => summarizeDistribution(records, `adoption_${basisPoints}`, arm.id,
      record => record.outcomes.success180DayShare)));
  const costSensitivity = [0.5, 1.5].flatMap(multiplier => PROJECT_ARMS.map(arm =>
    summarizeDistribution(records, `cost_${multiplier}`, arm.id,
      record => record.outcomes.lifecycle.cashSpent)));
  const delaySensitivity = [104, 208].flatMap(tick => PROJECT_ARMS
    .filter(arm => ['agentic_coordination', 'conventional_integration'].includes(arm.id))
    .map(arm => summarizeDistribution(records, `delay_${tick}`, arm.id,
      record => record.outcomes.success180DayShare)));
  const nullControlPass = seeds.every(seed => {
    const baseline = rowsFor(records, 'zero_adoption').find(row => row.seed === seed && row.arm === 'current_process');
    const disabled = rowsFor(records, 'zero_adoption').find(row => row.seed === seed && row.arm === 'agentic_zero_adoption');
    return baseline && disabled
      && stableString(clinicalOutcomes(baseline.outcomes)) === stableString(clinicalOutcomes(disabled.outcomes));
  });
  const failedCommissioningPass = seeds.every(seed => {
    const failed = rowsFor(records, 'commissioning_failure')
      .find(row => row.seed === seed && row.arm === 'agentic_commissioning_failure');
    const attempts = failed?.finalSnapshot.lifecycle.commissioning.attempts ?? [];
    return attempts.some(attempt => attempt.outcome === 'failed')
      && failed?.finalSnapshot.lifecycle.timeline.commissionedAt !== null
      && failed?.eventStream.kinds.commissioning_failed > 0
      && failed?.finalSnapshot.lifecycle.ledger.byCategory.incident_handling.cash > 0
      && failed?.finalSnapshot.lifecycle.ledger.byCategory.incident_handling.work > 0;
  });
  const mechanismParityPass = seeds.every(seed => {
    const rows = rowsFor(records, 'primary');
    const agentic = rows.find(row => row.seed === seed && row.arm === 'agentic_coordination');
    const conventional = rows.find(row => row.seed === seed && row.arm === 'conventional_integration');
    return agentic && conventional
      && stableString(clinicalOutcomes(agentic.outcomes)) === stableString(clinicalOutcomes(conventional.outcomes));
  });
  const costDominance = seeds.every(seed => {
    const rows = rowsFor(records, 'cost_dominance');
    const simple = rows.find(row => row.seed === seed && row.arm === 'conventional_integration');
    const agentic = rows.find(row => row.seed === seed && row.arm === 'agentic_cost_stress');
    return simple && agentic
      && stableString(clinicalOutcomes(simple.outcomes)) === stableString(clinicalOutcomes(agentic.outcomes))
      && simple.outcomes.lifecycle.cashSpent < agentic.outcomes.lifecycle.cashSpent;
  });
  if (!nullControlPass || !failedCommissioningPass || !mechanismParityPass || !costDominance) {
    throw new Error('A predeclared R05 null, failure, mechanism-parity, or cost-dominance check failed.');
  }
  return {
    primaryContrasts: primaryFamily.map(({ pValue, ...test }) => test),
    intervalMethod: 'Paired Student-t 95% confidence intervals across seed-level run differences; exact two-sided paired sign-flip p-values with Holm adjustment over the eight R01 co-primary-by-comparator tests.',
    proxies: {
      timely84DayShare: 'Treatment start within 48 ticks (84 days) of referral entry.',
      success180DayShare: 'Treatment start within 102 ticks (178.5 days, the greatest integer tick interval not exceeding 180 days), without a prior critical-state crossing.',
      limits: 'R03 outputs do not validate clinical appropriateness or the R01 clinical endpoint definitions; these are model-defined proxies.',
    },
    lifecycleHorizonSensitivity: {
      method: 'Capture cumulative lifecycle ledger and modeled workflow benefit at tick 208 (one year) and tick 1040 (five years) within each full five-year run, avoiding cohort censoring.',
      arms: yearToFiveYearEconomics,
    },
    lowAdoptionSensitivity: lowAdoption,
    deploymentDelaySensitivityTicks: [0, 104, 208],
    deploymentDelaySensitivity: delaySensitivity,
    lifecycleCashMultiplierSensitivity: [0.5, 1, 1.5],
    lifecycleCashSensitivity: costSensitivity,
    nonAgenticCostCounterexample: {
      description: 'Conventional integration is paired with an otherwise identical agentic mechanism, but the stress arm is assigned 2x the explicitly assumed cash ledger. Equal outcomes and higher assumed agentic cost make the non-agentic alternative dominate in this constructed scenario; this is not a price estimate.',
      verifiedForEverySeed: costDominance,
      conventionalVsAgenticStress: pairedContrasts(records, 'cost_dominance', 'agentic_cost_stress',
        'conventional_integration', ['success180DayShare', 'timely84DayShare']),
    },
    falsificationChecks: {
      zeroAdoptionMatchesCurrentProcessForEverySeed: nullControlPass,
      commissioningFailureDelaysButDoesNotGuaranteeFailureForEverySeed: failedCommissioningPass,
      agenticAndConventionalMechanismParity: mechanismParityPass,
      lowerCostNonAgenticCounterexampleUnderExplicitStressAssumptions: costDominance,
    },
  };
}

function addRuns(records, analysis, seeds, datasetBySeed, armRuns) {
  for (const seed of seeds) {
    for (const { arm, lifecycleOptions = {}, costMultiplier = 1, profileMultiplier = 1 } of armRuns) {
      const dataset = datasetBySeed.get(seed);
      records.push(executeRun({ analysis, seed, arm, dataset, lifecycleOptions, costMultiplier, profileMultiplier }));
    }
  }
}

function armRun(arm, options = {}) {
  return { arm, ...options };
}

export async function runBatch({ seeds = DEFAULT_SEEDS } = {}) {
  assertSeeds(seeds);
  await initializeExecutable();
  const datasets = seeds.map(seed => {
    const data = makeDataset(seed);
    const sha = sha256(Buffer.from(stableString({ episodes: data.episodes, schedule: data.schedule }), 'utf8'));
    return { ...data, sha256: sha };
  });
  const datasetBySeed = new Map(datasets.map(dataset => [dataset.seed, dataset]));
  const records = [];
  addRuns(records, 'primary', seeds, datasetBySeed, ARMS.map(arm => armRun(arm)));
  addRuns(records, 'zero_adoption', seeds, datasetBySeed, [
    armRun(ARMS[0]),
    armRun({ id: 'agentic_zero_adoption', interventionId: 'agentic_coordination', lifecycle: true },
      { lifecycleOptions: { adoptionTargetBasisPoints: 0 } }),
  ]);
  addRuns(records, 'commissioning_failure', seeds, datasetBySeed, [
    armRun({ id: 'agentic_commissioning_failure', interventionId: 'agentic_coordination', lifecycle: true },
      { lifecycleOptions: COUNTERFACTUAL_FAILURE.commissioning }),
  ]);
  for (const multiplier of [0.5, 1.5]) {
    addRuns(records, `cost_${multiplier}`, seeds, datasetBySeed,
      PROJECT_ARMS.map(arm => armRun(arm, { costMultiplier: multiplier })));
  }
  for (const basisPoints of [5000, 7500]) {
    addRuns(records, `adoption_${basisPoints}`, seeds, datasetBySeed,
      PROJECT_ARMS.filter(arm => ['agentic_coordination', 'conventional_integration'].includes(arm.id))
        .map(arm => armRun(arm, { lifecycleOptions: { adoptionTargetBasisPoints: basisPoints } })));
  }
  for (const implementationStartTick of [104, 208]) {
    addRuns(records, `delay_${implementationStartTick}`, seeds, datasetBySeed,
      PROJECT_ARMS.filter(arm => ['agentic_coordination', 'conventional_integration'].includes(arm.id))
        .map(arm => armRun(arm, { lifecycleOptions: { implementationStartTick } })));
  }
  addRuns(records, 'cost_dominance', seeds, datasetBySeed, [
    armRun(ARMS.find(arm => arm.id === 'conventional_integration')),
    armRun({ id: 'agentic_cost_stress', interventionId: 'agentic_coordination', lifecycle: true },
      { profileMultiplier: 2 }),
  ]);
  addRuns(records, 'downstream_bottleneck', seeds, datasetBySeed,
    [ARMS[0], ARMS[2]].map(arm => armRun(arm)));

  const expectedPerSeed = 5 + 2 + 1 + 8 + 4 + 4 + 2 + 2;
  if (records.length !== seeds.length * expectedPerSeed) {
    throw new Error(`R05 batch incomplete: expected ${seeds.length * expectedPerSeed} runs, got ${records.length}.`);
  }
  const identities = new Set(records.map(record => `${record.analysis}|${record.seed}|${record.arm}`));
  if (identities.size !== records.length) throw new Error('R05 batch has duplicate run identities.');
  const report = analysisReport(records, seeds);
  return {
    schema: 'r05-controlled-comparison-evidence-v1',
    status: 'exploratory-development-seeds-not-confirmatory',
    protocolVersion: core.R01_PROTOCOL_VERSION,
    modelVersion: core.R03_MODEL_VERSION,
    scenario: core.R03_SCENARIO,
    seedList: seeds,
    seedCount: seeds.length,
    runCount: records.length,
    workload: {
      backlogAtTick0: 120,
      newArrivals: 'Four episodes per month for 54 months, rounded to the nearest model tick.',
      episodeCount: R01_EPISODE_COUNT,
      lastArrivalTick: 936,
      horizonTicks: R01_HORIZON_TICKS,
      ticksPerWeek: core.TICKS_PER_WEEK,
      ticksPerYear: core.TICKS_PER_YEAR,
      daysPerTick: 7 / core.TICKS_PER_WEEK,
      timely84DaysTicks: R01_TIMELY_TICKS,
      success180DaysMaximumWholeTicks: R01_SUCCESS_180D_TICKS,
    },
    pairing: 'For each seed, all arms use the same frozen episode cohort and information-availability schedule. The core does not sample randomness; the runner uses a seed-local stream once to generate the common exogenous inputs. Policy commands, commissioning, adoption and lifecycle costs may vary by arm. There is no separate modeled exogenous shock process.',
    policy: POLICY,
    uncertainty: {
      interval: 'Two-sided 95% Student-t interval for paired seed-level differences; exact paired sign-flip p-values with Holm adjustment across eight co-primary-by-comparator tests.',
      unit: 'One complete town/run per seed; episodes are not independent replicates.',
      interpretation: 'Exploratory variation across eight predeclared synthetic seeds; not parameter uncertainty, calibration, statistical power, or external validity.',
    },
    equity: {
      ageBands: ['65-74', '75-84'],
      sex: 'Not measured; the pathway has no sex input.',
      ethnicityDisabilityDeprivation: 'Not measured; no provenance-supported input is present.',
    },
    lifecycleAssumptions: {
      currency: 'scenario_cash_minor_unit; not euros and not a sourced cost base.',
      cashProfiles: COST_PROFILE,
      sharedCashEnvelope: 100000,
      sharedWorkEnvelopeStaffHours: 5000,
      sensitivityAssumptions: '0.5x/1.0x/1.5x cash inputs; 50%/75%/100% adoption; implementation start at tick 0/104/208. Values are scenario stress inputs only.',
    },
    executable: EXECUTABLE,
    analyses: report,
    datasets: datasets.map(({ seed, episodes, schedule, sha256: datasetSha256 }) => ({
      id: `r05-seed-${seed}`, seed, sha256: datasetSha256, episodes, schedule,
    })),
    runs: records,
  };
}

function parseArgs(argv) {
  if (argv.length === 0) return {};
  if (argv.length === 1 && argv[0] === '--help') {
    console.log(`Usage: node ${fileURLToPath(import.meta.url)}\n\nRuns the fixed ${DEFAULT_SEEDS.length}-seed R05 development batch; writes reproducible JSON to stdout.`);
    process.exit(0);
  }
  throw new Error('No runner arguments are supported; use the predeclared seed list and plan.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    parseArgs(process.argv.slice(2));
    const evidence = await runBatch();
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } catch (error) {
    console.error(`R05 run failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

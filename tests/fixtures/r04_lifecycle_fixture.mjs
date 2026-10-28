// Shared deterministic R04 lifecycle fixture. Every number is a scenario assumption, not an estimate.
const CASH = 'scenario_cash_minor_unit';
const HOUR = 'staff_hour';
const assumption = (source, monetary = false) => ({ status: 'assumption', source,
  ...(monetary ? { priceYear: null } : {}) });
const param = (value, unit, mechanism, monetary = false) => ({ value, unit, mechanism,
  provenance: assumption('R04 hand-checkable test assumption', monetary) });

export function lifecycleParameters(overrides = {}) {
  const values = {
    approvalTick: 0, cashCap: 10000, workCap: 500, implementationStartTick: 0,
    implementationWorkRequired: 12, implementationWorkPerTick: 4, commissioningDelayTicks: 2,
    failedCommissioningAttempts: 0, reworkWorkPerFailure: 0, adoptionTargetBasisPoints: 10000,
    adoptionRampTicks: 0, recoveryWorkPerTick: 2, staffHoursPerCoordinationUnit: 3, ...overrides };
  const units = { approvalTick: 'tick', cashCap: CASH, workCap: HOUR, implementationStartTick: 'tick',
    implementationWorkRequired: HOUR, implementationWorkPerTick: 'staff_hour_per_tick',
    commissioningDelayTicks: 'tick', failedCommissioningAttempts: 'attempt', reworkWorkPerFailure: HOUR,
    adoptionTargetBasisPoints: 'basis_point', adoptionRampTicks: 'tick', recoveryWorkPerTick: 'staff_hour_per_tick',
    staffHoursPerCoordinationUnit: 'staff_hour_per_coordination_unit' };
  return Object.fromEntries(Object.entries(values).map(([name, value]) =>
    [name, param(value, units[name], `Named lifecycle input ${name}.`, name === 'cashCap')]));
}

export function costItem(id, category, timing, cash, work, extra = {}) {
  return { id, category, timing, cash, work, cashUnit: CASH, workUnit: HOUR,
    mechanism: `Named cost mechanism ${id}.`, provenance: assumption('R04 hand-checkable test assumption', cash > 0),
    ...extra };
}

export function lifecycleInput({ parameters = {}, costItems, interruptions = [] } = {}) {
  return {
    schema: 'r04-lifecycle-ledger-v1',
    id: 'r04-fixture-ledger',
    parameters: lifecycleParameters(parameters),
    costItems: costItems ?? [
      costItem('design', 'design_procurement', 'one_time', 3000, 10, { tick: 0 }),
      costItem('licence', 'licenses_compute', 'recurring', 100, 0, { from: 'commissioning', periodTicks: 4 }),
      costItem('oversight', 'human_oversight', 'recurring', 0, 2, { from: 'commissioning', periodTicks: 4 }),
    ],
    interruptions: interruptions.map(item => ({ workUnit: HOUR, mechanism: 'Scenario system downtime.',
      provenance: assumption('R04 hand-checkable test assumption'), ...item })),
  };
}

// Two referrals arrive each tick for `arrivalTicks` ticks; baseline handoffs cost two coordination units
// against two units of capacity, so the baseline can complete one handoff per tick.
export function lifecycleRunInput({ interventionId = 'conventional_integration', horizonTicks = 24,
  arrivalTicks = 12, startsPerTick = 2, lifecycle, withLifecycle = true } = {}) {
  const episodes = [];
  for (let tick = 0; tick < Math.min(arrivalTicks, horizonTicks + 1); tick++)
    for (let index = 0; index < 2; index++)
      episodes.push({ id: `r-${String(tick).padStart(2, '0')}-${index}`, age: 70, arrivalTick: tick,
        startingWaitTicks: 0 });
  return {
    interventionId,
    inputs: { horizonTicks, coordinationUnitsPerTick: 2, treatmentStartsPerTick: startsPerTick, episodes,
      ...(withLifecycle ? { lifecycle: lifecycle ?? lifecycleInput() } : {}) },
    schedule: { id: 'r04-fixture-schedule-v1', events: [] },
  };
}

// Policy driver: each tick, try to hand off every pending referral until capacity runs out.
// Self-contained (no closures over module scope) so the same function runs under Node and in the browser.
export function driveLifecycleRun({ fixture, modelExecutableId }) {
  const model = globalThis.MinisterModelCore;
  const run = model.createRun({ scenario: model.R03_SCENARIO, seed: 60475, modelExecutableId,
    protocolVersion: model.R01_PROTOCOL_VERSION, ...fixture });
  let sequence = 1;
  let cursor = run.eventsSince(0).cursor;
  const ticks = [];
  const receipts = [];
  const submit = () => {
    for (const episode of run.snapshot().episodes.filter(item => item.stage === 'handoff_pending')) {
      const receipt = run.applyCommand({ id: `cmd-${sequence}`, sequence, kind: 'complete_handoff',
        patientId: episode.id });
      receipts.push(receipt);
      if (receipt.status !== 'applied') break;
      sequence++;
    }
  };
  submit();
  for (let index = 0; index < fixture.inputs.horizonTicks; index++) {
    const result = run.advanceOneTick(cursor);
    cursor = result.cursor;
    ticks.push(result);
    submit();
  }
  return { events: run.eventsSince(0).events, snapshot: run.snapshot(), ticks, receipts };
}

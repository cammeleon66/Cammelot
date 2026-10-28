(function (root) {
  const TICKS_PER_WEEK = 4;
  const TICKS_PER_DAY = TICKS_PER_WEEK / 7;
  const QUARTER_TICKS = 13 * TICKS_PER_WEEK;
  const TICKS_PER_YEAR = 52 * TICKS_PER_WEEK;
  const STARTUP_CYCLE = 30;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function annualProbabilityToTick(probability) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError('Annual probability must be between 0 and 1.');
    }
    return probability === 0 ? 0 : 1 - Math.pow(1 - probability, 1 / TICKS_PER_YEAR);
  }

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function seededRandom(seed) {
    let s = seed || 1;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  const R03_SCENARIO = 'r03-cardiology-pathway-v1';
  const R03_MODEL_VERSION = 'minister-r03-cardiology-pathway-3';
  const R01_PROTOCOL_VERSION = 'r01-cardiology-v1.0';
  const R01_INTERVENTIONS = Object.freeze({
    current_process: Object.freeze({
      coordinationCapacityBonus: 0,
      handoffActionUnits: 2,
      mechanism: 'Fragmented handoff requires two status and record actions.',
    }),
    organizational_reform: Object.freeze({
      coordinationCapacityBonus: 1,
      handoffActionUnits: 2,
      mechanism: 'One additional human coordinator work unit per tick.',
    }),
    conventional_integration: Object.freeze({
      coordinationCapacityBonus: 0,
      handoffActionUnits: 1,
      mechanism: 'Shared referral status and required records remove one duplicate handoff action.',
    }),
    agentic_coordination: Object.freeze({
      coordinationCapacityBonus: 0,
      handoffActionUnits: 1,
      mechanism: 'Non-clinical agent actions use the same integrated handoff effort and capacity.',
    }),
    non_agentic_modernization: Object.freeze({
      coordinationCapacityBonus: 0,
      handoffActionUnits: 1,
      mechanism: 'A single rules-based workflow removes one duplicate handoff action.',
    }),
  });
  const TERMINAL_STAGES = new Set(['treatment_started', 'died_waiting', 'refused', 'relocated', 'other_exit']);
  const clone = value => JSON.parse(JSON.stringify(value));

  const R04_LIFECYCLE_SCHEMA = 'r04-lifecycle-ledger-v1';
  const LIFECYCLE_CASH_UNIT = 'scenario_cash_minor_unit';
  const LIFECYCLE_WORK_UNIT = 'staff_hour';
  const BASELINE_HANDOFF_UNITS = R01_INTERVENTIONS.current_process.handoffActionUnits;
  const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
  // Every lifecycle input is a named, unit-bearing assumption; there are no hidden defaults.
  // max === null means "the run horizon".
  const LIFECYCLE_PARAMETERS = Object.freeze({
    approvalTick: { unit: 'tick', min: 0, max: null },
    cashCap: { unit: LIFECYCLE_CASH_UNIT, min: 0, max: 1e9, monetary: true },
    workCap: { unit: LIFECYCLE_WORK_UNIT, min: 0, max: 1e7 },
    implementationStartTick: { unit: 'tick', min: 0, max: 100000 },
    implementationWorkRequired: { unit: LIFECYCLE_WORK_UNIT, min: 1, max: 1e6 },
    implementationWorkPerTick: { unit: 'staff_hour_per_tick', min: 1, max: 1e5 },
    commissioningDelayTicks: { unit: 'tick', min: 1, max: 100000 },
    failedCommissioningAttempts: { unit: 'attempt', min: 0, max: 10 },
    reworkWorkPerFailure: { unit: LIFECYCLE_WORK_UNIT, min: 0, max: 1e6 },
    adoptionTargetBasisPoints: { unit: 'basis_point', min: 0, max: 10000 },
    adoptionRampTicks: { unit: 'tick', min: 0, max: 100000 },
    recoveryWorkPerTick: { unit: 'staff_hour_per_tick', min: 1, max: 1e5 },
    staffHoursPerCoordinationUnit: { unit: 'staff_hour_per_coordination_unit', min: 0, max: 1000 },
  });
  const LIFECYCLE_CATEGORIES = Object.freeze(['design_procurement', 'data_cleanup', 'migration_dual_running',
    'training_backfill', 'implementation_labor', 'licenses_compute', 'human_oversight', 'incident_handling',
    'security_privacy', 'maintenance', 'upgrades', 'decommissioning', 'clinician_review_override']);
  const LIFECYCLE_TIMINGS = Object.freeze(['one_time', 'recurring', 'on_commissioning_failure',
    'on_interruption', 'per_adopted_handoff']);
  const PROVENANCE_STATUSES = Object.freeze(['assumption', 'sourced', 'placeholder_unsourced']);
  const LIFECYCLE_PURPOSES = Object.freeze(['implementation', 'investment', 'operating', 'failure_recovery',
    'decommissioning']);

  function boundedInteger(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max)
      throw new RangeError(`${label} must be an integer between ${min} and ${max}.`);
    return value;
  }

  function boundedText(value, label) {
    if (typeof value !== 'string' || value.length < 1 || value.length > 200)
      throw new TypeError(`${label} must be bounded text.`);
    return value;
  }

  function parseProvenance(provenance, label, monetary) {
    if (!provenance || !PROVENANCE_STATUSES.includes(provenance.status))
      throw new TypeError(`${label} requires a provenance status.`);
    const parsed = { status: provenance.status, source: boundedText(provenance.source, `${label} provenance source`) };
    if (monetary) {
      const year = provenance.priceYear;
      if (year === undefined || (year === null && provenance.status === 'sourced'))
        throw new TypeError(`${label} requires a price year (null only for unsourced assumptions).`);
      parsed.priceYear = year === null ? null : boundedInteger(year, 1900, 2100, `${label} price year`);
    }
    return parsed;
  }

  function parseLifecycle(raw, horizonTicks) {
    if (!raw || raw.schema !== R04_LIFECYCLE_SCHEMA || !ID_PATTERN.test(raw.id || '')
        || !raw.parameters || !Array.isArray(raw.costItems) || !Array.isArray(raw.interruptions))
      throw new TypeError('A versioned, identified R04 lifecycle input block is required.');
    const parameters = {};
    const values = {};
    for (const [name, spec] of Object.entries(LIFECYCLE_PARAMETERS)) {
      const input = raw.parameters[name];
      if (!input) throw new TypeError(`Lifecycle parameter ${name} is required.`);
      if (input.unit !== spec.unit) throw new TypeError(`Lifecycle parameter ${name} must use unit ${spec.unit}.`);
      values[name] = boundedInteger(input.value, spec.min, spec.max ?? horizonTicks, `Lifecycle parameter ${name}`);
      parameters[name] = { value: values[name], unit: spec.unit,
        mechanism: boundedText(input.mechanism, `Lifecycle parameter ${name} mechanism`),
        provenance: parseProvenance(input.provenance, `Lifecycle parameter ${name}`, !!spec.monetary) };
    }
    for (const name of Object.keys(raw.parameters))
      if (!LIFECYCLE_PARAMETERS[name]) throw new TypeError(`Unknown lifecycle parameter ${name}.`);
    if (values.implementationStartTick < values.approvalTick)
      throw new RangeError('Implementation cannot start before approval.');
    if (raw.costItems.length > 32 || raw.interruptions.length > 16)
      throw new RangeError('Lifecycle cost items and interruptions are bounded.');

    const ids = new Set();
    let scheduledCharges = 0;
    const costItems = raw.costItems.map((item, index) => {
      const label = `Lifecycle cost item ${index}`;
      if (!item || !ID_PATTERN.test(item.id || '') || ids.has(item.id)) throw new TypeError(`${label} needs a unique bounded id.`);
      ids.add(item.id);
      if (!LIFECYCLE_CATEGORIES.includes(item.category)) throw new RangeError(`${label} has an unsupported category.`);
      if (!LIFECYCLE_TIMINGS.includes(item.timing)) throw new RangeError(`${label} has an unsupported timing.`);
      if (item.cashUnit !== LIFECYCLE_CASH_UNIT || item.workUnit !== LIFECYCLE_WORK_UNIT)
        throw new TypeError(`${label} must name its cash and work units.`);
      const cash = boundedInteger(item.cash, 0, 1e9, `${label} cash`);
      const work = boundedInteger(item.work, 0, 1e7, `${label} work`);
      if (cash + work < 1) throw new RangeError(`${label} must charge cash or work.`);
      const parsed = { id: item.id, category: item.category, timing: item.timing, cash, work,
        mechanism: boundedText(item.mechanism, `${label} mechanism`),
        provenance: parseProvenance(item.provenance, label, cash > 0),
        purpose: item.timing === 'one_time' ? (item.category === 'decommissioning' ? 'decommissioning' : 'investment')
          : item.timing === 'recurring' || item.timing === 'per_adopted_handoff' ? 'operating' : 'failure_recovery' };
      if (item.timing === 'one_time') {
        parsed.tick = boundedInteger(item.tick, values.approvalTick, 1000000, `${label} tick`);
        if (parsed.tick <= horizonTicks) scheduledCharges++;
      } else if (item.timing === 'recurring') {
        if (item.from !== 'approval' && item.from !== 'commissioning') throw new RangeError(`${label} needs a recurring anchor.`);
        parsed.from = item.from;
        parsed.periodTicks = boundedInteger(item.periodTicks, 1, 100000, `${label} period`);
        scheduledCharges += Math.floor(horizonTicks / parsed.periodTicks) + 1;
      }
      return parsed;
    });
    if (scheduledCharges > 20000) throw new RangeError('Lifecycle scheduled charges exceed their bound.');
    const interruptionIds = new Set();
    const interruptions = raw.interruptions.map((item, index) => {
      const label = `Lifecycle interruption ${index}`;
      if (!item || !ID_PATTERN.test(item.id || '') || interruptionIds.has(item.id)
          || item.workUnit !== LIFECYCLE_WORK_UNIT)
        throw new TypeError(`${label} needs a unique id and the ${LIFECYCLE_WORK_UNIT} unit.`);
      interruptionIds.add(item.id);
      return { id: item.id, startTick: boundedInteger(item.startTick, 0, horizonTicks, `${label} start`),
        recoveryWork: boundedInteger(item.recoveryWork, 1, 1e6, `${label} recovery work`),
        mechanism: boundedText(item.mechanism, `${label} mechanism`),
        provenance: parseProvenance(item.provenance, label, false) };
    });
    return { schema: raw.schema, id: raw.id, parameters, values, costItems, interruptions };
  }

  function createRun({ scenario, seed, modelExecutableId, protocolVersion, interventionId = 'current_process',
    inputs, schedule } = {}) {
    if (scenario !== R03_SCENARIO) throw new RangeError('Unsupported R03 pathway scenario.');
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF)
      throw new RangeError('Seed must be an unsigned 32-bit integer.');
    if (!/^[a-f0-9]{64}$/.test(modelExecutableId || ''))
      throw new TypeError('A verified model executable identity is required.');
    if (protocolVersion !== R01_PROTOCOL_VERSION)
      throw new RangeError('Unsupported R01 protocol version.');
    if (!inputs || !Array.isArray(inputs.episodes) || inputs.episodes.length < 1 || inputs.episodes.length > 336)
      throw new RangeError('R03 requires between 1 and 336 referral episodes.');
    const horizonTicks = inputs.horizonTicks;
    const intervention = R01_INTERVENTIONS[interventionId];
    if (!intervention) throw new RangeError('Unsupported R01 intervention.');
    const coordinationUnitsPerTick = inputs.coordinationUnitsPerTick;
    const treatmentStartsPerTick = inputs.treatmentStartsPerTick;
    if (!Number.isInteger(horizonTicks) || horizonTicks < 1 || horizonTicks > 100000)
      throw new RangeError('Horizon must be a positive bounded number of ticks.');
    if (!Number.isInteger(coordinationUnitsPerTick) || coordinationUnitsPerTick < 1 || coordinationUnitsPerTick > 1000)
      throw new RangeError('Coordination capacity must be a positive bounded integer.');
    if (coordinationUnitsPerTick + intervention.coordinationCapacityBonus > 1000)
      throw new RangeError('Intervention-adjusted coordination capacity exceeds its bound.');
    if (!Number.isInteger(treatmentStartsPerTick) || treatmentStartsPerTick < 1 || treatmentStartsPerTick > 1000)
      throw new RangeError('Treatment-start capacity must be a positive bounded integer.');
    if (!schedule || typeof schedule.id !== 'string' || schedule.id.length < 1 || schedule.id.length > 128
        || !Array.isArray(schedule.events) || schedule.events.length > 10000)
      throw new TypeError('A bounded, identified external schedule is required.');

    const plan = inputs.lifecycle === undefined ? null : parseLifecycle(inputs.lifecycle, horizonTicks);
    const patientIds = new Set();
    const patients = inputs.episodes.map(episode => {
      if (!episode || typeof episode.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(episode.id)
          || patientIds.has(episode.id))
        throw new TypeError('Referral IDs must be unique bounded identifiers.');
      patientIds.add(episode.id);
      if (!Number.isInteger(episode.arrivalTick) || episode.arrivalTick < 0 || episode.arrivalTick > horizonTicks)
        throw new RangeError(`Invalid arrival tick for ${episode.id}.`);
      if (!Number.isInteger(episode.age) || episode.age < 65 || episode.age > 84)
        throw new RangeError(`Age for ${episode.id} must be between 65 and 84.`);
      if (!Number.isInteger(episode.startingWaitTicks) || episode.startingWaitTicks < 0
          || episode.startingWaitTicks > 100000)
        throw new RangeError(`Invalid starting wait for ${episode.id}.`);
      if (episode.priority !== undefined && (!Number.isInteger(episode.priority)
          || episode.priority < -100 || episode.priority > 100))
        throw new RangeError(`Invalid referral priority for ${episode.id}.`);
      if (episode.informationComplete !== undefined && typeof episode.informationComplete !== 'boolean')
        throw new TypeError(`Invalid information status for ${episode.id}.`);
      const initialStage = episode.initialStage || 'handoff_pending';
      const informationComplete = episode.informationComplete !== false;
      if ((initialStage === 'information_required' && informationComplete)
          || (initialStage === 'specialist_waiting' && !informationComplete))
        throw new RangeError(`Initial handoff information conflicts with the stage for ${episode.id}.`);
      for (const tick of [episode.criticalAtTick, episode.deathAtTick]) {
        if (tick !== undefined && (!Number.isInteger(tick) || tick < episode.arrivalTick || tick > horizonTicks))
          throw new RangeError(`Invalid clinical event tick for ${episode.id}.`);
      }
      if (episode.initialStage !== undefined
          && !['handoff_pending', 'information_required', 'specialist_waiting'].includes(episode.initialStage))
        throw new RangeError(`Invalid initial pathway stage for ${episode.id}.`);
      return {
        id: episode.id,
        age: episode.age,
        arrivalTick: episode.arrivalTick,
        startingWaitTicks: episode.startingWaitTicks,
        informationComplete,
        criticalAtTick: episode.criticalAtTick ?? null,
        deathAtTick: episode.deathAtTick ?? null,
        priority: Number.isInteger(episode.priority) ? episode.priority : 0,
        initialStage,
        stage: 'scheduled',
        clinicalState: 'stable',
        everCritical: false,
        criticalAt: null,
        trace: [],
      };
    });
    const scheduledEvents = schedule.events.map((event, index) => {
      if (!event || event.kind !== 'information_available' || !patientIds.has(event.patientId)
          || !Number.isInteger(event.tick) || event.tick < 0 || event.tick > horizonTicks)
        throw new TypeError(`Invalid external schedule event at index ${index}.`);
      const patient = patients.find(item => item.id === event.patientId);
      if (event.tick < patient.arrivalTick)
        throw new RangeError(`Information for ${event.patientId} cannot arrive before the referral.`);
      return { tick: event.tick, patientId: event.patientId, kind: event.kind, order: index };
    }).sort((left, right) => left.tick - right.tick || left.order - right.order);

    let effectiveCoordinationCapacity = coordinationUnitsPerTick + (plan ? 0 : intervention.coordinationCapacityBonus);
    const identity = {
      modelVersion: R03_MODEL_VERSION,
      modelExecutableId,
      scenario,
      seed,
      protocolVersion,
      scheduleId: schedule.id,
      interventionId,
    };
    const events = [];
    const receipts = new Map();
    let tick = 0;
    let eventSequence = 0;
    let lastCommandSequence = 0;
    let coordinationUsedThisTick = 0;
    let coordinationUnitsUsed = 0;
    let treatmentStartsThisTick = 0;
    let treatmentStarts = 0;
    let scheduleIndex = 0;
    let arrived = 0;

    function identityAt(atTick = tick) {
      return { ...identity, tick: atTick };
    }

    function emit(kind, patient, from, to, reason, extra = {}) {
      if (eventSequence >= 200000) throw new RangeError('Pathway event limit has been reached.');
      const event = {
        ...extra,
        id: `event-${++eventSequence}`,
        sequence: eventSequence,
        tick,
        kind,
        patientId: patient?.id ?? null,
        from: from ?? null,
        to: to ?? null,
        reason,
        runIdentity: identityAt(),
      };
      events.push(event);
      if (patient) patient.trace.push({
        eventId: event.id,
        tick,
        kind,
        from: from ?? null,
        to: to ?? null,
        reason,
        resource: extra.resource ?? null,
      });
      return event;
    }

    function transition(patient, stage, kind, reason, extra) {
      const from = patient.stage;
      patient.stage = stage;
      emit(kind, patient, from, stage, reason, extra);
    }

    // R04 lifecycle economics. Absent a lifecycle block the intervention mechanism is applied
    // immediately and for free (legacy R03 behaviour, reported as `modelled: false`).
    const life = plan ? {
      phase: 'not_approved',
      approvedAt: null, implementationStartedAt: null, implementationCompletedAt: null, commissionedAt: null,
      firstAdoptionAt: null, firstBenefitAt: null,
      remainingWork: plan.values.implementationWorkRequired, workDelivered: 0, reworkWorkAdded: 0,
      inRework: false, implementationStalled: false, recoveryStalled: false, attemptTick: null,
      attempts: [], interruptions: plan.interruptions.map(item => ({ ...item, status: 'scheduled',
        remainingWork: item.recoveryWork, startedAt: null, recoveredAt: null })),
      activeInterruption: null,
      cash: { authorised: 0, spent: 0, remaining: 0 },
      work: { authorised: 0, spent: 0, remaining: 0 },
      byPurpose: Object.fromEntries(LIFECYCLE_PURPOSES.map(purpose => [purpose, { cash: 0, work: 0 }])),
      byCategory: Object.fromEntries(LIFECYCLE_CATEGORIES.map(category => [category, { cash: 0, work: 0 }])),
      deferred: [], obligationSequence: 0, lapsed: false, adoptionCredit: 0, capacityCredit: 0,
      adoptedHandoffs: 0, baselineHandoffs: 0, coordinationUnitsAvoided: 0, capacityUnitsGranted: 0,
      spentBeforeFirstBenefit: null,
    } : null;
    const perUseItems = plan ? plan.costItems.filter(item => item.timing === 'per_adopted_handoff') : [];
    const perUseCash = perUseItems.reduce((sum, item) => sum + item.cash, 0);
    const perUseWork = perUseItems.reduce((sum, item) => sum + item.work, 0);

    function canPay(cash, work) {
      return cash <= life.cash.remaining && work <= life.work.remaining;
    }

    function spend(cash, work, purpose, category) {
      life.cash.spent += cash;
      life.cash.remaining -= cash;
      life.work.spent += work;
      life.work.remaining -= work;
      for (const bucket of [life.byPurpose[purpose], life.byCategory[category]]) {
        bucket.cash += cash;
        bucket.work += work;
      }
    }

    function costFields(item, trigger, obligationId) {
      return { itemId: item.id, category: item.category, purpose: item.purpose, trigger, obligationId,
        cash: item.cash, work: item.work, cashUnit: LIFECYCLE_CASH_UNIT, workUnit: LIFECYCLE_WORK_UNIT };
    }

    // Whole-item payment or an explicit deferred obligation; the ledger never goes below zero.
    function settle(item, trigger) {
      const obligationId = `obligation-${++life.obligationSequence}`;
      if (canPay(item.cash, item.work)) {
        spend(item.cash, item.work, item.purpose, item.category);
        emit('cost_paid', null, null, null, item.mechanism, costFields(item, trigger, obligationId));
      } else {
        life.deferred.push({ obligationId, dueTick: tick, trigger, item });
        emit('cost_deferred', null, null, null, 'Remaining finite budget cannot cover this obligation; it stays unpaid.',
          costFields(item, trigger, obligationId));
      }
    }

    function retryDeferred() {
      life.deferred = life.deferred.filter(obligation => {
        if (!canPay(obligation.item.cash, obligation.item.work)) return true;
        spend(obligation.item.cash, obligation.item.work, obligation.item.purpose, obligation.item.category);
        emit('cost_paid', null, null, null, obligation.item.mechanism,
          { ...costFields(obligation.item, obligation.trigger, obligation.obligationId),
            deferredSinceTick: obligation.dueTick });
        return false;
      });
    }

    function adoptionBasisPoints(atTick = tick) {
      if (life.commissionedAt === null) return 0;
      const { adoptionTargetBasisPoints: target, adoptionRampTicks: ramp } = plan.values;
      return ramp === 0 ? target : Math.floor(target * Math.min(atTick - life.commissionedAt, ramp) / ramp);
    }

    function mechanismAvailable() {
      return life.phase === 'commissioned' && life.deferred.length === 0;
    }

    function phaseTo(phase, kind, reason, extra) {
      const from = life.phase;
      life.phase = phase;
      emit(kind, null, from, phase, reason, extra);
    }

    function markBenefit(reason, extra) {
      if (life.firstBenefitAt !== null) return;
      life.firstBenefitAt = tick;
      life.spentBeforeFirstBenefit = { cash: life.cash.spent, work: life.work.spent };
      emit('benefit_realized', null, null, null, reason, extra);
    }

    function chargeTriggered(timing, trigger) {
      for (const item of plan.costItems) if (item.timing === timing) settle(item, trigger);
    }

    function lifecycleStep() {
      const values = plan.values;
      if (life.phase === 'not_approved') {
        if (tick < values.approvalTick) return;
        life.approvedAt = tick;
        life.cash.authorised = life.cash.remaining = values.cashCap;
        life.work.authorised = life.work.remaining = values.workCap;
        phaseTo('approved', 'lifecycle_approved',
          'Finite budgets were authorised; approval itself spends no cash or work.',
          { cashAuthorised: values.cashCap, workAuthorised: values.workCap,
            cashUnit: LIFECYCLE_CASH_UNIT, workUnit: LIFECYCLE_WORK_UNIT });
      }
      retryDeferred();
      if (life.phase === 'approved' && tick >= values.implementationStartTick) {
        life.implementationStartedAt = tick;
        phaseTo('implementing', 'implementation_started', 'Implementation work began after approval.');
      }
      if (life.phase === 'implementing') {
        const delivered = Math.min(values.implementationWorkPerTick, life.remainingWork, life.work.remaining);
        if (delivered > 0) {
          spend(0, delivered, life.inRework ? 'failure_recovery' : 'implementation', 'implementation_labor');
          life.remainingWork -= delivered;
          life.workDelivered += delivered;
          life.implementationStalled = false;
          emit('implementation_progress', null, null, null,
            life.inRework ? 'Rework work after a failed commissioning attempt.' : 'Implementation work delivered.',
            { work: delivered, workUnit: LIFECYCLE_WORK_UNIT, remainingWork: life.remainingWork,
              workDelivered: life.workDelivered, rework: life.inRework });
        } else if (!life.implementationStalled) {
          life.implementationStalled = true;
          emit('implementation_stalled', null, null, null, 'The finite work budget is exhausted; progress cannot continue.',
            { remainingWork: life.remainingWork, workUnit: LIFECYCLE_WORK_UNIT });
        }
        if (life.remainingWork === 0) {
          life.implementationCompletedAt ??= tick;
          life.attemptTick = tick + values.commissioningDelayTicks;
          life.inRework = false;
          phaseTo('awaiting_commissioning', 'implementation_completed',
            'Implementation work is complete; commissioning has not yet happened.',
            { attemptTick: life.attemptTick });
        }
      }
      if (life.phase === 'awaiting_commissioning' && tick >= life.attemptTick && life.deferred.length === 0) {
        const attempt = life.attempts.length + 1;
        if (attempt <= values.failedCommissioningAttempts) {
          life.attempts.push({ attempt, tick, outcome: 'failed' });
          life.attemptTick = tick + values.commissioningDelayTicks;
          if (values.reworkWorkPerFailure > 0) {
            life.remainingWork = values.reworkWorkPerFailure;
            life.reworkWorkAdded += values.reworkWorkPerFailure;
            life.inRework = true;
            life.implementationStalled = false;
            phaseTo('implementing', 'commissioning_failed', 'Commissioning failed; rework is required.', { attempt });
          } else {
            emit('commissioning_failed', null, life.phase, life.phase, 'Commissioning failed; retry is scheduled.',
              { attempt, attemptTick: life.attemptTick });
          }
          chargeTriggered('on_commissioning_failure', 'commissioning_failure');
        } else {
          life.attempts.push({ attempt, tick, outcome: 'passed' });
          life.commissionedAt = tick;
          phaseTo('commissioned', 'commissioned', 'Commissioning passed; adoption has not necessarily begun.', { attempt });
        }
      }
      if (life.phase === 'interrupted') {
        const active = life.activeInterruption;
        const delivered = Math.min(values.recoveryWorkPerTick, active.remainingWork, life.work.remaining);
        if (delivered > 0) {
          spend(0, delivered, 'failure_recovery', 'incident_handling');
          active.remainingWork -= delivered;
          life.recoveryStalled = false;
          emit('recovery_progress', null, null, null, 'Recovery work delivered.',
            { interruptionId: active.id, work: delivered, workUnit: LIFECYCLE_WORK_UNIT, remainingWork: active.remainingWork });
        } else if (!life.recoveryStalled) {
          life.recoveryStalled = true;
          emit('recovery_stalled', null, null, null, 'The finite work budget is exhausted; recovery cannot continue.',
            { interruptionId: active.id, remainingWork: active.remainingWork });
        }
        if (active.remainingWork === 0) {
          active.status = 'recovered';
          active.recoveredAt = tick;
          life.activeInterruption = null;
          phaseTo('commissioned', 'service_recovered', 'Recovery work is complete; the service is live again.',
            { interruptionId: active.id });
        }
      }
      for (const interruption of life.interruptions) {
        if (interruption.status !== 'scheduled' || interruption.startTick !== tick) continue;
        if (life.phase === 'commissioned') {
          interruption.status = 'active';
          interruption.startedAt = tick;
          life.activeInterruption = interruption;
          life.recoveryStalled = false;
          phaseTo('interrupted', 'service_interrupted', interruption.mechanism, { interruptionId: interruption.id });
          chargeTriggered('on_interruption', 'interruption');
        } else {
          interruption.status = 'not_applicable';
          emit('interruption_not_applicable', null, life.phase, life.phase,
            'The scheduled interruption found no live service to interrupt.', { interruptionId: interruption.id });
        }
      }
      for (const item of plan.costItems) {
        const anchor = item.from === 'approval' ? life.approvedAt : life.commissionedAt;
        if ((item.timing === 'one_time' && item.tick === tick)
            || (item.timing === 'recurring' && anchor !== null && tick >= anchor
              && (tick - anchor) % item.periodTicks === 0))
          settle(item, item.timing);
      }
      const lapsed = life.phase === 'commissioned' && life.deferred.length > 0;
      if (lapsed !== life.lapsed) {
        life.lapsed = lapsed;
        emit(lapsed ? 'service_lapsed' : 'service_restored', null, null, null,
          lapsed ? 'An unpaid obligation suspends the new mechanism; the baseline process applies.'
            : 'All obligations are paid; the new mechanism is available again.');
      }
      if (life.firstAdoptionAt === null && adoptionBasisPoints() > 0) {
        life.firstAdoptionAt = tick;
        emit('adoption_started', null, null, null, 'Adoption of the commissioned mechanism began.',
          { basisPoints: adoptionBasisPoints() });
      }
    }

    // Deterministic integer credit: a handoff uses the new mechanism once the accrued
    // adoption basis points reach 10,000; otherwise the baseline process handles it.
    function handoffPlan() {
      if (!life) return { units: intervention.handoffActionUnits, adopted: false };
      const basisPoints = mechanismAvailable() ? adoptionBasisPoints() : 0;
      const credit = life.adoptionCredit + basisPoints;
      if (basisPoints === 0) return { units: BASELINE_HANDOFF_UNITS, adopted: false, credit: life.adoptionCredit };
      if (credit < 10000) return { units: BASELINE_HANDOFF_UNITS, adopted: false, credit };
      if (!canPay(perUseCash, perUseWork))
        return { units: BASELINE_HANDOFF_UNITS, adopted: false, credit: life.adoptionCredit };
      return { units: intervention.handoffActionUnits, adopted: true, credit: credit - 10000 };
    }

    function commitHandoff(handoff) {
      life.adoptionCredit = handoff.credit;
      if (!handoff.adopted) {
        life.baselineHandoffs++;
        return;
      }
      life.adoptedHandoffs++;
      for (const item of perUseItems) {
        spend(item.cash, item.work, item.purpose, item.category);
        emit('cost_paid', null, null, null, item.mechanism, costFields(item, 'per_adopted_handoff', null));
      }
      const avoided = BASELINE_HANDOFF_UNITS - intervention.handoffActionUnits;
      if (avoided > 0) {
        life.coordinationUnitsAvoided += avoided;
        markBenefit('An adopted handoff used fewer coordination work units than the baseline process.',
          { coordinationUnitsAvoided: avoided });
      }
    }

    function refreshCapacity() {
      if (!life) return;
      let granted = 0;
      if (mechanismAvailable()) {
        life.capacityCredit += intervention.coordinationCapacityBonus * adoptionBasisPoints();
        granted = Math.floor(life.capacityCredit / 10000);
        life.capacityCredit -= granted * 10000;
      }
      effectiveCoordinationCapacity = coordinationUnitsPerTick + granted;
      if (granted > 0) {
        life.capacityUnitsGranted += granted;
        markBenefit('Adopted coordinator capacity was available this tick.', { capacityUnitsGranted: granted });
      }
    }

    function lifecycleSnapshot() {
      if (!life) return { modelled: false,
        note: 'No R04 lifecycle block: the intervention mechanism applied immediately and without cost.' };
      const avoidedStaffHours = life.coordinationUnitsAvoided * plan.values.staffHoursPerCoordinationUnit;
      return {
        modelled: true,
        schema: plan.schema,
        id: plan.id,
        phase: life.phase,
        timeline: { approvedAt: life.approvedAt, implementationStartedAt: life.implementationStartedAt,
          implementationCompletedAt: life.implementationCompletedAt, commissionedAt: life.commissionedAt,
          firstAdoptionAt: life.firstAdoptionAt, firstBenefitAt: life.firstBenefitAt },
        implementation: { workRequired: plan.values.implementationWorkRequired, workDelivered: life.workDelivered,
          workRemaining: life.remainingWork, reworkWorkAdded: life.reworkWorkAdded,
          stalled: life.implementationStalled },
        commissioning: { attempts: life.attempts, attemptTick: life.attemptTick },
        interruptions: life.interruptions.map(item => ({ id: item.id, startTick: item.startTick, status: item.status,
          startedAt: item.startedAt, recoveredAt: item.recoveredAt, recoveryWork: item.recoveryWork,
          remainingWork: item.remainingWork })),
        adoption: { targetBasisPoints: plan.values.adoptionTargetBasisPoints,
          currentBasisPoints: adoptionBasisPoints(), mechanismAvailable: mechanismAvailable(),
          adoptedHandoffs: life.adoptedHandoffs, baselineHandoffs: life.baselineHandoffs,
          adoptionCredit: life.adoptionCredit },
        ledger: {
          cash: { unit: LIFECYCLE_CASH_UNIT, ...life.cash },
          work: { unit: LIFECYCLE_WORK_UNIT, ...life.work },
          byPurpose: life.byPurpose,
          byCategory: life.byCategory,
          deferredObligations: life.deferred.map(obligation => ({ obligationId: obligation.obligationId,
            itemId: obligation.item.id, dueTick: obligation.dueTick, trigger: obligation.trigger,
            cash: obligation.item.cash, work: obligation.item.work })),
          residualLiabilities: plan.costItems.filter(item => item.timing === 'one_time' && item.tick > horizonTicks)
            .map(item => ({ itemId: item.id, tick: item.tick, cash: item.cash, work: item.work })),
          spentBeforeFirstBenefit: life.spentBeforeFirstBenefit,
          discounting: 'none',
        },
        benefit: { adoptedHandoffs: life.adoptedHandoffs, coordinationUnitsAvoided: life.coordinationUnitsAvoided,
          avoidedStaffHours, capacityUnitsGranted: life.capacityUnitsGranted },
        economics: { cashSpent: life.cash.spent, staffHoursSpent: life.work.spent, avoidedStaffHours,
          netStaffHours: avoidedStaffHours - life.work.spent,
          repaidInStaffHours: avoidedStaffHours >= life.work.spent,
          recognisedCashSavings: 0,
          note: 'Care benefits and added capacity are never converted into cash savings.' },
        parameters: { parameters: plan.parameters, costItems: plan.costItems, interruptions: plan.interruptions },
      };
    }

    function dueArrivals() {
      for (const patient of patients) {
        if (patient.stage !== 'scheduled' || patient.arrivalTick !== tick) continue;
        arrived++;
        transition(patient, patient.initialStage, 'demand_arrived', 'Referral entered the bounded pathway.',
          { age: patient.age, startingWaitTicks: patient.startingWaitTicks });
      }
    }

    function dueExternalEvents() {
      while (scheduleIndex < scheduledEvents.length && scheduledEvents[scheduleIndex].tick === tick) {
        const event = scheduledEvents[scheduleIndex++];
        const patient = patients.find(item => item.id === event.patientId);
        if (patient.informationComplete || TERMINAL_STAGES.has(patient.stage)) continue;
        patient.informationComplete = true;
        emit('information_available', patient, patient.stage, patient.stage,
          'Required referral information arrived on the shared external schedule.');
        if (patient.stage === 'information_required')
          transition(patient, 'handoff_pending', 'information_received', 'Required referral information is now available.');
      }
    }

    function dueClinicalEvents() {
      for (const patient of patients) {
        if (patient.stage === 'scheduled' || TERMINAL_STAGES.has(patient.stage)) continue;
        if (patient.clinicalState === 'stable' && patient.criticalAtTick === tick) {
          patient.clinicalState = 'critical';
          patient.everCritical = true;
          patient.criticalAt = tick;
          emit('deteriorated_critical', patient, 'stable', 'critical',
            'The shared clinical schedule crossed the frozen critical-state threshold.');
        }
      }
      for (const patient of patients) {
        if (patient.stage === 'scheduled' || TERMINAL_STAGES.has(patient.stage)) continue;
        if (patient.deathAtTick === tick)
          transition(patient, 'died_waiting', 'died_waiting', 'Death occurred before treatment under the shared clinical schedule.');
      }
    }

    function startTreatments() {
      treatmentStartsThisTick = 0;
      const waiting = patients.filter(patient => patient.stage === 'specialist_waiting')
        .sort((left, right) => right.priority - left.priority || left.arrivalTick - right.arrivalTick
          || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
      for (const patient of waiting.slice(0, treatmentStartsPerTick)) {
        treatmentStartsThisTick++;
        treatmentStarts++;
        transition(patient, 'treatment_started', 'treatment_started',
          'A shared specialist treatment-start slot was available.', { resource: 'specialist_start' });
      }
    }

    function processTick() {
      dueArrivals();
      dueExternalEvents();
      dueClinicalEvents();
      startTreatments();
    }

    if (life) {
      lifecycleStep();
      refreshCapacity();
    }
    dueArrivals();
    dueExternalEvents();
    dueClinicalEvents();

    function metrics() {
      const count = stage => patients.filter(patient => patient.stage === stage).length;
      return {
        arrivals: arrived,
        scheduled: count('scheduled'),
        handoffPending: count('handoff_pending'),
        informationRequired: count('information_required'),
        specialistWaiting: count('specialist_waiting'),
        criticalWaiting: patients.filter(patient => patient.clinicalState === 'critical'
          && !TERMINAL_STAGES.has(patient.stage)).length,
        treatmentStarts,
        diedWaiting: count('died_waiting'),
        refused: count('refused'),
        relocated: count('relocated'),
        otherExit: count('other_exit'),
        openEpisodes: patients.filter(patient => patient.stage !== 'scheduled'
          && !TERMINAL_STAGES.has(patient.stage)).length,
      };
    }

    function snapshot() {
      return clone({
        runIdentity: identityAt(),
        resources: {
          coordination: { capacityPerTick: effectiveCoordinationCapacity,
            baselineCapacityPerTick: coordinationUnitsPerTick,
            usedThisTick: coordinationUsedThisTick, unitsUsed: coordinationUnitsUsed,
            handoffActionUnits: intervention.handoffActionUnits,
            mechanism: intervention.mechanism },
          specialist: { startsPerTick: treatmentStartsPerTick, startsThisTick: treatmentStartsThisTick,
            starts: treatmentStarts },
        },
        metrics: metrics(),
        lifecycle: lifecycleSnapshot(),
        episodes: patients.map(patient => ({
          id: patient.id,
          age: patient.age,
          arrivalTick: patient.arrivalTick,
          startingWaitTicks: patient.startingWaitTicks,
          elapsedWaitTicks: patient.stage === 'scheduled' ? 0 : patient.startingWaitTicks + tick - patient.arrivalTick,
          stage: patient.stage,
          clinicalState: patient.clinicalState,
          everCritical: patient.everCritical,
          criticalAt: patient.criticalAt,
          trace: patient.trace,
        })),
        eventCursor: events.length,
      });
    }

    function eventsSince(cursor) {
      if (!Number.isInteger(cursor) || cursor < 0 || cursor > events.length)
        throw new RangeError('Event cursor is outside the authoritative event stream.');
      return { events: clone(events.slice(cursor)), cursor: events.length };
    }

    function applyCommand(command) {
      const reject = (reason, status = 'rejected') => {
        const receipt = { id: command?.id ?? null, sequence: command?.sequence ?? null, tick, status, reason,
          eventCursor: events.length + 1 };
        emit('command_receipt', null, null, null, reason, { receipt });
        return clone(receipt);
      };
      if (!command || typeof command.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(command.id)
          || !Number.isInteger(command.sequence) || command.sequence < 1
          || typeof command.patientId !== 'string' || typeof command.kind !== 'string')
        return reject('invalid_command');
      if (receipts.has(command.id)) return reject('duplicate_command_id', 'no_effect');
      if (command.sequence !== lastCommandSequence + 1) return reject('invalid_command_sequence');
      if (!['request_information', 'complete_handoff', 'refuse', 'relocate', 'other_exit'].includes(command.kind))
        return reject('command_not_allowed');
      const patient = patients.find(item => item.id === command.patientId);
      if (!patient || patient.stage === 'scheduled') return reject('referral_not_arrived');
      if (TERMINAL_STAGES.has(patient.stage)) return reject('referral_already_closed', 'no_effect');
      const handoff = command.kind === 'complete_handoff' ? handoffPlan() : null;
      const coordinationUnitsRequired = handoff
        ? handoff.units
        : command.kind === 'request_information' ? 1 : 0;
      if (coordinationUnitsRequired > 0
          && coordinationUsedThisTick + coordinationUnitsRequired > effectiveCoordinationCapacity)
        return reject('coordination_capacity');

      const from = patient.stage;
      let to = from;
      let reason;
      if (command.kind === 'request_information') {
        if (from !== 'handoff_pending' || patient.informationComplete) return reject('information_not_required', 'no_effect');
        coordinationUsedThisTick += coordinationUnitsRequired;
        coordinationUnitsUsed += coordinationUnitsRequired;
        to = 'information_required';
        reason = 'A coordinator requested the missing referral information.';
        transition(patient, to, 'information_requested', reason, { resource: 'coordination' });
      } else if (command.kind === 'complete_handoff') {
        if (from !== 'handoff_pending') return reject('handoff_not_ready', 'no_effect');
        if (!patient.informationComplete) return reject('required_information_missing');
        coordinationUsedThisTick += coordinationUnitsRequired;
        coordinationUnitsUsed += coordinationUnitsRequired;
        to = 'specialist_waiting';
        reason = 'The complete referral was handed to the specialist queue.';
        transition(patient, to, 'handoff_completed', reason, life
          ? { resource: 'coordination', coordinationUnits: handoff.units, adoptedMechanism: handoff.adopted }
          : { resource: 'coordination' });
        if (life) commitHandoff(handoff);
      } else {
        to = command.kind === 'refuse' ? 'refused'
          : command.kind === 'relocate' ? 'relocated' : 'other_exit';
        reason = `Referral exited through the recorded ${command.kind} pathway.`;
        transition(patient, to, command.kind, reason);
      }
      lastCommandSequence = command.sequence;
      const receipt = { id: command.id, sequence: command.sequence, tick, status: 'applied', reason,
        from, to, eventCursor: events.length + 1 };
      receipts.set(command.id, clone(receipt));
      emit('command_receipt', null, null, null, reason, { receipt });
      return clone(receipt);
    }

    function advanceOneTick(previousCursor) {
      if (!Number.isInteger(previousCursor) || previousCursor < 0 || previousCursor > events.length)
        throw new RangeError('Event cursor is outside the authoritative event stream.');
      if (tick >= horizonTicks) throw new RangeError('Pathway horizon has been reached.');
      tick++;
      coordinationUsedThisTick = 0;
      if (life) {
        lifecycleStep();
        refreshCapacity();
      }
      processTick();
      const eventBatch = eventsSince(previousCursor);
      return { tick, snapshot: snapshot(), events: eventBatch.events, cursor: eventBatch.cursor };
    }

    return Object.freeze({
      applyCommand,
      advanceOneTick,
      eventsSince,
      snapshot,
      get modelVersion() { return R03_MODEL_VERSION; },
      get protocolVersion() { return R01_PROTOCOL_VERSION; },
    });
  }

  root.MinisterModelCore = Object.freeze({
    TICKS_PER_WEEK,
    TICKS_PER_DAY,
    QUARTER_TICKS,
    TICKS_PER_YEAR,
    STARTUP_CYCLE,
    mulberry32,
    annualProbabilityToTick,
    hashCode,
    seededRandom,
    R03_SCENARIO,
    R03_MODEL_VERSION,
    R01_PROTOCOL_VERSION,
    R01_INTERVENTIONS,
    R04_LIFECYCLE_SCHEMA,
    LIFECYCLE_CASH_UNIT,
    LIFECYCLE_WORK_UNIT,
    createRun,
  });
})(globalThis);

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
  const R03_MODEL_VERSION = 'minister-r03-cardiology-pathway-1';
  const R01_PROTOCOL_VERSION = 'r01-cardiology-v1.0';
  const TERMINAL_STAGES = new Set(['treatment_started', 'died_waiting', 'refused', 'relocated', 'other_exit']);
  const clone = value => JSON.parse(JSON.stringify(value));

  function createRun({ scenario, seed, modelExecutableId, protocolVersion, inputs, schedule } = {}) {
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
    const coordinationUnitsPerTick = inputs.coordinationUnitsPerTick;
    const treatmentStartsPerTick = inputs.treatmentStartsPerTick;
    if (!Number.isInteger(horizonTicks) || horizonTicks < 1 || horizonTicks > 100000)
      throw new RangeError('Horizon must be a positive bounded number of ticks.');
    if (!Number.isInteger(coordinationUnitsPerTick) || coordinationUnitsPerTick < 1 || coordinationUnitsPerTick > 1000)
      throw new RangeError('Coordination capacity must be a positive bounded integer.');
    if (!Number.isInteger(treatmentStartsPerTick) || treatmentStartsPerTick < 1 || treatmentStartsPerTick > 1000)
      throw new RangeError('Treatment-start capacity must be a positive bounded integer.');
    if (!schedule || typeof schedule.id !== 'string' || schedule.id.length < 1 || schedule.id.length > 128
        || !Array.isArray(schedule.events) || schedule.events.length > 10000)
      throw new TypeError('A bounded, identified external schedule is required.');

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

    const identity = {
      modelVersion: R03_MODEL_VERSION,
      modelExecutableId,
      scenario,
      seed,
      protocolVersion,
      scheduleId: schedule.id,
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
          coordination: { capacityPerTick: coordinationUnitsPerTick, usedThisTick: coordinationUsedThisTick,
            unitsUsed: coordinationUnitsUsed },
          specialist: { startsPerTick: treatmentStartsPerTick, startsThisTick: treatmentStartsThisTick,
            starts: treatmentStarts },
        },
        metrics: metrics(),
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
      const requiresCoordination = command.kind === 'request_information' || command.kind === 'complete_handoff';
      if (requiresCoordination && coordinationUsedThisTick >= coordinationUnitsPerTick)
        return reject('coordination_capacity');

      const from = patient.stage;
      let to = from;
      let reason;
      if (command.kind === 'request_information') {
        if (from !== 'handoff_pending' || patient.informationComplete) return reject('information_not_required', 'no_effect');
        coordinationUsedThisTick++;
        coordinationUnitsUsed++;
        to = 'information_required';
        reason = 'A coordinator requested the missing referral information.';
        transition(patient, to, 'information_requested', reason, { resource: 'coordination' });
      } else if (command.kind === 'complete_handoff') {
        if (from !== 'handoff_pending') return reject('handoff_not_ready', 'no_effect');
        if (!patient.informationComplete) return reject('required_information_missing');
        coordinationUsedThisTick++;
        coordinationUnitsUsed++;
        to = 'specialist_waiting';
        reason = 'The complete referral was handed to the specialist queue.';
        transition(patient, to, 'handoff_completed', reason, { resource: 'coordination' });
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
    createRun,
  });
})(globalThis);

// Patient Agent — Hendrik Veenstra (First Cammelot Citizen)
// Extends CammelotAgent with patient-specific behavior

import { CammelotAgent } from "./cognitive_loop.js";
import { globalFHIRStore } from "../data_layer/fhir_store.js";
import { globalMessageBus } from "../communication/a2a_protocol.js";
import { DiseaseProgressionModel, HPDrainEngine } from "../clinical_logic/disease_engine.js";

/**
 * Patient Agent: autonomous citizen of Cammelot who navigates the healthcare system.
 */
export class PatientAgent extends CammelotAgent {
  constructor({ id, name, birthDate, gender, conditions, location }) {
    super({
      id,
      name,
      role: "patient",
      skills: [],
      location: location || { x: 32, y: 24 },
      personality: {},
    });

    this.birthDate = birthDate;
    this.gender = gender;
    this.hp = 100;
    this.spriteState = "healthy";
    this.conditions = conditions || [];
    this.weeksWaiting = 0;
    this.assignedGP = null;
    this.referralPending = false;
    this.diseaseState = "healthy";

    // Clinical engines
    this.hpEngine = new HPDrainEngine();
    this.diseaseModels = new Map();

    // Register in FHIR store
    this.fhirPatient = globalFHIRStore.createPatient({
      id: this.id,
      name: this.name,
      birthDate: this.birthDate,
      gender: this.gender,
      address: "Cammelot",
    });

    // Register initial conditions
    for (const cond of this.conditions) {
      globalFHIRStore.createCondition({
        patientId: this.id,
        code: cond.code,
        display: cond.name,
        severity: cond.severity || "moderate",
      });

      this.diseaseModels.set(
        cond.code,
        new DiseaseProgressionModel(cond.code)
      );
    }
  }

  /**
   * Override: Patient-specific action execution
   */
  executeAction(planStep) {
    switch (planStep.action) {
      case "request_urgent_referral":
        this._requestUrgentReferral();
        break;
      case "seek_alternative_care":
        this._seekAlternativeCare();
        break;
      case "routine_wait":
        this._routineWait();
        break;
      default:
        super.executeAction(planStep);
    }
  }

  /**
   * Override: Full patient tick — includes HP drain and disease progression
   */
  tick() {
    this.tickCount++;

    // 1. Disease progression (Markov)
    for (const [code, model] of this.diseaseModels) {
      const newState = model.transition(this.diseaseState, this.weeksWaiting);
      if (newState !== this.diseaseState) {
        this.diseaseState = newState;
        globalFHIRStore.createObservation({
          patientId: this.id,
          code: "CAMMELOT-DISEASE-STATE",
          display: `Disease state changed to: ${newState}`,
          value: DiseaseProgressionModel.STATES.indexOf(newState),
          unit: "state_index",
        });
      }
    }

    // 2. HP Drain calculation
    if (this.referralPending) {
      this.weeksWaiting += 0.25; // each tick = ~quarter week
    }

    const drainResult = this.hpEngine.calculateDrain(
      this.hp,
      this.weeksWaiting,
      this.diseaseState
    );

    // Also apply passive drain from disease severity alone
    const severityDrain = { healthy: 0, mild: 0.2, moderate: 0.5, severe: 1.5, critical: 3.0, deceased: 0 };
    const passiveDrain = severityDrain[this.diseaseState] || 0;
    const totalDrained = drainResult.drained + passiveDrain;

    if (totalDrained > 0) {
      this.hp = Math.max(0, drainResult.hp - passiveDrain);
      globalFHIRStore.logHPChange({
        patientId: this.id,
        currentHP: this.hp,
        delta: -totalDrained,
        reason: drainResult.reason || `passive_${this.diseaseState}`,
      });
    }

    // 3. Ghost check
    if (drainResult.isGhost && this.spriteState !== "ghost") {
      this.spriteState = "ghost";
      globalFHIRStore.logGhosting({ patientId: this.id });
      this.say(
        this.assignedGP || "broadcast",
        "I've been waiting too long... The system failed me."
      );
    } else {
      this.spriteState = this.hpEngine.getSpriteState(this.hp);
    }

    // 4. Update FHIR Patient HP extension
    const hpExt = this.fhirPatient.extension?.find(
      (e) => e.url === "http://cammelot.sim/fhir/hp"
    );
    if (hpExt) hpExt.valueInteger = Math.round(this.hp);

    // 5. Cognitive loop
    const plan = this.plan();
    for (const step of plan) {
      this.executeAction(step);
    }

    // 6. Log wait time
    if (this.referralPending) {
      globalFHIRStore.logWaitTime({
        patientId: this.id,
        weeksWaiting: this.weeksWaiting,
        treeknormWeeks: 12,
      });
    }

    return {
      tick: this.tickCount,
      hp: this.hp,
      spriteState: this.spriteState,
      diseaseState: this.diseaseState,
      weeksWaiting: this.weeksWaiting,
      plan,
    };
  }

  // --- Patient-specific actions ---

  _requestUrgentReferral() {
    if (this.assignedGP) {
      this.say(
        this.assignedGP,
        `My HP is at ${Math.round(this.hp)}. I need an urgent specialist referral!`
      );

      globalMessageBus.sendReferral({
        fromAgentId: this.id,
        toAgentId: this.assignedGP,
        patientId: this.id,
        conditionCode: this.conditions[0]?.code || "unknown",
        urgency: "urgent",
      });
    }
  }

  _seekAlternativeCare() {
    // Query the A2A mesh for specialists with shorter wait times
    const bestSpec = globalMessageBus.findBestSpecialist(
      this.conditions[0]?.code || "general"
    );

    if (bestSpec && bestSpec.waitTime.weeks < this.weeksWaiting) {
      this.say(
        bestSpec.agentId,
        `Wait time is ${bestSpec.waitTime.weeks} weeks with you vs ${Math.round(this.weeksWaiting)} weeks currently. Can you accept my referral?`
      );
    }
  }

  _routineWait() {
    // Just existing in the queue
    if (this.weeksWaiting > 0 && this.tickCount % 4 === 0) {
      this.say(
        this.assignedGP || "broadcast",
        `Still waiting... Week ${Math.round(this.weeksWaiting)}. HP: ${Math.round(this.hp)}/100`
      );
    }
  }

  onMessage(message) {
    super.onMessage(message);

    if (message.type === "response" && message.content?.accepted) {
      this.referralPending = false;
      this.weeksWaiting = 0;
      this.say(
        message.from,
        "Thank you! Finally getting the care I need."
      );
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      hp: this.hp,
      spriteState: this.spriteState,
      diseaseState: this.diseaseState,
      weeksWaiting: this.weeksWaiting,
      conditions: this.conditions,
      birthDate: this.birthDate,
      gender: this.gender,
    };
  }
}

// --- HENDRIK VEENSTRA: First Citizen of Cammelot ---

export function createHendrikVeenstra() {
  const hendrik = new PatientAgent({
    id: "patient-hendrik-veenstra",
    name: "Hendrik Veenstra",
    birthDate: "1956-03-15",
    gender: "male",
    conditions: [
      { code: "I25", name: "Chronic Ischemic Heart Disease", severity: "moderate" },
      { code: "E11", name: "Type 2 Diabetes", severity: "mild" },
    ],
    location: { x: 28, y: 20 },
  });

  // Hendrik's initial state: recently referred, waiting for cardiology
  hendrik.referralPending = true;
  hendrik.weeksWaiting = 4;
  hendrik.diseaseState = "moderate";
  hendrik.hp = 82;
  hendrik.assignedGP = "gp-de-jong";

  // Log initial state
  globalFHIRStore.createEncounter({
    patientId: hendrik.id,
    practitionerId: "gp-de-jong",
    type: "gp_consultation",
    status: "finished",
  });

  globalFHIRStore.logWaitTime({
    patientId: hendrik.id,
    weeksWaiting: 4,
    treeknormWeeks: 12,
  });

  globalFHIRStore.logHPChange({
    patientId: hendrik.id,
    currentHP: 82,
    delta: -18,
    reason: "disease_progression_pre_referral",
  });

  return hendrik;
}

export default PatientAgent;

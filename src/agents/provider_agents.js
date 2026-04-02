// GP & Specialist Agents — Healthcare Provider Agents for Cammelot

import { CammelotAgent } from "./cognitive_loop.js";
import { globalFHIRStore } from "../data_layer/fhir_store.js";
import { globalMessageBus } from "../communication/a2a_protocol.js";
import { SIMULATION_CONFIG } from "../../config/simulation.js";

/**
 * GP Agent: General Practitioner serving as gatekeeper in the Dutch healthcare system.
 * Manages patient queue, referrals, and suffers from administrative burden.
 */
export class GPAgent extends CammelotAgent {
  constructor({ id, name, location, maxPatients }) {
    super({
      id,
      name,
      role: "gp",
      skills: ["general_medicine", "referral", "triage"],
      location: location || { x: 16, y: 16 },
    });

    this.maxPatients = maxPatients || 2400;
    this.patients = [];
    this.referralQueue = [];
    this.adminBurden = SIMULATION_CONFIG.systemFailure.administrativeBurdenFraction;
    this.availableTimePerTick = 1.0; // fraction of time available
  }

  tick() {
    this.tickCount++;

    // Administrative burden steals time
    this.availableTimePerTick = 1.0 - this.adminBurden;

    // Process referral queue (limited by available time)
    const canProcess = Math.floor(this.referralQueue.length * this.availableTimePerTick);
    const processing = this.referralQueue.splice(0, canProcess);

    for (const referral of processing) {
      this._processReferral(referral);
    }

    // Update agent card with queue info
    this.agentCard.updateWaitTime(
      Math.ceil(this.referralQueue.length / Math.max(1, canProcess)),
      this.referralQueue.length
    );

    return {
      tick: this.tickCount,
      queueSize: this.referralQueue.length,
      processed: processing.length,
      adminBurden: this.adminBurden,
    };
  }

  _processReferral(referral) {
    const bestSpec = globalMessageBus.findBestSpecialist(referral.content.conditionCode);

    if (bestSpec) {
      if (bestSpec.waitTime.weeks > SIMULATION_CONFIG.systemFailure.treeknormWeeks) {
        // Treeknorm violation — communicate to patient
        this.say(
          referral.from,
          `Wait time is ${bestSpec.waitTime.weeks} weeks; I cannot refer you yet. The system is overloaded.`
        );
      }

      // Forward referral to specialist
      globalMessageBus.sendReferral({
        fromAgentId: this.id,
        toAgentId: bestSpec.agentId,
        patientId: referral.content.patientId,
        conditionCode: referral.content.conditionCode,
        urgency: referral.content.urgency,
      });

      // Log encounter
      globalFHIRStore.createEncounter({
        patientId: referral.content.patientId,
        practitionerId: this.id,
        type: "referral_processing",
        status: "in-progress",
      });
    } else {
      this.say(
        referral.from,
        "No specialist available for your condition. You'll have to wait."
      );
    }
  }

  onMessage(message) {
    super.onMessage(message);

    if (message.type === "referral") {
      this.referralQueue.push(message);
      this.say(
        message.from,
        `Referral received. Queue position: ${this.referralQueue.length}. Est. processing time: ${Math.ceil(this.referralQueue.length * (1 + this.adminBurden))} ticks.`
      );
    }
  }
}

/**
 * Specialist Agent: Hospital-based specialist with limited capacity and wait times.
 */
export class SpecialistAgent extends CammelotAgent {
  constructor({ id, name, specialty, location, weeklyCapacity }) {
    super({
      id,
      name,
      role: "specialist",
      skills: [specialty],
      location: location || { x: 48, y: 16 },
    });

    this.specialty = specialty;
    this.weeklyCapacity = weeklyCapacity || 15;
    this.waitList = [];
    this.currentWeekSlots = this.weeklyCapacity;
  }

  tick() {
    this.tickCount++;

    // Reset weekly slots every 4 ticks (1 simulated week)
    if (this.tickCount % 4 === 0) {
      this.currentWeekSlots = this.weeklyCapacity;
    }

    // Process waitlist
    const treating = this.waitList.splice(0, Math.min(this.currentWeekSlots, this.waitList.length));
    this.currentWeekSlots -= treating.length;

    for (const item of treating) {
      this._treatPatient(item);
    }

    // Update agent card
    const estWaitWeeks = Math.ceil(this.waitList.length / this.weeklyCapacity);
    this.agentCard.updateWaitTime(estWaitWeeks, this.waitList.length);

    return {
      tick: this.tickCount,
      waitListSize: this.waitList.length,
      treated: treating.length,
      estWaitWeeks,
    };
  }

  _treatPatient(referral) {
    const patientId = referral.content.patientId;

    // Create encounter
    globalFHIRStore.createEncounter({
      patientId,
      practitionerId: this.id,
      type: `specialist_${this.specialty}`,
      status: "finished",
    });

    // Notify patient
    const response = new (globalMessageBus.constructor === Object ? Object : Object)();
    globalMessageBus.sendMessage({
      id: `resp-${Date.now()}`,
      from: this.id,
      to: referral.content.patientId || referral.from,
      type: "response",
      content: { accepted: true, specialty: this.specialty },
      timestamp: new Date().toISOString(),
      status: "delivered",
    });

    this.say(
      patientId,
      `Your ${this.specialty} appointment is confirmed. Treatment begins now.`
    );
  }

  onMessage(message) {
    super.onMessage(message);

    if (message.type === "referral") {
      this.waitList.push(message);
      const estWait = Math.ceil(this.waitList.length / this.weeklyCapacity);

      this.say(
        message.from,
        `Referral accepted. Estimated wait: ${estWait} weeks. Queue position: ${this.waitList.length}.`
      );
    }
  }
}

// --- Factory functions for Cammelot infrastructure ---

export function createCammelotGPs() {
  return [
    new GPAgent({
      id: "gp-de-jong",
      name: "Dr. de Jong",
      location: { x: 12, y: 20 },
      maxPatients: 2400,
    }),
    new GPAgent({
      id: "gp-bakker",
      name: "Dr. Bakker",
      location: { x: 24, y: 32 },
      maxPatients: 2000,
    }),
    new GPAgent({
      id: "gp-visser",
      name: "Dr. Visser",
      location: { x: 36, y: 18 },
      maxPatients: 1800,
    }),
  ];
}

export function createCammelotSpecialists() {
  return [
    new SpecialistAgent({
      id: "spec-cardiology",
      name: "Dr. van den Berg (Cardiology)",
      specialty: "I25",
      location: { x: 50, y: 12 },
      weeklyCapacity: 12,
    }),
    new SpecialistAgent({
      id: "spec-endocrinology",
      name: "Dr. Mulder (Endocrinology)",
      specialty: "E11",
      location: { x: 52, y: 16 },
      weeklyCapacity: 15,
    }),
    new SpecialistAgent({
      id: "spec-pulmonology",
      name: "Dr. Janssen (Pulmonology)",
      specialty: "J44",
      location: { x: 54, y: 20 },
      weeklyCapacity: 10,
    }),
  ];
}

export default { GPAgent, SpecialistAgent };

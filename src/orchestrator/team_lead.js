// Team Lead Agent — Orchestrator for the Cammelot Simulation
// Manages sub-agents: Grid_Architect, Clinical_Logic_Agent, Research_Monitor_Agent

import { globalFHIRStore } from "../data_layer/fhir_store.js";
import { globalMessageBus } from "../communication/a2a_protocol.js";
import { buildCammelotMap } from "../grid_engine/tile_map.js";
import { createHendrikVeenstra } from "../agents/patient_agent.js";
import { createCammelotGPs, createCammelotSpecialists } from "../agents/provider_agents.js";
import { globalBiasTracker, globalROICounter } from "../research_monitor/research_monitor.js";
import { SIMULATION_CONFIG } from "../../config/simulation.js";

/**
 * Team Lead Agent: Initializes and orchestrates the Cammelot simulation.
 * Coordinates three sub-agent responsibilities:
 *   - Grid_Architect: world building
 *   - Clinical_Logic_Agent: health progression
 *   - Research_Monitor_Agent: analytics
 */
export class TeamLeadAgent {
  constructor() {
    this.simulationState = "initializing";
    this.currentCycle = 0;
    this.agents = {
      patients: [],
      gps: [],
      specialists: [],
    };
    this.tileMap = null;
    this.log = [];
  }

  /**
   * Initialize the full Cammelot simulation.
   */
  async initialize() {
    this._log("=== PROJECT CAMMELOT — INITIALIZATION ===");
    this._log(`Population target: ${SIMULATION_CONFIG.town.population}`);
    this._log(`Expected annual deaths: ${SIMULATION_CONFIG.expectedAnnualDeaths}`);

    // Phase 1: Grid_Architect — Build the world
    this._log("\n[Grid_Architect] Building Cammelot tile map...");
    this.tileMap = buildCammelotMap();
    this._log(`[Grid_Architect] Map created: ${this.tileMap.width}x${this.tileMap.height} tiles`);
    this._log(`[Grid_Architect] GP Practices: ${SIMULATION_CONFIG.infrastructure.gpPractices}`);
    this._log(`[Grid_Architect] Hospital: ${SIMULATION_CONFIG.infrastructure.hospital}`);

    // Phase 2: Spawn healthcare providers
    this._log("\n[Clinical_Logic_Agent] Spawning healthcare providers...");
    this.agents.gps = createCammelotGPs();
    this.agents.specialists = createCammelotSpecialists();

    for (const gp of this.agents.gps) {
      this.tileMap.placeEntity(gp.id, gp.location.x, gp.location.y, "gp");
      this._log(`  Registered GP: ${gp.name} at (${gp.location.x}, ${gp.location.y})`);
    }

    for (const spec of this.agents.specialists) {
      this.tileMap.placeEntity(spec.id, spec.location.x, spec.location.y, "specialist");
      this._log(`  Registered Specialist: ${spec.name} at (${spec.location.x}, ${spec.location.y})`);
    }

    // Phase 3: Spawn first patient — Hendrik Veenstra
    this._log("\n[Clinical_Logic_Agent] Creating first citizen: Hendrik Veenstra...");
    const hendrik = createHendrikVeenstra();
    this.agents.patients.push(hendrik);
    this.tileMap.placeEntity(hendrik.id, hendrik.location.x, hendrik.location.y, "patient", hendrik.spriteState);
    this._log(`  Patient: ${hendrik.name} (DOB: ${hendrik.birthDate})`);
    this._log(`  Conditions: ${hendrik.conditions.map((c) => c.name).join(", ")}`);
    this._log(`  Current HP: ${hendrik.hp}/100 | Disease State: ${hendrik.diseaseState}`);
    this._log(`  Waiting for specialist: ${hendrik.weeksWaiting} weeks`);
    this._log(`  Assigned GP: ${hendrik.assignedGP}`);

    // Phase 4: Verify FHIR Memory Stream
    this._log("\n[Research_Monitor_Agent] Verifying FHIR Memory Stream...");
    const memoryStream = globalFHIRStore.getMemoryStream(hendrik.id);
    this._log(`  FHIR resources for Hendrik: ${memoryStream.length}`);
    for (const resource of memoryStream) {
      const desc =
        resource.code?.coding?.[0]?.display ||
        resource.type?.[0]?.coding?.[0]?.display ||
        resource.resourceType;
      this._log(`    [${resource.resourceType}] ${desc}`);
    }

    // Phase 5: System stats
    this._log("\n[Research_Monitor_Agent] System Statistics:");
    const stats = globalFHIRStore.getStats();
    this._log(`  Total FHIR Resources: ${stats.totalResources}`);
    this._log(`  Patients: ${stats.patients}`);
    this._log(`  Conditions: ${stats.conditions}`);
    this._log(`  Encounters: ${stats.encounters}`);
    this._log(`  Observations: ${stats.observations}`);

    // A2A Mesh status
    this._log("\n[A2A Mesh] Agent Registry:");
    const allAgents = globalMessageBus.discoverAgents();
    for (const agent of allAgents) {
      this._log(`  [${agent.role}] ${agent.name} — Status: ${agent.status}, Wait: ${agent.waitTime.weeks}w`);
    }

    this.simulationState = "ready";
    this._log("\n=== CAMMELOT INITIALIZED — SIMULATION READY ===");
    this._log(`Total agents in mesh: ${allAgents.length}`);

    return this.getStatus();
  }

  /**
   * Run one simulation cycle: all agents tick in order.
   */
  runCycle() {
    this.currentCycle++;

    // 1. Specialists tick first (update capacities)
    for (const spec of this.agents.specialists) {
      spec.tick();
    }

    // 2. GPs process referrals
    for (const gp of this.agents.gps) {
      gp.tick();
    }

    // 3. Patients tick (HP drain, cognitive loop)
    for (const patient of this.agents.patients) {
      const result = patient.tick();

      // Update tile map sprite
      this.tileMap.updateEntitySprite(patient.id, result.spriteState);

      // Record for research monitoring
      globalBiasTracker.recordDecision({
        cycle: this.currentCycle,
        agentId: patient.assignedGP || "system",
        patientId: patient.id,
        decisionType: "referral",
        outcome: patient.referralPending ? "delayed" : "treated",
        metadata: {
          conditionCode: patient.conditions[0]?.code,
          weeksWaiting: patient.weeksWaiting,
          hp: patient.hp,
        },
      });

      // ROI logging
      if (patient.referralPending) {
        globalROICounter.logCost({
          cycle: this.currentCycle,
          type: "wasted",
          amount: globalROICounter.costs.gpConsultationEur * 0.3,
          category: "admin",
          description: `Admin overhead for ${patient.name}`,
        });
      }

      if (result.spriteState === "ghost") {
        const ghostCost = globalROICounter.calculateGhostCost(
          patient.weeksWaiting,
          globalFHIRStore.getPatientResources(patient.id).filter(
            (r) => r.resourceType === "Encounter"
          ).length
        );
        globalROICounter.logCost({
          cycle: this.currentCycle,
          type: "preventable",
          amount: ghostCost.totalPreventableCostEur,
          category: "ghost",
          description: `Preventable death: ${patient.name}`,
        });
      }
    }

    // 4. Update congestion visualization
    for (const gp of this.agents.gps) {
      this.tileMap.updateCongestion(gp.id, gp.referralQueue.length);
    }
    for (const spec of this.agents.specialists) {
      this.tileMap.updateCongestion(spec.id, spec.waitList.length);
    }

    return {
      cycle: this.currentCycle,
      stats: globalFHIRStore.getStats(),
      patients: this.agents.patients.map((p) => ({
        name: p.name,
        hp: p.hp,
        sprite: p.spriteState,
        waiting: p.weeksWaiting,
      })),
    };
  }

  /**
   * Run N cycles and return research summary.
   */
  runSimulation(cycles = 100) {
    this._log(`\n=== RUNNING SIMULATION: ${cycles} cycles ===`);
    const results = [];

    for (let i = 0; i < cycles; i++) {
      const result = this.runCycle();
      results.push(result);

      // Log milestones
      if (i % 100 === 0 && i > 0) {
        this._log(`  Cycle ${i}: Ghosts=${result.stats.ghosts}, Resources=${result.stats.totalResources}`);
      }
    }

    // Research reports
    const biasReport = globalBiasTracker.generateReport(cycles);
    const roiInsight = globalROICounter.generateInsight();

    this._log(`\n=== SIMULATION COMPLETE ===`);
    this._log(`Cycles: ${cycles}`);
    this._log(`Final stats: ${JSON.stringify(globalFHIRStore.getStats())}`);
    this._log(`Bias alert: ${biasReport.summary}`);
    this._log(`ROI: ${roiInsight.headline}`);

    return {
      cycles,
      finalStats: globalFHIRStore.getStats(),
      biasReport,
      roiInsight,
      results: results.slice(-5), // last 5 cycles
    };
  }

  getStatus() {
    return {
      state: this.simulationState,
      cycle: this.currentCycle,
      agents: {
        patients: this.agents.patients.length,
        gps: this.agents.gps.length,
        specialists: this.agents.specialists.length,
      },
      fhirStats: globalFHIRStore.getStats(),
      log: this.log,
    };
  }

  _log(message) {
    this.log.push(message);
    console.log(message);
  }
}

// --- ENTRY POINT ---
const teamLead = new TeamLeadAgent();
const status = await teamLead.initialize();

// Run initial 10 cycles to demonstrate
console.log("\n--- Running 10 demonstration cycles ---\n");
const simResult = teamLead.runSimulation(10);

console.log("\n--- Hendrik Veenstra Status ---");
const hendrik = teamLead.agents.patients[0];
console.log(JSON.stringify(hendrik.toJSON(), null, 2));

console.log("\n--- FHIR Memory Stream (last 5 entries) ---");
const stream = globalFHIRStore.getMemoryStream(hendrik.id);
for (const entry of stream.slice(-5)) {
  const desc = entry.code?.coding?.[0]?.display || entry.resourceType;
  console.log(`  [${entry.resourceType}] ${desc}`);
}

console.log("\n--- A2A Message Log (last 5) ---");
const messages = globalMessageBus.getMessageLog({}).slice(-5);
for (const msg of messages) {
  console.log(`  ${msg.from} → ${msg.to}: [${msg.type}] ${msg.content?.text || JSON.stringify(msg.content)}`);
}

console.log("\n--- Research Monitor ---");
console.log("Bias Report:", JSON.stringify(globalBiasTracker.analyzeBias(), null, 2));
console.log("ROI Summary:", JSON.stringify(globalROICounter.getSummary(), null, 2));

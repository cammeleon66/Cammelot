// Simulation Loop — Autonomous simulation runner with IST/SOLL toggle
// Runs the full Cammelot simulation with configurable parameters

import { globalFHIRStore } from "../data_layer/fhir_store.js";
import { globalMessageBus } from "../communication/a2a_protocol.js";
import { buildCammelotMap } from "../grid_engine/tile_map.js";
import { createHendrikVeenstra } from "../agents/patient_agent.js";
import { createCammelotGPs, createCammelotSpecialists } from "../agents/provider_agents.js";
import { spawnPopulation, instantiateAgents } from "../agents/population_engine.js";
import { globalBiasTracker, globalROICounter } from "../research_monitor/research_monitor.js";
import { SecurityAuditor } from "../research_monitor/security_auditor.js";
import { SIMULATION_CONFIG } from "../../config/simulation.js";
import { IZA_DATA, SOLL_PARAMETERS, NZA_TARIFFS } from "../../config/reference_data.js";

/**
 * IST/SOLL Configuration Profiles
 */
const PROFILES = {
  IST: {
    name: "IST — Current Crisis",
    adminBurden: 0.30,
    sickLeaveRate: 0.08,
    treeknormWeeks: 12,
    aiEfficiency: 1.0,
    dataAvailability: 0.11,
    hybridCareAdoption: 0.25,
    description: "Current reality: 30% admin, 8% sick leave, 12+ week waits",
  },
  SOLL: {
    name: "SOLL — AI-Native Future",
    adminBurden: 0.05,
    sickLeaveRate: 0.05,
    aiEfficiency: 1.34,
    treeknormWeeks: 4,
    dataAvailability: 0.66,
    hybridCareAdoption: 0.70,
    description: "AI-native: <5% admin, AI triage, full FHIR interop",
  },
};

/**
 * SimulationRunner — configurable simulation with IST/SOLL toggle
 */
export class SimulationRunner {
  constructor(profile = "IST") {
    this.profile = PROFILES[profile] || PROFILES.IST;
    this.profileName = profile;
    this.cycle = 0;
    this.tileMap = null;
    this.agents = { patients: [], gps: [], specialists: [] };
    this.populationStats = null;
    this.snapshots = [];
    this.running = false;
  }

  /**
   * Initialize the simulation world.
   * @param {number} agentLimit - How many full agents to instantiate (rest are statistical)
   */
  async initialize(agentLimit = 50) {
    console.log(`\n=== CAMMELOT SIMULATION — ${this.profile.name} ===`);
    console.log(this.profile.description);

    // Build world
    this.tileMap = buildCammelotMap();
    console.log(`[Grid] Map: ${this.tileMap.width}×${this.tileMap.height} tiles`);

    // Spawn providers
    this.agents.gps = createCammelotGPs();
    this.agents.specialists = createCammelotSpecialists();

    // Apply profile to GPs
    for (const gp of this.agents.gps) {
      gp.adminBurden = this.profile.adminBurden;
      this.tileMap.placeEntity(gp.id, gp.location.x, gp.location.y, "gp");
    }

    // Apply profile to specialists
    for (const spec of this.agents.specialists) {
      // SOLL: AI improves throughput
      spec.weeklyCapacity = Math.round(
        spec.weeklyCapacity * this.profile.aiEfficiency
      );
      this.tileMap.placeEntity(spec.id, spec.location.x, spec.location.y, "specialist");
    }

    // Spawn population (statistical)
    console.log(`[Population] Spawning ${SIMULATION_CONFIG.town.population} citizens...`);
    const { citizens, stats } = spawnPopulation(SIMULATION_CONFIG.town.population);
    this.populationStats = stats;

    console.log(`  Total: ${stats.total} | M: ${stats.bySex.male} F: ${stats.bySex.female}`);
    console.log(`  Age groups: ${JSON.stringify(stats.byAgeGroup)}`);
    console.log(`  With conditions: ${stats.withConditions} (${((stats.withConditions / stats.total) * 100).toFixed(1)}%)`);
    console.log(`  Multimorbidity: ${stats.withMultimorbidity}`);
    console.log(`  Top conditions: ${Object.entries(stats.conditions).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}:${v}`).join(", ")}`);

    // Instantiate first batch as full agents (Hendrik + random citizens)
    console.log(`[Agents] Instantiating ${agentLimit} full agents...`);

    // Hendrik is always first
    const hendrik = createHendrikVeenstra();
    this.agents.patients.push(hendrik);
    this.tileMap.placeEntity(hendrik.id, hendrik.location.x, hendrik.location.y, "patient", hendrik.spriteState);

    // Add more agents
    const additionalAgents = instantiateAgents(citizens.slice(0, agentLimit - 1));
    for (const agent of additionalAgents) {
      this.agents.patients.push(agent);
      this.tileMap.placeEntity(agent.id, agent.location.x, agent.location.y, "patient", agent.spriteState);
    }

    console.log(`[Agents] ${this.agents.patients.length} patient agents active`);
    console.log(`[Mesh] ${globalMessageBus.discoverAgents().length} agents in A2A mesh`);

    // Log FHIR stats
    const fhirStats = globalFHIRStore.getStats();
    console.log(`[FHIR] Resources: ${fhirStats.totalResources} (${fhirStats.patients} patients, ${fhirStats.conditions} conditions)`);

    this.running = true;
    return this.getSnapshot();
  }

  /**
   * Run one simulation cycle.
   */
  runCycle() {
    if (!this.running) return null;
    this.cycle++;

    // 1. Specialists process wait lists
    for (const spec of this.agents.specialists) {
      spec.tick();
    }

    // 2. GPs process referrals (admin burden reduces throughput)
    for (const gp of this.agents.gps) {
      gp.tick();
    }

    // 3. Patients tick: disease progression + HP drain + cognitive loop
    let ghostsThisCycle = 0;
    for (const patient of this.agents.patients) {
      const prevState = patient.spriteState;
      const result = patient.tick();

      // Update tile map
      this.tileMap.updateEntitySprite(patient.id, result.spriteState);

      // Record for bias tracking
      globalBiasTracker.recordDecision({
        cycle: this.cycle,
        agentId: patient.assignedGP || "system",
        patientId: patient.id,
        decisionType: "referral",
        outcome: patient.referralPending ? "delayed" : "treated",
        metadata: {
          conditionCode: patient.conditions[0]?.code,
          weeksWaiting: patient.weeksWaiting,
          hp: patient.hp,
          age: patient.birthDate
            ? new Date().getFullYear() - new Date(patient.birthDate).getFullYear()
            : 0,
          distanceToHospital: Math.abs(patient.location.x - 50) + Math.abs(patient.location.y - 12),
        },
      });

      // ROI logging
      if (patient.referralPending) {
        const consultCost = NZA_TARIFFS.gp.regularConsult.euros;
        globalROICounter.logCost({
          cycle: this.cycle,
          type: "wasted",
          amount: consultCost * this.profile.adminBurden,
          category: "admin",
          description: `Admin overhead: ${patient.name}`,
        });
      }

      if (result.spriteState === "ghost" && prevState !== "ghost") {
        ghostsThisCycle++;
        const ghostCost = globalROICounter.calculateGhostCost(
          patient.weeksWaiting,
          globalFHIRStore.getPatientResources(patient.id)
            .filter((r) => r.resourceType === "Encounter").length
        );
        globalROICounter.logCost({
          cycle: this.cycle,
          type: "preventable",
          amount: ghostCost.totalPreventableCostEur,
          category: "ghost",
          description: `Preventable death: ${patient.name}`,
        });
      }
    }

    // 4. Update congestion
    for (const gp of this.agents.gps) {
      this.tileMap.updateCongestion(gp.id, gp.referralQueue.length);
    }
    for (const spec of this.agents.specialists) {
      this.tileMap.updateCongestion(spec.id, spec.waitList.length);
    }

    // Snapshot every 10 cycles
    if (this.cycle % 10 === 0) {
      this.snapshots.push(this.getSnapshot());
    }

    return {
      cycle: this.cycle,
      ghostsThisCycle,
      stats: globalFHIRStore.getStats(),
    };
  }

  /**
   * Run N cycles.
   */
  run(cycles = 100) {
    console.log(`\n--- Running ${cycles} cycles (${this.profileName}) ---`);
    for (let i = 0; i < cycles; i++) {
      this.runCycle();
      if (this.cycle % 100 === 0) {
        const s = globalFHIRStore.getStats();
        console.log(`  Cycle ${this.cycle}: Ghosts=${s.ghosts}, Resources=${s.totalResources}`);
      }
    }
    return this.generateReport();
  }

  /**
   * Generate a comprehensive report.
   */
  generateReport() {
    const stats = globalFHIRStore.getStats();
    const biasReport = globalBiasTracker.generateReport(this.cycle);
    const roiSummary = globalROICounter.getSummary();
    const roiInsight = globalROICounter.generateInsight();

    // Calculate effective capacity
    const cEff = (1 - this.profile.adminBurden - this.profile.sickLeaveRate) * this.profile.aiEfficiency;

    const report = {
      simulation: {
        profile: this.profileName,
        profileDescription: this.profile.description,
        totalCycles: this.cycle,
        effectiveCapacity: Math.round(cEff * 100) + "%",
      },
      population: this.populationStats,
      outcomes: {
        totalPatients: stats.patients,
        ghosts: stats.ghosts,
        ghostRate: stats.patients > 0
          ? ((stats.ghosts / stats.patients) * 100).toFixed(2) + "%"
          : "0%",
        totalFHIRResources: stats.totalResources,
      },
      bias: biasReport,
      roi: roiSummary,
      linkedInInsight: roiInsight,
      snapshots: this.snapshots.slice(-5),
    };

    console.log(`\n=== REPORT: ${this.profileName} ===`);
    console.log(`Cycles: ${this.cycle}`);
    console.log(`Effective Capacity: ${report.simulation.effectiveCapacity}`);
    console.log(`Ghosts: ${stats.ghosts} (${report.outcomes.ghostRate})`);
    console.log(`FHIR Resources: ${stats.totalResources}`);
    console.log(`Bias Alert: ${biasReport.summary}`);
    console.log(`ROI: ${roiInsight.headline}`);

    return report;
  }

  getSnapshot() {
    const stats = globalFHIRStore.getStats();
    return {
      cycle: this.cycle,
      profile: this.profileName,
      stats,
      patients: this.agents.patients.slice(0, 10).map((p) => ({
        name: p.name,
        hp: Math.round(p.hp),
        sprite: p.spriteState,
        disease: p.diseaseState,
        waiting: Math.round(p.weeksWaiting * 10) / 10,
      })),
      messages: globalMessageBus.getMessageLog({}).length,
    };
  }
}

// --- CLI ENTRY POINT ---
const args = process.argv.slice(2);
const profile = args.includes("--soll") ? "SOLL" : "IST";
const cycles = parseInt(args.find((a) => a.startsWith("--cycles="))?.split("=")[1] || "100");
const agents = parseInt(args.find((a) => a.startsWith("--agents="))?.split("=")[1] || "50");
const runSecurity = args.includes("--security");

const sim = new SimulationRunner(profile);
await sim.initialize(agents);

const report = sim.run(cycles);

// Optional: Security audit
if (runSecurity) {
  const auditor = new SecurityAuditor();
  const securityReport = auditor.runFullAudit();
  console.log(`\nSecurity: ${securityReport.linkedInHook}`);
}

// Display Hendrik's final state
const hendrik = sim.agents.patients.find((p) => p.id === "patient-hendrik-veenstra");
if (hendrik) {
  console.log(`\n--- Hendrik Veenstra ---`);
  console.log(`HP: ${Math.round(hendrik.hp)}/100 | State: ${hendrik.diseaseState} | Sprite: ${hendrik.spriteState}`);
  console.log(`Waiting: ${Math.round(hendrik.weeksWaiting)}w | Conditions: ${hendrik.conditions.map((c) => c.name).join(", ")}`);
}

console.log(`\n--- Final FHIR Stats ---`);
console.log(JSON.stringify(globalFHIRStore.getStats(), null, 2));

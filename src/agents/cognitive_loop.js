// Agent Cognitive Loop — Park et al. Architecture
// Memory Stream → Reflection → Planning

import { globalFHIRStore } from "../data_layer/fhir_store.js";
import { globalMessageBus, AgentCard, A2AMessage } from "../communication/a2a_protocol.js";

/**
 * Base Agent class implementing the Generative Agent cognitive loop.
 * All agents (patients, GPs, specialists) extend this.
 */
export class CammelotAgent {
  constructor({ id, name, role, skills, location, personality }) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.skills = skills || [];
    this.location = location || { x: 0, y: 0 };
    this.personality = personality || {};

    // Internal state
    this.currentPlan = [];
    this.reflections = [];
    this.importanceThreshold = 5; // minimum importance to trigger reflection
    this.tickCount = 0;

    // Register with A2A mesh
    this.agentCard = new AgentCard({
      agentId: this.id,
      name: this.name,
      role: this.role,
      skills: this.skills,
      location: this.location,
    });
    globalMessageBus.registerAgent(this.agentCard);

    // Subscribe to incoming messages
    globalMessageBus.subscribe(this.id, (msg) => this.onMessage(msg));
  }

  // --- 1. MEMORY STREAM ---

  /**
   * Retrieve the full memory stream from FHIR store.
   * Returns chronologically ordered FHIR resources.
   */
  getMemoryStream() {
    return globalFHIRStore.getMemoryStream(this.id);
  }

  /**
   * Score the importance of a memory (0-10 scale).
   * Higher scores trigger reflection.
   */
  scoreImportance(memory) {
    const typeScores = {
      Condition: 8,
      Encounter: 5,
      Observation: 3,
    };
    let score = typeScores[memory.resourceType] || 2;

    // Boost for ghost/critical events
    if (memory.code?.coding?.some((c) => c.code === "CAMMELOT-GHOST")) score = 10;
    if (memory.code?.coding?.some((c) => c.code === "CAMMELOT-HP")) score += 2;

    return Math.min(10, score);
  }

  /**
   * Get recent important memories for reflection.
   */
  getRecentImportantMemories(windowSize = 20) {
    const stream = this.getMemoryStream();
    const recent = stream.slice(-windowSize);
    return recent
      .map((m) => ({ memory: m, importance: this.scoreImportance(m) }))
      .filter((m) => m.importance >= this.importanceThreshold)
      .sort((a, b) => b.importance - a.importance);
  }

  // --- 2. REFLECTION ---

  /**
   * Generate high-level reflections from important memories.
   * These are conclusions about system failures, patterns, etc.
   */
  reflect() {
    const important = this.getRecentImportantMemories();
    if (important.length === 0) return [];

    const newReflections = [];

    // Check for wait-time patterns
    const waitObs = important.filter(
      (m) => m.memory.code?.coding?.some((c) => c.code === "CAMMELOT-WAIT")
    );
    if (waitObs.length > 0) {
      const avgWait =
        waitObs.reduce(
          (sum, m) => sum + (m.memory.valueQuantity?.value || 0),
          0
        ) / waitObs.length;

      if (avgWait > 12) {
        newReflections.push({
          type: "system_failure",
          content: `Average wait time (${avgWait.toFixed(1)}w) exceeds Treeknorm. System is failing.`,
          severity: "high",
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Check for HP drain patterns
    const hpObs = important.filter(
      (m) => m.memory.code?.coding?.some((c) => c.code === "CAMMELOT-HP")
    );
    if (hpObs.length > 2) {
      const hpValues = hpObs.map((m) => m.memory.valueQuantity?.value || 0);
      const trend = hpValues[hpValues.length - 1] - hpValues[0];
      if (trend < -20) {
        newReflections.push({
          type: "health_decline",
          content: `HP declining rapidly (${trend} HP over recent period). Intervention needed.`,
          severity: "critical",
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.reflections.push(...newReflections);
    return newReflections;
  }

  // --- 3. PLANNING ---

  /**
   * Generate action plan based on reflections and current state.
   * Returns ordered list of intended actions.
   */
  plan() {
    const reflections = this.reflect();
    const plan = [];

    for (const ref of reflections) {
      switch (ref.type) {
        case "system_failure":
          plan.push({
            action: "seek_alternative_care",
            priority: "high",
            description: "Wait time exceeds Treeknorm — exploring alternatives",
          });
          break;
        case "health_decline":
          plan.push({
            action: "request_urgent_referral",
            priority: "critical",
            description: "HP declining — requesting urgent specialist referral",
          });
          break;
      }
    }

    // Default plan: continue waiting / routine check
    if (plan.length === 0) {
      plan.push({
        action: "routine_wait",
        priority: "low",
        description: "Continuing standard care pathway",
      });
    }

    this.currentPlan = plan;
    return plan;
  }

  // --- 4. EXECUTION ---

  /**
   * Execute one cognitive tick: Memory → Reflect → Plan → Act
   */
  tick() {
    this.tickCount++;
    const plan = this.plan();

    for (const step of plan) {
      this.executeAction(step);
    }

    return { tick: this.tickCount, plan, reflections: this.reflections.slice(-3) };
  }

  /**
   * Execute a single planned action. Override in subclasses.
   */
  executeAction(planStep) {
    // Base implementation — log the action
    globalFHIRStore.createObservation({
      patientId: this.id,
      code: "CAMMELOT-ACTION",
      display: `Agent action: ${planStep.action}`,
      value: planStep.priority === "critical" ? 10 : 5,
      unit: "priority",
    });
  }

  // --- MESSAGE HANDLING ---

  onMessage(message) {
    // Log received message as observation
    globalFHIRStore.createObservation({
      patientId: this.id,
      code: "CAMMELOT-MSG",
      display: `Received ${message.type} from ${message.from}`,
    });
  }

  /**
   * Send a speech bubble dialogue (visible in UI)
   */
  say(toAgentId, text) {
    return globalMessageBus.createDialogue({
      fromAgentId: this.id,
      toAgentId,
      text,
    });
  }

  // --- SERIALIZATION ---

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      location: this.location,
      tickCount: this.tickCount,
      planLength: this.currentPlan.length,
      reflectionCount: this.reflections.length,
      agentCard: this.agentCard.toJSON(),
    };
  }
}

export default CammelotAgent;

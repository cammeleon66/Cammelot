// Clinical Logic — Markov Disease Progression & HP Drain Engine
// Implements the fatale HP drain based on IZA wait times and Treeknorm violations

import { SIMULATION_CONFIG } from "../../config/simulation.js";

/**
 * Markov state model for disease progression.
 * States: healthy → mild → moderate → severe → critical → deceased
 * Transition probabilities shift based on wait-time pressure.
 */
export class DiseaseProgressionModel {
  static STATES = ["healthy", "mild", "moderate", "severe", "critical", "deceased"];

  constructor(conditionCode) {
    this.conditionCode = conditionCode;

    // Base weekly transition probabilities (without system delay)
    this.baseTransitions = {
      healthy:   { healthy: 0.95, mild: 0.05, moderate: 0, severe: 0, critical: 0, deceased: 0 },
      mild:      { healthy: 0.02, mild: 0.88, moderate: 0.08, severe: 0.02, critical: 0, deceased: 0 },
      moderate:  { healthy: 0, mild: 0.03, moderate: 0.82, severe: 0.12, critical: 0.03, deceased: 0 },
      severe:    { healthy: 0, mild: 0, moderate: 0.02, severe: 0.75, critical: 0.18, deceased: 0.05 },
      critical:  { healthy: 0, mild: 0, moderate: 0, severe: 0.05, critical: 0.65, deceased: 0.30 },
      deceased:  { healthy: 0, mild: 0, moderate: 0, severe: 0, critical: 0, deceased: 1.0 },
    };
  }

  /**
   * Compute transition probabilities adjusted for system delay.
   * When wait exceeds Treeknorm, progression accelerates.
   */
  getAdjustedTransitions(currentState, weeksWaiting) {
    const base = { ...this.baseTransitions[currentState] };
    const { treeknormWeeks } = SIMULATION_CONFIG.systemFailure;

    // BUG-001 FIX: Deceased is an absorbing state — always return deceased=1.0
    if (currentState === "deceased") return base;

    if (weeksWaiting <= treeknormWeeks) return base;

    // Acceleration factor: exponential degradation beyond Treeknorm
    const overdue = weeksWaiting - treeknormWeeks;
    const accelerationFactor = 1 + 0.15 * overdue; // 15% faster per week overdue

    // Shift probability mass toward worse states
    const states = DiseaseProgressionModel.STATES;
    const currentIdx = states.indexOf(currentState);

    // Reduce self-stay probability, increase progression
    const progressionBoost = Math.min(base[currentState] * 0.1 * accelerationFactor, base[currentState] * 0.5);
    base[currentState] -= progressionBoost;

    // Distribute to worse states
    const worseStates = states.slice(currentIdx + 1);
    if (worseStates.length > 0) {
      const perState = progressionBoost / worseStates.length;
      for (const ws of worseStates) {
        base[ws] += perState;
      }
    }

    return base;
  }

  /**
   * Simulate one weekly transition.
   * Returns the new state.
   */
  transition(currentState, weeksWaiting) {
    const probs = this.getAdjustedTransitions(currentState, weeksWaiting);
    const rand = Math.random();
    let cumulative = 0;

    for (const state of DiseaseProgressionModel.STATES) {
      cumulative += probs[state];
      if (rand <= cumulative) return state;
    }

    return currentState; // fallback
  }
}

/**
 * HP Drain Engine — calculates health point loss from system delay
 */
export class HPDrainEngine {
  constructor() {
    this.config = SIMULATION_CONFIG.hpDrain;
    this.treeknorm = SIMULATION_CONFIG.systemFailure.treeknormWeeks;
  }

  /**
   * Calculate HP after one tick, given current wait time.
   * HP drains when wait exceeds Treeknorm.
   */
  calculateDrain(currentHP, weeksWaiting, diseaseState) {
    if (currentHP <= this.config.ghostThreshold) {
      return { hp: 0, drained: 0, isGhost: true, reason: "already_ghost" };
    }

    let drain = 0;
    let reason = "stable";

    // Base drain from Treeknorm violation
    if (weeksWaiting > this.treeknorm) {
      const overdueWeeks = weeksWaiting - this.treeknorm;
      drain += this.config.drainPerWeekOverTreeknorm * overdueWeeks;
      reason = `treeknorm_violation_${overdueWeeks}w_overdue`;
    }

    // Additional drain from disease severity
    const severityMultiplier = {
      healthy: 0,
      mild: 0.5,
      moderate: 1.0,
      severe: 2.0,
      critical: 4.0,
      deceased: 0, // already handled
    };

    // BUG-002 FIX: severityMultiplier["healthy"] = 0 is JS-falsy, was hitting || 1.0 fallback
    const mult = severityMultiplier[diseaseState];
    drain *= mult !== undefined ? mult : 1.0;

    // Administrative burden adds passive drain
    const adminDrain = drain * SIMULATION_CONFIG.systemFailure.administrativeBurdenFraction;
    drain += adminDrain;

    const newHP = Math.max(0, currentHP - drain);
    const isGhost = newHP <= this.config.ghostThreshold;

    return {
      hp: Math.round(newHP * 100) / 100,
      drained: Math.round(drain * 100) / 100,
      isGhost,
      isCritical: newHP <= this.config.criticalHP && !isGhost,
      reason,
    };
  }

  /**
   * Determine sprite state based on HP
   */
  getSpriteState(hp) {
    if (hp <= this.config.ghostThreshold) return "ghost";
    if (hp <= this.config.criticalHP) return "critical";
    if (hp <= 50) return "distressed";
    if (hp <= 75) return "concerned";
    return "healthy";
  }
}

/**
 * Treeknorm Compliance Checker
 */
export class TreeknormChecker {
  constructor() {
    this.treeknorm = SIMULATION_CONFIG.systemFailure.treeknormWeeks;
  }

  isCompliant(weeksWaiting) {
    return weeksWaiting <= this.treeknorm;
  }

  getViolationSeverity(weeksWaiting) {
    if (this.isCompliant(weeksWaiting)) return "compliant";
    const overdue = weeksWaiting - this.treeknorm;
    if (overdue <= 4) return "minor";
    if (overdue <= 8) return "moderate";
    if (overdue <= 16) return "severe";
    return "critical";
  }

  /** Expected HP impact for a given wait duration */
  projectHPImpact(weeksWaiting, diseaseState, currentHP = 100) {
    const engine = new HPDrainEngine();
    let hp = currentHP;
    const trajectory = [{ week: 0, hp }];

    for (let w = 1; w <= weeksWaiting; w++) {
      const result = engine.calculateDrain(hp, w, diseaseState);
      hp = result.hp;
      trajectory.push({ week: w, hp, isGhost: result.isGhost });
      if (result.isGhost) break;
    }

    return trajectory;
  }
}

export default { DiseaseProgressionModel, HPDrainEngine, TreeknormChecker };

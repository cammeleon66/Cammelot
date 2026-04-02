// Research Monitor — Bias Tracker + ROI Counter
// Tracks systemic bias accumulation and financial impact of administrative friction

import { globalFHIRStore } from "../data_layer/fhir_store.js";
import { globalMessageBus } from "../communication/a2a_protocol.js";

/**
 * Bias Tracker: Measures how implicit bias in LLM agent decisions
 * accumulates over simulation cycles.
 */
export class BiasTracker {
  constructor() {
    this.cycleData = [];
    this.cumulativeBias = {};
    this.dimensionLabels = [
      "age_bias",        // older patients deprioritized
      "condition_bias",  // certain diagnoses under-recognized
      "location_bias",   // distance to hospital affecting care
      "referral_bias",   // systematic referral pattern skew
    ];
  }

  /**
   * Record a decision event for bias analysis.
   */
  recordDecision({ cycle, agentId, patientId, decisionType, outcome, metadata }) {
    const event = {
      cycle,
      agentId,
      patientId,
      decisionType,
      outcome,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    };

    this.cycleData.push(event);
    return event;
  }

  /**
   * Analyze bias accumulation across a window of cycles.
   */
  analyzeBias(fromCycle = 0, toCycle = Infinity) {
    const window = this.cycleData.filter(
      (e) => e.cycle >= fromCycle && e.cycle <= toCycle
    );

    if (window.length === 0) return { totalEvents: 0, biasScores: {} };

    // Age bias: compare outcomes for 65+ vs younger patients
    const ageBias = this._computeAgeBias(window);

    // Referral bias: check if certain conditions get systematically delayed
    const referralBias = this._computeReferralBias(window);

    // Location bias: check distance-to-care correlation with outcomes
    const locationBias = this._computeLocationBias(window);

    return {
      totalEvents: window.length,
      cycleRange: [fromCycle, Math.min(toCycle, window[window.length - 1]?.cycle || 0)],
      biasScores: {
        age_bias: ageBias,
        referral_bias: referralBias,
        location_bias: locationBias,
      },
      alert: ageBias > 0.3 || referralBias > 0.3
        ? "SIGNIFICANT BIAS DETECTED — Review agent decision patterns"
        : "Within acceptable range",
    };
  }

  _computeAgeBias(events) {
    const patientStore = globalFHIRStore.getByType("Patient");
    const seniorIds = new Set(
      patientStore
        .filter((p) => {
          if (!p.birthDate) return false;
          const age = new Date().getFullYear() - new Date(p.birthDate).getFullYear();
          return age >= 65;
        })
        .map((p) => p.id)
    );

    const seniorEvents = events.filter((e) => seniorIds.has(e.patientId));
    const nonSeniorEvents = events.filter((e) => !seniorIds.has(e.patientId));

    if (seniorEvents.length === 0 || nonSeniorEvents.length === 0) return 0;

    // Compare outcome rates (higher = more bias)
    const seniorNeg = seniorEvents.filter((e) => e.outcome === "delayed" || e.outcome === "denied").length;
    const nonSeniorNeg = nonSeniorEvents.filter((e) => e.outcome === "delayed" || e.outcome === "denied").length;

    const seniorRate = seniorNeg / seniorEvents.length;
    const nonSeniorRate = nonSeniorNeg / nonSeniorEvents.length;

    return Math.abs(seniorRate - nonSeniorRate);
  }

  _computeReferralBias(events) {
    const referralEvents = events.filter((e) => e.decisionType === "referral");
    if (referralEvents.length === 0) return 0;

    // Group by condition code
    const byCondition = {};
    for (const e of referralEvents) {
      const code = e.metadata.conditionCode || "unknown";
      if (!byCondition[code]) byCondition[code] = { total: 0, delayed: 0 };
      byCondition[code].total++;
      if (e.outcome === "delayed") byCondition[code].delayed++;
    }

    // Compute variance in delay rates
    const rates = Object.values(byCondition).map(
      (c) => c.total > 0 ? c.delayed / c.total : 0
    );
    if (rates.length < 2) return 0;

    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / rates.length;

    return Math.sqrt(variance); // standard deviation as bias score
  }

  _computeLocationBias(events) {
    // Simplified: check if patients farther from hospital have worse outcomes
    const withLocation = events.filter((e) => e.metadata.distanceToHospital !== undefined);
    if (withLocation.length < 10) return 0;

    const close = withLocation.filter((e) => e.metadata.distanceToHospital <= 10);
    const far = withLocation.filter((e) => e.metadata.distanceToHospital > 10);

    if (close.length === 0 || far.length === 0) return 0;

    const closeNeg = close.filter((e) => e.outcome === "delayed").length / close.length;
    const farNeg = far.filter((e) => e.outcome === "delayed").length / far.length;

    return Math.abs(farNeg - closeNeg);
  }

  /** Generate report for LinkedIn Applied Research post */
  generateReport(cycles) {
    const analysis = this.analyzeBias(0, cycles);
    return {
      title: `Applied Research Report: Bias Analysis over ${cycles} cycles`,
      summary: analysis.alert,
      data: analysis,
      insight: analysis.biasScores.age_bias > 0.2
        ? `Age bias detected: seniors ${(analysis.biasScores.age_bias * 100).toFixed(1)}% more likely to experience delays`
        : "No significant age-based disparities detected",
    };
  }
}

/**
 * ROI Counter: Calculates financial impact of administrative friction.
 */
export class ROICounter {
  constructor() {
    // Dutch healthcare cost estimates (simplified)
    this.costs = {
      gpConsultationEur: 35,
      specialistConsultationEur: 150,
      hospitalDayEur: 850,
      adminMinuteEur: 1.2, // cost per minute of admin time
      gpMinutesPerConsultation: 15,
      adminFraction: 0.30, // 30% of time is admin
    };

    this.ledger = [];
  }

  /**
   * Log a cost event.
   */
  logCost({ cycle, type, amount, category, description }) {
    const entry = {
      cycle,
      type,       // "actual" | "wasted" | "preventable"
      amount,
      category,   // "admin" | "care" | "wait" | "ghost"
      description,
      timestamp: new Date().toISOString(),
    };
    this.ledger.push(entry);
    return entry;
  }

  /**
   * Calculate admin waste for a given number of GP consultations.
   */
  calculateAdminWaste(consultations) {
    const totalMinutes = consultations * this.costs.gpMinutesPerConsultation;
    const adminMinutes = totalMinutes * this.costs.adminFraction;
    const wasteCost = adminMinutes * this.costs.adminMinuteEur;

    return {
      totalConsultations: consultations,
      totalMinutes,
      adminMinutes,
      clinicalMinutes: totalMinutes - adminMinutes,
      wasteCostEur: Math.round(wasteCost * 100) / 100,
      lostPatientSlots: Math.floor(adminMinutes / this.costs.gpMinutesPerConsultation),
    };
  }

  /**
   * Calculate the cost of a ghosting event (preventable death).
   */
  calculateGhostCost(weeksWaited, encounterCount) {
    const waitCost = weeksWaited * this.costs.specialistConsultationEur * 0.1;
    const careCost = encounterCount * this.costs.gpConsultationEur;
    const socialCost = 50000; // statistical value of life-year (simplified)

    return {
      waitRelatedCostEur: Math.round(waitCost),
      carePathwayCostEur: Math.round(careCost),
      estimatedSocialCostEur: socialCost,
      totalPreventableCostEur: Math.round(waitCost + careCost + socialCost),
    };
  }

  /**
   * Aggregate ROI summary across cycles.
   */
  getSummary(fromCycle = 0, toCycle = Infinity) {
    const window = this.ledger.filter(
      (e) => e.cycle >= fromCycle && e.cycle <= toCycle
    );

    const byCategory = {};
    for (const entry of window) {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = { actual: 0, wasted: 0, preventable: 0 };
      }
      byCategory[entry.category][entry.type] += entry.amount;
    }

    const totalWaste = window
      .filter((e) => e.type === "wasted")
      .reduce((sum, e) => sum + e.amount, 0);

    const totalPreventable = window
      .filter((e) => e.type === "preventable")
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      cycleRange: [fromCycle, toCycle],
      entries: window.length,
      byCategory,
      totalWasteEur: Math.round(totalWaste),
      totalPreventableCostEur: Math.round(totalPreventable),
      roiOfFix: totalWaste > 0
        ? `Eliminating admin friction saves €${Math.round(totalWaste).toLocaleString()} per cycle`
        : "No waste recorded yet",
    };
  }

  /** Generate LinkedIn-ready Applied Research insight */
  generateInsight() {
    const summary = this.getSummary();
    const ghostCount = globalFHIRStore.getStats().ghosts;
    return {
      title: "Applied Research: ROI of Administrative Friction Reduction",
      headline: `€${summary.totalWasteEur.toLocaleString()} wasted on administrative overhead. ${ghostCount} preventable deaths.`,
      data: summary,
      callToAction: "The care infarction is quantifiable. Here is the data.",
    };
  }
}

// Singletons
export const globalBiasTracker = new BiasTracker();
export const globalROICounter = new ROICounter();

export default { BiasTracker, ROICounter };

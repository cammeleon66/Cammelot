// Cammelot — Simulation Configuration
// Based on CBS/RIVM representative data for the Netherlands

export const SIMULATION_CONFIG = {
  town: {
    name: "Cammelot",
    population: 5000,
    seniorPercentage: 0.20, // 20% seniors (65+)
    annualDeathRateNL: 172000, // deaths/year nationally
    nationalPopulation: 18_000_000,
  },

  // Derived: expected annual deaths in Cammelot
  get expectedAnnualDeaths() {
    return Math.round(
      (this.town.population / this.town.nationalPopulation) *
        this.town.annualDeathRateNL
    );
  },

  // Healthcare infrastructure
  infrastructure: {
    gpPractices: 3, // ~1 per 1700 inhabitants
    hospital: 1,
    pharmacies: 2,
    nursingHome: 1,
  },

  // System failure parameters (IST)
  systemFailure: {
    administrativeBurdenFraction: 0.30, // 30% of GP time
    staffAbsenteeismRate: 0.08, // 8%
    treeknormWeeks: 12, // max acceptable wait in weeks
  },

  // HP Drain mechanics
  hpDrain: {
    baseHP: 100,
    drainPerWeekOverTreeknorm: 3, // HP lost per week beyond Treeknorm
    ghostThreshold: 0, // becomes ghost at 0 HP
    criticalHP: 20, // sprite changes to distressed
  },

  // Simulation timing
  timing: {
    ticksPerDay: 4, // 4 ticks = 1 simulated day
    daysPerWeek: 7,
    cyclesPerRun: 1000, // default research run length
  },

  // Grid dimensions (tile-based)
  grid: {
    width: 64, // tiles
    height: 48, // tiles
    tileSize: 16, // pixels per tile (16-bit SNES standard)
  },

  // Demographics breakdown
  demographics: {
    ageGroups: [
      { label: "0-17", fraction: 0.20 },
      { label: "18-44", fraction: 0.30 },
      { label: "45-64", fraction: 0.30 },
      { label: "65+", fraction: 0.20 },
    ],
    // Common conditions by prevalence in 65+
    seniorConditions: [
      { code: "I25", name: "Chronic Ischemic Heart Disease", prevalence: 0.12 },
      { code: "E11", name: "Type 2 Diabetes", prevalence: 0.18 },
      { code: "J44", name: "COPD", prevalence: 0.10 },
      { code: "M81", name: "Osteoporosis", prevalence: 0.15 },
      { code: "F03", name: "Dementia", prevalence: 0.07 },
    ],
  },
};

export default SIMULATION_CONFIG;

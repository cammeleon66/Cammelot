// CBS/RIVM/NZa Reference Data for the Netherlands
// Authoritative source data for Cammelot simulation parameters

export const CBS_DATA = {
  // National demographics (2024-2025)
  national: {
    population: 18_000_000,
    annualDeaths2024: 172_000,
    lifeExpectancy: { male: 80.5, female: 83.2 },
  },

  // Mortality by age group (CBS 2024, preliminary)
  mortalityByAge: [
    { group: "0-65",  deaths: 21_175, causes: ["External causes", "Neoplasms"] },
    { group: "65-80", deaths: 53_282, causes: ["Cardiovascular", "Neoplasms"] },
    { group: "80+",   deaths: 97_594, causes: ["Dementia", "Heart Failure", "Frailty"] },
  ],

  // Age distribution for population spawning
  ageDistribution: [
    { min: 0,  max: 17, fraction: 0.20, label: "Youth" },
    { min: 18, max: 44, fraction: 0.30, label: "Young Adult" },
    { min: 45, max: 64, fraction: 0.30, label: "Middle Age" },
    { min: 65, max: 79, fraction: 0.13, label: "Senior" },
    { min: 80, max: 99, fraction: 0.07, label: "Elderly" },
  ],

  // Gender split
  genderRatio: { male: 0.49, female: 0.51 },
};

export const RIVM_DATA = {
  // Chronic disease prevalence (RIVM VTV-2024)
  chronicConditions: [
    { code: "M17", name: "Arthrosis",                    prevalenceNL: 1_600_000, seniorPrevalence: 0.25 },
    { code: "E11", name: "Diabetes Mellitus Type 2",     prevalenceNL: 1_200_000, seniorPrevalence: 0.18 },
    { code: "F03", name: "Dementia",                     prevalenceNL: 300_000,   seniorPrevalence: 0.07, ageMin: 65 },
    { code: "J44", name: "COPD",                         prevalenceNL: 600_000,   seniorPrevalence: 0.10 },
    { code: "I25", name: "Chronic Ischemic Heart Disease",prevalenceNL: 800_000,  seniorPrevalence: 0.12 },
    { code: "M81", name: "Osteoporosis",                 prevalenceNL: 500_000,   seniorPrevalence: 0.15 },
    { code: "I50", name: "Heart Failure",                prevalenceNL: 240_000,   seniorPrevalence: 0.08, ageMin: 65 },
    { code: "C34", name: "Lung Cancer",                  prevalenceNL: 70_000,    seniorPrevalence: 0.02, ageMin: 50 },
    { code: "F32", name: "Depression",                   prevalenceNL: 900_000,   seniorPrevalence: 0.05 },
    { code: "I10", name: "Hypertension",                 prevalenceNL: 2_800_000, seniorPrevalence: 0.30 },
  ],

  // Morbidity patterns
  seniorChronicRate: 0.96, // 96% of 75+ has ≥1 chronic condition
  multimorbidityRate: 0.45, // 45% of 75+ has ≥2 conditions

  // Consultation frequency
  consultFrequency: {
    average: 6,     // contacts per year per person
    senior75plus: 16, // contacts per year for 75+
    senior65to74: 10,
  },

  // Annual deaths by cause (psychische stoornissen + zenuwstelsel incl. dementia)
  dementiaDeaths2024: 25_241,

  // Projected chronic disease growth
  projectedChronicSick2050: 12_000_000, // currently 5.7M with ≥2 conditions
};

export const NZA_TARIFFS = {
  year: 2025,

  // GP (Huisarts) tariffs
  gp: {
    shortConsult:    { description: "Kort consult (<5 min)",     euros: 6.21,  minutes: 4  },
    regularConsult:  { description: "Regulier consult (5-20 min)", euros: 12.43, minutes: 12 },
    longConsult:     { description: "Lang consult (>20 min)",    euros: 24.85, minutes: 25 },
    regularVisit:    { description: "Visite regulier (<20 min)", euros: 18.64, minutes: 15 },
    mtvp:            { description: "Meer Tijd voor de Patiënt", eurosPerPatientPerQuarter: 3.23 },
  },

  // Ketenzorg (Multidisciplinary care chains)
  ketenzorg: {
    diabetes:  { code: "DM",  eurosPerQuarter: 63.36 },
    copd:      { code: "COPD", eurosPerQuarter: 50.19 },
    hvz:       { code: "HVZ", eurosPerQuarter: 27.17 },
  },

  // Specialist / Hospital
  specialist: {
    consultation: 150,   // approximate
    hospitalDay:  850,
    erVisit:      265,
    mriScan:      300,
    ctScan:       200,
  },

  // Cost of prevented hospitalization (average)
  preventedHospitalizationSaving: 5_845,
};

export const IZA_DATA = {
  // Integraal Zorgakkoord parameters
  transformationBudget: 2_800_000_000, // €2.8 billion total
  postbusClosingDate: "2025-07-01",
  submittedPlans: 270,
  targetHybridCare2026: 0.70, // 70%
  targetAdminReduction2030: 0.20, // from 30% to 20%

  // Staffing crisis
  staffShortage: {
    2025: { hospitals: 7_800, ggz: 8_600, nursingHomes: 16_100, homeCare: 6_300, total: 66_400 },
    2034: { hospitals: 38_400, ggz: 20_800, nursingHomes: 82_900, homeCare: 25_300, total: 301_000 },
  },

  // Current sick leave
  sickLeaveRate: 0.078, // 7.8%, peaks above 8%

  // Consultation patterns
  consultationMix: {
    spreekuur: 0.74,    // 74% office consultations
    visite: 0.085,      // 8.5% home visits
    telefoon: 0.175,    // 17.5% telephone/admin
  },

  // Referral rate from GP to specialist
  referralRate: 0.04, // only 4% of contacts lead to referral

  // Treeknorm standards
  treeknorm: {
    diagnostics: 4,    // weeks
    outpatient: 4,     // weeks
    treatment: 7,      // weeks
    maxAcceptable: 12, // our simulation threshold
  },

  // Current Treeknorm violations
  violations2025: {
    mriCtExceedingNorm: 0.289,       // 28.9%
    ophthalmologyWeeks: 12,
    neurologyIncreaseSince2022: 0.50, // 50%+
    dermatologyIncrease2024: 0.06,    // +6%
  },
};

export const SOLL_PARAMETERS = {
  // AI-Native future scenario parameters
  adminLoad: 0.05,                   // from 30% to <5%
  aiEfficiencyMultiplier: 1.34,      // E_ai against 2030
  dataAvailability: 0.66,            // from 11% to 66%
  staffFreedByAI: 110_000,           // FTE freed by technology
  acuteAdmissionReduction: 0.32,     // 32% reduction via Digital Twins
  waitTimeReduction: 0.30,           // 30% faster throughput
  hybridCareAdoption: 0.70,
  routineTasksAutomated: 0.50,       // 36-66% of routine tasks
};

export default { CBS_DATA, RIVM_DATA, NZA_TARIFFS, IZA_DATA, SOLL_PARAMETERS };

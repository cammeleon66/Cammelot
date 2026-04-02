// Population Engine — Procedural spawning of 5,000 agents based on CBS/RIVM data

import { randomUUID } from "node:crypto";
import { CBS_DATA, RIVM_DATA } from "../../config/reference_data.js";
import { PatientAgent } from "./patient_agent.js";

// Dutch first names and surnames for procedural generation
const FIRST_NAMES_M = [
  "Jan", "Piet", "Hendrik", "Willem", "Klaas", "Dirk", "Cornelis", "Johannes",
  "Gerrit", "Pieter", "Anton", "Bert", "Frans", "Henk", "Jaap", "Karel",
  "Marcel", "Nico", "Rob", "Theo", "Wim", "Arjen", "Bas", "Dennis",
  "Erik", "Frank", "Guus", "Hans", "Ivo", "Joost", "Lars", "Maarten",
  "Niels", "Oscar", "Paul", "Roel", "Sander", "Tom", "Victor", "Wouter",
];

const FIRST_NAMES_F = [
  "Maria", "Anna", "Johanna", "Cornelia", "Elisabeth", "Wilhelmina", "Geertje",
  "Hendrika", "Jantje", "Pietje", "Anja", "Bettie", "Carla", "Diana",
  "Eva", "Femke", "Grietje", "Hilde", "Ingrid", "Julia", "Katrin", "Linda",
  "Marieke", "Nienke", "Olga", "Petra", "Rita", "Sophie", "Truus", "Vera",
];

const SURNAMES = [
  "de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker",
  "Janssen", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot",
  "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer",
  "de Wit", "Dijkstra", "Smits", "de Graaf", "van der Meer", "van der Linden",
  "Kok", "Jacobs", "de Haan", "Vermeulen", "van den Heuvel", "van der Veen",
  "van den Broek", "de Bruijn", "de Bruin", "van der Heijden", "Schouten",
  "van Beek", "Willems", "van Vliet", "van de Ven", "Hoekstra", "Maas",
  "Verhoeven", "Koster", "van Dam", "van der Wal", "Prins", "Blom", "Huisman",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random birth date based on age distribution.
 */
function generateBirthDate(currentYear = 2026) {
  const rand = Math.random();
  let cumulative = 0;
  let ageMin = 0, ageMax = 99;

  for (const group of CBS_DATA.ageDistribution) {
    cumulative += group.fraction;
    if (rand <= cumulative) {
      ageMin = group.min;
      ageMax = group.max;
      break;
    }
  }

  const age = randomInt(ageMin, ageMax);
  const birthYear = currentYear - age;
  const month = String(randomInt(1, 12)).padStart(2, "0");
  const day = String(randomInt(1, 28)).padStart(2, "0");
  return { birthDate: `${birthYear}-${month}-${day}`, age };
}

/**
 * Assign chronic conditions based on age and RIVM prevalence.
 */
function assignConditions(age) {
  const conditions = [];
  const isSenior = age >= 65;
  const isElderly = age >= 75;

  for (const cond of RIVM_DATA.chronicConditions) {
    // Skip age-gated conditions
    if (cond.ageMin && age < cond.ageMin) continue;

    let probability;
    if (isSenior) {
      probability = cond.seniorPrevalence;
      // Elderly get higher prevalence
      if (isElderly) probability *= 1.3;
    } else {
      // Younger population: scale down from national prevalence
      probability = (cond.prevalenceNL / CBS_DATA.national.population) * 0.5;
    }

    if (Math.random() < probability) {
      const severity = isSenior
        ? pick(["mild", "moderate", "moderate", "severe"])
        : pick(["mild", "mild", "moderate"]);
      conditions.push({ code: cond.code, name: cond.name, severity });
    }
  }

  // Enforce multimorbidity rate for 75+
  if (isElderly && conditions.length < 2 && Math.random() < RIVM_DATA.multimorbidityRate) {
    const available = RIVM_DATA.chronicConditions.filter(
      (c) => !conditions.some((ex) => ex.code === c.code) && (!c.ageMin || age >= c.ageMin)
    );
    if (available.length > 0) {
      const extra = pick(available);
      conditions.push({ code: extra.code, name: extra.name, severity: "mild" });
    }
  }

  return conditions;
}

/**
 * Assign a random home location on the Cammelot grid.
 * Avoids buildings, water, and roads.
 */
function assignHomeLocation() {
  // Residential zones in Cammelot
  const residentialZones = [
    { xMin: 2, xMax: 8, yMin: 10, yMax: 16 },   // West residential
    { xMin: 14, xMax: 20, yMin: 26, yMax: 38 },  // South-west
    { xMin: 36, xMax: 44, yMin: 26, yMax: 36 },  // South-east
    { xMin: 48, xMax: 56, yMin: 26, yMax: 36 },  // East
    { xMin: 18, xMax: 28, yMin: 34, yMax: 38 },  // South
    { xMin: 2, xMax: 10, yMin: 4, yMax: 10 },    // North-west
  ];
  const zone = pick(residentialZones);
  return {
    x: randomInt(zone.xMin, zone.xMax),
    y: randomInt(zone.yMin, zone.yMax),
  };
}

/**
 * Spawn the full population of Cammelot.
 */
export function spawnPopulation(count = 5000, { gpIds = ["gp-de-jong", "gp-bakker", "gp-visser"] } = {}) {
  const citizens = [];
  const stats = {
    total: 0,
    bySex: { male: 0, female: 0 },
    byAgeGroup: {},
    withConditions: 0,
    withMultimorbidity: 0,
    conditions: {},
  };

  for (let i = 0; i < count; i++) {
    const gender = Math.random() < CBS_DATA.genderRatio.male ? "male" : "female";
    const names = gender === "male" ? FIRST_NAMES_M : FIRST_NAMES_F;
    const firstName = pick(names);
    const surname = pick(SURNAMES);
    const name = `${firstName} ${surname}`;

    const { birthDate, age } = generateBirthDate();
    const conditions = assignConditions(age);
    const location = assignHomeLocation();
    const assignedGP = pick(gpIds);

    const id = `patient-${i.toString().padStart(4, "0")}`;

    // Determine initial HP based on age and conditions
    let hp = 100;
    if (age >= 80) hp = randomInt(50, 85);
    else if (age >= 65) hp = randomInt(65, 95);
    else if (conditions.length > 0) hp = randomInt(75, 95);

    // Determine disease state
    let diseaseState = "healthy";
    if (conditions.length > 2) diseaseState = "moderate";
    else if (conditions.length > 0) diseaseState = "mild";

    // Some patients are already waiting for referral
    let referralPending = false;
    let weeksWaiting = 0;
    if (conditions.length > 0 && age >= 65 && Math.random() < 0.15) {
      referralPending = true;
      weeksWaiting = randomInt(1, 16);
    }

    // Track stats
    stats.total++;
    stats.bySex[gender]++;
    const ageGroup = age < 18 ? "0-17" : age < 45 ? "18-44" : age < 65 ? "45-64" : age < 80 ? "65-79" : "80+";
    stats.byAgeGroup[ageGroup] = (stats.byAgeGroup[ageGroup] || 0) + 1;
    if (conditions.length > 0) stats.withConditions++;
    if (conditions.length >= 2) stats.withMultimorbidity++;
    for (const c of conditions) {
      stats.conditions[c.code] = (stats.conditions[c.code] || 0) + 1;
    }

    citizens.push({
      id,
      name,
      birthDate,
      age,
      gender,
      conditions,
      location,
      assignedGP,
      hp,
      diseaseState,
      referralPending,
      weeksWaiting,
    });
  }

  return { citizens, stats };
}

/**
 * Instantiate PatientAgent objects from spawned population data.
 * Use `limit` to control how many full agents to create (memory-intensive).
 */
export function instantiateAgents(citizenData, limit = 100) {
  const agents = [];
  const toInstantiate = citizenData.slice(0, limit);

  for (const data of toInstantiate) {
    const agent = new PatientAgent({
      id: data.id,
      name: data.name,
      birthDate: data.birthDate,
      gender: data.gender,
      conditions: data.conditions,
      location: data.location,
    });

    agent.hp = data.hp;
    agent.diseaseState = data.diseaseState;
    agent.assignedGP = data.assignedGP;
    agent.referralPending = data.referralPending;
    agent.weeksWaiting = data.weeksWaiting;

    agents.push(agent);
  }

  return agents;
}

export default { spawnPopulation, instantiateAgents };

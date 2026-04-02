// FHIR Memory Store — Data Layer for Cammelot
// Every agent action is logged as a FHIR resource (Observation, Condition, Encounter)

import { randomUUID } from "node:crypto";

/**
 * In-memory FHIR-native store. Each agent's actions produce FHIR R4 resources.
 * Queryable by resource type, patient, date range, and code.
 */
export class FHIRMemoryStore {
  constructor() {
    /** @type {Map<string, object>} resourceId → FHIR Resource */
    this.resources = new Map();
    /** @type {Map<string, string[]>} patientId → [resourceId] */
    this.patientIndex = new Map();
    /** @type {Map<string, string[]>} resourceType → [resourceId] */
    this.typeIndex = new Map();
  }

  // --- Resource Creation ---

  createPatient({ id, name, birthDate, gender, address }) {
    const resource = {
      resourceType: "Patient",
      id: id || randomUUID(),
      name: [{ use: "official", text: name }],
      birthDate,
      gender,
      address: address ? [{ text: address, city: "Cammelot" }] : [],
      extension: [
        {
          url: "http://cammelot.sim/fhir/hp",
          valueInteger: 100,
        },
        {
          url: "http://cammelot.sim/fhir/sprite-state",
          valueString: "alive",
        },
      ],
    };
    return this._store(resource);
  }

  createCondition({ patientId, code, display, onsetDate, severity }) {
    const resource = {
      resourceType: "Condition",
      id: randomUUID(),
      subject: { reference: `Patient/${patientId}` },
      code: {
        coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code, display }],
      },
      onsetDateTime: onsetDate || new Date().toISOString(),
      severity: severity
        ? { coding: [{ code: severity, display: severity }] }
        : undefined,
      clinicalStatus: {
        coding: [{ code: "active", display: "Active" }],
      },
    };
    return this._store(resource, patientId);
  }

  createEncounter({ patientId, practitionerId, type, start, end, status }) {
    const resource = {
      resourceType: "Encounter",
      id: randomUUID(),
      subject: { reference: `Patient/${patientId}` },
      participant: practitionerId
        ? [{ individual: { reference: `Practitioner/${practitionerId}` } }]
        : [],
      type: type
        ? [{ coding: [{ code: type, display: type }] }]
        : [],
      period: {
        start: start || new Date().toISOString(),
        end: end || undefined,
      },
      status: status || "planned",
    };
    return this._store(resource, patientId);
  }

  createObservation({ patientId, code, display, value, unit, dateTime }) {
    const resource = {
      resourceType: "Observation",
      id: randomUUID(),
      subject: { reference: `Patient/${patientId}` },
      code: {
        coding: [
          { system: "http://loinc.org", code, display },
        ],
      },
      valueQuantity: value !== undefined ? { value, unit } : undefined,
      effectiveDateTime: dateTime || new Date().toISOString(),
      status: "final",
    };
    return this._store(resource, patientId);
  }

  // --- Wait-time specific observations ---

  logWaitTime({ patientId, weeksWaiting, treeknormWeeks }) {
    return this.createObservation({
      patientId,
      code: "CAMMELOT-WAIT",
      display: "Waiting time for specialist care",
      value: weeksWaiting,
      unit: "weeks",
    });
  }

  logHPChange({ patientId, currentHP, delta, reason }) {
    return this.createObservation({
      patientId,
      code: "CAMMELOT-HP",
      display: `HP change: ${reason}`,
      value: currentHP,
      unit: "HP",
    });
  }

  logGhosting({ patientId }) {
    const patient = this.getResource(patientId);
    if (patient) {
      const hpExt = patient.extension?.find(
        (e) => e.url === "http://cammelot.sim/fhir/sprite-state"
      );
      if (hpExt) hpExt.valueString = "ghost";
    }
    return this.createObservation({
      patientId,
      code: "CAMMELOT-GHOST",
      display: "Patient became ghost (mortality event)",
      value: 0,
      unit: "HP",
    });
  }

  // --- Querying ---

  getResource(id) {
    return this.resources.get(id) || null;
  }

  getPatientResources(patientId) {
    const ids = this.patientIndex.get(patientId) || [];
    return ids.map((id) => this.resources.get(id)).filter(Boolean);
  }

  getByType(resourceType) {
    const ids = this.typeIndex.get(resourceType) || [];
    return ids.map((id) => this.resources.get(id)).filter(Boolean);
  }

  /** Memory Stream: full chronological log for a patient (for cognitive loop) */
  getMemoryStream(patientId) {
    return this.getPatientResources(patientId).sort((a, b) => {
      const dateA =
        a.effectiveDateTime || a.period?.start || a.onsetDateTime || "";
      const dateB =
        b.effectiveDateTime || b.period?.start || b.onsetDateTime || "";
      return dateA.localeCompare(dateB);
    });
  }

  /** Search resources with filters */
  search({ resourceType, patientId, code, fromDate, toDate } = {}) {
    let results = [...this.resources.values()];

    if (resourceType) {
      results = results.filter((r) => r.resourceType === resourceType);
    }
    if (patientId) {
      results = results.filter(
        (r) =>
          r.subject?.reference === `Patient/${patientId}` || r.id === patientId
      );
    }
    if (code) {
      results = results.filter((r) =>
        r.code?.coding?.some((c) => c.code === code)
      );
    }
    if (fromDate) {
      results = results.filter((r) => {
        const d = r.effectiveDateTime || r.period?.start || r.onsetDateTime;
        return d && d >= fromDate;
      });
    }
    if (toDate) {
      results = results.filter((r) => {
        const d = r.effectiveDateTime || r.period?.start || r.onsetDateTime;
        return d && d <= toDate;
      });
    }

    return results;
  }

  /** FHIR Bundle response format */
  searchAsBundle(params) {
    const entries = this.search(params);
    return {
      resourceType: "Bundle",
      type: "searchset",
      total: entries.length,
      entry: entries.map((resource) => ({
        resource,
        fullUrl: `urn:uuid:${resource.id}`,
      })),
    };
  }

  // --- Internal ---

  _store(resource, patientId) {
    this.resources.set(resource.id, resource);

    // Type index
    const type = resource.resourceType;
    if (!this.typeIndex.has(type)) this.typeIndex.set(type, []);
    this.typeIndex.get(type).push(resource.id);

    // Patient index
    const pId =
      patientId ||
      (resource.resourceType === "Patient" ? resource.id : null);
    if (pId) {
      if (!this.patientIndex.has(pId)) this.patientIndex.set(pId, []);
      this.patientIndex.get(pId).push(resource.id);
    }

    return resource;
  }

  /** Stats summary for the simulation dashboard */
  getStats() {
    const patients = this.getByType("Patient");
    const ghosts = patients.filter((p) =>
      p.extension?.some(
        (e) =>
          e.url === "http://cammelot.sim/fhir/sprite-state" &&
          e.valueString === "ghost"
      )
    );
    return {
      totalResources: this.resources.size,
      patients: patients.length,
      ghosts: ghosts.length,
      conditions: this.getByType("Condition").length,
      encounters: this.getByType("Encounter").length,
      observations: this.getByType("Observation").length,
    };
  }
}

// Singleton store for the simulation
export const globalFHIRStore = new FHIRMemoryStore();
export default FHIRMemoryStore;

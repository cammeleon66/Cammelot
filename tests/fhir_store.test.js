// Galahad QA — FHIR Memory Store Integrity Tests
// Regression check: fhir-store-integrity

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { FHIRMemoryStore } from "../src/data_layer/fhir_store.js";

describe("FHIRMemoryStore", () => {
  let store;

  beforeEach(() => {
    store = new FHIRMemoryStore();
  });

  // --- Patient Resource ---

  describe("createPatient", () => {
    it("should create a Patient resource with correct fields", () => {
      const patient = store.createPatient({
        id: "patient-001",
        name: "Hendrik Veenstra",
        birthDate: "1955-03-12",
        gender: "male",
        address: "Dorpstraat 7",
      });
      assert.strictEqual(patient.resourceType, "Patient");
      assert.strictEqual(patient.id, "patient-001");
      assert.strictEqual(patient.name[0].text, "Hendrik Veenstra");
      assert.strictEqual(patient.birthDate, "1955-03-12");
      assert.strictEqual(patient.gender, "male");
      assert.strictEqual(patient.address[0].city, "Cammelot");
    });

    it("should initialize HP extension to 100", () => {
      const patient = store.createPatient({ id: "p1", name: "Test" });
      const hpExt = patient.extension.find(
        (e) => e.url === "http://cammelot.sim/fhir/hp"
      );
      assert.ok(hpExt, "HP extension must exist");
      assert.strictEqual(hpExt.valueInteger, 100);
    });

    it("should initialize sprite-state extension to 'alive'", () => {
      const patient = store.createPatient({ id: "p2", name: "Test" });
      const spriteExt = patient.extension.find(
        (e) => e.url === "http://cammelot.sim/fhir/sprite-state"
      );
      assert.ok(spriteExt, "Sprite-state extension must exist");
      assert.strictEqual(spriteExt.valueString, "alive");
    });

    it("should auto-generate an id when none provided", () => {
      const patient = store.createPatient({ name: "Auto ID" });
      assert.ok(patient.id, "Patient id must be auto-generated");
      assert.ok(patient.id.length > 0);
    });
  });

  // --- Condition Resource ---

  describe("createCondition", () => {
    it("should create a Condition linked to a patient", () => {
      store.createPatient({ id: "p-cond", name: "Cond Patient" });
      const condition = store.createCondition({
        patientId: "p-cond",
        code: "I25",
        display: "Chronic Ischemic Heart Disease",
        severity: "moderate",
      });
      assert.strictEqual(condition.resourceType, "Condition");
      assert.strictEqual(condition.subject.reference, "Patient/p-cond");
      assert.strictEqual(condition.code.coding[0].code, "I25");
      assert.strictEqual(condition.clinicalStatus.coding[0].code, "active");
    });
  });

  // --- Encounter Resource ---

  describe("createEncounter", () => {
    it("should create an Encounter with practitioner reference", () => {
      store.createPatient({ id: "p-enc", name: "Enc Patient" });
      const encounter = store.createEncounter({
        patientId: "p-enc",
        practitionerId: "gp-de-jong",
        type: "consultation",
        status: "in-progress",
      });
      assert.strictEqual(encounter.resourceType, "Encounter");
      assert.strictEqual(encounter.subject.reference, "Patient/p-enc");
      assert.strictEqual(
        encounter.participant[0].individual.reference,
        "Practitioner/gp-de-jong"
      );
      assert.strictEqual(encounter.status, "in-progress");
    });
  });

  // --- Observation Resource ---

  describe("createObservation", () => {
    it("should create an Observation with value and unit", () => {
      store.createPatient({ id: "p-obs", name: "Obs Patient" });
      const obs = store.createObservation({
        patientId: "p-obs",
        code: "CAMMELOT-HP",
        display: "HP reading",
        value: 82,
        unit: "HP",
      });
      assert.strictEqual(obs.resourceType, "Observation");
      assert.strictEqual(obs.valueQuantity.value, 82);
      assert.strictEqual(obs.valueQuantity.unit, "HP");
      assert.strictEqual(obs.status, "final");
    });
  });

  // --- Querying ---

  describe("querying", () => {
    beforeEach(() => {
      store.createPatient({ id: "qp1", name: "Query Patient 1" });
      store.createPatient({ id: "qp2", name: "Query Patient 2" });
      store.createCondition({ patientId: "qp1", code: "I25", display: "Heart" });
      store.createObservation({ patientId: "qp1", code: "CAMMELOT-HP", display: "HP", value: 80, unit: "HP" });
      store.createObservation({ patientId: "qp2", code: "CAMMELOT-WAIT", display: "Wait", value: 14, unit: "weeks" });
    });

    it("should retrieve a resource by id", () => {
      const p = store.getResource("qp1");
      assert.ok(p);
      assert.strictEqual(p.id, "qp1");
    });

    it("should return null for unknown id", () => {
      assert.strictEqual(store.getResource("nonexistent"), null);
    });

    it("should retrieve all resources for a patient", () => {
      const resources = store.getPatientResources("qp1");
      assert.ok(resources.length >= 2, "Patient qp1 should have patient + condition + observation");
    });

    it("should retrieve resources by type", () => {
      const patients = store.getByType("Patient");
      assert.strictEqual(patients.length, 2);
      const conditions = store.getByType("Condition");
      assert.strictEqual(conditions.length, 1);
    });

    it("should search by resourceType and code", () => {
      const hpObs = store.search({ resourceType: "Observation", code: "CAMMELOT-HP" });
      assert.strictEqual(hpObs.length, 1);
      assert.strictEqual(hpObs[0].valueQuantity.value, 80);
    });

    it("should search by patientId", () => {
      const results = store.search({ patientId: "qp2" });
      // qp2 has the patient resource itself + 1 observation
      assert.ok(results.length >= 1);
    });

    it("should return a FHIR Bundle via searchAsBundle", () => {
      const bundle = store.searchAsBundle({ resourceType: "Patient" });
      assert.strictEqual(bundle.resourceType, "Bundle");
      assert.strictEqual(bundle.type, "searchset");
      assert.strictEqual(bundle.total, 2);
      assert.strictEqual(bundle.entry.length, 2);
    });
  });

  // --- Memory Stream ---

  describe("getMemoryStream", () => {
    it("should return chronologically sorted resources for a patient", () => {
      store.createPatient({ id: "ms-p", name: "Stream Patient" });
      store.createObservation({
        patientId: "ms-p", code: "CAMMELOT-HP", display: "HP",
        value: 90, unit: "HP", dateTime: "2026-01-02T00:00:00Z",
      });
      store.createObservation({
        patientId: "ms-p", code: "CAMMELOT-HP", display: "HP",
        value: 70, unit: "HP", dateTime: "2026-01-01T00:00:00Z",
      });
      const stream = store.getMemoryStream("ms-p");
      // The observation with dateTime 2026-01-01 should come before 2026-01-02
      const obs = stream.filter((r) => r.resourceType === "Observation");
      assert.ok(obs.length >= 2);
      assert.ok(obs[0].effectiveDateTime <= obs[1].effectiveDateTime);
    });
  });

  // --- Stats ---

  describe("getStats", () => {
    it("should return accurate aggregate statistics", () => {
      store.createPatient({ id: "st1", name: "Stat1" });
      store.createPatient({ id: "st2", name: "Stat2" });
      store.createCondition({ patientId: "st1", code: "E11", display: "Diabetes" });
      const stats = store.getStats();
      assert.strictEqual(stats.patients, 2);
      assert.strictEqual(stats.conditions, 1);
      assert.strictEqual(stats.ghosts, 0);
    });
  });

  // --- Ghosting ---

  describe("logGhosting", () => {
    it("should mark patient sprite-state as ghost", () => {
      store.createPatient({ id: "ghost-p", name: "Ghost Patient" });
      store.logGhosting({ patientId: "ghost-p" });
      const patient = store.getResource("ghost-p");
      const spriteExt = patient.extension.find(
        (e) => e.url === "http://cammelot.sim/fhir/sprite-state"
      );
      assert.strictEqual(spriteExt.valueString, "ghost");
    });
  });
});

// Galahad QA — Agent Cognitive Loop Tests
// Regression check: agent-cognitive-loop

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { CammelotAgent } from "../src/agents/cognitive_loop.js";
import { FHIRMemoryStore } from "../src/data_layer/fhir_store.js";
import { A2AMessageBus } from "../src/communication/a2a_protocol.js";

// We construct fresh agents pointing at the global singletons.
// The cognitive_loop module uses globalFHIRStore and globalMessageBus internally.

describe("CammelotAgent — Cognitive Loop", () => {
  let agent;

  beforeEach(() => {
    agent = new CammelotAgent({
      id: `agent-test-${Date.now()}`,
      name: "Test Agent",
      role: "patient",
      skills: ["self_care"],
      location: { x: 5, y: 10 },
      personality: { anxious: true },
    });
  });

  // --- Instantiation ---

  describe("instantiation", () => {
    it("should set basic agent properties", () => {
      assert.ok(agent.id.startsWith("agent-test-"));
      assert.strictEqual(agent.name, "Test Agent");
      assert.strictEqual(agent.role, "patient");
      assert.deepStrictEqual(agent.skills, ["self_care"]);
      assert.deepStrictEqual(agent.location, { x: 5, y: 10 });
    });

    it("should initialize tick counter at 0", () => {
      assert.strictEqual(agent.tickCount, 0);
    });

    it("should start with empty plan and reflections", () => {
      assert.deepStrictEqual(agent.currentPlan, []);
      assert.deepStrictEqual(agent.reflections, []);
    });

    it("should register an AgentCard with the message bus", () => {
      assert.ok(agent.agentCard, "Agent must have an AgentCard");
      assert.strictEqual(agent.agentCard.agentId, agent.id);
      assert.strictEqual(agent.agentCard.role, "patient");
    });
  });

  // --- Cognitive Loop: tick() ---

  describe("tick()", () => {
    it("should increment tickCount on each tick", () => {
      agent.tick();
      assert.strictEqual(agent.tickCount, 1);
      agent.tick();
      assert.strictEqual(agent.tickCount, 2);
    });

    it("should return an object with tick, plan, and reflections", () => {
      const result = agent.tick();
      assert.ok("tick" in result, "Result must have tick");
      assert.ok("plan" in result, "Result must have plan");
      assert.ok("reflections" in result, "Result must have reflections");
      assert.strictEqual(result.tick, 1);
      assert.ok(Array.isArray(result.plan));
    });

    it("should follow Memory → Reflect → Plan → Execute order", () => {
      // tick() calls plan() which calls reflect() internally.
      // reflect() accesses memory via getRecentImportantMemories().
      // We verify the chain produces a valid plan.
      const result = agent.tick();
      assert.ok(result.plan.length >= 1, "Plan must contain at least one action");
      // Default (no important memories) → "routine_wait"
      assert.strictEqual(result.plan[0].action, "routine_wait");
    });
  });

  // --- Memory Stream ---

  describe("getMemoryStream()", () => {
    it("should return an array (possibly empty for new agent)", () => {
      const stream = agent.getMemoryStream();
      assert.ok(Array.isArray(stream));
    });
  });

  // --- Importance Scoring ---

  describe("scoreImportance()", () => {
    it("should score Condition resources high (8)", () => {
      const score = agent.scoreImportance({ resourceType: "Condition" });
      assert.strictEqual(score, 8);
    });

    it("should score Encounter resources medium (5)", () => {
      const score = agent.scoreImportance({ resourceType: "Encounter" });
      assert.strictEqual(score, 5);
    });

    it("should score CAMMELOT-GHOST events at maximum (10)", () => {
      const score = agent.scoreImportance({
        resourceType: "Observation",
        code: { coding: [{ code: "CAMMELOT-GHOST" }] },
      });
      assert.strictEqual(score, 10);
    });

    it("should boost HP-related observations", () => {
      const score = agent.scoreImportance({
        resourceType: "Observation",
        code: { coding: [{ code: "CAMMELOT-HP" }] },
      });
      assert.ok(score >= 5, "HP observation should score >= 5");
    });
  });

  // --- Reflection ---

  describe("reflect()", () => {
    it("should return an array of reflections (empty when no important memories)", () => {
      const reflections = agent.reflect();
      assert.ok(Array.isArray(reflections));
    });
  });

  // --- Planning ---

  describe("plan()", () => {
    it("should return at least a routine_wait plan when no reflections", () => {
      const plan = agent.plan();
      assert.ok(plan.length >= 1);
      assert.strictEqual(plan[0].action, "routine_wait");
      assert.strictEqual(plan[0].priority, "low");
    });
  });

  // --- Serialization ---

  describe("toJSON()", () => {
    it("should serialize agent state to JSON-compatible object", () => {
      agent.tick();
      const json = agent.toJSON();
      assert.strictEqual(json.id, agent.id);
      assert.strictEqual(json.name, "Test Agent");
      assert.strictEqual(json.role, "patient");
      assert.strictEqual(json.tickCount, 1);
      assert.ok("agentCard" in json);
      assert.strictEqual(json.agentCard["@context"], "https://a2a-protocol.org/context");
    });
  });
});

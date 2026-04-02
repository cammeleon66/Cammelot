// Galahad QA — A2A Protocol Contract Tests
// Regression check: a2a-protocol-contracts

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  AgentCard,
  A2AMessage,
  A2AMessageBus,
} from "../src/communication/a2a_protocol.js";

describe("A2A Protocol", () => {
  // --- AgentCard ---

  describe("AgentCard", () => {
    it("should create a card with required fields", () => {
      const card = new AgentCard({
        agentId: "gp-de-jong",
        name: "Dr. de Jong",
        role: "gp",
        skills: ["triage", "referral"],
        location: { x: 12, y: 20 },
      });
      assert.strictEqual(card.agentId, "gp-de-jong");
      assert.strictEqual(card.name, "Dr. de Jong");
      assert.strictEqual(card.role, "gp");
      assert.deepStrictEqual(card.skills, ["triage", "referral"]);
      assert.strictEqual(card.status, "available");
    });

    it("should auto-generate agentId when not provided", () => {
      const card = new AgentCard({ name: "Auto Agent", role: "specialist" });
      assert.ok(card.agentId, "agentId must be auto-generated");
      assert.ok(card.agentId.length > 0);
    });

    it("should serialize to A2A JSON with @context", () => {
      const card = new AgentCard({
        agentId: "spec-cardio",
        name: "Dr. van den Berg",
        role: "specialist",
        skills: ["cardiology"],
        location: { x: 46, y: 8 },
      });
      const json = card.toJSON();
      assert.strictEqual(json["@context"], "https://a2a-protocol.org/context");
      assert.strictEqual(json.agentId, "spec-cardio");
      assert.ok(json.waitTime, "waitTime must be present");
      assert.strictEqual(json.waitTime.weeks, 0);
      assert.ok(json.metadata, "metadata must be present");
      assert.strictEqual(json.metadata.treeknorm_status, "compliant");
      assert.ok(json.endpoint.includes("spec-cardio"));
    });

    it("should update wait time correctly", () => {
      const card = new AgentCard({ agentId: "spec-test", name: "Spec", role: "specialist" });
      card.updateWaitTime(14, 28);
      assert.strictEqual(card.currentWaitWeeks, 14);
      assert.strictEqual(card.queueSize, 28);
      const json = card.toJSON();
      assert.strictEqual(json.waitTime.weeks, 14);
      assert.strictEqual(json.metadata.treeknorm_status, "exceeded");
    });
  });

  // --- A2AMessage ---

  describe("A2AMessage", () => {
    it("should create a message with auto-generated id and timestamp", () => {
      const msg = new A2AMessage({
        from: "gp-de-jong",
        to: "spec-cardio",
        type: "referral",
        content: { patientId: "patient-001", conditionCode: "I25" },
      });
      assert.ok(msg.id, "Message id must be auto-generated");
      assert.strictEqual(msg.from, "gp-de-jong");
      assert.strictEqual(msg.to, "spec-cardio");
      assert.strictEqual(msg.type, "referral");
      assert.strictEqual(msg.status, "pending");
      assert.ok(msg.timestamp);
    });
  });

  // --- A2AMessageBus ---

  describe("A2AMessageBus", () => {
    let bus;

    beforeEach(() => {
      bus = new A2AMessageBus();
    });

    describe("registration", () => {
      it("should register an agent and retrieve its card", () => {
        const card = new AgentCard({ agentId: "gp-reg", name: "GP Reg", role: "gp" });
        bus.registerAgent(card);
        const retrieved = bus.getAgentCard("gp-reg");
        assert.ok(retrieved);
        assert.strictEqual(retrieved.agentId, "gp-reg");
      });

      it("should return null for unregistered agent", () => {
        assert.strictEqual(bus.getAgentCard("nonexistent"), null);
      });

      it("should unregister an agent", () => {
        const card = new AgentCard({ agentId: "gp-unreg", name: "GP", role: "gp" });
        bus.registerAgent(card);
        bus.unregisterAgent("gp-unreg");
        assert.strictEqual(bus.getAgentCard("gp-unreg"), null);
      });
    });

    describe("discovery", () => {
      beforeEach(() => {
        bus.registerAgent(new AgentCard({ agentId: "gp-1", name: "GP 1", role: "gp", skills: ["triage"] }));
        bus.registerAgent(new AgentCard({ agentId: "gp-2", name: "GP 2", role: "gp", skills: ["triage", "referral"] }));
        bus.registerAgent(new AgentCard({ agentId: "spec-1", name: "Spec 1", role: "specialist", skills: ["cardiology"] }));
      });

      it("should discover agents by role", () => {
        const gps = bus.discoverAgents({ role: "gp" });
        assert.strictEqual(gps.length, 2);
      });

      it("should discover agents by skill", () => {
        const referrers = bus.discoverAgents({ skill: "referral" });
        assert.strictEqual(referrers.length, 1);
        assert.strictEqual(referrers[0].agentId, "gp-2");
      });

      it("should find best specialist (shortest wait)", () => {
        const card = bus.registry.get("spec-1");
        card.updateWaitTime(6, 10);
        const best = bus.findBestSpecialist("cardiology");
        assert.ok(best);
        assert.strictEqual(best.agentId, "spec-1");
      });
    });

    describe("messaging", () => {
      beforeEach(() => {
        bus.registerAgent(new AgentCard({ agentId: "sender", name: "Sender", role: "gp" }));
        bus.registerAgent(new AgentCard({ agentId: "receiver", name: "Receiver", role: "specialist" }));
      });

      it("should route a message to the recipient inbox", () => {
        const msg = new A2AMessage({
          from: "sender",
          to: "receiver",
          type: "referral",
          content: { patientId: "p1" },
        });
        bus.sendMessage(msg);
        const inbox = bus.getInbox("receiver");
        assert.strictEqual(inbox.length, 1);
        assert.strictEqual(inbox[0].type, "referral");
        assert.strictEqual(inbox[0].status, "delivered");
      });

      it("should notify subscribers on message delivery", () => {
        let notified = false;
        bus.subscribe("receiver", (msg) => {
          notified = true;
          assert.strictEqual(msg.type, "alert");
        });
        bus.sendMessage(
          new A2AMessage({ from: "sender", to: "receiver", type: "alert", content: {} })
        );
        assert.ok(notified, "Subscriber must be notified");
      });

      it("should send referral with correct lifecycle fields", () => {
        const msg = bus.sendReferral({
          fromAgentId: "sender",
          toAgentId: "receiver",
          patientId: "p-ref",
          conditionCode: "I25",
          urgency: "urgent",
        });
        assert.strictEqual(msg.type, "referral");
        assert.strictEqual(msg.content.urgency, "urgent");
        assert.strictEqual(msg.content.conditionCode, "I25");
        assert.strictEqual(msg.status, "delivered");
      });

      it("should create dialogue (speech bubble) messages", () => {
        const msg = bus.createDialogue({
          fromAgentId: "sender",
          toAgentId: "receiver",
          text: "Wait time is 12 weeks; I cannot refer you yet",
        });
        assert.strictEqual(msg.type, "dialogue");
        assert.strictEqual(msg.content.displayAs, "speech_bubble");
        assert.ok(msg.content.text.includes("12 weeks"));
      });
    });

    describe("message log", () => {
      beforeEach(() => {
        bus.registerAgent(new AgentCard({ agentId: "a1", name: "A1", role: "gp" }));
        bus.registerAgent(new AgentCard({ agentId: "a2", name: "A2", role: "specialist" }));
        bus.sendMessage(new A2AMessage({ from: "a1", to: "a2", type: "referral", content: {} }));
        bus.sendMessage(new A2AMessage({ from: "a2", to: "a1", type: "response", content: {} }));
        bus.sendMessage(new A2AMessage({ from: "a1", to: "a2", type: "dialogue", content: {} }));
      });

      it("should filter message log by type", () => {
        const referrals = bus.getMessageLog({ type: "referral" });
        assert.strictEqual(referrals.length, 1);
      });

      it("should filter message log by sender", () => {
        const fromA1 = bus.getMessageLog({ fromAgent: "a1" });
        assert.strictEqual(fromA1.length, 2);
      });
    });
  });
});

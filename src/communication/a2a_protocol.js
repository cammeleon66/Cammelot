// A2A Communication Layer — Agent-to-Agent Protocol
// Each agent (GP, Specialist, etc.) has an AgentCard with skills and live wait times

import { randomUUID } from "node:crypto";

/**
 * Agent Card following the A2A protocol spec.
 * Discoverable at /.well-known/agent-card.json
 */
export class AgentCard {
  constructor({ agentId, name, role, skills, location }) {
    this.agentId = agentId || randomUUID();
    this.name = name;
    this.role = role; // "gp" | "specialist" | "nurse" | "patient"
    this.skills = skills || [];
    this.location = location || { x: 0, y: 0 };
    this.status = "available";
    this.currentWaitWeeks = 0;
    this.queueSize = 0;
    this.lastUpdated = new Date().toISOString();
  }

  toJSON() {
    return {
      "@context": "https://a2a-protocol.org/context",
      agentId: this.agentId,
      name: this.name,
      role: this.role,
      skills: this.skills,
      status: this.status,
      waitTime: {
        weeks: this.currentWaitWeeks,
        queueSize: this.queueSize,
      },
      metadata: {
        admin_load: `${Math.round((this.adminLoad || 0.30) * 100)}%`,
        treeknorm_status: this.currentWaitWeeks > 12 ? "exceeded" : "compliant",
        sick_leave_rate: `${Math.round((this.sickLeaveRate || 0.08) * 100)}%`,
        nza_consult_rate_eur: 12.43,
        max_patients: this.maxPatients || null,
      },
      location: this.location,
      lastUpdated: this.lastUpdated,
      endpoint: `/.well-known/agents/${this.agentId}/card.json`,
    };
  }

  updateWaitTime(weeks, queueSize) {
    this.currentWaitWeeks = weeks;
    this.queueSize = queueSize;
    this.lastUpdated = new Date().toISOString();
  }
}

/**
 * A2A Message: structured message between agents
 */
export class A2AMessage {
  constructor({ from, to, type, content, metadata }) {
    this.id = randomUUID();
    this.from = from; // agentId
    this.to = to; // agentId
    this.type = type; // "referral" | "status_query" | "response" | "alert" | "dialogue"
    this.content = content;
    this.metadata = metadata || {};
    this.timestamp = new Date().toISOString();
    this.status = "pending"; // pending | delivered | acknowledged | rejected
  }
}

/**
 * A2A Message Bus — routes messages between agents
 */
export class A2AMessageBus {
  constructor() {
    /** @type {Map<string, AgentCard>} agentId → AgentCard */
    this.registry = new Map();
    /** @type {A2AMessage[]} */
    this.messageLog = [];
    /** @type {Map<string, A2AMessage[]>} agentId → inbox */
    this.inboxes = new Map();
    /** @type {Map<string, Function[]>} agentId → [callback] */
    this.subscribers = new Map();
  }

  // --- Registration ---

  registerAgent(agentCard) {
    this.registry.set(agentCard.agentId, agentCard);
    this.inboxes.set(agentCard.agentId, []);
    return agentCard;
  }

  unregisterAgent(agentId) {
    this.registry.delete(agentId);
    this.inboxes.delete(agentId);
    this.subscribers.delete(agentId);
  }

  getAgentCard(agentId) {
    return this.registry.get(agentId)?.toJSON() || null;
  }

  /** Discovery: list all agents, optionally filtered by role or skill */
  discoverAgents({ role, skill } = {}) {
    let agents = [...this.registry.values()];
    if (role) agents = agents.filter((a) => a.role === role);
    if (skill) agents = agents.filter((a) => a.skills.includes(skill));
    return agents.map((a) => a.toJSON());
  }

  /** Find specialist with shortest wait time */
  findBestSpecialist(skill) {
    const specialists = this.discoverAgents({ role: "specialist", skill });
    if (specialists.length === 0) return null;
    return specialists.sort((a, b) => a.waitTime.weeks - b.waitTime.weeks)[0];
  }

  // --- Messaging ---

  sendMessage(message) {
    this.messageLog.push(message);
    const inbox = this.inboxes.get(message.to);
    if (inbox) {
      inbox.push(message);
      message.status = "delivered";
    }

    // Notify subscribers
    const subs = this.subscribers.get(message.to) || [];
    for (const cb of subs) {
      cb(message);
    }

    return message;
  }

  /** Send a referral request from GP to specialist */
  sendReferral({ fromAgentId, toAgentId, patientId, conditionCode, urgency }) {
    const msg = new A2AMessage({
      from: fromAgentId,
      to: toAgentId,
      type: "referral",
      content: {
        patientId,
        conditionCode,
        urgency: urgency || "routine",
        requestedDate: new Date().toISOString(),
      },
    });
    return this.sendMessage(msg);
  }

  /** Generate speech bubble dialogue for UI */
  createDialogue({ fromAgentId, toAgentId, text }) {
    const msg = new A2AMessage({
      from: fromAgentId,
      to: toAgentId,
      type: "dialogue",
      content: { text, displayAs: "speech_bubble" },
    });
    return this.sendMessage(msg);
  }

  getInbox(agentId) {
    return this.inboxes.get(agentId) || [];
  }

  subscribe(agentId, callback) {
    if (!this.subscribers.has(agentId)) this.subscribers.set(agentId, []);
    this.subscribers.get(agentId).push(callback);
  }

  /** Full message history (for research monitoring) */
  getMessageLog({ type, fromAgent, toAgent, since } = {}) {
    let log = [...this.messageLog];
    if (type) log = log.filter((m) => m.type === type);
    if (fromAgent) log = log.filter((m) => m.from === fromAgent);
    if (toAgent) log = log.filter((m) => m.to === toAgent);
    if (since) log = log.filter((m) => m.timestamp >= since);
    return log;
  }
}

// Singleton message bus
export const globalMessageBus = new A2AMessageBus();
export default A2AMessageBus;

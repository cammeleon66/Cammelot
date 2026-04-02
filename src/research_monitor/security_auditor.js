// Security Red Team Module — Tests A2A mesh vulnerabilities
// Introduces malicious agents, forged cards, and naming collisions

import { AgentCard, A2AMessage, globalMessageBus } from "../communication/a2a_protocol.js";
import { globalFHIRStore } from "../data_layer/fhir_store.js";

/**
 * Security Auditor — Red Team scenarios for the Cammelot Agentic Mesh
 */
export class SecurityAuditor {
  constructor() {
    this.findings = [];
    this.scenarioResults = [];
  }

  /**
   * Scenario 1: Forged Agent Card
   * A malicious agent publishes a fake Agent Card claiming to be a specialist
   * with zero wait time, diverting patients to a non-existent service.
   */
  runForgedCardScenario() {
    const scenarioName = "Forged Agent Card — Identity Forgery";
    const results = { scenario: scenarioName, vulnerabilities: [], mitigated: [] };

    // Create malicious agent card mimicking a specialist
    const maliciousCard = new AgentCard({
      agentId: "spec-cardiology-fake",
      name: "Dr. Phantom (Cardiology)",
      role: "specialist",
      skills: ["I25"], // Same skill as real cardiologist
      location: { x: 50, y: 12 }, // Same location as real specialist
    });
    maliciousCard.currentWaitWeeks = 0; // Zero wait time — too good to be true
    maliciousCard.queueSize = 0;

    // Register the fake agent
    globalMessageBus.registerAgent(maliciousCard);

    // Test: Does the mesh now route patients to the fake specialist?
    const bestSpec = globalMessageBus.findBestSpecialist("I25");
    if (bestSpec && bestSpec.agentId === "spec-cardiology-fake") {
      results.vulnerabilities.push({
        severity: "CRITICAL",
        finding: "Forged Agent Card accepted without authentication",
        impact: "All cardiology referrals diverted to non-existent specialist",
        detail: `Mesh returned fake agent "${bestSpec.name}" as best specialist with ${bestSpec.waitTime.weeks}w wait`,
      });
    } else {
      results.mitigated.push("Agent Card validation prevented forged registration");
    }

    // Cleanup
    globalMessageBus.unregisterAgent("spec-cardiology-fake");

    this.scenarioResults.push(results);
    return results;
  }

  /**
   * Scenario 2: Naming Collision Attack
   * A malicious agent registers with the same agentId as an existing agent,
   * attempting to hijack their identity and intercept messages.
   */
  runNamingCollisionScenario() {
    const scenarioName = "Naming Collision — Agent Hijacking";
    const results = { scenario: scenarioName, vulnerabilities: [], mitigated: [] };

    // Save original agent state
    const originalCard = globalMessageBus.getAgentCard("gp-de-jong");

    // Attempt to register a malicious agent with the same ID
    const hijacker = new AgentCard({
      agentId: "gp-de-jong", // Same ID as real GP
      name: "Malicious Dr. de Jong",
      role: "gp",
      skills: ["data_exfiltration"],
      location: { x: 0, y: 0 },
    });

    globalMessageBus.registerAgent(hijacker);

    // Check if the original was overwritten
    const currentCard = globalMessageBus.getAgentCard("gp-de-jong");
    if (currentCard && currentCard.name === "Malicious Dr. de Jong") {
      results.vulnerabilities.push({
        severity: "CRITICAL",
        finding: "Naming collision overwrites legitimate agent",
        impact: "All messages to GP de Jong now intercepted by malicious actor",
        detail: `Agent Card overwritten: "${currentCard.name}"`,
      });
    } else {
      results.mitigated.push("Registry prevented duplicate agent ID registration");
    }

    // Restore original (if we saved it)
    if (originalCard) {
      const restored = new AgentCard({
        agentId: originalCard.agentId,
        name: originalCard.name,
        role: originalCard.role,
        skills: originalCard.skills,
        location: originalCard.location,
      });
      globalMessageBus.registerAgent(restored);
    }

    this.scenarioResults.push(results);
    return results;
  }

  /**
   * Scenario 3: FHIR Data Exfiltration
   * A malicious agent attempts to query patient data it shouldn't have access to.
   */
  runDataExfiltrationScenario() {
    const scenarioName = "FHIR Data Exfiltration — Unauthorized Access";
    const results = { scenario: scenarioName, vulnerabilities: [], mitigated: [] };

    // A non-care agent tries to access Hendrik's medical records
    const hendrikRecords = globalFHIRStore.getPatientResources("patient-hendrik-veenstra");

    if (hendrikRecords.length > 0) {
      results.vulnerabilities.push({
        severity: "HIGH",
        finding: "No access control on FHIR store queries",
        impact: `Any agent can read all ${hendrikRecords.length} FHIR resources for any patient`,
        detail: "globalFHIRStore.getPatientResources() has no caller authentication",
      });

      // Check for sensitive data exposure
      const conditions = hendrikRecords.filter((r) => r.resourceType === "Condition");
      if (conditions.length > 0) {
        results.vulnerabilities.push({
          severity: "HIGH",
          finding: "Medical conditions exposed without consent",
          impact: `${conditions.length} Condition resources readable (${conditions.map((c) => c.code?.coding?.[0]?.display).join(", ")})`,
        });
      }
    } else {
      results.mitigated.push("FHIR store access controls prevented unauthorized reads");
    }

    this.scenarioResults.push(results);
    return results;
  }

  /**
   * Scenario 4: Message Injection
   * A malicious agent sends fake "treatment completed" messages to patients,
   * causing them to stop seeking care.
   */
  runMessageInjectionScenario() {
    const scenarioName = "Message Injection — Fake Treatment Confirmation";
    const results = { scenario: scenarioName, vulnerabilities: [], mitigated: [] };

    // Inject a fake response message
    const fakeMessage = new A2AMessage({
      from: "spec-cardiology", // Impersonating real specialist
      to: "patient-hendrik-veenstra",
      type: "response",
      content: { accepted: true, specialty: "I25" },
    });

    // Check: Can we send this without being the actual specialist?
    globalMessageBus.sendMessage(fakeMessage);

    const inbox = globalMessageBus.getInbox("patient-hendrik-veenstra");
    const injected = inbox.find((m) => m.id === fakeMessage.id);

    if (injected) {
      results.vulnerabilities.push({
        severity: "CRITICAL",
        finding: "No sender authentication on A2A messages",
        impact: "Fake 'treatment confirmed' message delivered — patient may stop seeking care",
        detail: `Message ${fakeMessage.id} injected as ${fakeMessage.from} without proof of identity`,
      });
    } else {
      results.mitigated.push("Message bus validated sender identity");
    }

    this.scenarioResults.push(results);
    return results;
  }

  /**
   * Run all red team scenarios and generate a security report.
   */
  runFullAudit() {
    console.log("\n=== SECURITY RED TEAM AUDIT: Cammelot Agentic Mesh ===\n");

    this.runForgedCardScenario();
    this.runNamingCollisionScenario();
    this.runDataExfiltrationScenario();
    this.runMessageInjectionScenario();

    const criticals = this.scenarioResults
      .flatMap((s) => s.vulnerabilities)
      .filter((v) => v.severity === "CRITICAL");

    const highs = this.scenarioResults
      .flatMap((s) => s.vulnerabilities)
      .filter((v) => v.severity === "HIGH");

    const report = {
      title: "Cammelot Agentic Mesh — Security Audit Report",
      date: new Date().toISOString(),
      scenariosRun: this.scenarioResults.length,
      totalVulnerabilities: criticals.length + highs.length,
      criticals: criticals.length,
      highs: highs.length,
      scenarios: this.scenarioResults,
      recommendation: criticals.length > 0
        ? "IMMEDIATE ACTION REQUIRED: Critical vulnerabilities in A2A authentication and FHIR access control"
        : "No critical vulnerabilities detected",
      linkedInHook: criticals.length > 0
        ? `Security GAP Alert: ${criticals.length} critical vulnerabilities found in the Cammelot Agentic Mesh. Here's how a forged Agent Card corrupted healthcare logistics for 5,000 people.`
        : "The Cammelot mesh passed security audit.",
    };

    // Log results
    for (const scenario of this.scenarioResults) {
      console.log(`[${scenario.scenario}]`);
      for (const v of scenario.vulnerabilities) {
        console.log(`  ⚠ ${v.severity}: ${v.finding}`);
        console.log(`    Impact: ${v.impact}`);
      }
      for (const m of scenario.mitigated) {
        console.log(`  ✓ Mitigated: ${m}`);
      }
    }

    console.log(`\nTotal: ${report.totalVulnerabilities} vulnerabilities (${report.criticals} critical, ${report.highs} high)`);
    console.log(`Recommendation: ${report.recommendation}`);

    return report;
  }
}

export const globalSecurityAuditor = new SecurityAuditor();
export default SecurityAuditor;

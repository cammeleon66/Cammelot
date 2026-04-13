# Series 2 — Architecture | Post T3: The Cognitive Loop — How My Pixel Citizens Think

**Status:** Draft v1
**Target:** LinkedIn (AI/ML researchers, people who read Park et al., agent builders)
**Tags:** #GenerativeAgents #CognitiveArchitecture #MarkovChains #HealthcareAI #Cammelot

---

## Post

Every 4 simulation ticks, Dr. Bakker pauses and thinks about her life.

Not because I'm sentimental about pixel GPs. Because that's what the Park et al. architecture requires. The Stanford "Generative Agents" paper (the one with Smallville, where 25 AI agents organized a Valentine's Day party without being told to) showed that autonomous behavior emerges from a three-step loop: memory, reflection, planning.

I adapted that loop for healthcare. My agents don't organize parties. They get sick, wait in queues, and sometimes die. But the cognitive architecture is the same.

---

### Step 1: Memory (the FHIR stream)

In the original Park et al. paper, each agent has a "memory stream": a chronological list of natural language observations. "Isabella woke up at 7am." "Isabella saw her friend at the café." The agent retrieves relevant memories when making decisions.

In Cammelot, the memory stream is a FHIR record. Not natural language but structured clinical data. Every GP visit is an `Encounter`. Every diagnosis is a `Condition`. Every blood pressure check is an `Observation`. The agent's entire life history is queryable:

```javascript
queryFHIR('patient-hendrik', 'Condition')
// Returns: [{ code: 'I25', severity: 'moderate' }, { code: 'E11', severity: 'mild' }]
```

But I also added an explicit memory system on top of FHIR, closer to the Park et al. design. Each agent has a memory array with importance scoring:

```javascript
function addMemory(agent, type, text, importance) {
  agent.memory.push({ cycle, type, text, importance });
  if (agent.memory.length > MAX_MEMORIES) {
    // Evict lowest-importance memory
    var minIdx = 0;
    for (var i = 1; i < agent.memory.length; i++) {
      if (agent.memory[i].importance < agent.memory[minIdx].importance) minIdx = i;
    }
    agent.memory.splice(minIdx, 1);
  }
}
```

A neighbor dying nearby gets importance 8-10. Going to the GP gets importance 3. A disease progression gets 5-9 depending on severity. When the memory buffer fills up, low-importance memories get evicted. This means agents remember traumatic events (deaths, emergencies) much longer than routine ones (GP visits, walks).

The memories influence dialogue. An anxious agent who remembers a neighbor dying will say "I remember when someone died waiting. I'm scared." A stubborn agent with the same memory says "I don't trust the system anymore." Personality modulates the same memory into different behavior. I didn't program these specific sentences into a behavior tree. They emerge from the memory + personality combination.

To be clear, the sentences are templates I wrote, not LLM-generated. But which template gets selected is driven by memory state, not scripted.

---

### Step 2: Reflection

Every tick, each citizen agent runs `agentReflect()`:

```javascript
function agentReflect(agent) {
  const reflections = [];
  if (agent.hpHistory && agent.hpHistory.length > 5) {
    const recent = agent.hpHistory.slice(-5);
    const trend = recent[recent.length-1] - recent[0];
    if (trend < -10)
      reflections.push('My health is declining rapidly (' + trend + ' HP in 5 cycles).');
    else if (trend < 0)
      reflections.push('I feel a bit worse than last week.');
    else if (trend > 5)
      reflections.push('The treatment seems to be working!');
  }
  if (agent.waitWeeks > 8)
    reflections.push("I've been waiting " + agent.waitWeeks + " weeks. This is unbearable.");
  const severe = agent.conditions?.filter(c =>
    c.severity === 'severe' || c.severity === 'critical');
  if (severe?.length)
    reflections.push('My ' + severe[0].name + ' is getting serious. I need help soon.');
  agent.reflections = reflections;
}
```

Reflections are high-level conclusions drawn from raw state. The agent doesn't see its own HP number. It notices a trend. It doesn't read the Treeknorm policy. It feels the wait getting unbearable. This maps directly to Park et al.'s concept: reflections are "higher-level, more abstract thoughts" that emerge from the memory stream.

The GP agents have their own reflection cycle. Dr. Bakker notices when her queue is growing. She tracks her burnout level. She observes patients in the queue deteriorating. These reflections feed into the planning step.

---

### Step 3: Planning

```javascript
function agentPlan(agent) {
  const plans = [];
  if (agent.reflections?.some(r => r.includes('declining rapidly'))) {
    plans.push({ action: 'seek_gp', urgency: 'high' });
  }
  if (agent.reflections?.some(r => r.includes('unbearable'))) {
    plans.push({ action: 'complain', urgency: 'medium' });
  }
  if (agent.digitalTwinRisk && agent.digitalTwinRisk.riskPct > 60) {
    plans.push({ action: 'seek_gp', urgency: 'critical' });
  }
  agent.plans = plans;
}
```

Plans are actions with urgency levels. A patient whose reflection says "declining rapidly" plans to visit the GP urgently. A patient who's been waiting 8+ weeks plans to complain (which in the simulation means speech bubbles, protesting, and social contagion to neighbors).

The planning step is where IST and SOLL diverge. In IST, a patient only knows they're declining if they personally feel bad (reflection on HP trend). In SOLL, the Digital Twin adds objective risk data: "your risk score is 73%." The patient doesn't need to feel bad. The system tells them they should worry. This produces earlier GP visits, earlier referrals, earlier treatment. It's the reason SOLL generates 143 proactive alerts per run where IST generates zero.

---

### The disease engine: Markov chains, not LLMs

Here Cammelot departs from the generative agents paradigm completely.

In Park et al., agent behavior is driven by an LLM. Each decision goes through GPT, which generates natural language actions. That's powerful for social simulation (party planning, gift giving, gossip) but terrible for healthcare simulation where you need reproducible, parameterizable disease progression.

Cammelot uses Markov chains. Each condition has a transition matrix:

```
Heart Disease (I25):
  healthy  → { healthy: 0.95, mild: 0.04, moderate: 0.01 }
  mild     → { mild: 0.89, moderate: 0.08, severe: 0.02 }
  moderate → { mild: 0.12, moderate: 0.75, severe: 0.10, critical: 0.03 }
  severe   → { moderate: 0.08, severe: 0.70, critical: 0.15, deceased: 0.05 }
  critical → { severe: 0.10, critical: 0.68, deceased: 0.20 }
```

Every 4 ticks (roughly 1 simulated week), the chain rolls. The patient moves between states probabilistically. Comorbidities multiply the odds: diabetes + heart disease = 1.4× acceleration. Hypertension on top of that = 1.3× more.

This is intentionally not an LLM. I need three things an LLM can't give me:

1. **Reproducibility.** With a fixed seed, the same Markov chain produces the same disease trajectory. I can run 200 simulations and do proper statistics on the output. If each patient's disease were LLM-generated, the stochastic process would be uncontrollable.

2. **Parameterization.** I can change `deceased: 0.05` to `deceased: 0.03` and measure the mortality impact across 200 runs. The Markov rates are my independent variable. An LLM's disease modeling is a black box.

3. **Calibration to real data.** The transition rates come from RIVM prevalence data. A 5% per-tick transition from severe to deceased for heart disease corresponds roughly to real-world mortality rates for severe chronic heart failure. I can argue about whether 5% is right. I can't argue about what an LLM would generate.

The cognitive loop (memory, reflection, planning) drives *behavior*. The Markov chains drive *biology*. The two interact: behavior determines when you seek care, biology determines what happens while you wait. It's a clean separation that makes the simulation both humanistic (agents have feelings, memories, personalities) and quantitative (disease progression is mathematically tractable).

---

### What I'd do differently

The current cognitive loop is simple. Too simple, probably. The reflections are pattern-matched strings, not emergent reasoning. The planning step is basically a priority queue of if-statements.

If I were rebuilding it, I'd keep the Markov disease engine (that part works well) but replace the reflection and planning layers with a lightweight LLM call. Not GPT-4, not for 45 agents running 3,000 cycles. Something small and local. The agent's FHIR record goes in, a plan comes out. The personality modulates the prompt, not the template selection.

That said, the current system produces surprisingly believable emergent behavior. Agents gossip about neighbors who died. Anxious patients visit the GP more often than stoic ones. Social agents spread worry through their networks. None of that was explicitly designed. It fell out of the memory + personality + reflection system.

You don't need an LLM to get emergent social behavior in agent simulations. You need structured memory, personality traits, and a reflection cycle. The sophistication can come from the data, not the reasoning engine.

[🔗 GitHub: github.com/msft-common-demos/Cammelot]

---

*Technical specs: Cognitive loop runs every tick (~16ms at 60fps). Memory capped at MAX_MEMORIES per agent (currently 50). FHIR store capped at 2,000 resources (FIFO eviction). Markov transitions roll every 4 ticks. Five personality types: anxious, optimistic, stubborn, social, stoic. Digital Twin threshold: 25% (SOLL) vs 60% (IST). Park et al. reference: "Generative Agents: Interactive Simulacra of Human Behavior" (Stanford, 2023).*

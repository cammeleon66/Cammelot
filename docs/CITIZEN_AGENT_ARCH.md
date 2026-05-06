# Citizen Agent Architecture — LLM-Powered Reasoning for Cammelot SOLL Mode

> **Version:** 1.0  
> **Date:** 2026-05-06  
> **Status:** Draft — Ready for Implementation  
> **Author:** Architecture Council  
> **References:** Park et al. "Generative Agents" (2023), CLAUDE.md, ADR.md

---

## Table of Contents

1. [Overview & Motivation](#1-overview--motivation)
2. [Architecture Principles](#2-architecture-principles)
3. [Cognitive Loop Design](#3-cognitive-loop-design)
4. [Personality System](#4-personality-system)
5. [LLM Integration Architecture](#5-llm-integration-architecture)
6. [IST vs SOLL Agent Behavior](#6-ist-vs-soll-agent-behavior)
7. [Performance & Cost Management](#7-performance--cost-management)
8. [PoC Implementation Plan](#8-poc-implementation-plan)
9. [Future Extensions](#9-future-extensions)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Appendix: Prompt Templates](#appendix-a-prompt-templates)
12. [Appendix: FHIR Memory Schema](#appendix-b-fhir-memory-stream-schema)

---

## 1. Overview & Motivation

### 1.1 Why LLM-Powered Citizens?

Cammelot simulates a Dutch town of 45 citizens, 3 GPs, and 1 hospital to expose
the mechanics of the Dutch "zorginfarct" (care gridlock). Today, every citizen in
`world.html` is an **automaton** — a state machine that follows deterministic rules
for care-seeking, queuing, and compliance. This produces useful systemic metrics
(wait times, mortality, cost) but misses a critical dimension: **individual reasoning**.

Real patients don't follow flowcharts. A 72-year-old retired teacher with chronic
COPD reacts to a 14-week wait differently than a 35-year-old anxious parent with
mild hypertension. The teacher might stoically endure; the parent might demand a
second opinion. These personality-driven divergences create emergent population-level
patterns that rigid automatons cannot produce.

LLM-powered citizen agents bring three capabilities that automatons lack:

1. **Personality-driven decision-making** — same clinical situation, different
   personality traits → different choices (seek care, wait, refuse, self-medicate)
2. **Natural language reasoning** — agents can articulate *why* they made a choice,
   producing observable dialogue for research analysis
3. **Emergent social behavior** — agents can observe others' experiences and adjust
   their own care-seeking behavior (future extension)

### 1.2 The IST/SOLL Split

The architecture preserves the fundamental IST/SOLL duality:

| Mode | Agent Behavior | LLM Calls |
|------|---------------|-----------|
| **IST** | Deterministic automatons — fixed rules, zero reasoning | **0 per minute** |
| **SOLL** | LLM-powered reasoning — personality-driven decisions | **6–30 per minute** |

This split is non-negotiable. IST mode represents the current system — broken,
mechanical, and predictable. SOLL mode represents the AI-augmented future where
citizens have agency, information access (Digital Twin), and the capacity to reason
about their own care.

The toggle between IST and SOLL (buttons `#bi` / `#bs` in world.html, line ~866)
switches agent behavior at runtime. Existing automaton logic (the `agentReflect()`
and `agentPlan()` functions at lines ~1697–1727) remains as the IST pathway and as
the fallback when LLM calls fail.

### 1.3 Academic Foundation

This architecture draws directly from:

- **Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (2023)**
  — Memory Stream + Reflection + Planning cognitive architecture
- **Cammelot's existing cognitive loop** (Sprint 10, world.html lines 1696–1727)
  — `agentReflect()` and `agentPlan()` already implement a skeletal version
- **FHIR R4 as Memory Stream** — every agent action is already logged as a FHIR
  resource (CLAUDE.md §3.1), providing the experience record that Park et al. require

The key innovation is **consolidating** Park's three-stage loop (observe → reflect
→ plan) into a **single LLM call** per cognitive cycle, making it economically
viable for a browser-based simulation.

---

## 2. Architecture Principles

### 2.1 Event-Driven, Not Per-Tick

**This is the single most important architectural decision.**

Cammelot's simulation loop ticks every 500ms (line 1209). With 45 agents, a naive
"think every tick" approach produces:

```
45 agents × 2 ticks/sec × 60 sec = 5,400 LLM calls per minute
```

At ~$0.003 per call (Llama 3 8B via Ollama, ~500 input tokens + ~200 output), this
costs ~$16/min or **$972/hour**. With GPT-4o, multiply by 50×. This is economically
absurd and computationally infeasible.

**Solution: agents think only when something changes.** We define a set of **trigger
events** that activate a cognitive cycle:

| Trigger Event | Description | Frequency |
|---------------|-------------|-----------|
| `health_state_change` | Markov chain transitions severity (mild→moderate, etc.) | ~2–5/min across population |
| `hp_threshold_crossed` | HP drops below 80, 50, or 20 | ~1–3/min |
| `queue_entered` | Agent joins a GP or specialist queue | ~1–2/min |
| `queue_milestone` | Wait exceeds Treeknorm (12 weeks IST, 4 weeks SOLL) | ~0.5–1/min |
| `treatment_received` | Agent reaches front of queue, gets treated | ~0.5–1/min |
| `social_observation` | Agent observes another agent's ghost/death event | Future extension |
| `digital_twin_alert` | Risk prediction exceeds threshold (SOLL only) | ~0.5–1/min |
| `treeknorm_violation` | System-level wait time exceeds norm | ~0.5/min |

**Estimated call volume:** 6–30 LLM calls per minute depending on simulation
activity. During quiet periods (most agents healthy, short queues), volume drops
to ~6/min. During crisis cascades (multiple agents deteriorating, queues backing
up), volume peaks at ~30/min.

```
Best case:   6 calls/min × $0.003 = $0.018/min = $1.08/hr
Worst case: 30 calls/min × $0.003 = $0.090/min = $5.40/hr
GPT-4o:     30 calls/min × $0.015 = $0.450/min = $27.00/hr
```

### 2.2 One LLM Call Per Cognitive Cycle

Park et al. use three separate stages — Memory Retrieval, Reflection, Planning —
each potentially requiring its own LLM call. We **consolidate** into a single prompt
that includes:

1. **Context** — agent's current state, personality, recent memories
2. **Reflection prompt** — "What do you notice about your situation?"
3. **Action selection** — "What will you do next? Choose from: [action space]"

The LLM returns a structured JSON response containing both the reflection (for
logging/display) and the chosen action (for execution). This halves or thirds the
call count compared to a faithful Park implementation.

### 2.3 Graceful Degradation

If an LLM call fails (timeout, rate limit, provider error), the agent **falls back
to automaton behavior** — the existing `agentReflect()` / `agentPlan()` logic. This
means:

- IST mode always works (zero LLM dependency)
- SOLL mode works with degraded quality if the LLM is unavailable
- No simulation crash from API failures
- Individual agent failures don't cascade to other agents

### 2.4 Server-Side API Keys

API keys **never** touch the browser. A lightweight proxy server sits between
`world.html` and the LLM provider:

```
Browser (world.html)  →  Proxy Server (:3001)  →  LLM Provider
   fetch('/api/think')     adds API key              Ollama / OpenAI / etc.
   no secrets in JS        stateless relay
```

The proxy has **zero npm production dependencies** — it uses Node.js built-in
`http` module only, consistent with the project's zero-dependency philosophy
(see ADR-001).

---

## 3. Cognitive Loop Design

### 3.1 Memory Stream

Each citizen maintains a **Memory Stream** — a chronological log of experiences
stored as FHIR resources. The existing FHIR data layer (CLAUDE.md §3.1) already
supports this with custom observation codes:

```
CAMMELOT-WAIT    → waiting experience ("waited 8 weeks for cardiology")
CAMMELOT-HP      → health point snapshot (HP=62, declining)
CAMMELOT-GHOST   → observed a death event ("saw Mrs. Jansen pass away")
CAMMELOT-ACTION  → action taken ("decided to seek GP appointment")
```

**Memory Retrieval** selects the most relevant memories for the current cognitive
cycle using three scoring factors (adapted from Park et al.):

```
score(memory) = α × recency(memory)
              + β × importance(memory)
              + γ × relevance(memory, current_trigger)
```

Where:
- **Recency**: exponential decay — recent memories score higher
- **Importance**: health events > social events > routine observations
- **Relevance**: semantic similarity to current trigger (simplified to keyword
  matching for PoC; could use embeddings later)

For the PoC, we use a simplified version: retrieve the **last 5 memories** plus
any memories tagged with the current trigger's condition code.

### 3.2 The Cognitive Cycle

When a trigger event fires for an agent, the following sequence executes:

```
┌─────────────────────────────────────────────────────────────┐
│                    COGNITIVE CYCLE                           │
│                                                             │
│  1. TRIGGER fires (e.g., health_state_change)               │
│     ↓                                                       │
│  2. MEMORY RETRIEVAL                                        │
│     - Fetch last 5 FHIR observations for this agent         │
│     - Fetch condition-relevant memories                     │
│     - Fetch personality profile                             │
│     ↓                                                       │
│  3. PROMPT ASSEMBLY                                         │
│     - System prompt: role, personality, cultural context    │
│     - Memory context: recent experiences                    │
│     - Current situation: trigger event details              │
│     - Action space: available choices                       │
│     ↓                                                       │
│  4. LLM CALL (single request)                               │
│     → Returns: { reflection, action, reasoning }            │
│     ↓                                                       │
│  5. ACTION EXECUTION                                        │
│     - Validate action against available action space        │
│     - Execute in simulation (queue join, behavior change)   │
│     - Log to Memory Stream (FHIR observation)               │
│     ↓                                                       │
│  6. DISPLAY                                                 │
│     - Show reflection as speech bubble                      │
│     - Update agent panel with reasoning                     │
│                                                             │
│  Fallback: if step 4 fails → use agentReflect/agentPlan    │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Action Space

The agent's LLM response must select from a defined set of actions. Invalid or
unrecognized actions are mapped to `wait` (safe default).

| Action | Description | Preconditions |
|--------|-------------|---------------|
| `seek_care` | Go to GP, join queue | Not already in queue |
| `wait` | Continue current behavior, do nothing new | Always available |
| `comply` | Follow treatment plan, stay in queue | Currently in queue or under treatment |
| `refuse` | Refuse recommended treatment | Treatment recommended |
| `seek_second_opinion` | Visit a different GP | Already seen one GP |
| `self_medicate` | Attempt self-care (rest, OTC meds) | Has condition, not in queue |
| `complain` | Express frustration (affects social network) | Wait > 4 weeks |
| `leave_queue` | Abandon queue, return to roaming | Currently in queue |
| `emergency` | Go directly to hospital (bypass GP) | HP < 20 or critical severity |
| `share_experience` | Tell nearby agents about care experience | Future extension |

### 3.4 Action Validation & Execution

The simulation enforces hard constraints regardless of LLM output:

```javascript
function validateAction(agent, action) {
  // Hard constraints — override LLM decision
  if (agent.hp <= 0) return 'dead';          // Can't act when dead
  if (agent.state === 'dead') return 'dead';
  if (action === 'emergency' && agent.hp > 20 && !hasCriticalCondition(agent))
    return 'seek_care';                       // Downgrade non-emergency
  if (action === 'seek_care' && isInQueue(agent))
    return 'wait';                            // Already queuing
  if (action === 'leave_queue' && !isInQueue(agent))
    return 'wait';                            // Not in queue
  return action;                              // Action is valid
}
```

### 3.5 Prompt Template

The prompt is assembled from modular components:

```
┌──────────────────────────────────────────────────┐
│  SYSTEM PROMPT                                    │
│  "You are {name}, a {age}-year-old citizen of    │
│   Cammelot, a small Dutch town..."               │
│  + personality traits (Big Five scores)           │
│  + cultural context (Dutch healthcare norms)      │
├──────────────────────────────────────────────────┤
│  MEMORY CONTEXT                                   │
│  "Recent experiences:"                            │
│  - 3 days ago: visited GP, told to wait           │
│  - 1 week ago: HP dropped from 75 to 62          │
│  - 2 weeks ago: noticed neighbor became a ghost   │
├──────────────────────────────────────────────────┤
│  CURRENT SITUATION                                │
│  "Right now:"                                     │
│  - Your health: moderate COPD, HP=58              │
│  - You've been waiting 9 weeks for specialist     │
│  - The Treeknorm is 12 weeks                      │
│  - Your Digital Twin predicts 42% risk            │
├──────────────────────────────────────────────────┤
│  ACTION REQUEST                                   │
│  "What do you do? Respond with JSON:"             │
│  { reflection: "...", action: "...",              │
│    reasoning: "..." }                             │
│  Actions: seek_care, wait, comply, refuse,        │
│  seek_second_opinion, self_medicate, complain,    │
│  leave_queue, emergency                           │
└──────────────────────────────────────────────────┘
```

See [Appendix A](#appendix-a-prompt-templates) for the full prompt template.

---

## 4. Personality System

### 4.1 Big Five Personality Model

Each citizen is assigned a **Big Five personality profile** — five traits scored
on a 0.0–1.0 scale. These traits are injected into the LLM prompt to produce
personality-driven behavioral divergence.

| Trait | Low (0.0–0.3) | Mid (0.4–0.6) | High (0.7–1.0) | Healthcare Impact |
|-------|---------------|---------------|-----------------|-------------------|
| **Openness (O)** | Traditional, habitual | Balanced | Curious, experimental | High O → more likely to try alternative treatments, seek second opinions |
| **Conscientiousness (C)** | Disorganized, impulsive | Moderate | Disciplined, careful | High C → follows treatment plans, keeps appointments, takes meds on time |
| **Extraversion (E)** | Reserved, solitary | Ambiverted | Sociable, assertive | High E → discusses health with others, more likely to complain publicly |
| **Agreeableness (A)** | Skeptical, demanding | Cooperative | Trusting, compliant | High A → waits patiently, follows doctor's advice without question |
| **Neuroticism (N)** | Calm, emotionally stable | Average | Anxious, worry-prone | High N → seeks care earlier, more distressed by wait times, catastrophizes |

### 4.2 Personality Generation

Personalities are generated at population spawn time with controlled distributions:

```javascript
function generatePersonality() {
  return {
    openness:          clamp(gaussianRandom(0.5, 0.18), 0, 1),
    conscientiousness: clamp(gaussianRandom(0.5, 0.18), 0, 1),
    extraversion:      clamp(gaussianRandom(0.5, 0.18), 0, 1),
    agreeableness:     clamp(gaussianRandom(0.55, 0.15), 0, 1),  // Dutch skew: slightly agreeable
    neuroticism:       clamp(gaussianRandom(0.45, 0.18), 0, 1)   // Dutch skew: slightly stoic
  };
}
```

The Dutch cultural baseline skews slightly toward higher agreeableness (cooperative
culture, respect for institutions) and lower neuroticism (nuchterheid — Dutch
sobriety/pragmatism).

### 4.3 Dutch Cultural Modifiers

Beyond Big Five traits, Dutch cultural factors modulate care-seeking behavior.
These are injected into the system prompt as contextual background:

| Cultural Factor | Description | Behavioral Effect |
|-----------------|-------------|-------------------|
| **"Dokter weet het best"** | Doctor-knows-best deference | High trust in GP recommendations; less likely to seek second opinion |
| **Nuchterheid** | Pragmatic sobriety; "don't make a fuss" | Higher threshold for seeking care; tendency to minimize symptoms |
| **Egalitarianism** | Everyone waits their turn | Lower likelihood of queue-jumping or demanding expedited care |
| **Self-reliance** | "Eerst zelf proberen" (try it yourself first) | Higher rate of self-medication before GP visit |
| **Huisarts loyalty** | Strong GP-patient relationship | Reluctance to switch GPs; preference for familiar provider |
| **Insurance awareness** | Universal coverage via basispakket | No financial barrier to care-seeking (unlike US model) |

### 4.4 Personality → Decision Mapping

The personality profile doesn't directly control decisions — it **biases** the LLM's
reasoning through prompt injection. However, we can predict expected behavioral
patterns:

**Scenario: HP drops to 55, moderate COPD, waited 6 weeks**

| Personality Profile | Expected Behavior | Reasoning |
|--------------------|-------------------|-----------|
| High N (0.8), Low A (0.2) | `seek_care` or `complain` | Anxious + skeptical → doesn't trust the system to prioritize them |
| Low N (0.2), High A (0.9) | `wait` or `comply` | Calm + trusting → "the doctor said wait, so I wait" |
| High O (0.8), Low C (0.3) | `self_medicate` or `seek_second_opinion` | Curious + impulsive → tries alternative approaches |
| High C (0.9), High N (0.7) | `seek_care` (urgently) | Disciplined + anxious → researches symptoms, realizes severity |
| Low E (0.2), High A (0.8) | `wait` | Reserved + agreeable → suffers quietly, doesn't want to burden system |

### 4.5 Age-Personality Interactions

Age modifies personality expression in healthcare contexts:

```javascript
function adjustPersonalityForAge(personality, age) {
  const p = { ...personality };
  if (age >= 70) {
    p.agreeableness = Math.min(1.0, p.agreeableness + 0.1);   // Generational deference
    p.neuroticism   = Math.min(1.0, p.neuroticism + 0.05);    // Health anxiety with age
    p.openness      = Math.max(0.0, p.openness - 0.1);        // Less open to new approaches
  }
  if (age <= 30) {
    p.openness      = Math.min(1.0, p.openness + 0.1);        // Digital native, open to alternatives
    p.agreeableness = Math.max(0.0, p.agreeableness - 0.05);  // Less deferential to authority
  }
  return p;
}
```

---

## 5. LLM Integration Architecture

### 5.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (world.html)                         │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│  │ Tick Loop │──→│ Event Detect │──→│ Cognitive Cycle Manager  │    │
│  │ (500ms)  │   │ (triggers)   │   │ - queue management       │    │
│  └──────────┘   └──────────────┘   │ - prompt assembly        │    │
│                                     │ - response parsing       │    │
│                                     └───────────┬──────────────┘    │
│                                                  │ fetch()          │
│                                                  ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AgentLLMClient (frontend module)                           │    │
│  │  - POST /api/think  { agentId, prompt, personality }        │    │
│  │  - Retry logic (3 attempts, exponential backoff)            │    │
│  │  - Timeout: 10s per request                                 │    │
│  │  - Fallback: agentReflect() + agentPlan() on failure        │    │
│  └─────────────────────────────┬───────────────────────────────┘    │
└────────────────────────────────┼────────────────────────────────────┘
                                 │ HTTP POST (JSON)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PROXY SERVER (:3001)                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Node.js http module (zero npm deps)                        │    │
│  │                                                             │    │
│  │  Routes:                                                    │    │
│  │  POST /api/think    → Forward to LLM provider               │    │
│  │  GET  /api/health   → Status check                          │    │
│  │  GET  /api/config   → Return available models               │    │
│  │                                                             │    │
│  │  Responsibilities:                                          │    │
│  │  - Inject API key from env var (CAMMELOT_LLM_KEY)           │    │
│  │  - Route to configured provider                             │    │
│  │  - Rate limiting (max 60 req/min)                           │    │
│  │  - Request/response logging (debug mode)                    │    │
│  │  - CORS headers for localhost development                   │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ HTTPS (provider-specific format)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     LLM PROVIDER (abstracted)                       │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │  Ollama (local)  │  │  OpenAI API      │  │  Anthropic API  │   │
│  │  localhost:11434  │  │  api.openai.com  │  │  api.anthropic  │   │
│  │  Llama 3 8B      │  │  GPT-4o-mini     │  │  Claude Haiku   │   │
│  │  FREE            │  │  ~$0.015/call    │  │  ~$0.005/call   │   │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Proxy Server Design

The proxy server is intentionally minimal — a stateless relay that adds API keys
and forwards requests:

```javascript
// scripts/llm-proxy.js — Lightweight LLM proxy (zero npm deps)
import { createServer } from 'node:http';

const PORT = process.env.CAMMELOT_PROXY_PORT || 3001;
const PROVIDER = process.env.CAMMELOT_LLM_PROVIDER || 'ollama';

const PROVIDERS = {
  ollama: {
    url: 'http://localhost:11434/api/chat',
    transform: (req) => ({
      model: req.model || 'llama3',
      messages: req.messages,
      format: 'json',
      stream: false
    }),
    extractResponse: (res) => JSON.parse(res.message.content)
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 'Authorization': `Bearer ${process.env.CAMMELOT_LLM_KEY}` },
    transform: (req) => ({
      model: req.model || 'gpt-4o-mini',
      messages: req.messages,
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.7
    }),
    extractResponse: (res) => JSON.parse(res.choices[0].message.content)
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'x-api-key': process.env.CAMMELOT_LLM_KEY,
      'anthropic-version': '2023-06-01'
    },
    transform: (req) => ({
      model: req.model || 'claude-3-haiku-20240307',
      max_tokens: 300,
      messages: req.messages
    }),
    extractResponse: (res) => JSON.parse(res.content[0].text)
  }
};
```

### 5.3 Request / Response Format

**Request** (browser → proxy):

```json
{
  "agentId": "citizen-maria-bakker",
  "trigger": "health_state_change",
  "messages": [
    {
      "role": "system",
      "content": "You are Maria Bakker, a 68-year-old retired nurse in Cammelot..."
    },
    {
      "role": "user",
      "content": "Your COPD just progressed from mild to moderate. HP: 72. Wait: 3 weeks. What do you do?"
    }
  ],
  "model": "llama3",
  "personality": {
    "openness": 0.6,
    "conscientiousness": 0.8,
    "extraversion": 0.4,
    "agreeableness": 0.7,
    "neuroticism": 0.5
  }
}
```

**Response** (proxy → browser):

```json
{
  "agentId": "citizen-maria-bakker",
  "reflection": "My COPD is getting worse. As a former nurse, I know moderate COPD needs monitoring. The wait isn't critical yet but I should be seen soon.",
  "action": "seek_care",
  "reasoning": "Professional medical knowledge tells me not to wait until it's severe. My conscientiousness compels me to be proactive.",
  "confidence": 0.85,
  "tokens": { "input": 487, "output": 156 },
  "latency_ms": 340,
  "provider": "ollama",
  "fallback": false
}
```

### 5.4 Error Handling & Fallback Chain

```
LLM Call Attempt
    │
    ├─ Success → Parse JSON → Validate action → Execute
    │
    ├─ Timeout (>10s) → Retry (max 3, exponential backoff)
    │   ├─ Retry succeeds → Parse → Execute
    │   └─ All retries fail → FALLBACK
    │
    ├─ HTTP Error (4xx/5xx) → FALLBACK immediately
    │
    ├─ JSON Parse Error → FALLBACK (LLM returned non-JSON)
    │
    └─ Invalid Action → Map to 'wait' (safe default)

FALLBACK:
    agentReflect(agent)  → deterministic reflection (existing code)
    agentPlan(agent)     → deterministic action plan (existing code)
    Log: { fallback: true, reason: "..." }
```

### 5.5 Provider Configuration

Environment variables control provider selection:

```bash
# Local development (Ollama — free, no API key needed)
export CAMMELOT_LLM_PROVIDER=ollama
# Ollama must be running: ollama serve
# Model must be pulled: ollama pull llama3

# OpenAI
export CAMMELOT_LLM_PROVIDER=openai
export CAMMELOT_LLM_KEY=sk-...
export CAMMELOT_LLM_MODEL=gpt-4o-mini

# Anthropic
export CAMMELOT_LLM_PROVIDER=anthropic
export CAMMELOT_LLM_KEY=sk-ant-...
export CAMMELOT_LLM_MODEL=claude-3-haiku-20240307

# Azure OpenAI
export CAMMELOT_LLM_PROVIDER=azure
export CAMMELOT_LLM_KEY=...
export CAMMELOT_LLM_ENDPOINT=https://{resource}.openai.azure.com
export CAMMELOT_LLM_DEPLOYMENT=gpt-4o-mini
```

---

## 6. IST vs SOLL Agent Behavior

### 6.1 Behavioral Comparison

| Dimension | IST (Automaton) | SOLL (LLM-Powered) |
|-----------|----------------|---------------------|
| **Decision engine** | `agentReflect()` + `agentPlan()` — hardcoded rules | LLM cognitive cycle — personality-driven reasoning |
| **Care-seeking** | Deterministic: HP < threshold → seek GP | Personality-modulated: anxious agents seek earlier, stoic agents wait |
| **Queue behavior** | Waits indefinitely until served | May leave queue, complain, or seek alternatives |
| **Treatment compliance** | 100% compliance (always follows plan) | Personality-dependent: low C → may skip medications |
| **Information access** | None — agent doesn't "know" its own state | Digital Twin — sees risk predictions, HP trajectory |
| **Social behavior** | None — agents are isolated decision-makers | Observes neighbors, discusses experiences (future) |
| **Language output** | Canned dialogue strings (line ~2470+) | LLM-generated natural language reflections |
| **Adaptability** | Fixed response to fixed stimulus | Same stimulus + different personality = different response |
| **Cost** | Zero (no external calls) | $1–27/hr depending on provider and activity |
| **Failure mode** | Never fails (deterministic) | Falls back to IST behavior on LLM failure |

### 6.2 Code Path Split

The toggle mechanism integrates at the cognitive cycle entry point:

```javascript
// In tick() — after event detection
function processTriggerEvent(agent, trigger) {
  if (mode === 'IST') {
    // Existing automaton path — zero LLM calls
    agentReflect(agent);
    agentPlan(agent);
    executeAutomatonPlan(agent);
    return;
  }

  // SOLL: LLM-powered cognitive cycle
  if (mode === 'SOLL' && llmProxyAvailable) {
    cognitiveManager.enqueue(agent, trigger);
    // Async — result arrives via callback, executes action
    return;
  }

  // SOLL but LLM unavailable — graceful degradation
  agentReflect(agent);
  agentPlan(agent);
  executeAutomatonPlan(agent);
}
```

### 6.3 Event Detection Integration

The trigger detection layer wraps existing world.html logic. It monitors state
changes that already happen in `tick()` (line 6309+) and fires trigger events:

```javascript
// Wraps existing disease progression in tick()
function detectTriggerEvents(agent, prevState) {
  const triggers = [];

  // Health state transition (Markov chain already runs in tick)
  if (agent.severity !== prevState.severity) {
    triggers.push({
      type: 'health_state_change',
      data: { from: prevState.severity, to: agent.severity }
    });
  }

  // HP threshold crossing
  const thresholds = [80, 50, 20];
  for (const t of thresholds) {
    if (prevState.hp > t && agent.hp <= t) {
      triggers.push({
        type: 'hp_threshold_crossed',
        data: { threshold: t, currentHp: agent.hp }
      });
    }
  }

  // Queue entry
  if (!prevState.inQueue && isInQueue(agent)) {
    triggers.push({
      type: 'queue_entered',
      data: { queueType: agent.queueType, building: agent.queueBuilding }
    });
  }

  // Treeknorm violation
  const treeknorm = M[mode].tree;
  if (prevState.waitWeeks <= treeknorm && agent.waitWeeks > treeknorm) {
    triggers.push({
      type: 'treeknorm_violation',
      data: { waitWeeks: agent.waitWeeks, norm: treeknorm }
    });
  }

  return triggers;
}
```

### 6.4 Side-by-Side Scenario Walkthrough

**Scenario:** Citizen Jan (age 74, COPD moderate, HP 65, waiting 10 weeks)

**IST Path:**
```
tick() → agentReflect(jan)
  → "I've been waiting 10 weeks. The wait is getting long."
tick() → agentPlan(jan)
  → [{ action: 'complain', urgency: 'medium', reason: 'Long wait frustration' }]
tick() → jan continues waiting in queue (no behavioral change)
Result: Jan waits indefinitely. HP continues to drain.
```

**SOLL Path (High Neuroticism, Low Agreeableness):**
```
trigger: hp_threshold_crossed (HP went from 68 → 65)
cognitiveManager.enqueue(jan, trigger)
LLM prompt includes: personality={N:0.8, A:0.2}, HP=65, wait=10wks
LLM response: {
  reflection: "I can't take this anymore. 10 weeks! My breathing is worse
               every day and nobody seems to care. I'm going to that other
               doctor across town.",
  action: "seek_second_opinion",
  reasoning: "Anxious about worsening symptoms and distrustful of the
              current system's ability to help in time."
}
Result: Jan leaves current queue, walks to a different GP. New queue,
        but potentially shorter wait. Dialogue bubble shows frustration.
```

**SOLL Path (Low Neuroticism, High Agreeableness — same HP, same wait):**
```
trigger: hp_threshold_crossed (HP went from 68 → 65)
LLM prompt includes: personality={N:0.2, A:0.9}, HP=65, wait=10wks
LLM response: {
  reflection: "The wait is long, but the doctor said it takes time. I trust
               they'll see me when they can. Maybe I'll take it easy today.",
  action: "wait",
  reasoning: "Patient and trusting of the healthcare system. Prefers to
              follow the process rather than create disruption."
}
Result: Jan continues waiting patiently. Same clinical situation,
        opposite behavioral outcome. This is the power of personality.
```

---

## 7. Performance & Cost Management

### 7.1 Token Budget

Each cognitive cycle has a **token budget** to control costs:

| Component | Estimated Tokens | Notes |
|-----------|-----------------|-------|
| System prompt | ~200 tokens | Personality, cultural context, role |
| Memory context | ~150 tokens | Last 5 memories, compressed |
| Current situation | ~100 tokens | Trigger details, HP, conditions, wait |
| Action space | ~50 tokens | Available actions list |
| **Total input** | **~500 tokens** | |
| LLM response | ~150 tokens | Reflection + action + reasoning JSON |
| **Total per cycle** | **~650 tokens** | |

### 7.2 Cost Projections

| Provider | Model | Cost/Call | Calls/Min (avg) | Cost/Hour | Cost/8hr Session |
|----------|-------|-----------|-----------------|-----------|------------------|
| Ollama | Llama 3 8B | $0.00 | 15 | **$0.00** | **$0.00** |
| Ollama | Llama 3 70B | $0.00 | 15 | **$0.00** | **$0.00** |
| OpenAI | GPT-4o-mini | ~$0.003 | 15 | **$2.70** | **$21.60** |
| OpenAI | GPT-4o | ~$0.015 | 15 | **$13.50** | **$108.00** |
| Anthropic | Claude 3 Haiku | ~$0.005 | 15 | **$4.50** | **$36.00** |
| Anthropic | Claude 3.5 Sonnet | ~$0.012 | 15 | **$10.80** | **$86.40** |
| Azure OpenAI | GPT-4o-mini | ~$0.003 | 15 | **$2.70** | **$21.60** |

**Recommendation:** Use Ollama (Llama 3 8B) for development and demos. Use
GPT-4o-mini or Claude Haiku for cloud deployments where quality matters. Reserve
GPT-4o/Sonnet for research runs where reasoning quality is paramount.

### 7.3 Caching Strategy

**Situation hashing** — many agents face similar situations. We cache LLM responses
keyed on a normalized situation fingerprint:

```javascript
function situationHash(agent, trigger) {
  // Quantize continuous values to reduce cache key cardinality
  const hpBucket    = Math.floor(agent.hp / 10) * 10;       // 0,10,20,...100
  const waitBucket  = Math.floor(agent.waitWeeks / 4) * 4;  // 0,4,8,12,...
  const sevBucket   = agent.conditions?.[0]?.severity || 'none';
  const persCluster = personalityCluster(agent.personality); // 8 clusters

  return `${trigger.type}|${hpBucket}|${waitBucket}|${sevBucket}|${persCluster}`;
}

// 8 personality clusters via dominant trait
function personalityCluster(p) {
  const dominant = Object.entries(p).reduce((a, b) => a[1] > b[1] ? a : b);
  return `${dominant[0]}_${dominant[1] > 0.6 ? 'high' : 'low'}`;
}
```

Cache properties:
- **TTL:** 5 minutes (situations evolve; stale responses feel robotic)
- **Max entries:** 200 (bounded memory)
- **Hit rate estimate:** 30–50% during steady-state simulation
- **Effect:** Reduces effective LLM calls from 15/min to ~8–10/min

### 7.4 Request Queuing & Batching

The `CognitiveManager` queues and processes LLM requests to prevent overload:

```javascript
class CognitiveManager {
  constructor() {
    this.queue = [];              // Pending cognitive cycles
    this.inFlight = 0;            // Currently active LLM calls
    this.maxConcurrent = 3;       // Max parallel LLM requests
    this.cache = new Map();       // Situation → response cache
    this.rateLimiter = {
      tokens: 60,                 // 60 requests per minute
      refillRate: 1,              // 1 token per second
      lastRefill: Date.now()
    };
  }

  enqueue(agent, trigger) {
    // Check cache first
    const hash = situationHash(agent, trigger);
    if (this.cache.has(hash)) {
      const cached = this.cache.get(hash);
      if (Date.now() - cached.timestamp < 300000) {  // 5 min TTL
        this.executeAction(agent, cached.response);
        return;
      }
    }

    this.queue.push({ agent, trigger, hash, enqueueTime: Date.now() });
    this.processQueue();
  }

  async processQueue() {
    while (this.queue.length > 0 && this.inFlight < this.maxConcurrent) {
      if (!this.consumeRateToken()) break;

      const item = this.queue.shift();
      this.inFlight++;

      try {
        const response = await this.callLLM(item.agent, item.trigger);
        this.cache.set(item.hash, { response, timestamp: Date.now() });
        this.executeAction(item.agent, response);
      } catch (err) {
        // Fallback to automaton
        agentReflect(item.agent);
        agentPlan(item.agent);
        executeAutomatonPlan(item.agent);
      } finally {
        this.inFlight--;
        this.processQueue();  // Process next in queue
      }
    }
  }
}
```

### 7.5 Rate Limiting

| Level | Limit | Enforcement |
|-------|-------|-------------|
| Frontend (CognitiveManager) | 60 requests/min | Token bucket, queuing |
| Proxy server | 60 requests/min | HTTP 429 response |
| Per-agent | 1 request/30 seconds | Cooldown timer per agent |
| Burst protection | Max 5 concurrent | Semaphore in CognitiveManager |

The per-agent cooldown prevents a single agent in a rapidly deteriorating state
from dominating the LLM budget. If an agent triggers multiple events within the
cooldown window, only the highest-priority trigger is processed.

### 7.6 Priority Queue

When the request queue has multiple pending items, they are prioritized:

```javascript
const TRIGGER_PRIORITY = {
  'hp_threshold_crossed':   100,  // Most urgent — agent is actively declining
  'health_state_change':     80,  // Severity escalated
  'treeknorm_violation':     70,  // System failure detected
  'digital_twin_alert':      60,  // Predictive warning
  'queue_entered':           40,  // Informational
  'treatment_received':      30,  // Positive event, lower urgency
  'queue_milestone':         20,  // Routine check
  'social_observation':      10   // Future extension
};
```

---

## 8. PoC Implementation Plan

### 8.1 Scope

The PoC proves the concept with minimal scope:

| Dimension | PoC Scope | Full Scope (Future) |
|-----------|-----------|---------------------|
| Agents | **3** citizen agents with LLM reasoning | All 45 citizens |
| Decision points | **1** — care-seeking when health deteriorates | All actions in action space |
| LLM provider | **Ollama** (Llama 3 8B, local) | Multi-provider abstraction |
| Triggers | `health_state_change`, `hp_threshold_crossed` | All 8 trigger types |
| Personality | 3 distinct profiles (see below) | Full Big Five distribution |
| Social | None | Agent-to-agent influence |
| Caching | None (unnecessary at 3 agents) | Full situation cache |

### 8.2 PoC Agents

Three agents with distinct personalities to demonstrate behavioral divergence:

| Agent | Age | Condition | Personality | Expected Behavior |
|-------|-----|-----------|-------------|-------------------|
| **Maria Bakker** | 68 | COPD (moderate) | High C (0.8), Mid N (0.5) — the "Responsible Retiree" | Seeks care proactively, follows treatment plans |
| **Pieter de Vries** | 42 | Hypertension (mild) | Low N (0.2), High A (0.9) — the "Stoic Worker" | Waits patiently, minimizes symptoms, delays care |
| **Fatima El-Amrani** | 35 | T2D (mild) | High N (0.8), Low A (0.3) — the "Anxious Parent" | Seeks care early, worries about children, questions doctors |

### 8.3 Implementation Phases

```
Phase 1: Proxy Server                              [~2 hours]
├── Create scripts/llm-proxy.js (Node http, zero deps)
├── Ollama provider integration
├── Health check endpoint
├── CORS configuration
└── Test with curl

Phase 2: Frontend Client                           [~2 hours]
├── AgentLLMClient class in world.html
├── fetch() to proxy with retry logic
├── Fallback to agentReflect/agentPlan
├── Response parsing and validation
└── Test with hardcoded prompts

Phase 3: Cognitive Integration                      [~3 hours]
├── Event detection layer (wrap tick() state changes)
├── CognitiveManager (queue, rate limit)
├── Prompt assembly from agent state
├── Action validation and execution
├── Speech bubble display of reflections
└── IST/SOLL toggle integration

Phase 4: Personality & Testing                      [~2 hours]
├── Personality generation and injection
├── 3 PoC agent profiles
├── Test: same scenario → different personalities → different actions
├── Test: IST mode → zero LLM calls
├── Test: LLM failure → graceful fallback
└── Console logging of cognitive cycles

Phase 5: Polish & Documentation                     [~1 hour]
├── README update with setup instructions
├── Console debug mode (--debug flag)
├── Token usage reporting
└── Demo script for walkthrough

Total estimated effort: ~10 hours
```

### 8.4 Integration Points with world.html

The PoC touches these specific areas of the existing codebase:

| Location (world.html) | Change | Risk |
|------------------------|--------|------|
| Line ~1209 (`mode='IST'`) | Add `llmProxyAvailable` flag | None — additive |
| Line ~1696 (`agentReflect`) | Add SOLL branch before existing logic | Low — existing path preserved |
| Line ~6309 (`tick()`) | Add `detectTriggerEvents()` call for SOLL agents | Low — only runs for 3 agents in PoC |
| Line ~2470 (dialogue) | Show LLM reflections in speech bubbles | Low — existing bubble system reused |
| Agent spawn (~line 2840) | Add `personality` property to 3 agents | None — additive property |
| New: bottom of `<script>` | `CognitiveManager` class, `AgentLLMClient` class | None — new code, no modifications |

### 8.5 Success Criteria

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| Behavioral divergence | Same health event, 3 agents make different decisions | ≥2 distinct actions |
| Personality coherence | Repeated runs produce personality-consistent patterns | >70% consistency |
| Fallback reliability | Kill Ollama mid-simulation → agents continue functioning | Zero crashes |
| Performance | LLM response latency (Ollama, Llama 3 8B, local) | <2 seconds p95 |
| IST isolation | Toggle to IST → verify zero LLM calls in network tab | 0 requests |
| Cost tracking | Token usage logged per agent per cycle | Visible in console |

### 8.6 Local Development Setup

```bash
# 1. Install Ollama (https://ollama.ai)
# macOS/Linux:
curl -fsSL https://ollama.ai/install.sh | sh
# Windows: download installer from ollama.ai

# 2. Pull Llama 3 model
ollama pull llama3

# 3. Start Ollama server (if not auto-started)
ollama serve

# 4. Start Cammelot LLM proxy
node scripts/llm-proxy.js
# → Proxy listening on http://localhost:3001

# 5. Serve the site (any static file server)
npx serve site/
# → Open http://localhost:3000/world.html

# 6. Switch to SOLL mode in the simulation
# → Click "✦ SOLL" button
# → Watch 3 agents make LLM-powered decisions
# → Check browser console for cognitive cycle logs
```

---

## 9. Future Extensions

### 9.1 Social Influence Network

**Phase 2 extension:** Agents observe each other and share experiences.

When a citizen observes a **ghost event** (another citizen dying from system delay),
it triggers a `social_observation` event. The observing agent's LLM prompt includes:

```
"You just saw your neighbor Hendrik become a ghost (died after waiting
 16 weeks for cardiology). How does this affect your own care decisions?"
```

Expected emergent behaviors:
- **Anxious agents** (high N) → panic-seek care even when healthy
- **Stoic agents** (low N) → rationalize: "that won't happen to me"
- **Social agents** (high E) → spread the news, amplify fear
- **Cascade risk:** A single death could trigger a wave of care-seeking,
  overwhelming GP queues — a realistic simulation of health anxiety contagion

### 9.2 Information Asymmetry (Digital Twin Access)

In SOLL mode, agents can access their **Digital Twin** data — risk predictions,
HP trajectory, condition progression forecasts. This creates an information asymmetry
between IST agents (who don't know their prognosis) and SOLL agents (who do):

```
IST Agent Prompt Context:
  "You have moderate COPD. You feel somewhat worse lately."

SOLL Agent Prompt Context:
  "You have moderate COPD. Your Digital Twin predicts:
   - 42% chance of progression to severe within 8 weeks
   - HP trajectory: 65 → 48 in 50 ticks without treatment
   - Recommended: specialist consultation within 4 weeks"
```

This mirrors the real-world promise of AI-augmented healthcare: patients with
better data make better decisions. The simulation can measure whether this
information advantage actually reduces mortality.

### 9.3 GP and Specialist Agents

**Phase 3 extension:** GPs and specialists also become LLM-powered agents with
their own personality profiles:

| Agent | Personality Dimension | Healthcare Effect |
|-------|----------------------|-------------------|
| GP with high C | Thorough, systematic | Longer consultations, better diagnoses, slower throughput |
| GP with high A | Empathetic, patient | Better patient rapport, but struggles to refuse requests |
| GP with low N | Calm under pressure | Handles crisis well, but may underestimate urgency |
| Specialist with low A | Direct, efficient | Fast throughput, but patients feel rushed/dismissed |

GP agents could reason about their own burnout:

```
"I've seen 24 patients today. Administrative burden is crushing me.
 I spent 40 minutes on files for the last patient. I'm exhausted.
 Decision: Refer the next complex case to specialist instead of
 managing it myself — I can't give them the attention they need."
```

### 9.4 Emergent Behaviors to Monitor

| Emergent Pattern | Mechanism | Research Value |
|-----------------|-----------|----------------|
| **Health anxiety cascade** | Ghost event → social observation → mass care-seeking | Models real-world pandemic panic |
| **Trust erosion** | Long waits → low satisfaction → queue abandonment | Measures system credibility threshold |
| **Information-driven inequality** | SOLL agents with Digital Twin seek care earlier → better outcomes → IST agents die more | Quantifies AI access disparity |
| **Personality clustering** | High-N agents overwhelm GPs → compliant agents get delayed further | Emergent unfairness from personality distribution |
| **Self-medication drift** | Agents with low C skip official care → health worsens → emergency visits spike | Models non-compliance cost |
| **Second-opinion shopping** | Low-A agents cycle between GPs → consume capacity → system slowdown | The "difficult patient" system load |

### 9.5 Scale Considerations

| Scale | Agents | Est. LLM Calls/Min | Feasibility |
|-------|--------|--------------------|----|
| PoC | 3 | 2–5 | ✅ Trivial for local Ollama |
| Current sim | 45 | 6–30 | ✅ Feasible with caching + rate limiting |
| Medium town | 200 | 25–120 | ⚠️ Requires aggressive caching, batch processing |
| Large town | 500 | 60–300 | ⚠️ Needs distributed inference (multiple Ollama instances) |
| City | 5,000 | 600–3,000 | ❌ Requires architectural rethink (hierarchical agents, group reasoning) |

For 200+ agents, the architecture would need:
- **Hierarchical cognitive cycles** — only "interesting" agents (health events,
  queue changes) get full LLM calls; stable agents use cached/templated responses
- **Group reasoning** — instead of 10 agents in the same queue each making
  independent LLM calls, a single "group cognition" call reasons about the
  collective queue experience
- **Tiered models** — use fast/cheap models for routine decisions (wait, comply)
  and expensive models for critical decisions (leave queue, emergency, refuse)

---

## 10. Data Flow Diagrams

### 10.1 Event → Cognitive Cycle → Action Flow

```
                              SIMULATION TICK (500ms)
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │   For each agent:        │
                        │   Save prevState         │
                        │   Run disease progression│
                        │   Update HP, severity    │
                        │   Process queues         │
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │ detectTriggerEvents()    │
                        │                         │
                        │ Compare prevState to     │
                        │ current state:           │
                        │ • severity changed?      │
                        │ • HP crossed threshold?  │
                        │ • entered queue?         │
                        │ • Treeknorm violated?    │
                        └────────────┬────────────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                     No triggers           Triggers found
                          │                     │
                          ▼                     ▼
                     (skip agent)    ┌─────────────────────┐
                                     │  mode === 'IST' ?   │
                                     └──────┬──────┬───────┘
                                            │      │
                                       Yes  │      │  No (SOLL)
                                            ▼      ▼
                                    ┌─────────┐  ┌────────────────────┐
                                    │automaton│  │ CognitiveManager   │
                                    │reflect()│  │ .enqueue(agent,    │
                                    │plan()   │  │          trigger)  │
                                    └─────────┘  └────────┬───────────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │ Cache hit?     │
                                                 └───┬────────┬───┘
                                                     │        │
                                                Yes  │        │ No
                                                     ▼        ▼
                                            ┌──────────┐ ┌────────────┐
                                            │Use cached│ │ Build      │
                                            │response  │ │ prompt     │
                                            └────┬─────┘ │ Call LLM   │
                                                 │       └─────┬──────┘
                                                 │             │
                                                 │       ┌─────┴──────┐
                                                 │       │ Success?   │
                                                 │       └──┬─────┬───┘
                                                 │     Yes  │     │ No
                                                 │          │     ▼
                                                 │          │  ┌──────────┐
                                                 │          │  │ FALLBACK │
                                                 │          │  │ automaton│
                                                 │          │  └────┬─────┘
                                                 ▼          ▼       │
                                            ┌──────────────────────┐│
                                            │  Validate action     │◄
                                            │  Execute in sim      │
                                            │  Log to FHIR memory  │
                                            │  Show speech bubble  │
                                            └──────────────────────┘
```

### 10.2 Frontend → Proxy → LLM Data Flow

```
┌───────────────────────────────────────────────────────────────┐
│                    BROWSER (world.html)                        │
│                                                               │
│  tick()                                                       │
│    │                                                          │
│    ├─ detectTriggerEvents(agent)                              │
│    │    └─ triggers: [{type:'health_state_change', ...}]      │
│    │                                                          │
│    └─ cognitiveManager.enqueue(agent, trigger)                │
│         │                                                     │
│         ├─ buildPrompt(agent, trigger, memories)              │
│         │    ├─ systemPrompt: personality + cultural context   │
│         │    ├─ memoryContext: last 5 FHIR observations       │
│         │    └─ situationPrompt: HP, severity, wait, trigger  │
│         │                                                     │
│         └─ agentLLMClient.think(prompt)                       │
│              │                                                │
│              │  POST /api/think                                │
│              │  {                                              │
│              │    agentId: "citizen-maria-bakker",             │
│              │    messages: [...],                             │
│              │    personality: {O:0.6, C:0.8, ...}            │
│              │  }                                              │
│              │                                                │
└──────────────┼────────────────────────────────────────────────┘
               │
               │  HTTP POST (localhost:3001)
               │  Content-Type: application/json
               │  No API keys in request
               ▼
┌───────────────────────────────────────────────────────────────┐
│                    PROXY SERVER (:3001)                        │
│                    scripts/llm-proxy.js                        │
│                                                               │
│  Receive request                                              │
│    │                                                          │
│    ├─ Rate limit check (60 req/min)                           │
│    │    └─ 429 Too Many Requests if exceeded                  │
│    │                                                          │
│    ├─ Transform request for provider                          │
│    │    ├─ Add API key from CAMMELOT_LLM_KEY env var          │
│    │    ├─ Set model from CAMMELOT_LLM_MODEL env var          │
│    │    ├─ Set max_tokens: 300                                │
│    │    └─ Set temperature: 0.7                               │
│    │                                                          │
│    ├─ Forward to LLM provider                                 │
│    │                                                          │
│    └─ Transform response                                      │
│         ├─ Extract JSON from provider-specific format         │
│         ├─ Add token usage metadata                           │
│         └─ Return to browser                                  │
│                                                               │
└──────────────┬────────────────────────────────────────────────┘
               │
               │  HTTPS (provider-specific)
               │  Authorization: Bearer sk-...
               ▼
┌───────────────────────────────────────────────────────────────┐
│                    LLM PROVIDER                               │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐     │
│  │   Ollama    │  │   OpenAI   │  │    Anthropic      │     │
│  │  :11434     │  │            │  │                   │     │
│  │             │  │            │  │                   │     │
│  │ POST /api/  │  │ POST /v1/  │  │ POST /v1/        │     │
│  │   chat      │  │  chat/     │  │   messages       │     │
│  │             │  │  completions│  │                   │     │
│  │ Model:      │  │ Model:     │  │ Model:           │     │
│  │  llama3     │  │  gpt-4o-   │  │  claude-3-       │     │
│  │             │  │  mini      │  │  haiku            │     │
│  │ Response:   │  │ Response:  │  │ Response:        │     │
│  │  message.   │  │  choices   │  │  content[0]      │     │
│  │  content    │  │  [0].msg   │  │  .text           │     │
│  └─────────────┘  └─────────────┘  └───────────────────┘     │
└───────────────────────────────────────────────────────────────┘
```

### 10.3 Memory Stream FHIR Query Pattern

```
┌───────────────────────────────────────────────────────────────┐
│               MEMORY STREAM (per citizen)                      │
│                                                               │
│  FHIR Observation Resources (chronological)                   │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ {                                                        │ │
│  │   resourceType: "Observation",                           │ │
│  │   subject: { reference: "Patient/citizen-maria-bakker" },│ │
│  │   code: { coding: [{ code: "CAMMELOT-ACTION" }] },      │ │
│  │   effectiveDateTime: "2025-07-17T10:30:00Z",            │ │
│  │   valueString: "seek_care",                              │ │
│  │   component: [                                           │ │
│  │     { code: "reflection",                                │ │
│  │       valueString: "My COPD is worsening..." },          │ │
│  │     { code: "reasoning",                                 │ │
│  │       valueString: "As a former nurse, I know..." },     │ │
│  │     { code: "trigger",                                   │ │
│  │       valueString: "health_state_change" },              │ │
│  │     { code: "personality-cluster",                       │ │
│  │       valueString: "conscientiousness_high" }            │ │
│  │   ]                                                      │ │
│  │ }                                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  Query for Cognitive Cycle:                                   │
│                                                               │
│  GET /Observation                                             │
│    ?subject=Patient/citizen-maria-bakker                      │
│    &code=CAMMELOT-ACTION,CAMMELOT-HP,CAMMELOT-WAIT           │
│    &_sort=-date                                               │
│    &_count=5                                                  │
│                                                               │
│  Returns last 5 memories → injected into LLM prompt          │
│                                                               │
│  Relevance Query (condition-specific):                        │
│                                                               │
│  GET /Observation                                             │
│    ?subject=Patient/citizen-maria-bakker                      │
│    &code=CAMMELOT-ACTION                                      │
│    &value-string=seek_care,refuse,complain                   │
│    &_sort=-date                                               │
│    &_count=3                                                  │
│                                                               │
│  Returns past care-seeking decisions for pattern analysis     │
└───────────────────────────────────────────────────────────────┘

  Memory Retrieval for Prompt Assembly:

  ┌─────────────────┐     ┌──────────────┐     ┌────────────────┐
  │  FHIR Store     │────→│  Memory      │────→│  Prompt        │
  │  (all agent     │     │  Selector    │     │  Builder       │
  │   observations) │     │              │     │                │
  │                 │     │  • Recency   │     │  "Recent       │
  │  Observation[]  │     │  • Importance│     │   experiences: │
  │                 │     │  • Relevance │     │   - 3 days ago │
  │                 │     │              │     │     you visited│
  │                 │     │  Top 5       │     │     GP..."     │
  └─────────────────┘     └──────────────┘     └────────────────┘
```

### 10.4 IST ↔ SOLL Toggle State Machine

```
                    ┌────────────────────────────────────────┐
                    │         MODE TOGGLE (#bi / #bs)        │
                    └────────────────┬───────────────────────┘
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                    Click IST (#bi)         Click SOLL (#bs)
                         │                       │
                         ▼                       ▼
                ┌─────────────────┐     ┌─────────────────────┐
                │   IST MODE      │     │    SOLL MODE         │
                │                 │     │                     │
                │ • mode = 'IST'  │     │ • mode = 'SOLL'     │
                │ • M = M.IST     │     │ • M = M.SOLL        │
                │ • admin = 30%   │     │ • admin = 5%        │
                │ • tree = 12wk   │     │ • tree = 4wk        │
                │ • ai = 1.0      │     │ • ai = 1.34         │
                │ • drain = 1.0   │     │ • drain = 0.3       │
                │                 │     │                     │
                │ Agent behavior: │     │ Agent behavior:     │
                │ agentReflect()  │     │ IF llmProxy active: │
                │ agentPlan()     │     │   → LLM cognitive   │
                │ (deterministic) │     │     cycle            │
                │                 │     │ ELSE:               │
                │ LLM calls: 0   │     │   → fallback to     │
                │                 │     │     automaton        │
                │ Speech bubbles: │     │                     │
                │ canned strings  │     │ LLM calls: 6-30/min│
                │                 │     │                     │
                │ No personality  │     │ Speech bubbles:     │
                │ No Digital Twin │     │ LLM-generated text  │
                │ No social obs.  │     │                     │
                │                 │     │ Personality active  │
                │                 │     │ Digital Twin active │
                │                 │     │ Social obs. (future)│
                └─────────────────┘     └─────────────────────┘
```

---

## Appendix A: Prompt Templates

### A.1 System Prompt Template

```
You are {name}, a {age}-year-old {occupation} living in Cammelot, a small Dutch
town. You have lived here for {years_in_town} years.

PERSONALITY:
You are {personality_description}.
- Openness: {openness}/10 — {openness_desc}
- Conscientiousness: {conscientiousness}/10 — {conscientiousness_desc}
- Extraversion: {extraversion}/10 — {extraversion_desc}
- Agreeableness: {agreeableness}/10 — {agreeableness_desc}
- Neuroticism: {neuroticism}/10 — {neuroticism_desc}

CULTURAL CONTEXT:
You live in the Netherlands. The healthcare system has a GP (huisarts) as
gatekeeper — you must visit your GP before seeing a specialist. Wait times
for specialists can be long (the Treeknorm standard is {treeknorm} weeks).
You {cultural_modifier}.

IMPORTANT RULES:
- Stay in character. Respond as {name} would, given your personality.
- Your response must be valid JSON with exactly these fields:
  reflection, action, reasoning
- Available actions: {action_list}
- Choose ONE action only.
- Keep your reflection under 2 sentences.
- Keep your reasoning under 2 sentences.
```

### A.2 Personality Description Generator

```javascript
function describePersonality(p) {
  const parts = [];

  if (p.openness > 0.7) parts.push('curious and open to new experiences');
  else if (p.openness < 0.3) parts.push('traditional and set in your ways');

  if (p.conscientiousness > 0.7) parts.push('disciplined and organized');
  else if (p.conscientiousness < 0.3) parts.push('spontaneous and sometimes forgetful');

  if (p.extraversion > 0.7) parts.push('outgoing and sociable');
  else if (p.extraversion < 0.3) parts.push('reserved and prefer your own company');

  if (p.agreeableness > 0.7) parts.push('trusting and cooperative');
  else if (p.agreeableness < 0.3) parts.push('skeptical and questioning of authority');

  if (p.neuroticism > 0.7) parts.push('prone to worry and anxiety');
  else if (p.neuroticism < 0.3) parts.push('calm and emotionally stable');

  return parts.join(', ') || 'a balanced, typical Dutch citizen';
}
```

### A.3 Situation Prompt Template

```
CURRENT SITUATION:
{trigger_description}

Your health status:
- Conditions: {conditions_list}
- Health Points: {hp}/100 ({hp_trend})
- Current severity: {severity}
- Waiting time: {wait_weeks} weeks (Treeknorm: {treeknorm} weeks)
- Currently: {behavior_state} {queue_info}
{digital_twin_section}

Recent memories:
{memory_list}

Based on your personality and situation, what do you do?

Respond with ONLY this JSON (no other text):
{
  "reflection": "A short thought about your current situation (1-2 sentences)",
  "action": "one of: seek_care, wait, comply, refuse, seek_second_opinion, self_medicate, complain, leave_queue, emergency",
  "reasoning": "Why you chose this action (1-2 sentences)"
}
```

### A.4 Digital Twin Section (SOLL Only)

```
Your Digital Twin (AI health assistant) reports:
- Risk of condition progression: {risk_pct}%
- Projected HP in 50 ticks: {projected_hp} (without treatment)
- Projected HP with treatment: {projected_hp_treated}
- Recommendation: {dt_recommendation}
```

### A.5 Example Complete Prompt

```
SYSTEM:
You are Maria Bakker, a 68-year-old retired nurse living in Cammelot, a small
Dutch town. You have lived here for 42 years.

PERSONALITY:
You are disciplined and organized, calm and emotionally stable.
- Openness: 6/10 — moderately open to new ideas
- Conscientiousness: 8/10 — very disciplined and responsible
- Extraversion: 4/10 — somewhat reserved
- Agreeableness: 7/10 — generally trusting and cooperative
- Neuroticism: 3/10 — quite calm and stable

CULTURAL CONTEXT:
You live in the Netherlands. The healthcare system has a GP (huisarts) as
gatekeeper — you must visit your GP before seeing a specialist. Wait times
for specialists can be long (the Treeknorm standard is 4 weeks). You trust
your GP's judgment and prefer to follow the established process.

IMPORTANT RULES:
- Stay in character. Respond as Maria would, given your personality.
- Your response must be valid JSON with exactly these fields:
  reflection, action, reasoning
- Available actions: seek_care, wait, comply, self_medicate, complain
- Choose ONE action only.
- Keep your reflection under 2 sentences.
- Keep your reasoning under 2 sentences.

USER:
Your COPD just progressed from mild to moderate. This is a significant change
in your health status.

Your health status:
- Conditions: COPD (moderate, ICD-10: J44)
- Health Points: 72/100 (declining: was 78 five cycles ago)
- Current severity: moderate
- Waiting time: 3 weeks (Treeknorm: 4 weeks)
- Currently: roaming (not in any queue)

Your Digital Twin (AI health assistant) reports:
- Risk of progression to severe: 28% within 8 weeks
- Projected HP in 50 ticks: 61 (without treatment)
- Projected HP with treatment: 74
- Recommendation: Schedule GP visit within 2 weeks

Recent memories:
- 10 cycles ago: Felt a bit worse than last week
- 25 cycles ago: Visited GP Dr. de Jong, was told "mild COPD, monitor at home"
- 40 cycles ago: Noticed neighbor Hendrik coughing badly in the queue

Based on your personality and situation, what do you do?

Respond with ONLY this JSON (no other text):
{
  "reflection": "...",
  "action": "...",
  "reasoning": "..."
}
```

**Expected response** (given Maria's high C, moderate A, low N):

```json
{
  "reflection": "My COPD has moved to moderate. As a former nurse, I know this means I should get proper monitoring before it gets worse.",
  "action": "seek_care",
  "reasoning": "My medical background tells me moderate COPD needs professional attention. The Digital Twin confirms a 28% risk of getting worse, and my disciplined nature won't let me ignore that."
}
```

---

## Appendix B: FHIR Memory Stream Schema

### B.1 Memory Entry (Observation Resource)

Each cognitive cycle produces a FHIR Observation that is appended to the agent's
Memory Stream:

```json
{
  "resourceType": "Observation",
  "id": "mem-maria-bakker-00142",
  "status": "final",
  "category": [{
    "coding": [{
      "system": "http://cammelot.sim/fhir/category",
      "code": "cognitive-cycle",
      "display": "LLM Cognitive Cycle Output"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://cammelot.sim/fhir/observation",
      "code": "CAMMELOT-ACTION",
      "display": "Agent Action Decision"
    }]
  },
  "subject": {
    "reference": "Patient/citizen-maria-bakker"
  },
  "effectiveDateTime": "2025-07-17T10:30:00Z",
  "valueString": "seek_care",
  "component": [
    {
      "code": {
        "coding": [{
          "system": "http://cammelot.sim/fhir/component",
          "code": "reflection"
        }]
      },
      "valueString": "My COPD has moved to moderate. As a former nurse, I know this means I should get proper monitoring."
    },
    {
      "code": {
        "coding": [{
          "system": "http://cammelot.sim/fhir/component",
          "code": "reasoning"
        }]
      },
      "valueString": "My medical background tells me moderate COPD needs professional attention."
    },
    {
      "code": {
        "coding": [{
          "system": "http://cammelot.sim/fhir/component",
          "code": "trigger"
        }]
      },
      "valueString": "health_state_change:mild->moderate"
    },
    {
      "code": {
        "coding": [{
          "system": "http://cammelot.sim/fhir/component",
          "code": "personality-cluster"
        }]
      },
      "valueString": "conscientiousness_high"
    },
    {
      "code": {
        "coding": [{
          "system": "http://cammelot.sim/fhir/component",
          "code": "hp-at-decision"
        }]
      },
      "valueQuantity": {
        "value": 72,
        "unit": "HP",
        "system": "http://cammelot.sim/fhir/units"
      }
    },
    {
      "code": {
        "coding": [{
          "system": "http://cammelot.sim/fhir/component",
          "code": "llm-metadata"
        }]
      },
      "valueString": "{\"provider\":\"ollama\",\"model\":\"llama3\",\"tokens\":{\"input\":487,\"output\":156},\"latency_ms\":340,\"fallback\":false}"
    }
  ],
  "extension": [{
    "url": "http://cammelot.sim/fhir/hp",
    "valueInteger": 72
  }]
}
```

### B.2 Memory Types in Stream

| Code | Purpose | Frequency | Retention |
|------|---------|-----------|-----------|
| `CAMMELOT-ACTION` | Agent decision from cognitive cycle | Per trigger event | Permanent |
| `CAMMELOT-HP` | Health point snapshot | Every 10 ticks | Last 200 entries |
| `CAMMELOT-WAIT` | Wait time milestone | Per queue milestone | Permanent |
| `CAMMELOT-GHOST` | Observed death event | Per death observation | Permanent |
| `CAMMELOT-SOCIAL` | Social interaction record | Per conversation (future) | Last 50 entries |
| `CAMMELOT-TREATMENT` | Treatment received | Per treatment event | Permanent |

### B.3 Memory Retrieval Pseudocode

```javascript
function retrieveMemories(agentId, trigger, maxMemories = 5) {
  // 1. Get all memories for this agent
  const all = fhirStore.search('Observation', {
    subject: `Patient/${agentId}`,
    code: 'CAMMELOT-ACTION,CAMMELOT-HP,CAMMELOT-WAIT,CAMMELOT-GHOST',
    _sort: '-date'
  });

  // 2. Score each memory
  const scored = all.map(mem => ({
    memory: mem,
    score: scoreMemory(mem, trigger)
  }));

  // 3. Sort by score, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxMemories).map(s => s.memory);
}

function scoreMemory(memory, trigger) {
  const now = Date.now();
  const memTime = new Date(memory.effectiveDateTime).getTime();
  const ageMinutes = (now - memTime) / 60000;

  // Recency: exponential decay (half-life = 30 minutes sim time)
  const recency = Math.exp(-0.693 * ageMinutes / 30);

  // Importance: health events > social events
  const importanceMap = {
    'CAMMELOT-GHOST': 1.0,     // Witnessing death is highly memorable
    'CAMMELOT-ACTION': 0.7,    // Past decisions are relevant
    'CAMMELOT-WAIT': 0.5,      // Wait milestones are moderately important
    'CAMMELOT-HP': 0.3         // HP snapshots are routine
  };
  const importance = importanceMap[memory.code?.coding?.[0]?.code] || 0.2;

  // Relevance: does this memory relate to the current trigger?
  const memTrigger = memory.component?.find(
    c => c.code?.coding?.[0]?.code === 'trigger'
  )?.valueString || '';
  const relevance = memTrigger.includes(trigger.type) ? 1.0 : 0.3;

  return (0.4 * recency) + (0.3 * importance) + (0.3 * relevance);
}
```

---

## Appendix C: Glossary

| Term | Definition |
|------|-----------|
| **Cognitive Cycle** | A single round of memory retrieval → prompt assembly → LLM call → action execution |
| **Trigger Event** | A state change that activates an agent's cognitive cycle |
| **Memory Stream** | Chronological FHIR-backed log of an agent's experiences and decisions |
| **Action Space** | The set of valid actions an agent can choose from |
| **Personality Cluster** | A simplified categorization of Big Five profiles for caching |
| **Treeknorm** | Dutch standard for maximum acceptable wait times in healthcare |
| **Ghost / Ghosting** | Death event from system delay — citizen sprite becomes transparent |
| **Digital Twin** | AI-powered health risk prediction available to SOLL agents |
| **Zorginfarct** | Dutch term for "care gridlock" — the systemic collapse this project models |
| **Nuchterheid** | Dutch sobriety/pragmatism — cultural tendency to minimize problems |
| **Huisarts** | Dutch GP (general practitioner) — the gatekeeper to specialist care |
| **Big Five** | Five-factor personality model: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism |
| **Park et al.** | "Generative Agents: Interactive Simulacra of Human Behavior" (Stanford, 2023) |

---

## Appendix D: Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| 1 | Should personality traits be visible to the player in the agent info panel? | UX — helps player understand divergent behavior | **Pending** |
| 2 | Can we use embeddings for memory relevance scoring instead of keyword matching? | Quality — better memory retrieval | **Deferred to post-PoC** |
| 3 | Should GP agents also be LLM-powered in Phase 2? | Scope — significant increase in call volume | **Deferred** |
| 4 | How to handle personality drift over time (traumatic events change personality)? | Realism — but adds significant complexity | **Deferred** |
| 5 | Should the proxy server be a separate repo or stay in `scripts/`? | Architecture — separate repo adds operational complexity | **Decision: stay in scripts/** |
| 6 | What happens when 3+ agents trigger cognitive cycles in the same tick? | Performance — queue handles this, but UX of multiple speech bubbles? | **PoC will test** |
| 7 | Should we offer a "fast mode" with no LLM calls for speed runs? | UX — useful for researchers running 1000-cycle experiments | **Pending** |

---

*End of document. Last updated: 2026-05-06.*

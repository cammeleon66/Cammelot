# Series 2 — Architecture | Post T5: The Persona Layer — Giving 45 Pixel Citizens a Personality

**Status:** Ready to publish (2026-06-09)
**Target:** LinkedIn (AI/ML researchers, agent builders, healthcare-AI people, the Park et al. crowd)
**Tags:** #GenerativeAgents #LLM #AgentDesign #HealthcareAI #ReproducibleResearch #Cammelot

> **Series note:** Series 2 is about architecture — agent identity, memory, cognition, persona, and resilience. This is **Post T5 (persona)**; it follows **T3 (the cognitive loop)** and sets up **T6 (resilience & concentration risk)**.

---

## Post

In Post T3 I admitted the weakest part of Cammelot: the citizens didn't really *think*. Their reflections were pattern-matched strings. Their thoughts were five hard-coded sentences per health state. Every anxious patient said the same thing. I closed that post with a promise — "if I were rebuilding it, the personality would modulate the prompt, not the template selection."

This is that rebuild — Cammelot’s **persona layer**.

> **A note on names.** An earlier draft of this post called the persona layer the “Living Patient Agent.” I’ve since reserved that term for a different, bigger idea: the **SOLL product concept** of an autonomous “active brain” on top of clean data that does *proactive preventative care* — reaching out to people before they deteriorate. That concept (and how it generalises to a *Living Citizen* and a *Living Store*) is **Post T7**. This post is the narrower, purely *methodological* sibling: how I give **simulated** citizens distinct, reproducible personalities without breaking the science.

The goal was simple to state and annoying to engineer: I wanted the 45 citizens of Cammelot to feel like 45 different people — their own voice, their own way of dealing with illness, their own decisions about whether to trust the system — *without* breaking the thing that makes the simulation scientifically useful: reproducibility.

---

### The problem with "just call an LLM"

The obvious move is to wire every agent to an LLM. Each tick, you hand GPT the patient's situation and let it narrate.

I tried to reason about the cost before writing it. Cammelot's headline result comes from a **100-run study**: 45 agents × ~3,000 cycles × 100 runs × 2 modes (IST and SOLL). That's on the order of **27 million agent-decision points** per study. Routing that through an LLM is not just expensive — it's *unscientific*. Every run would be different in uncontrollable ways. I could never say "SOLL produces 177% more chronic-care (ketenzorg) interventions" with a straight face if the underlying agents were non-deterministic black boxes. The variance from the LLM would swamp the variance from the intervention I'm actually trying to measure.

So live-LLM-per-tick was out. But I still wanted real personality. The answer was to move the LLM *upstream*.

---

### The Hybrid architecture: author once, run deterministically

Here's the key insight. You don't need the LLM at *runtime*. You need it at *authoring time*.

I split the system into two layers:

**1. The Persona Genome (LLM-authored, once).**
An LLM acts as a character writer. It produces a library of diverse Dutch citizen archetypes — `config/persona_archetypes.json`. Sixteen of them so far: the stoic old farmer who refuses to "bother the doctor," the anxious caregiver who catastrophises every symptom, the stubborn skeptic who distrusts the system, the busy professional who has no time to be sick, the lonely elder for whom the GP visit is the social highlight of the week.

Each archetype carries:

```json
{
  "id": "stubborn_skeptic",
  "label": "The Stubborn Skeptic",
  "voice": "Distrustful of institutions, blunt, independent. Has been let down before.",
  "match": { "ageMin": 40, "ageMax": 75, "gender": "any" },
  "trait": "stubborn",
  "bigFive": { "O": 0.4, "C": 0.5, "E": 0.5, "A": 0.25, "N": 0.5 },
  "behavior": {
    "careSeekingBias": -0.35, "compliance": 0.4, "trustInSystem": 0.25,
    "refusalTendency": 0.4, "secondOpinionDrive": 0.3,
    "drainModifier": 1.05, "socialness": 0.4
  },
  "thoughts": {
    "healthy": ["I manage my own health, thanks.", "Doctors. Always something with them.", "Feeling fine. Don't need anyone telling me otherwise."],
    "early_symptoms": ["I'll deal with it myself.", "Half their 'treatments' are nonsense anyway.", "Not running to the GP for every little thing."],
    "waiting": ["Knew they'd make me wait. They always do.", "This is exactly why I don't bother with them.", "A number in a queue. That's all we are to them."],
    "long_wait": ["The system doesn't care about people like me.", "Twelve weeks. And they call this care.", "I've half a mind to walk out and forget it."],
    "declining": ["So much for their wonderful system.", "Should've trusted my gut and gone private.", "They let it get this far. Typical."],
    "treated": ["About time. Won't be thanking anyone.", "Fine. It worked. Doesn't change what I think.", "One decent doctor in the whole lot."],
    "recovering": ["Getting better. No thanks to the wait.", "I'll take the recovery. Keep the lectures.", "Back on my feet. On my own terms."],
    "grief": ["The system failed them. I won't pretend otherwise.", "Another one the waiting list killed.", "Makes my blood boil, that does."]
  }
}
```

**2. The Persona Engine (deterministic, every run).**
A tiny, dependency-free module (`src/sim/persona.js`) assigns those archetypes to spawned citizens and selects their thoughts — *deterministically*. Same citizen, same run seed → same person, every single time. The LLM's creativity is frozen into data; the engine just reads it.

This is the whole trick. **The LLM gives you diversity. The engine gives you reproducibility. You get both because they happen at different times.**

---

### Making "random personality" reproducible

Citizens in Cammelot are procedurally spawned with random names each run, so I can't bind a persona to a fixed ID. Assignment has to be derived. I reuse the *exact* RNG the simulation engine already uses, so the persona layer stays in lockstep with everything else:

```javascript
export function assignPersona(agent, archetypes, opts = {}) {
  const seedSalt = opts.seed || 0;
  const jitter = typeof opts.jitter === 'number' ? opts.jitter : 0.06;
  const candidates = matchArchetypes(agent, archetypes);   // age/gender-appropriate
  const rng = seededRandom(hashCode(String(agent.id || 'anon')) + 13 + seedSalt);
  rng(); rng(); rng();   // warm up: LCGs correlate badly on nearby seeds
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  const arch = candidates[idx];
  return { archetypeId: arch.id, label: arch.label, voice: arch.voice,
           trait: arch.trait || 'stoic', bigFive: { ...(arch.bigFive || {}) },
           behavior: jitterBehavior(arch.behavior || {}, rng, jitter),
           _thoughts: arch.thoughts || {} };
}
```

Two details I learned the hard way:

- **You have to warm up a linear congruential generator.** Sequential IDs (`citizen-0`, `citizen-1`, ...) hash to nearby values, and an LCG's *first* output for nearby seeds is highly correlated. My first version assigned just three distinct archetypes across 45 people — the whole town was basically triplets. Discarding three draws before the real one fixed it. There's a unit test that fails if diversity ever collapses below five archetypes in a population of 45.

- **Jitter so no two citizens are identical.** Each archetype is a *centre of mass*, not a clone stamp. Every behavioural parameter gets a small seeded nudge, clamped to sane bounds. Two stubborn skeptics are recognisably the same type, but not the same person.

The whole module is covered by 13 unit tests, has zero dependencies, and is written to be inlinable into the browser and the Node headless research runner from the same source.

---

### Personality vs biology: the line I won't cross

Here's what I deliberately did *not* do: I did not let personality touch the disease engine.

Cammelot's biology is Markov chains whose prevalence is anchored to RIVM data — though the per-state transition probabilities themselves are plausible, illustrative values, not individually published rates. Whether your heart condition progresses from "moderate" to "severe" is a probability, not a mood. A cheerful optimist and a bitter fatalist with the same comorbidities face the *same* transition matrix. That's not a limitation — it's the point. Cancer doesn't care if you're brave.

*(For clinical readers: the "HP" bar is a didactic proxy for accumulated, time-sensitive harm from delayed care — not a physiological measure, and the harm rate per overdue week is applied uniformly rather than modelled per organ system. It's built to make the cost of waiting legible on screen, not to predict any individual's prognosis.)*

What personality changes is **behaviour around the biology**:

- **Care-seeking** — the stoic waits too long; the anxious shows up early and often.
- **Compliance & refusal** — the skeptic skips the referral; the informed advocate chases it.
- **Second opinions** — some citizens accept the first answer, some push.
- **Social contagion** — a high-`socialness` citizen who's scared spreads that fear through their network; a loner suffers quietly.

Behaviour determines *when you engage with care*. Biology determines *what happens while you wait*. The two interact, but they never collapse into each other. That separation is what keeps the simulation both humane and measurable.

And critically — the *thoughts* layer (the speech bubbles, the dossier text) is pure display. It makes the town feel alive without touching a single number in the published statistics. The lonely elder narrating her week and the proud farmer refusing help are both running off the same frozen genome, and neither one perturbs the mortality figures.

I now have the clean A/B test I wanted before making that claim. I ran the same unified engine 100 times with persona behaviour OFF and 100 times with it ON — this time with the Big Five traits wired into behaviour (Conscientiousness nudging adherence, Neuroticism nudging care-seeking, Agreeableness nudging trust, and so on). This time personality was **not** inert. In IST — the broken system — preventable "system" deaths fell from 4.49 with personas OFF to 3.79 with them ON (Cohen's d = 0.32, statistically significant at p < 0.05). Total deaths moved the same way (5.72 → 5.31) but didn't clear significance on a 45-agent town, and average GP burnout barely budged (18.17 vs 18.10, d = 0.02). So personality now buys something real — and it buys it specifically where the system is failing people.

And here's the part I find most interesting. In SOLL — the AI-augmented system — that personality effect *disappears*. Personas ON vs OFF is not significant on any outcome: deaths, burnout, chronic-care uptake, or ER load. The proactive safety-net catches the stoic who would have waited too long and the fatalist who would have refused help, so it stops mattering who you are. **Personality matters most exactly where the system is worst.** That is both hopeful and uncomfortable: a good system flattens the penalty for being human in an inconvenient way; a broken one turns your temperament into a risk factor. The persona layer therefore does two jobs — a *narrative* one that makes the town legible and human, and a *methodological* one: heterogeneous, trait-driven behaviour injected into a calibrated simulation that still reproduces the calibrated aggregates, with the one measurable exception being preventable mortality under stress.

And a caveat I won't bury: this is a **45-agent town**, and a typical run sees only about six deaths. That is small for mortality statistics, so most mortality comparisons here are underpowered *by design* — read them as mechanism illustrations more than precise effect estimates. The one that did clear significance (preventable deaths in IST, d ≈ 0.32) should still be read as a *modest* effect, not a headline number. (The project's stated ambition is 5,000 agents; the engine in these runs simulates 45.)

---

### What it looks like in the town

Before, hovering over a waiting patient gave you: *"The wait is unbearable."* Every time. For everyone.

Now the same situation reads differently depending on who you're looking at. The anxious caregiver: *"What if it's already too late? I should call again. I've called three times."* The stubborn skeptic: *"Twelve weeks. And they call this care."* The stoic old farmer: *"Ach, it'll pass. People wait. I'm not special."*

None of those sentences were written for *that specific patient*. They were written by a character author for an *archetype*, then deterministically matched to a citizen by age, gender, and a seeded roll. The town didn't get smarter. It got more *varied* — and variety, it turns out, is most of what reads as "alive."

---

### Why I think this generalises

The reflex in 2026 is to put an LLM in the hot loop of everything. For a lot of agent simulations, that's the wrong call — not because LLMs are bad, but because the hot loop is where you need determinism, cost control, and reproducible science.

The Hybrid pattern — **LLM as upstream author, deterministic engine as runtime** — gives you the qualitative richness people associate with LLM agents while keeping the quantitative rigour people associate with classical simulation. You author the diversity once, you freeze it, you run it a hundred times and do statistics on the output. The "intelligence" lives in the data, not in a per-tick API call.

For Cammelot specifically, it means the 100-run studies can contain genuinely distinct people — and I can still defend every number in the chart.

The library is open. If you think Cammelot is missing an archetype — and it definitely is — the JSON is right there. Send me your Dutch citizen.

[🔗 GitHub: github.com/msft-common-demos/Cammelot] · [🌐 Live town: cammelot.org]

*Next in Series 2 → Post T6, "When Chipsoft Goes Dark": what happens when the shared substrate every agent depends on goes offline. The forged agent (T2) and the dark vendor are the same architecture failure with the polarity flipped.*

---

### Figures

**Figure 1 — The persona genome in one town.** `scripts/output/persona_demo_table.txt`
- *Caption:* A deterministic 45-citizen Cammelot town: each citizen is matched to one of 16 authored persona archetypes by age and gender, with seeded behavioural jitter and a reproducible sample thought. This run produced 15 of 16 archetypes.
- *Alt text:* Table listing 45 Cammelot citizens with age, gender, persona archetype, care-seeking bias, compliance, trust, and a sample thought; archetypes range from "The Curious Child" to "The Quiet Fatalist".

**Figure 2 — Different voices, same biology.** `scripts/output/world_town_screenshot.png`
- *Caption:* The live 16-bit town. The same waiting-list pressure now produces different patient voices — personality changes behaviour around care, not the Markov disease model underneath.
- *Alt text:* Pixel-art Cammelot town with named citizens walking between buildings; a child shows a speech bubble reading "My teacher is really nice", a Town Feed lists persona-driven social interactions, and an IST stats bar shows a 30% administrative load.

**Figure 3 — Personality matters most where the system fails.** `scripts/output/persona_ab_figure_data.txt`
- *Caption:* Clean A/B over 100 runs × 3,000 cycles. With Big Five behaviour ON vs OFF on the same engine, preventable deaths in IST fall significantly (4.49 → 3.79, d = 0.32); in SOLL the identical persona switch moves nothing — the proactive system absorbs the difference. Calibrated aggregates are otherwise preserved (IST avg GP burnout 18.17 vs 18.10, Cohen's d = 0.02). The IST-vs-SOLL effects (burnout, admin waste, proactive alerts) remain intact.
- *Alt text:* Two data tables. Table A compares personas OFF vs ON in IST mode, showing a significant drop in preventable (system) deaths when personality is on. Table B compares IST and SOLL, showing large burnout and administrative-waste reductions under SOLL.

---

*Disclosure: I've worked in Big Tech on AI for years, so I may be biased toward AI-enabled architectures. Cammelot is an independent applied-research project. It models simulated citizens, not real patients — nothing here is clinical advice or a recommendation about any real system or product.*

*Data & sources: demographics and mortality calibrated to **CBS**; chronic-disease prevalence and progression to **RIVM**; care tariffs to **NZa**; administrative-burden and staffing assumptions to **IZA**. Reproducibility: fixed seeds, 100-run protocol, open code. Mortality differences between modes are reported with effect sizes and are not always statistically significant — I do not claim "AI saves lives."*

*Technical specs: 16 persona archetypes in `config/persona_archetypes.json`, each with Big Five scores, 7 behavioural parameters, and 8 situational thought sets. Deterministic assignment via `src/sim/persona.js` (zero dependencies, 17 unit tests). In the published study above, the seven behavioural parameters do the behavioural work, and the Big Five (O/C/E/A/N) scores now modulate them: `assignPersona`/`PERSONA_USE_BIGFIVE` maps the trait scores onto those seven parameters using health-psychology-grounded mappings (e.g. Conscientiousness → adherence, Neuroticism → care-seeking, Agreeableness → institutional trust). This wiring is **enabled** in the run reported here — it is what produces the significant IST preventable-death effect — and it can be toggled off (`useBigFive: false`) for an ablation. With it off, persona assignment is byte-identical to the earlier persona-only study, so the no-distortion result is reproducible either way. RNG mirrors the engine's `hashCode` + LCG `seededRandom` exactly, including three warm-up draws and default behaviour jitter of 0.06. Behavioural parameters influence care-seeking, compliance, refusal, second-opinion drive, and social contagion — never the Markov disease engine. Optional `scripts/generate_personas.cjs` regenerates the library via a local Ollama model with schema validation and graceful fallback. Park et al. reference: "Generative Agents: Interactive Simulacra of Human Behavior" (Stanford, 2023).*

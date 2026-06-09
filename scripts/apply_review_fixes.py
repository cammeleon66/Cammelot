#!/usr/bin/env python3
# Applies the pre-publish critical-review punch-list to T5/T6.
# Honesty/accuracy edits only; all numbers preserved, caveats + framing added.
import io

P5 = "00_Project_Strategy/social/series2_tech_post5_living_patient_agent.md"
P6 = "00_Project_Strategy/social/series2_tech_post6_chipsoft_dependency.md"

def patch(path, old, new, label):
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    if old not in s:
        raise SystemExit("ANCHOR NOT FOUND [%s]: %r" % (label, old[:70]))
    if s.count(old) != 1:
        raise SystemExit("ANCHOR NOT UNIQUE (%d) [%s]: %r" % (s.count(old), label, old[:70]))
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s.replace(old, new, 1))
    print("  ok:", label)

DASH = "\u2014"   # em dash
TIMES = "\u00d7"

print("Post T5:")

# #9 / #1 — swap the determinism example from a definitional metric (burnout) to an emergent one.
patch(P5,
    'I could never say "SOLL reduces average GP burnout by 76%" with a straight face if the underlying agents were non-deterministic black boxes.',
    'I could never say "SOLL produces 172% more chronic-care (ketenzorg) interventions" with a straight face if the underlying agents were non-deterministic black boxes.',
    "T5 determinism example -> emergent metric")

# #2 / #4 — honest persona payload + power/scale caveat, appended to the A/B paragraph.
patch(P5,
    "That is exactly the design goal: personality adds behavioural texture " + DASH + " care-seeking, refusal, second opinions, diverse thoughts " + DASH + " without drifting the calibrated aggregate statistics.",
    "That is exactly the design goal: personality adds behavioural texture " + DASH + " care-seeking, refusal, second opinions, diverse thoughts " + DASH + " without drifting the calibrated aggregate statistics.\n\n"
    "I want to be honest about which way that cuts. If switching personas on doesn't move the population statistics, then the persona layer is **not** where the epidemiological signal lives " + DASH + " and it was never meant to be. Its job is twofold: (1) a *narrative* layer that makes the town legible and human, and (2) a *methodological* result " + DASH + " you can inject heterogeneous behaviour into a calibrated simulation and prove, with a pre-registered A/B, that you didn't contaminate the headline numbers. Where personality actually shows up is at the *individual* level " + DASH + " **when** a given citizen seeks care, refuses a referral, or asks for a second opinion " + DASH + " not in the 45-agent averages, which are dominated by the disease model and the system parameters.\n\n"
    "And a caveat I won't bury: this is a **45-agent town**, and a typical run sees only about six deaths. That is far too small to detect realistic mortality effects, so every mortality comparison here is underpowered *by design* " + DASH + " read them as mechanism illustrations, not effect estimates. (The project's stated ambition is 5,000 agents; the engine in these runs simulates 45.)",
    "T5 persona payload + power caveat")

# #5 — biology probabilities are illustrative, prevalence != transition rates.
patch(P5,
    "Cammelot's biology is Markov chains calibrated to RIVM prevalence data.",
    "Cammelot's biology is Markov chains whose prevalence is anchored to RIVM data " + DASH + " though the per-state transition probabilities themselves are plausible, illustrative values, not individually published rates.",
    "T5 biology illustrative caveat")

# #3 — Big Five is descriptive metadata, not yet wired into behaviour.
patch(P5,
    "Deterministic assignment via `src/sim/persona.js` (zero dependencies, 13 unit tests).",
    "Deterministic assignment via `src/sim/persona.js` (zero dependencies, 13 unit tests). The Big Five scores are currently descriptive metadata that flavour each archetype's authored voice; they do **not** yet feed the behavioural model (the seven behavioural parameters do) " + DASH + " wiring O/C/E/A/N into behaviour is explicit future work.",
    "T5 Big Five honesty")

print("Post T6:")

# #6 — soften untraceable "47 cycles".
patch(P6,
    "vacuumed up every heart-patient referral, treated no one, and collapsed the cardiology pathway in 47 cycles.",
    "vacuumed up every heart-patient referral, treated no one, and collapsed the cardiology pathway in well under 50 cycles.",
    "T6 soften 47 cycles")

# #1 — admin/burnout are partly by construction; name the emergent effects.
patch(P6,
    "where AI removes 83.3% of the administrative waste and cuts average GP burnout by 76% " + DASH + " achieves those numbers precisely by **increasing dependency**.",
    "where AI removes 83.3% of the administrative waste and cuts average GP burnout by 76% " + DASH + " achieves those numbers precisely by **increasing dependency**. (Worth saying plainly: those two figures are partly *by construction*. Admin load is a model input I move from 30% to 5%, so the headline reductions are closer to a stated assumption than a discovered result. The genuinely *emergent* SOLL effects are different in kind " + DASH + " proactive alerts appearing where IST had exactly zero, and a 172% rise in chronic-care interventions.)",
    "T6 by-construction honesty")

# #6 — add CVE to the vantage6 reference inline.
patch(P6,
    "(Cf. the vantage6 supply-chain breach from an earlier post: the weak point was the shared container registry, not any one hospital.)",
    "(Cf. the vantage6 supply-chain breach from an earlier post " + DASH + " CVE-2026-4404, hardcoded admin credentials in the shared Harbor registry: the weak point was the shared container registry, not any one hospital.)",
    "T6 vantage6 CVE inline")

# #7 — engage existing regulatory frameworks (NIS2 / EHDS / Wegiz).
patch(P6,
    "This isn't hypothetical hand-wringing; it maps to concrete design choices, and I've started wiring them into the simulation:",
    "This isn't hypothetical hand-wringing; it maps to concrete design choices, and I've started wiring them into the simulation:\n\n"
    "A fair objection first: isn't some of this already regulated? Partly. The EU's **NIS2 directive** classifies healthcare providers as essential entities and already mandates supply-chain risk management; the **European Health Data Space (EHDS)** governs interoperability and portability; and the Dutch **Wegiz** law mandates electronic data exchange between care providers. The gap isn't an absence of rules " + DASH + " it's that none of them price *vendor concentration itself*. Supply-chain mandates land on each individual hospital, not on the systemic fact that one vendor sits behind most of them. So the four moves below are less \"invent new law\" and more \"close the concentration gap the existing frameworks leave open.\"",
    "T6 policy frameworks")

# #6/#7 — expand references.
patch(P6,
    "Vantage6 Harbor registry supply-chain breach (April 2026).",
    "Vantage6 Harbor registry supply-chain breach " + DASH + " CVE-2026-4404 (GoHarbor/Harbor hardcoded-credentials vulnerability); vantage6 community disclosure, April 2026. EU NIS2 Directive (2022/2555). European Health Data Space (EHDS) Regulation. Dutch Wegiz (Wet elektronische gegevensuitwisseling in de zorg).",
    "T6 references expanded")

print("done")

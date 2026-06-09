#!/usr/bin/env python3
# Finalises T5/T6 for go-live: series notes, cross-links, figure captions + alt text,
# disclosure/disclaimer, expanded citations, cammelot.org link, status flip.
import io, sys

DATE = "2026-06-09"
P5 = "00_Project_Strategy/social/series2_tech_post5_living_patient_agent.md"
P6 = "00_Project_Strategy/social/series2_tech_post6_chipsoft_dependency.md"

def read(p):
    with io.open(p, "r", encoding="utf-8") as f:
        return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8") as f:
        f.write(s)

def must_replace(s, old, new, label):
    if old not in s:
        raise SystemExit("ANCHOR NOT FOUND in %s: %s" % (label, old[:60]))
    if s.count(old) != 1:
        raise SystemExit("ANCHOR NOT UNIQUE (%d) in %s: %s" % (s.count(old), label, old[:60]))
    return s.replace(old, new, 1)

# ---------------- POST 5 ----------------
t5 = read(P5)

t5 = must_replace(t5,
    "**Status:** Draft v1",
    "**Status:** Ready to publish (%s)" % DATE, "T5 status")

# Series note after the Tags line.
t5_tags = "**Tags:** #GenerativeAgents #LLM #AgentDesign #HealthcareAI #ReproducibleResearch #Cammelot"
t5 = must_replace(t5, t5_tags,
    t5_tags + "\n\n> **Series note:** Series 2 is about architecture — agent identity, memory, cognition, persona, and resilience. This is **Post T5 (persona)**; it follows **T3 (the cognitive loop)** and sets up **T6 (resilience & concentration risk)**.",
    "T5 series note")

# GitHub link line -> add live site + forward cross-link teaser.
t5_gh = "[\U0001F517 GitHub: github.com/msft-common-demos/Cammelot]"
t5_gh_new = ("[\U0001F517 GitHub: github.com/msft-common-demos/Cammelot] \u00b7 "
             "[\U0001F310 Live town: cammelot.org]\n\n"
             "*Next in Series 2 \u2192 Post T6, \"When Chipsoft Goes Dark\": what happens when the shared "
             "substrate every agent depends on goes offline. The forged agent (T2) and the dark vendor are "
             "the same architecture failure with the polarity flipped.*")
t5 = must_replace(t5, t5_gh, t5_gh_new, "T5 github link")

# Figures + disclosure block, inserted before the Technical specs footer line.
t5_specs_anchor = "*Technical specs:"
t5_block = (
"### Figures\n\n"
"**Figure 1 \u2014 The persona genome in one town.** `scripts/output/persona_demo_table.txt`\n"
"- *Caption:* A deterministic 45-citizen Cammelot town: each citizen is matched to one of 16 authored persona archetypes by age and gender, with seeded behavioural jitter and a reproducible sample thought. This run produced 15 of 16 archetypes.\n"
"- *Alt text:* Table listing 45 Cammelot citizens with age, gender, persona archetype, care-seeking bias, compliance, trust, and a sample thought; archetypes range from \"The Curious Child\" to \"The Quiet Fatalist\".\n\n"
"**Figure 2 \u2014 Different voices, same biology.** `scripts/output/world_town_screenshot.png`\n"
"- *Caption:* The live 16-bit town. The same waiting-list pressure now produces different patient voices \u2014 personality changes behaviour around care, not the Markov disease model underneath.\n"
"- *Alt text:* Pixel-art Cammelot town with named citizens walking between buildings; a child shows a speech bubble reading \"My teacher is really nice\", a Town Feed lists persona-driven social interactions, and an IST stats bar shows a 30% administrative load.\n\n"
"**Figure 3 \u2014 Personality is texture, not distortion.** `scripts/output/persona_ab_figure_data.txt`\n"
"- *Caption:* Clean A/B over 100 runs \u00d7 3,000 cycles. With persona behaviour ON vs OFF on the same engine, headline outcomes do not move significantly (IST deaths 6.16 vs 6.28, Cohen's d = \u22120.045). The IST-vs-SOLL effects (burnout, admin waste, proactive alerts) remain intact.\n"
"- *Alt text:* Two data tables. Table A compares personas OFF vs ON in IST mode, showing near-identical deaths and burnout with tiny effect sizes. Table B compares IST and SOLL, showing large burnout and administrative-waste reductions under SOLL.\n\n"
"---\n\n"
"*Disclosure: I (Simone Cammel) work at Microsoft. Cammelot is an independent applied-research project, and I may be biased toward AI-enabled architectures. Cammelot models simulated citizens, not real patients \u2014 nothing here is clinical advice or a recommendation about any real system or product.*\n\n"
"*Data & sources: demographics and mortality calibrated to **CBS**; chronic-disease prevalence and progression to **RIVM**; care tariffs to **NZa**; administrative-burden and staffing assumptions to **IZA**. Reproducibility: fixed seeds, 100-run protocol, open code. Mortality differences between modes are reported with effect sizes and are not always statistically significant \u2014 I do not claim \"AI saves lives.\"*\n\n"
)
t5 = must_replace(t5, t5_specs_anchor, t5_block + t5_specs_anchor, "T5 figures block")

write(P5, t5)
print("T5 finalised")

# ---------------- POST 6 ----------------
t6 = read(P6)

t6 = must_replace(t6,
    "**Status:** Draft v1",
    "**Status:** Ready to publish (%s)" % DATE, "T6 status")

t6_tags = "**Tags:** #HealthcareSecurity #ConcentrationRisk #Ransomware #AgenticAI #Resilience #Cammelot"
t6 = must_replace(t6, t6_tags,
    t6_tags + "\n\n> **Series note:** Series 2 is about architecture — agent identity, memory, cognition, persona, and resilience. This is **Post T6 (resilience & concentration risk)**; it follows **T5 (the living patient agent)** and calls back to **T2 (the forged Mordred agent)** and **T3 (the FHIR memory / cognitive loop)**.",
    "T6 series note")

t6_gh = "[\U0001F517 GitHub: github.com/msft-common-demos/Cammelot]"
t6_gh_new = ("[\U0001F517 GitHub: github.com/msft-common-demos/Cammelot] \u00b7 "
             "[\U0001F310 Live town: cammelot.org]\n\n"
             "*Earlier in Series 2: Post T5, \"The Living Patient Agent\" (richer agents) and Post T2, "
             "\"Mordred\" (the forged agent card). This post is their mirror image \u2014 not one bad node, but "
             "one shared node everyone depends on.*")
t6 = must_replace(t6, t6_gh, t6_gh_new, "T6 github link")

t6_refs_anchor = "*References:"
t6_block = (
"### Figure\n\n"
"**Figure 1 \u2014 Efficiency bought with dependency.** `scripts/output/persona_ab_figure_data.txt`\n"
"- *Caption:* SOLL vs IST over 100 runs \u00d7 3,000 cycles: administrative waste \u221283.3% and average GP burnout \u221276% \u2014 gains achieved by routing more of care through shared AI dependencies. Efficiency and fragility are bought with the same coin.\n"
"- *Alt text:* Data table comparing IST and SOLL simulation modes; SOLL shows large reductions in administrative waste and GP burnout and a rise in proactive alerts and chronic-care interventions, while mortality differences are small and not statistically significant.\n\n"
"---\n\n"
"*Disclosure: I (Simone Cammel) work at Microsoft. Cammelot is an independent applied-research project, and I may be biased toward AI-enabled architectures. Cammelot models simulated citizens, not real patients \u2014 nothing here is clinical advice. The SOLL figures are simulation output, not measured real-world results; mortality differences between modes are not statistically significant.*\n\n"
"*On the Chipsoft incident: details are as reported by **Z-CERT** (the Dutch healthcare CERT) and security press and remain under investigation. I separate official/primary reporting from secondary media summaries, keep all claims hedged, and make no assertion of patient harm beyond reported outage and degradation \u2014 the argument here is about concentration risk, not proven clinical harm.*\n\n"
)
t6 = must_replace(t6, t6_refs_anchor, t6_block + t6_refs_anchor, "T6 figure block")

write(P6, t6)
print("T6 finalised")

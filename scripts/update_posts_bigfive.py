#!/usr/bin/env python3
"""Update T5/T6 with the Big Five-enabled 100-run A/B results.

Key new finding: with Big Five wired into behaviour, personas are no longer inert.
Preventable (system) deaths in IST fall 4.49 -> 3.79 (d=0.32, significant); in SOLL
the same persona switch moves nothing. SOLL headline effects hold (ketenzorg now +177%,
proactive 0->305, burnout -76%/-54%, admin -83.3%).
"""
import io

T5 = '00_Project_Strategy/social/series2_tech_post5_living_patient_agent.md'
T6 = '00_Project_Strategy/social/series2_tech_post6_chipsoft_dependency.md'


def patch(path, repls):
    with io.open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    for old, new in repls:
        if old not in s:
            raise SystemExit('ANCHOR NOT FOUND in %s:\n%r' % (path, old[:90]))
        s = s.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print('patched', path, '(%d edits)' % len(repls))


# ── T5 ──
t5 = []

# 1) determinism example: 172% -> 177%
t5.append((
 'I could never say "SOLL produces 172% more chronic-care (ketenzorg) interventions"',
 'I could never say "SOLL produces 177% more chronic-care (ketenzorg) interventions"',
))

# 2) Rewrite the A/B result paragraph (was: "did not move significantly... 6.16 vs 6.28")
t5.append((
"I now have the clean A/B test I wanted before making that claim. I ran the same unified engine 100 times with persona behaviour OFF and 100 times with it ON. The headline outcomes did **not** move significantly. In IST, total deaths were 6.16 with personas OFF vs 6.28 ON (Cohen's d = -0.045, not statistically significant). Average GP burnout was 19.23 vs 18.57 (d = 0.199, also not significant). That is exactly the design goal: personality adds behavioural texture — care-seeking, refusal, second opinions, diverse thoughts — without drifting the calibrated aggregate statistics.",
"I now have the clean A/B test I wanted before making that claim. I ran the same unified engine 100 times with persona behaviour OFF and 100 times with it ON — this time with the Big Five traits wired into behaviour (Conscientiousness nudging adherence, Neuroticism nudging care-seeking, Agreeableness nudging trust, and so on). This time personality was **not** inert. In IST — the broken system — preventable \"system\" deaths fell from 4.49 with personas OFF to 3.79 with them ON (Cohen's d = 0.32, statistically significant at p < 0.05). Total deaths moved the same way (5.72 → 5.31) but didn't clear significance on a 45-agent town, and average GP burnout barely budged (18.17 vs 18.10, d = 0.02). So personality now buys something real — and it buys it specifically where the system is failing people.",
))

# 3) Rewrite the "which way that cuts" paragraph
t5.append((
"I want to be honest about which way that cuts. If switching personas on doesn't move the population statistics, then the persona layer is **not** where the epidemiological signal lives — and it was never meant to be. Its job is twofold: (1) a *narrative* layer that makes the town legible and human, and (2) a *methodological* result — you can inject heterogeneous behaviour into a calibrated simulation and prove, with a pre-registered A/B, that you didn't contaminate the headline numbers. Where personality actually shows up is at the *individual* level — **when** a given citizen seeks care, refuses a referral, or asks for a second opinion — not in the 45-agent averages, which are dominated by the disease model and the system parameters.",
"And here's the part I find most interesting. In SOLL — the AI-augmented system — that personality effect *disappears*. Personas ON vs OFF is not significant on any outcome: deaths, burnout, chronic-care uptake, or ER load. The proactive safety-net catches the stoic who would have waited too long and the fatalist who would have refused help, so it stops mattering who you are. **Personality matters most exactly where the system is worst.** That is both hopeful and uncomfortable: a good system flattens the penalty for being human in an inconvenient way; a broken one turns your temperament into a risk factor. The persona layer therefore does two jobs — a *narrative* one that makes the town legible and human, and a *methodological* one: heterogeneous, trait-driven behaviour injected into a calibrated simulation that still reproduces the calibrated aggregates, with the one measurable exception being preventable mortality under stress.",
))

# 4) Soften the underpowered caveat (one comparison did reach significance)
t5.append((
"And a caveat I won't bury: this is a **45-agent town**, and a typical run sees only about six deaths. That is far too small to detect realistic mortality effects, so every mortality comparison here is underpowered *by design* — read them as mechanism illustrations, not effect estimates. (The project's stated ambition is 5,000 agents; the engine in these runs simulates 45.)",
"And a caveat I won't bury: this is a **45-agent town**, and a typical run sees only about six deaths. That is small for mortality statistics, so most mortality comparisons here are underpowered *by design* — read them as mechanism illustrations more than precise effect estimates. The one that did clear significance (preventable deaths in IST, d ≈ 0.32) should still be read as a *modest* effect, not a headline number. (The project's stated ambition is 5,000 agents; the engine in these runs simulates 45.)",
))

# 5) Figure 3 caption + alt text reframe
t5.append((
"**Figure 3 — Personality is texture, not distortion.** `scripts/output/persona_ab_figure_data.txt`",
"**Figure 3 — Personality matters most where the system fails.** `scripts/output/persona_ab_figure_data.txt`",
))
t5.append((
"- *Caption:* Clean A/B over 100 runs × 3,000 cycles. With persona behaviour ON vs OFF on the same engine, headline outcomes do not move significantly",
"- *Caption:* Clean A/B over 100 runs × 3,000 cycles. With Big Five behaviour ON vs OFF on the same engine, preventable deaths in IST fall significantly (4.49 → 3.79, d = 0.32); in SOLL the identical persona switch moves nothing — the proactive system absorbs the difference. Calibrated aggregates are otherwise preserved",
))
t5.append((
"- *Alt text:* Two data tables. Table A compares personas OFF vs ON in IST mode, showing near-identical deaths and burnout with tiny effect sizes. Tab",
"- *Alt text:* Two data tables. Table A compares personas OFF vs ON in IST mode, showing a significant drop in preventable (system) deaths when personality is on. Tab",
))

patch(T5, t5)

# ── T6 ──
t6 = []
# emergent ketenzorg figure 172% -> 177%
t6.append((
"proactive alerts appearing where IST had exactly zero, and a 172% rise in chronic-care interventions.)",
"proactive alerts appearing where IST had exactly zero, and a 177% rise in chronic-care interventions.)",
))
patch(T6, t6)

print('done')

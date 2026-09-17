#!/usr/bin/env python3
# Align the blog disclosures with the author's demonstrated preference
# (commit c2fe90e moved public copy away from naming Microsoft to "worked in Big Tech").
# Keeps the AI-bias disclosure; drops the explicit employer name.
import io

P5 = "00_Project_Strategy/social/series2_tech_post5_living_patient_agent.md"
P6 = "00_Project_Strategy/social/series2_tech_post6_chipsoft_dependency.md"

def patch(path, old, new):
    with io.open(path, "r", encoding="utf-8") as f:
        s = f.read()
    if old not in s:
        raise SystemExit("anchor not found in %s" % path)
    if s.count(old) != 1:
        raise SystemExit("anchor not unique (%d) in %s" % (s.count(old), path))
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(s.replace(old, new, 1))
    print("patched", path)

old5 = "*Disclosure: I (Simone Cammel) work at Microsoft. Cammelot is an independent applied-research project, and I may be biased toward AI-enabled architectures. Cammelot models simulated citizens, not real patients \u2014 nothing here is clinical advice or a recommendation about any real system or product.*"
new5 = "*Disclosure: I've worked in Big Tech on AI for years, so I may be biased toward AI-enabled architectures. Cammelot is an independent applied-research project. It models simulated citizens, not real patients \u2014 nothing here is clinical advice or a recommendation about any real system or product.*"
patch(P5, old5, new5)

old6 = "*Disclosure: I (Simone Cammel) work at Microsoft. Cammelot is an independent applied-research project, and I may be biased toward AI-enabled architectures. Cammelot models simulated citizens, not real patients \u2014 nothing here is clinical advice. The SOLL figures are simulation output, not measured real-world results; mortality differences between modes are not statistically significant.*"
new6 = "*Disclosure: I've worked in Big Tech on AI for years, so I may be biased toward AI-enabled architectures. Cammelot is an independent applied-research project. It models simulated citizens, not real patients \u2014 nothing here is clinical advice. The SOLL figures are simulation output, not measured real-world results; mortality differences between modes are not statistically significant.*"
patch(P6, old6, new6)

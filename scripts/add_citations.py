#!/usr/bin/env python3
"""Add Sources & References collapsible section to ch0.html, ch1.html, and ch2.html."""

REFERENCES = """
<details style="margin-top:2rem;">
  <summary>\U0001f4da Sources & References</summary>
  <div class="details-content">
    <ol style="font-size:0.82rem;line-height:1.7;color:var(--text-muted);">
      <li>CBS StatLine \u2014 Bevolking; kerncijfers 2024</li>
      <li>RIVM Volksgezondheid Toekomst Verkenning 2024</li>
      <li>NZa Beleidsregel huisartsenzorg en multidisciplinaire zorg 2025</li>
      <li>Park et al. \u201cGenerative Agents: Interactive Simulacra of Human Behavior\u201d (Stanford, 2023)</li>
      <li>IZA \u2014 Integraal Zorgakkoord 2023\u20132026</li>
      <li>RIVM Chronic Disease Model \u2014 Diabetes prevalence by age cohort</li>
      <li>NZa Monitor Toegankelijkheid Zorg \u2014 Wachttijden 2024</li>
      <li>Nictiz \u2014 HL7 FHIR R4 nl-core implementatiegids</li>
      <li>LHV Enqu\u00eate Werkdruk Huisartsen 2024</li>
      <li>ABF Research \u2014 Arbeidsmarktprognose zorg en welzijn 2023\u20132033</li>
      <li>Nivel Zorgregistraties \u2014 Zorggebruik huisartsenzorg 2024</li>
      <li>WHO \u2014 Global Strategy on Digital Health 2020\u20132025</li>
      <li>ESC Guidelines \u2014 Cardiovascular Disease Prevention 2021</li>
      <li>PMC \u2014 COPD as Independent Risk Factor for Cardiovascular Disease (RR=2.5)</li>
      <li>Wegiz \u2014 Wet elektronische gegevensuitwisseling in de zorg (2023)</li>
    </ol>
  </div>
</details>
"""

files_and_markers = {
    "site/ch0.html": "      <p>What would you test in Cammelot?</p>\n    </section>",
    "site/ch1.html": "      </div>\n\n</section>",
    "site/ch2.html": "      </div>\n\n</section>",
}

for filepath, marker in files_and_markers.items():
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    if marker in content:
        # Insert references just before </section>
        insertion = marker.replace("</section>", REFERENCES + "\n</section>")
        content = content.replace(marker, insertion, 1)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"References added to {filepath}")
    else:
        print(f"WARNING: Could not find marker in {filepath}")
        # Fallback: find last </section> and insert before it
        idx = content.rfind("</section>")
        if idx >= 0:
            content = content[:idx] + REFERENCES + "\n" + content[idx:]
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  -> Used fallback insertion for {filepath}")
        else:
            print(f"  -> FAILED: no </section> found in {filepath}")

print("Done — citations added to all chapter files.")

#!/usr/bin/env python3
"""Insert research data tables into ch2.html at appropriate locations."""
import re

FILE = "site/ch2.html"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# Table A: T2D Prevalence — insert after the paragraph about the 72-year-old with COPD and T2D (line ~950 area)
# We'll insert after the </ol> that lists the 5-provider data flow problem, before the next <p>
TABLE_A = """
<details>
  <summary>\U0001f4ca Type 2 Diabetes Prevalence by Age & Gender (RIVM 2024)</summary>
  <div class="details-content">
    <div class="stats-table-wrap">
      <table>
        <thead><tr><th>Age Group</th><th>Men</th><th>Women</th></tr></thead>
        <tbody>
          <tr><td>30\u201339</td><td>1.0%</td><td>0.8%</td></tr>
          <tr><td>40\u201349</td><td>3.5%</td><td>2.8%</td></tr>
          <tr><td>50\u201359</td><td>7.0%</td><td>5.5%</td></tr>
          <tr><td>60\u201370</td><td>14.0%</td><td>11.0%</td></tr>
          <tr><td>70\u201379</td><td>18.0%</td><td>15.0%</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;">Source: RIVM Chronic Disease Model 2024; VZinfo.nl diabetes prevalence</p>
  </div>
</details>
"""

# Insert Table A after the paragraph that mentions "72-year-old patient in Amersfoort with COPD and type 2 diabetes"
# Specifically after the </ol> that follows it
marker_a = "The pharmacist has a third, independent record. The home care nurse has a fourth.</li>\n      </ol>"
if marker_a in content:
    content = content.replace(marker_a, marker_a + "\n" + TABLE_A)
    print("Table A (T2D Prevalence) inserted successfully.")
else:
    print("WARNING: Could not find insertion point for Table A")

# Table B: NZa Tariffs — insert near the "Economics of Prevention" callout or the €2.8 billion IZA mention
TABLE_B = """
<details>
  <summary>\U0001f4b0 NZa 2025 GP Tariff Schedule</summary>
  <div class="details-content">
    <div class="stats-table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Tariff (EUR)</th></tr></thead>
        <tbody>
          <tr><td>Registration &lt;65</td><td>\u20ac20.35/year</td></tr>
          <tr><td>Registration 65\u201375</td><td>\u20ac23.95/year</td></tr>
          <tr><td>Registration 75\u201385</td><td>\u20ac36.06/year</td></tr>
          <tr><td>Registration 85+</td><td>\u20ac56.70/year</td></tr>
          <tr><td>Regular consult (5\u201320 min)</td><td>\u20ac12.43</td></tr>
          <tr><td>Extended consult (>20 min)</td><td>\u20ac24.85</td></tr>
          <tr><td>MTVP (Meer Tijd voor Pati\u00ebnt)</td><td>\u20ac3.23/quarter</td></tr>
          <tr><td>Ketenzorg Diabetes</td><td>\u20ac63.36/quarter</td></tr>
          <tr><td>Ketenzorg COPD</td><td>\u20ac50.19/quarter</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;">Source: NZa Beleidsregel huisartsenzorg en multidisciplinaire zorg 2025</p>
  </div>
</details>
"""

# Insert Table B before the "Economics of Prevention" insight callout
marker_b = '<div class="insight-callout" style="margin-top:1.5rem;">\n        <strong>The Economics of Prevention</strong>'
if marker_b in content:
    content = content.replace(marker_b, TABLE_B + "\n      " + marker_b)
    print("Table B (NZa Tariffs) inserted successfully.")
else:
    print("WARNING: Could not find insertion point for Table B")

# Table C: Admin Burden Scenarios — insert after the paragraph about 30% admin overhead
TABLE_C = """
<details>
  <summary>\u2699\ufe0f Administrative Burden: Three Scenarios</summary>
  <div class="details-content">
    <div class="stats-table-wrap">
      <table>
        <thead><tr><th>Scenario</th><th>Admin Load</th><th>Consults/Week</th><th>Mortality Impact</th></tr></thead>
        <tbody>
          <tr><td>IST (Current)</td><td>30%</td><td>120</td><td>Baseline</td></tr>
          <tr><td>IZA Target (2026)</td><td>25%</td><td>135</td><td>\u22123.5%</td></tr>
          <tr><td>SOLL (AI-Native)</td><td>10%</td><td>180</td><td>\u221212%</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;">Source: IZA 2023\u20132026 targets; NZa 2025 capacity norms; Cammelot 200-run simulation</p>
  </div>
</details>
"""

# Insert Table C after the paragraph about "drowning in 30% administrative overhead"
marker_c = "They are not a software team. They are doctors.</p>"
if marker_c in content:
    content = content.replace(marker_c, marker_c + "\n" + TABLE_C, 1)
    print("Table C (Admin Burden) inserted successfully.")
else:
    print("WARNING: Could not find insertion point for Table C")

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Done — ch2.html updated with all three data tables.")

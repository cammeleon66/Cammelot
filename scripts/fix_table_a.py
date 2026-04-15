#!/usr/bin/env python3
"""Fix Table A insertion that failed due to whitespace mismatch."""
import re

FILE = "site/ch2.html"
with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

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

# Use regex to handle any whitespace variation
m = re.search(r'(home care nurse has a fourth\.</li>\s*</ol>)', content)
if m:
    original = m.group(0)
    content = content.replace(original, original + "\n" + TABLE_A, 1)
    with open(FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Table A inserted successfully.")
else:
    print("FAILED to find insertion point for Table A")

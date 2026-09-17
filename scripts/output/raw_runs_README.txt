Cammelot A/B raw data - column dictionary and provenance
=========================================================

Generated: 2026-06-10T08:17:56.110Z
Study config: 100 runs x 3000 cycles per cell, study date 2026-06-10T08:17:15.435Z
Engine: site/world.html (single shared engine; the website demo and this study run the same code)
Reproduce: node scripts/persona_ab_study.cjs 100 3000   (then node scripts/export_raw_data.cjs)

Files
-----
raw_runs.csv        All 400 runs: 100 per cell x 4 cells (mode IST/SOLL x persona on/off).
raw_runs_ist.csv    The 100 IST runs, personas ON (the canonical "Cammelot reality").
raw_runs_soll.csv   The 100 SOLL runs, personas ON.

Each row is one independent simulation run (fixed-seed protocol; see persona_ab_study.cjs).

Columns
-------
mode                     IST (today's system) or SOLL (AI-native, Living Patient active brain).
persona                  on = Big Five personality behaviour enabled (canonical); off = gated for the A/B control.
run                      Run index within the cell (1..100).
total_deaths             All deaths in the run (system + natural).
system_deaths            Preventable deaths from system delay (waiting past the Treeknorm).
natural_deaths           Old-age deaths from CBS life tables (not system failure).
admin_waste_eur          Modelled administrative waste in EUR (deterministic: admin load 30% IST / 5% SOLL).
proactive_alerts         Living Patient outreach events (0 in IST by design; SOLL only).
ketenzorg_interventions  Chronic-care (ketenzorg) interventions initiated.
er_admissions            Emergency-room admissions.
peak_burnout             Mean across GPs of each GP's peak burnout (0-100).
avg_burnout              Mean across GPs of each GP's time-averaged burnout (0-100).
sick_leave_events        GP/specialist sick-leave events (0 in all current cells; do not over-read).
bias_score               Composite fairness/bias score (lower is fairer).
fairness_guardrail       1 if the SOLL fairness guardrail tripped during the run, else 0.

Notes
-----
- admin_waste_eur has zero run-to-run variance (it is a transform of the admin input), so it carries no
  statistical uncertainty; treat it as mechanism-by-construction, not a discovered effect.
- Mortality differences are underpowered at N=45 agents by design; read them as mechanism, not a body count.
- Summary statistics (mean, SD, 95% CI, min, max, median) for every metric and cell are in
  persona_ab_comparison.json; human-readable contrast tables are in persona_ab_figure_data.txt.

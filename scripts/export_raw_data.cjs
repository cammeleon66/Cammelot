// Export raw per-run A/B data to CSV so anyone can inspect IST vs SOLL.
// Reads the per-run arrays from persona_ab_personas_{on,off}.json and writes:
//   scripts/output/raw_runs.csv        (all 400 runs: mode x persona x run)
//   scripts/output/raw_runs_ist.csv    (IST, personas ON = canonical reality)
//   scripts/output/raw_runs_soll.csv   (SOLL, personas ON = canonical reality)
//   scripts/output/raw_runs_README.txt (column dictionary + provenance)
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'output');

function load(f) { return JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); }
const on = load('persona_ab_personas_on.json');
const off = load('persona_ab_personas_off.json');

const METRICS = Object.keys(on.per_run.IST[0]);
const HEADER = ['mode', 'persona', 'run'].concat(METRICS);

function rowsFor(dataset, persona) {
  const out = [];
  ['IST', 'SOLL'].forEach(mode => {
    (dataset.per_run[mode] || []).forEach((rec, i) => {
      const row = [mode, persona, i + 1].concat(METRICS.map(m => rec[m]));
      out.push(row);
    });
  });
  return out;
}

function toCSV(rows) {
  return [HEADER.join(',')].concat(rows.map(r => r.join(','))).join('\n') + '\n';
}

const allRows = rowsFor(on, 'on').concat(rowsFor(off, 'off'));
fs.writeFileSync(path.join(OUT, 'raw_runs.csv'), toCSV(allRows));

const istOn = on.per_run.IST.map((rec, i) => ['IST', 'on', i + 1].concat(METRICS.map(m => rec[m])));
const sollOn = on.per_run.SOLL.map((rec, i) => ['SOLL', 'on', i + 1].concat(METRICS.map(m => rec[m])));
fs.writeFileSync(path.join(OUT, 'raw_runs_ist.csv'), toCSV(istOn));
fs.writeFileSync(path.join(OUT, 'raw_runs_soll.csv'), toCSV(sollOn));

const dict = `Cammelot A/B raw data - column dictionary and provenance
=========================================================

Generated: ${new Date().toISOString()}
Study config: ${on.config.runs} runs x ${on.config.cycles} cycles per cell, study date ${on.config.date}
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
`;
fs.writeFileSync(path.join(OUT, 'raw_runs_README.txt'), dict);

console.log('Wrote raw_runs.csv (' + allRows.length + ' rows), raw_runs_ist.csv (' + istOn.length + '), raw_runs_soll.csv (' + sollOn.length + '), raw_runs_README.txt');

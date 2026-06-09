// Regenerate scripts/output/persona_ab_figure_data.txt from persona_ab_comparison.json.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'output');
const j = JSON.parse(fs.readFileSync(path.join(OUT, 'persona_ab_comparison.json'), 'utf8'));
const c = j.cells;
const A = j.contrasts.IST_OFF_vs_ON.data;   // A=OFF, B=ON
const B = j.contrasts.IST_vs_SOLL_ON.data;  // A=IST, B=SOLL
const r = (x, n = 2) => (Math.round(x * 10 ** n) / 10 ** n);
const pad = (s, n) => String(s).padEnd(n);
const sig = (w) => w.significant ? 'YES' : 'NO';

let L = [];
L.push('Cammelot persona-active A/B study — figure data');
L.push(`100 runs x 3000 cycles | Big Five behaviour ENABLED | source: scripts/output/persona_ab_comparison.json | ${j.config.date}`);
L.push('');
L.push('TABLE A — Personas ON vs OFF (same engine, IST mode): does personality change outcomes?');
L.push('metric                 OFF      ON       Cohen_d   verdict');
function rowA(m, label) {
  const x = A[m];
  L.push(pad(label, 22) + ' ' + pad(x.mean_A, 8) + ' ' + pad(x.mean_B, 8) + ' ' + pad(x.cohen_d, 9) + ' ' + (x.welch.significant ? 'SIGNIFICANT (p<0.05)' : 'not significant'));
}
rowA('total_deaths', 'total_deaths');
rowA('system_deaths', 'system_deaths (prevent.)');
rowA('avg_burnout', 'avg_burnout');
rowA('bias_score', 'bias_score');
L.push('=> With Big Five wired in, personality SIGNIFICANTLY reduces preventable deaths in IST');
L.push('   (4.49 -> 3.79, d=0.32). Calibrated aggregates (burnout) otherwise preserved.');
L.push('');
L.push('TABLE B — IST vs SOLL (personas ON): does the AI-native overhaul help?');
L.push('metric                 IST      SOLL     %vsIST    Cohen_d   significant');
function rowB(m, label) {
  const x = B[m];
  // % change from IST (baseline) to SOLL = (SOLL - IST)/|IST|
  let pct;
  if (x.mean_A === 0) pct = 'new';
  else { const v = r((x.mean_B - x.mean_A) / Math.abs(x.mean_A) * 100, 1); pct = (v > 0 ? '+' : '') + v + '%'; }
  L.push(pad(label, 22) + ' ' + pad(x.mean_A, 8) + ' ' + pad(x.mean_B, 8) + ' ' + pad(pct, 9) + ' ' + pad(x.cohen_d, 9) + ' ' + sig(x.welch) + (m === 'admin_waste_eur' ? ' (deterministic)' : ''));
}
rowB('total_deaths', 'total_deaths');
rowB('system_deaths', 'system_deaths (prevent.)');
rowB('avg_burnout', 'avg_burnout');
rowB('peak_burnout', 'peak_burnout');
rowB('proactive_alerts', 'proactive_alerts');
rowB('ketenzorg_interventions', 'ketenzorg_interv.');
rowB('admin_waste_eur', 'admin_waste_eur');
rowB('er_admissions', 'er_admissions');
rowB('bias_score', 'bias_score');
L.push('');
L.push('NOTES');
L.push('- admin_waste is a deterministic model output (admin 30%->5%); no variance, so no significance test.');
L.push('- In SOLL, personas ON vs OFF is NOT significant on any outcome — the proactive system absorbs');
L.push('  personality. The persona effect on preventable deaths is an IST-only (broken-system) phenomenon.');
L.push('- Total-mortality differences remain underpowered at N=45; the IST preventable-death effect (d=0.32)');
L.push('  is modest. Do not over-claim "AI saves lives".');
L.push('- sick_leave_events = 0 in all cells. Do NOT cite sick leave.');
L.push('');
L.push('CLASSIFICATION — assumed input vs emergent finding');
L.push('metric                 type            note');
L.push('admin_waste_eur        ASSUMED         pure transform of admin input (30%->5%); zero variance across runs (d=0)');
L.push('avg_burnout            MOSTLY ASSUMED  dominated by admin input term (admin*100); small emergent queue component');
L.push('peak_burnout           MOSTLY ASSUMED  same basis as avg_burnout');
L.push('proactive_alerts       EMERGENT        absent in IST by design; arises from SOLL agent behaviour (0 -> ~305)');
L.push('ketenzorg_interv.      EMERGENT        chronic-care pathway uptake; high run-to-run variance');
L.push('system_deaths (IST)    EMERGENT        Big Five-driven care-seeking/adherence; SIGNIFICANT in IST (d=0.32)');
L.push('er_admissions          EMERGENT        downstream of care-seeking + capacity');
L.push('bias_score             EMERGENT        fairness guardrail metric');
L.push('');
L.push('READING GUIDANCE: lead with EMERGENT results. Present admin/burnout reductions as');
L.push('mechanism-by-construction (a consequence of the modelled intervention), NOT as discovered effects.');
L.push('The headline persona finding is emergent: personality matters most where the system is worst (IST).');
L.push('');

fs.writeFileSync(path.join(OUT, 'persona_ab_figure_data.txt'), L.join('\n'));
console.log('wrote persona_ab_figure_data.txt');

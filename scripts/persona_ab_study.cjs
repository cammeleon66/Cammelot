// Persona A/B Study — clean 4-cell factorial (IST/SOLL × personas OFF/ON)
// Usage: node scripts/persona_ab_study.cjs [runs] [cycles]
// Runs each cell N times via research_run.cjs (PERSONA env toggles persona numeric effects),
// aggregates metrics with mean/SD/95% CI, and contrasts OFF-vs-ON (within mode) and
// IST-vs-SOLL (within persona setting) using Cohen's d + Welch t-test.
// Writes: persona_ab_personas_off.json, persona_ab_personas_on.json, persona_ab_comparison.json

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const N_RUNS = parseInt(process.argv[2] || '100', 10);
const N_CYCLES = parseInt(process.argv[3] || '3000', 10);
const RUNNER = path.join(__dirname, 'research_run.cjs');
const OUT_DIR = path.join(__dirname, 'output');

// Metrics tracked (per the study spec)
const METRICS = [
  'total_deaths', 'system_deaths', 'natural_deaths', 'admin_waste_eur',
  'proactive_alerts', 'ketenzorg_interventions', 'er_admissions',
  'peak_burnout', 'avg_burnout', 'sick_leave_events', 'bias_score',
  'a2a_pre_briefs', 'outreach_opt_outs', 'unique_citizens_contacted',
  'reach_0_44', 'reach_45_64', 'reach_65_79', 'reach_80plus',
];

function runOnce(mode, persona) {
  const out = execSync(`node "${RUNNER}" ${mode} ${N_CYCLES}`, {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PERSONA: persona, DEBUG: '' }),
  });
  return JSON.parse(out);
}

// Reduce a full research_run result to the scalar metrics we study.
function toMetrics(r) {
  const peaks = (r.gp_peak_burnout || []).map(g => g.peak);
  const avgs = (r.gp_avg_burnout || []).map(g => g.avg);
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  return {
    total_deaths: r.total_deaths || 0,
    system_deaths: r.system_deaths || 0,
    natural_deaths: r.natural_deaths || 0,
    admin_waste_eur: r.admin_waste_eur || 0,
    proactive_alerts: r.proactive_alerts || 0,
    ketenzorg_interventions: r.ketenzorg_interventions || 0,
    er_admissions: r.er_admissions || 0,
    peak_burnout: Math.round(mean(peaks) * 100) / 100,   // mean across GPs of per-GP peak
    avg_burnout: Math.round(mean(avgs) * 100) / 100,      // mean across GPs of per-GP time-avg
    sick_leave_events: r.sick_leave_events || 0,
    bias_score: r.bias_score || 0,
    fairness_guardrail: r.fairness_guardrail ? 1 : 0,
    a2a_pre_briefs: r.a2a_pre_briefs || 0,
    outreach_opt_outs: r.outreach_opt_outs || 0,
    unique_citizens_contacted: r.unique_citizens_contacted || 0,
    reach_0_44: (r.outreach_reach && r.outreach_reach['0-44']) || 0,
    reach_45_64: (r.outreach_reach && r.outreach_reach['45-64']) || 0,
    reach_65_79: (r.outreach_reach && r.outreach_reach['65-79']) || 0,
    reach_80plus: (r.outreach_reach && r.outreach_reach['80+']) || 0,
  };
}

// Student-t critical value for 95% CI (two-tailed) by degrees of freedom.
function tCrit95(df) {
  if (df <= 0) return 0;
  const table = { 1:12.706,2:4.303,3:3.182,4:2.776,5:2.571,6:2.447,7:2.365,8:2.306,9:2.262,
    10:2.228,15:2.131,20:2.086,25:2.060,30:2.042,40:2.021,50:2.009,60:2.000,80:1.990,100:1.984,120:1.980 };
  if (table[df]) return table[df];
  const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
  let lo = keys[0], hi = keys[keys.length-1];
  for (const k of keys) { if (k <= df) lo = k; if (k >= df) { hi = k; break; } }
  if (lo === hi) return table[lo];
  const t = (df - lo) / (hi - lo);
  return table[lo] + t * (table[hi] - table[lo]); // linear interp
}

function stats(arr) {
  const n = arr.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0, ci95_lo: 0, ci95_hi: 0, min: 0, max: 0, median: 0 };
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const tc = tCrit95(n - 1);
  const sorted = [...arr].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
  const r3 = x => Math.round(x * 1000) / 1000;
  return {
    n, mean: r3(mean), sd: r3(sd), ci95_lo: r3(mean - tc * se), ci95_hi: r3(mean + tc * se),
    min: r3(Math.min(...arr)), max: r3(Math.max(...arr)), median: r3(median),
  };
}

function cohenD(a1, a2) {
  const m1 = a1.reduce((s,v)=>s+v,0)/a1.length, m2 = a2.reduce((s,v)=>s+v,0)/a2.length;
  const v1 = a1.length>1 ? a1.reduce((s,v)=>s+(v-m1)**2,0)/(a1.length-1) : 0;
  const v2 = a2.length>1 ? a2.reduce((s,v)=>s+(v-m2)**2,0)/(a2.length-1) : 0;
  const pooled = Math.sqrt((v1 + v2) / 2);
  if (pooled === 0) return 0;
  return Math.round((m1 - m2) / pooled * 1000) / 1000;
}

function welchT(a1, a2) {
  const n1=a1.length, n2=a2.length;
  const m1=a1.reduce((s,v)=>s+v,0)/n1, m2=a2.reduce((s,v)=>s+v,0)/n2;
  const v1=n1>1?a1.reduce((s,v)=>s+(v-m1)**2,0)/(n1-1):0;
  const v2=n2>1?a2.reduce((s,v)=>s+(v-m2)**2,0)/(n2-1):0;
  const se=Math.sqrt(v1/n1 + v2/n2);
  if (se === 0) return { t: 0, df: 0, significant: false };
  const t=(m1-m2)/se;
  const df=(v1/n1+v2/n2)**2 / ((v1/n1)**2/(n1-1) + (v2/n2)**2/(n2-1));
  return { t: Math.round(t*1000)/1000, df: Math.round(df*10)/10, significant: Math.abs(t) > tCrit95(Math.round(df)) };
}

// ── Run all four cells ──
process.stderr.write(`=== Persona A/B Study: ${N_RUNS} runs × ${N_CYCLES} cycles × 4 cells ===\n`);
const cells = {
  IST_on:  { mode: 'IST',  persona: 'on'  },
  IST_off: { mode: 'IST',  persona: 'off' },
  SOLL_on: { mode: 'SOLL', persona: 'on'  },
  SOLL_off:{ mode: 'SOLL', persona: 'off' },
};
const raw = {}; // cellKey -> [metricsObj,...]
for (const [key, cfg] of Object.entries(cells)) {
  raw[key] = [];
  for (let i = 0; i < N_RUNS; i++) {
    const t0 = Date.now();
    raw[key].push(toMetrics(runOnce(cfg.mode, cfg.persona)));
    if ((i + 1) % 10 === 0 || i === 0) process.stderr.write(`  ${key} ${i+1}/${N_RUNS} (${Date.now()-t0}ms)\n`);
  }
}

const col = (key, m) => raw[key].map(r => r[m]);
function cellStats(key) {
  const o = { n: N_RUNS };
  for (const m of METRICS) o[m] = stats(col(key, m));
  const gr = col(key, 'fairness_guardrail');
  o.fairness_guardrail = {
    activated_runs: gr.reduce((s, v) => s + v, 0),
    total_runs: N_RUNS,
    rate_pct: Math.round(gr.reduce((s, v) => s + v, 0) / N_RUNS * 1000) / 10,
  };
  return o;
}

function contrast(keyA, keyB) {
  // A - B framing (e.g., OFF - ON, or IST - SOLL)
  const out = {};
  for (const m of METRICS) {
    const a = col(keyA, m), b = col(keyB, m);
    const ma = a.reduce((s,v)=>s+v,0)/a.length, mb = b.reduce((s,v)=>s+v,0)/b.length;
    out[m] = {
      mean_A: Math.round(ma*1000)/1000, mean_B: Math.round(mb*1000)/1000,
      delta: Math.round((ma - mb)*1000)/1000,
      pct_change: mb !== 0 ? Math.round((ma - mb)/Math.abs(mb)*1000)/10 : null,
      cohen_d: cohenD(a, b), welch: welchT(a, b),
    };
  }
  return out;
}

const meta = { runs: N_RUNS, cycles: N_CYCLES, date: new Date().toISOString(),
  note: 'PERSONA=off prepends `var PERSONA_ENABLED=false` so persona numeric behavior effects are gated off; persona assignment/thoughts remain.' };

// personas-OFF file (both modes, persona numeric effects disabled)
const offDoc = {
  config: Object.assign({ persona_effects: 'OFF' }, meta),
  IST: cellStats('IST_off'), SOLL: cellStats('SOLL_off'),
  IST_vs_SOLL: contrast('IST_off', 'SOLL_off'),
  per_run: { IST: raw.IST_off, SOLL: raw.SOLL_off },
};
// personas-ON file
const onDoc = {
  config: Object.assign({ persona_effects: 'ON' }, meta),
  IST: cellStats('IST_on'), SOLL: cellStats('SOLL_on'),
  IST_vs_SOLL: contrast('IST_on', 'SOLL_on'),
  per_run: { IST: raw.IST_on, SOLL: raw.SOLL_on },
};
// comparison file — all four contrasts
const cmpDoc = {
  config: meta,
  cells: { IST_on: cellStats('IST_on'), IST_off: cellStats('IST_off'),
           SOLL_on: cellStats('SOLL_on'), SOLL_off: cellStats('SOLL_off') },
  contrasts: {
    'IST_OFF_vs_ON':  { framing: 'A=OFF, B=ON', data: contrast('IST_off', 'IST_on') },
    'SOLL_OFF_vs_ON': { framing: 'A=OFF, B=ON', data: contrast('SOLL_off', 'SOLL_on') },
    'IST_vs_SOLL_ON':  { framing: 'A=IST, B=SOLL', data: contrast('IST_on', 'SOLL_on') },
    'IST_vs_SOLL_OFF': { framing: 'A=IST, B=SOLL', data: contrast('IST_off', 'SOLL_off') },
  },
};

fs.writeFileSync(path.join(OUT_DIR, 'persona_ab_personas_off.json'), JSON.stringify(offDoc, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'persona_ab_personas_on.json'), JSON.stringify(onDoc, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'persona_ab_comparison.json'), JSON.stringify(cmpDoc, null, 2));
process.stderr.write('\n=== Wrote persona_ab_personas_off.json, persona_ab_personas_on.json, persona_ab_comparison.json ===\n');

// Compact console summary (stdout)
const fmt = (k, m) => `${cellStats(k)[m].mean}±${cellStats(k)[m].sd}`;
console.log(JSON.stringify({
  summary: {
    peak_burnout: { IST_on: fmt('IST_on','peak_burnout'), IST_off: fmt('IST_off','peak_burnout'),
                    SOLL_on: fmt('SOLL_on','peak_burnout'), SOLL_off: fmt('SOLL_off','peak_burnout') },
    avg_burnout:  { IST_on: fmt('IST_on','avg_burnout'), IST_off: fmt('IST_off','avg_burnout'),
                    SOLL_on: fmt('SOLL_on','avg_burnout'), SOLL_off: fmt('SOLL_off','avg_burnout') },
    total_deaths: { IST_on: fmt('IST_on','total_deaths'), IST_off: fmt('IST_off','total_deaths'),
                    SOLL_on: fmt('SOLL_on','total_deaths'), SOLL_off: fmt('SOLL_off','total_deaths') },
  }
}, null, 2));
process.exit(0);

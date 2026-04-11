// Deep research runner — 20 runs per mode with full statistical analysis
// Usage: node scripts/deep_research.cjs [runs] [cycles]
// Outputs JSON with per-run data + aggregated statistics to stdout

const { execSync } = require('child_process');
const path = require('path');

const N_RUNS = parseInt(process.argv[2] || '20', 10);
const N_CYCLES = parseInt(process.argv[3] || '3000', 10);
const RUNNER = path.join(__dirname, 'research_run.cjs');

function runOnce(mode, cycles) {
  const cmd = `node "${RUNNER}" ${mode} ${cycles}`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

function stats(arr) {
  const n = arr.length;
  if (n === 0) return { mean: 0, sd: 0, ci95_lo: 0, ci95_hi: 0, min: 0, max: 0, median: 0 };
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const t = 2.093; // t-critical for df=19 at 95% CI
  const sorted = [...arr].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
  return {
    mean: Math.round(mean * 1000) / 1000,
    sd: Math.round(sd * 1000) / 1000,
    ci95_lo: Math.round((mean - t * se) * 1000) / 1000,
    ci95_hi: Math.round((mean + t * se) * 1000) / 1000,
    min: Math.round(Math.min(...arr) * 1000) / 1000,
    max: Math.round(Math.max(...arr) * 1000) / 1000,
    median: Math.round(median * 1000) / 1000,
    raw: arr.map(v => Math.round(v * 1000) / 1000)
  };
}

function cohenD(arr1, arr2) {
  const m1 = arr1.reduce((s,v) => s+v, 0) / arr1.length;
  const m2 = arr2.reduce((s,v) => s+v, 0) / arr2.length;
  const v1 = arr1.reduce((s,v) => s+(v-m1)**2, 0) / (arr1.length-1);
  const v2 = arr2.reduce((s,v) => s+(v-m2)**2, 0) / (arr2.length-1);
  const pooledSD = Math.sqrt((v1 + v2) / 2);
  if (pooledSD === 0) return 0;
  return Math.round((m1 - m2) / pooledSD * 1000) / 1000;
}

// Welch's t-test (unequal variance)
function welchT(arr1, arr2) {
  const n1 = arr1.length, n2 = arr2.length;
  const m1 = arr1.reduce((s,v) => s+v, 0) / n1;
  const m2 = arr2.reduce((s,v) => s+v, 0) / n2;
  const v1 = arr1.reduce((s,v) => s+(v-m1)**2, 0) / (n1-1);
  const v2 = arr2.reduce((s,v) => s+(v-m2)**2, 0) / (n2-1);
  const se = Math.sqrt(v1/n1 + v2/n2);
  if (se === 0) return { t: 0, df: 0, significant: false };
  const t = (m1 - m2) / se;
  const df = (v1/n1 + v2/n2)**2 / ((v1/n1)**2/(n1-1) + (v2/n2)**2/(n2-1));
  // Approximate p-value using t-distribution (rough)
  const absT = Math.abs(t);
  const significant = absT > 2.0; // rough threshold for p < 0.05
  return { t: Math.round(t * 1000) / 1000, df: Math.round(df * 10) / 10, significant };
}

process.stderr.write(`=== Deep Research: ${N_RUNS} runs × ${N_CYCLES} cycles per mode ===\n\n`);

// Collect per-run data
const istRuns = [];
const sollRuns = [];

for (let i = 0; i < N_RUNS; i++) {
  process.stderr.write(`IST run ${i+1}/${N_RUNS}...`);
  const t0 = Date.now();
  istRuns.push(runOnce('IST', N_CYCLES));
  process.stderr.write(` ${Date.now()-t0}ms\n`);
}

for (let i = 0; i < N_RUNS; i++) {
  process.stderr.write(`SOLL run ${i+1}/${N_RUNS}...`);
  const t0 = Date.now();
  sollRuns.push(runOnce('SOLL', N_CYCLES));
  process.stderr.write(` ${Date.now()-t0}ms\n`);
}

// Extract per-run metric arrays
const extract = (runs, key) => runs.map(r => r[key] || 0);
const extractAge = (runs, ageGroup, field) => runs.map(r => {
  const ag = r.age_analysis?.[ageGroup];
  return ag ? ag[field] || 0 : 0;
});
const extractBurnout = (runs) => runs.map(r => {
  const gps = r.gp_burnout || [];
  if (gps.length === 0) return 0;
  return gps.reduce((s, g) => s + g.burnout, 0) / gps.length;
});

// Key metrics
const metrics = [
  'system_deaths', 'natural_deaths', 'total_deaths', 'er_admissions',
  'proactive_alerts', 'ketenzorg_interventions', 'admin_waste_eur',
  'gini', 'bias_score', 'fairness_guardrail'
];

const results = {
  config: { runs: N_RUNS, cycles: N_CYCLES, date: new Date().toISOString() },
  IST: { per_run: istRuns.map(r => ({ 
    system_deaths: r.system_deaths, natural_deaths: r.natural_deaths,
    total_deaths: r.total_deaths, er_admissions: r.er_admissions,
    admin_waste_eur: r.admin_waste_eur, gini: r.gini, bias_score: r.bias_score,
    population: r.population, gp_burnout: r.gp_burnout,
    death_reports: r.death_reports, agent_stories: (r.agent_stories || []).slice(0, 5)
  }))},
  SOLL: { per_run: sollRuns.map(r => ({
    system_deaths: r.system_deaths, natural_deaths: r.natural_deaths,
    total_deaths: r.total_deaths, er_admissions: r.er_admissions,
    admin_waste_eur: r.admin_waste_eur, gini: r.gini, bias_score: r.bias_score,
    population: r.population, proactive_alerts: r.proactive_alerts,
    ketenzorg_interventions: r.ketenzorg_interventions,
    fairness_guardrail: r.fairness_guardrail,
    gp_burnout: r.gp_burnout,
    death_reports: r.death_reports, agent_stories: (r.agent_stories || []).slice(0, 5)
  }))},
  statistics: {},
  comparisons: {},
  age_analysis: { IST: {}, SOLL: {} }
};

// Compute stats for each metric
for (const m of metrics) {
  const istArr = extract(istRuns, m).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const sollArr = extract(sollRuns, m).map(v => typeof v === 'boolean' ? (v ? 1 : 0) : v);
  results.statistics[m] = { IST: stats(istArr), SOLL: stats(sollArr) };
  results.comparisons[m] = {
    cohen_d: cohenD(istArr, sollArr),
    welch: welchT(istArr, sollArr),
    pct_change: stats(istArr).mean !== 0 
      ? Math.round((stats(sollArr).mean - stats(istArr).mean) / stats(istArr).mean * 1000) / 10 + '%'
      : 'N/A'
  };
}

// Burnout stats
const istBurnout = extractBurnout(istRuns);
const sollBurnout = extractBurnout(sollRuns);
results.statistics.gp_burnout = { IST: stats(istBurnout), SOLL: stats(sollBurnout) };
results.comparisons.gp_burnout = {
  cohen_d: cohenD(istBurnout, sollBurnout),
  welch: welchT(istBurnout, sollBurnout),
  pct_change: Math.round((stats(sollBurnout).mean - stats(istBurnout).mean) / stats(istBurnout).mean * 1000) / 10 + '%'
};

// Age-stratified mortality
for (const ag of ['0-44', '45-64', '65-79', '80+']) {
  const istMort = istRuns.map(r => {
    const d = r.age_analysis?.[ag];
    return d && d.population > 0 ? d.deaths / d.population : 0;
  });
  const sollMort = sollRuns.map(r => {
    const d = r.age_analysis?.[ag];
    return d && d.population > 0 ? d.deaths / d.population : 0;
  });
  results.age_analysis.IST[ag] = stats(istMort.map(v => v * 100)); // as percentage
  results.age_analysis.SOLL[ag] = stats(sollMort.map(v => v * 100));
  results.comparisons['mortality_' + ag] = {
    cohen_d: cohenD(istMort, sollMort),
    welch: welchT(istMort, sollMort),
    IST_mean_pct: Math.round(istMort.reduce((s,v)=>s+v,0)/istMort.length * 1000) / 10,
    SOLL_mean_pct: Math.round(sollMort.reduce((s,v)=>s+v,0)/sollMort.length * 1000) / 10
  };
}

// All death reports collected (for narrative mining)
results.all_deaths = {
  IST: istRuns.flatMap((r, i) => (r.death_reports || []).map(d => ({ ...d, run: i }))),
  SOLL: sollRuns.flatMap((r, i) => (r.death_reports || []).map(d => ({ ...d, run: i })))
};

// Guardrail activation rate
const guardrailRate = sollRuns.filter(r => r.fairness_guardrail).length;
results.guardrail_activation = {
  activated_runs: guardrailRate,
  total_runs: N_RUNS,
  rate: Math.round(guardrailRate / N_RUNS * 1000) / 10 + '%'
};

process.stderr.write(`\n=== Complete. ${istRuns.length + sollRuns.length} total runs. ===\n`);
console.log(JSON.stringify(results, null, 2));
process.exit(0);

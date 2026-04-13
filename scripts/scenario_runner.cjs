// Scenario runner — runs parameterized experiments on the Cammelot simulation
// Usage: node scripts/scenario_runner.cjs <scenario_name>
// Outputs JSON to stdout, progress to stderr
//
// Scenarios:
//   optout-bias       — Vary opt-out rate (5%, 10%, 20%, 50%), 20 runs each
//   research-freq     — Vary research query frequency (50, 100, 200, 500 cycles), 20 runs each
//   k-anonymity       — Vary k threshold (3, 5, 10, 15, 20), 20 runs each
//   benchmark-freq    — Vary benchmark frequency (50, 100, 200, 500), 20 runs each
//   mordred-v2        — Supply chain attack with forged signed cards, 20 runs

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCENARIO = process.argv[2];
const RUNS_PER_CONFIG = parseInt(process.argv[3] || '20', 10);
const CYCLES = parseInt(process.argv[4] || '3000', 10);
const RUNNER = path.join(__dirname, 'research_run.cjs');

if (!SCENARIO) {
  process.stderr.write('Usage: node scenario_runner.cjs <scenario_name> [runs_per_config] [cycles]\n');
  process.stderr.write('Scenarios: optout-bias, research-freq, k-anonymity, benchmark-freq, mordred-v2\n');
  process.exit(1);
}

// Read the simulation HTML once
const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'frontend', 'v4.html'), 'utf8');

function stats(arr) {
  const n = arr.length;
  if (n === 0) return { mean: 0, sd: 0, min: 0, max: 0, median: 0 };
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const sorted = [...arr].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
  return {
    mean: Math.round(mean * 1000) / 1000,
    sd: Math.round(sd * 1000) / 1000,
    min: Math.round(Math.min(...arr) * 1000) / 1000,
    max: Math.round(Math.max(...arr) * 1000) / 1000,
    median: Math.round(median * 1000) / 1000
  };
}

function runOnce(mode, cycles, envOverrides = {}) {
  const envStr = Object.entries(envOverrides).map(([k,v]) => `${k}=${v}`).join(' ');
  // Pass overrides as environment variables
  const env = { ...process.env, ...Object.fromEntries(Object.entries(envOverrides).map(([k,v]) => [k, String(v)])) };
  const cmd = `node "${RUNNER}" ${mode} ${cycles}`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], env });
  return JSON.parse(out);
}

// But research_run.cjs doesn't read env vars for params.
// Instead, we'll create temporary patched HTML files and point the runner at them.
// Actually, let's just create a wrapper that patches the JS source before eval.

function runPatched(mode, cycles, patches) {
  // Create a temporary patched runner that applies source patches
  const tmpRunner = path.join(__dirname, `_tmp_scenario_run_${process.pid}_${Date.now()}.cjs`);
  let runnerSrc = fs.readFileSync(RUNNER, 'utf8');
  
  // The runner reads v4.html and evals the JS. We inject patches into the eval'd JS.
  // Find where it says: patchedJS += '\nglobal._agents...
  // and add our patches before that line.
  
  // Strategy: Add patches right after "let patchedJS = mainJS;"
  const patchInsertions = patches.map(p => {
    // Each patch is { find: 'string to find', replace: 'replacement' }
    return `patchedJS = patchedJS.replace(${JSON.stringify(p.find)}, ${JSON.stringify(p.replace)});`;
  }).join('\n');
  
  runnerSrc = runnerSrc.replace(
    "let patchedJS = mainJS;",
    "let patchedJS = mainJS;\n" + patchInsertions
  );
  
  fs.writeFileSync(tmpRunner, runnerSrc, 'utf8');
  
  try {
    const cmd = `node "${tmpRunner}" ${mode} ${cycles}`;
    const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(out);
  } finally {
    try { fs.unlinkSync(tmpRunner); } catch(e) {}
  }
}

function runScenario(configs) {
  const results = {};
  for (const config of configs) {
    const label = config.label;
    process.stderr.write(`\n=== Config: ${label} ===\n`);
    const runs = [];
    for (let i = 0; i < RUNS_PER_CONFIG; i++) {
      process.stderr.write(`  Run ${i+1}/${RUNS_PER_CONFIG}...`);
      const t0 = Date.now();
      const r = config.patches.length > 0
        ? runPatched(config.mode || 'SOLL', CYCLES, config.patches)
        : runOnce(config.mode || 'SOLL', CYCLES);
      process.stderr.write(` ${Date.now()-t0}ms\n`);
      runs.push(r);
    }
    
    const extract = (key) => runs.map(r => r[key] || 0);
    results[label] = {
      config: config.params,
      n_runs: RUNS_PER_CONFIG,
      metrics: {
        total_deaths: stats(extract('total_deaths')),
        system_deaths: stats(extract('system_deaths')),
        research_queries: stats(extract('research_queries_completed')),
        opt_out_refusals: stats(extract('research_opt_out_refusals')),
        cohort_too_small: stats(extract('research_cohort_too_small')),
        benchmark_reports: stats(extract('benchmark_reports_generated')),
        proactive_alerts: stats(extract('proactive_alerts')),
        ketenzorg: stats(extract('ketenzorg_interventions')),
        gini: stats(extract('gini')),
        bias_score: stats(extract('bias_score')),
        er_admissions: stats(extract('er_admissions')),
      },
      gp_burnout_avg: stats(runs.map(r => {
        const gps = r.gp_burnout || [];
        return gps.length > 0 ? gps.reduce((s, g) => s + g.burnout, 0) / gps.length : 0;
      })),
    };
  }
  return results;
}

// ═══ SCENARIO DEFINITIONS ═══

const scenarios = {
  'optout-bias': () => {
    const optOutRates = [0.05, 0.10, 0.20, 0.50];
    const configs = optOutRates.map(rate => ({
      label: `optout_${Math.round(rate*100)}pct`,
      mode: 'SOLL',
      params: { opt_out_rate: rate },
      patches: [{
        find: 'researchConsent: Math.random() >= 0.05',
        replace: `researchConsent: Math.random() >= ${rate}`
      }]
    }));
    // Also run IST baseline (no research agent, but measure deaths)
    configs.unshift({
      label: 'ist_baseline',
      mode: 'IST',
      params: { opt_out_rate: 0.05 },
      patches: []
    });
    return configs;
  },

  'research-freq': () => {
    const freqs = [50, 100, 200, 500];
    return freqs.map(freq => ({
      label: `research_every_${freq}`,
      mode: 'SOLL',
      params: { research_frequency_cycles: freq },
      patches: [{
        find: "cycle % 100 === 0 && cycle > 0) {\n    var researchAgent",
        replace: `cycle % ${freq} === 0 && cycle > 0) {\n    var researchAgent`
      }]
    }));
  },

  'k-anonymity': () => {
    const kValues = [3, 5, 10, 15, 20];
    return kValues.map(k => ({
      label: `k_${k}`,
      mode: 'SOLL',
      params: { k_anonymity_threshold: k },
      patches: [
        {
          find: 'if (hpCount >= 10) {',
          replace: `if (hpCount >= ${k}) {`
        },
        {
          find: 'if (hba1cCount >= 10) {',
          replace: `if (hba1cCount >= ${k}) {`
        }
      ]
    }));
  },

  'benchmark-freq': () => {
    const freqs = [50, 100, 200, 500];
    return freqs.map(freq => ({
      label: `benchmark_every_${freq}`,
      mode: 'SOLL',
      params: { benchmark_frequency_cycles: freq },
      patches: [{
        find: "cycle % 200 === 0 && cycle > 0) {\n    var benchAgent",
        replace: `cycle % ${freq} === 0 && cycle > 0) {\n    var benchAgent`
      }]
    }));
  },

  'mordred-v2': () => {
    // Simulate supply chain attack: inject agent with valid-looking but forged card
    // In v2, cards are signed so the forged card should fail verification
    // We test: (1) baseline SOLL, (2) Mordred with unsigned card, (3) Mordred with stolen signature
    return [
      {
        label: 'soll_baseline',
        mode: 'SOLL',
        params: { attack: 'none' },
        patches: []
      },
      {
        label: 'mordred_forged_card',
        mode: 'SOLL',
        params: { attack: 'forged_card' },
        patches: [{
          // Inject a Mordred agent that creates a card with wrong signature
          find: "// ═══ Research Agent: Federated query",
          replace: `// ═══ Mordred Attack: Forged specialist card ═══
  if (cycle === 50) {
    var mordred = agents.find(a => a.id === 'mordred-agent');
    if (!mordred) {
      var fakeCard = {
        agentId: 'spec-cardiology-shadow',
        name: 'Dr. van den Berg',
        role: 'specialist',
        skills: ['cardiology'],
        status: 'available',
        waitTime: { weeks: 0, queueSize: 0 },
        metadata: {},
        signature: 'sig-FORGED'
      };
      var verified = verifyAgentCard(fakeCard);
      if (!verified) {
        logEvent('security_alert', null, 'Mordred forged card REJECTED by verification');
        mordredAttackBlocked = (mordredAttackBlocked || 0) + 1;
      } else {
        logEvent('security_breach', null, 'Mordred forged card ACCEPTED — breach!');
        mordredAttackSucceeded = (mordredAttackSucceeded || 0) + 1;
      }
    }
  }
  // ═══ Research Agent: Federated query`
        }]
      },
      {
        label: 'mordred_replay_attack',
        mode: 'SOLL',
        params: { attack: 'replay_real_card' },
        patches: [{
          // Mordred copies a real card signature but changes waitTime to 0
          find: "// ═══ Research Agent: Federated query",
          replace: `// ═══ Mordred Attack: Replay real card with modified fields ═══
  if (cycle === 50) {
    var realCardio = agents.find(a => a.id === 'spec-cardiology');
    if (realCardio && realCardio.agentCard) {
      var stolenCard = JSON.parse(JSON.stringify(realCardio.agentCard));
      stolenCard.waitTime = { weeks: 0, queueSize: 0 };
      stolenCard.status = 'available';
      var verified = verifyAgentCard(stolenCard);
      if (!verified) {
        logEvent('security_alert', null, 'Mordred replay attack REJECTED (card tampered)');
        mordredAttackBlocked = (mordredAttackBlocked || 0) + 1;
      } else {
        logEvent('security_breach', null, 'Mordred replay attack ACCEPTED — waitTime spoofed!');
        mordredAttackSucceeded = (mordredAttackSucceeded || 0) + 1;
      }
    }
  }
  // ═══ Research Agent: Federated query`
        }]
      }
    ];
  }
};

// ═══ MAIN ═══

if (!scenarios[SCENARIO]) {
  process.stderr.write(`Unknown scenario: ${SCENARIO}\n`);
  process.stderr.write(`Available: ${Object.keys(scenarios).join(', ')}\n`);
  process.exit(1);
}

process.stderr.write(`\n╔══════════════════════════════════════════╗\n`);
process.stderr.write(`║ Scenario: ${SCENARIO.padEnd(30)}║\n`);
process.stderr.write(`║ Runs per config: ${String(RUNS_PER_CONFIG).padEnd(23)}║\n`);
process.stderr.write(`║ Cycles: ${String(CYCLES).padEnd(32)}║\n`);
process.stderr.write(`╚══════════════════════════════════════════╝\n\n`);

const configs = scenarios[SCENARIO]();
const results = runScenario(configs);

const output = {
  scenario: SCENARIO,
  date: new Date().toISOString(),
  runs_per_config: RUNS_PER_CONFIG,
  cycles: CYCLES,
  results
};

process.stdout.write(JSON.stringify(output, null, 2));
process.stderr.write(`\n\nDone. ${Object.keys(results).length} configs × ${RUNS_PER_CONFIG} runs = ${Object.keys(results).length * RUNS_PER_CONFIG} total runs.\n`);

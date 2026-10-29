// Aggregate one or more benchmark_minister_strategies.cjs outputs into a
// balance diagnosis summary (JSON + Markdown tables).
// Usage: node scripts/summarize_minister_balance.cjs --output summary.json in1.json [in2.json ...]
const { readFileSync, writeFileSync } = require('node:fs');

function parseArgs(argv) {
  const files = [];
  let output = null;
  let markdown = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--output') output = argv[++i];
    else if (argv[i] === '--markdown') markdown = argv[++i];
    else files.push(argv[i]);
  }
  if (!files.length) throw new Error('Pass at least one benchmark JSON file');
  return { files, output, markdown };
}

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');
const inc = (map, key, by = 1) => { map[key] = (map[key] || 0) + by; };
const isWin = (run) => run.endReason === 'served' || run.electionResult === 'won' || run.electionResult?.won === true;

function summarize(files) {
  const scenarios = {};
  const sources = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    sources.push({ file, sourceRevision: data.sourceRevision, generatedAt: data.generatedAt });
    for (const group of data.groups) {
      const s = scenarios[group.scenario] ||= {
        scenario: group.scenario, seeds: new Set(), runs: 0, wins: 0, completedHorizon: 0, finalVoteHeld: 0,
        endReasons: {}, endings: {}, gateFailures: {}, onlyFailingGate: {}, endingTicks: [], policies: {},
        axes: { purchasePolicy: {}, responsePolicy: {}, governancePolicy: {} },
        penalties: {}, gains: {}, ledgerMismatches: 0, systemDeaths: [], treatments: [], noAction: { runs: 0, wins: 0 },
      };
      s.seeds.add(group.seed);
      if (group.noActionReference) {
        s.noAction.runs += 1;
        if (isWin(group.noActionReference)) s.noAction.wins += 1;
      }
      for (const run of group.runs) {
        if (run.repeatOf) continue;
        s.runs += 1;
        const win = isWin(run);
        if (win) s.wins += 1;
        if (run.completedDeclaredHorizon) s.completedHorizon += 1;
        if (run.finalVoteCriteria?.voteHeld) s.finalVoteHeld += 1;
        inc(s.endReasons, run.endReason || 'unknown');
        inc(s.endings, run.finalEndingLabel || 'unknown');
        s.endingTicks.push(run.endingTick);
        s.systemDeaths.push(run.care?.systemDeaths ?? null);
        s.treatments.push(run.care?.treatments ?? null);
        const failed = (run.finalVoteCriteria?.gates || []).filter((g) => !g.passed).map((g) => g.id);
        for (const id of failed) inc(s.gateFailures, id);
        if (failed.length === 1) inc(s.onlyFailingGate, failed[0]);
        const p = s.policies[run.policyId] ||= { runs: 0, wins: 0, completed: 0 };
        p.runs += 1; if (win) p.wins += 1; if (run.completedDeclaredHorizon) p.completed += 1;
        for (const axis of Object.keys(s.axes)) {
          const a = s.axes[axis][run[axis]] ||= { runs: 0, wins: 0 };
          a.runs += 1; if (win) a.wins += 1;
        }
        const ledger = run.trustBudgetLedger;
        if (ledger?.entries) {
          const totals = { ...ledger.baseline };
          for (const e of ledger.entries) {
            totals[e.metric] = (totals[e.metric] ?? 0) + e.amount;
            if (e.metric === 'budget') continue;
            inc(e.amount < 0 ? s.penalties : s.gains, `${e.source}:${e.metric}`, Math.abs(e.amount));
          }
          const final = { ...run.trust, budget: run.budget?.final ?? run.budget };
          for (const k of ['citizens', 'doctors', 'parliament']) {
            if (typeof final[k] === 'number' && Math.round(totals[k]) !== Math.round(final[k])) { s.ledgerMismatches += 1; break; }
          }
        }
      }
    }
  }
  const out = { generatedAt: new Date().toISOString(), sources, scenarios: {} };
  for (const s of Object.values(scenarios)) {
    const ticks = [...s.endingTicks].sort((a, b) => a - b);
    const nums = (xs) => xs.filter((x) => typeof x === 'number');
    const mean = (xs) => { const v = nums(xs); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const perRun = (m) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / s.runs).toFixed(2)]));
    out.scenarios[s.scenario] = {
      seeds: [...s.seeds].sort((a, b) => a - b), runs: s.runs, wins: s.wins, winRate: s.runs ? s.wins / s.runs : null,
      completedHorizon: s.completedHorizon, finalVoteHeld: s.finalVoteHeld,
      noActionReference: s.noAction,
      endReasons: s.endReasons, endings: s.endings,
      gateFailures: Object.fromEntries(Object.entries(s.gateFailures).sort((a, b) => b[1] - a[1])),
      onlyFailingGate: s.onlyFailingGate,
      endingTick: { min: ticks[0], median: ticks[Math.floor(ticks.length / 2)], max: ticks[ticks.length - 1] },
      meanSystemDeaths: mean(s.systemDeaths), meanTreatments: mean(s.treatments),
      runsWithZeroTreatments: s.treatments.filter((t) => t === 0).length,
      meanTrustLossPerRun: perRun(s.penalties), meanTrustGainPerRun: perRun(s.gains),
      ledgerMismatches: s.ledgerMismatches,
      axes: s.axes,
      policies: Object.fromEntries(Object.entries(s.policies).sort((a, b) => b[1].wins - a[1].wins || a[0].localeCompare(b[0]))),
    };
  }
  return out;
}

function toMarkdown(summary) {
  const lines = [];
  for (const [id, s] of Object.entries(summary.scenarios)) {
    lines.push(`### ${id}`, '', `Seeds: ${s.seeds.join(', ')}; ${s.runs} strategy runs (repeats excluded).`, '');
    lines.push('| Measure | Value |', '|---|---|');
    lines.push(`| Wins | ${s.wins} (${pct(s.wins, s.runs)}) |`);
    lines.push(`| Completed declared horizon | ${s.completedHorizon} (${pct(s.completedHorizon, s.runs)}) |`);
    lines.push(`| Final vote held | ${s.finalVoteHeld} (${pct(s.finalVoteHeld, s.runs)}) |`);
    lines.push(`| No-action reference wins | ${s.noActionReference.wins}/${s.noActionReference.runs} |`);
    lines.push(`| Ending tick min/median/max | ${s.endingTick.min} / ${s.endingTick.median} / ${s.endingTick.max} |`);
    lines.push(`| Mean model system deaths | ${s.meanSystemDeaths?.toFixed(2)} |`);
    lines.push(`| Mean specialist treatments | ${s.meanTreatments?.toFixed(2)} (zero in ${s.runsWithZeroTreatments} runs) |`);
    lines.push(`| Ledger reconciliation mismatches | ${s.ledgerMismatches} |`, '');
    lines.push('| End reason | Runs |', '|---|---|', ...Object.entries(s.endReasons).map(([k, v]) => `| ${k} | ${v} (${pct(v, s.runs)}) |`), '');
    lines.push('| Failed final-vote gate | Runs failing | Only failing gate |', '|---|---|---|',
      ...Object.entries(s.gateFailures).map(([k, v]) => `| ${k} | ${v} (${pct(v, s.runs)}) | ${s.onlyFailingGate[k] || 0} |`), '');
    lines.push('| Trust loss source (mean points per run) |  |', '|---|---|',
      ...Object.entries(s.meanTrustLossPerRun).slice(0, 8).map(([k, v]) => `| ${k} | ${v} |`), '');
    for (const [axis, values] of Object.entries(s.axes)) {
      lines.push(`| ${axis} | Wins / runs |`, '|---|---|',
        ...Object.entries(values).map(([k, v]) => `| ${k} | ${v.wins}/${v.runs} (${pct(v.wins, v.runs)}) |`), '');
    }
    const top = Object.entries(s.policies).slice(0, 5);
    lines.push('| Top strategies | Wins / runs | Completed horizon |', '|---|---|---|',
      ...top.map(([k, v]) => `| ${k} | ${v.wins}/${v.runs} | ${v.completed}/${v.runs} |`), '');
  }
  return lines.join('\n');
}

if (require.main === module) {
  const { files, output, markdown } = parseArgs(process.argv.slice(2));
  const summary = summarize(files);
  if (output) writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
  const md = toMarkdown(summary);
  if (markdown) writeFileSync(markdown, `${md}\n`);
  else console.log(md);
}

module.exports = { summarize, toMarkdown };

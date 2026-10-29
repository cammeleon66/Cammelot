import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseArgs, parseOptionHeuristics, responseScore } = require('../scripts/benchmark_minister_strategies.cjs');

test('response option parser exposes the signals claimed by trust, budget, and care policies', () => {
  const trustText = 'Citizens +5 · Doctors +4 · Parliament +3';
  const budgetText = '+€80K funding';
  const careText = '+0.5 starts/week · admin -2 · sick -1%';
  const adverseCareText = '-0.5 starts/week · admin +2 · sick +1%';

  assert.equal(parseOptionHeuristics(trustText).trust, 12);
  assert.equal(parseOptionHeuristics(budgetText).budget, 80000);
  assert.equal(parseOptionHeuristics(careText).capacity, 0.5);
  assert.equal(parseOptionHeuristics(careText).admin, -2);
  assert.equal(parseOptionHeuristics(careText).sick, -1);
  assert.ok(responseScore(trustText, 'trust-first') > responseScore('Citizens -5 · Doctors -4 · Parliament -3', 'trust-first'));
  assert.ok(responseScore(budgetText, 'budget-first') > responseScore('-€20K expenditure', 'budget-first'));
  assert.ok(responseScore(careText, 'care-first') > responseScore(adverseCareText, 'care-first'));
});

test('benchmark accepts independent purchase, response, and governance policy axes', () => {
  const options = parseArgs([
    '--purchase-policies', 'balanced,capacity-first',
    '--response-policies', 'trust-first,budget-first',
    '--governance-policies', 'no-laws,parliament-first',
  ]);
  assert.deepEqual(options.purchasePolicies, ['balanced', 'capacity-first']);
  assert.deepEqual(options.responsePolicies, ['trust-first', 'budget-first']);
  assert.deepEqual(options.governancePolicies, ['no-laws', 'parliament-first']);
});

test('Minister strategy benchmark records a local versioned run and matched no-action reference', { timeout: 120000 }, () => {
  const output = execFileSync(process.execPath, [
    'scripts/benchmark_minister_strategies.cjs',
    '--seeds', '2468',
    '--scenarios', 'cabinetcrisis',
    '--policies', 'balanced',
    '--concurrency', '1',
    '--no-repeat-balanced',
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const evidence = JSON.parse(output);
  const group = evidence.groups[0];
  const run = group.runs[0];

  assert.equal(evidence.executable.modelVersion, 'minister-care-10-access-time-replay');
  assert.match(evidence.executable.modelExecutableId, /^[a-f0-9]{64}$/);
  assert.match(evidence.executable.replayExecutableId, /^[a-f0-9]{64}$/);
  assert.match(evidence.executable.modelModuleSha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.executable.ministerHtmlSha256, /^[a-f0-9]{64}$/);
  assert.equal(run.scenario, 'cabinetcrisis');
  assert.equal(run.seed, 2468);
  assert.equal(run.completedDeclaredHorizon, true);
  assert.equal(run.endingTick, run.horizonTicks);
  assert.equal(run.purchasePolicy, 'balanced');
  assert.equal(run.responsePolicy, 'balanced');
  assert.equal(run.governancePolicy, 'resilience-first');
  assert.equal(run.finalVoteCriteria.voteHeld, true);
  assert.equal(typeof run.gateFailure, 'string');
  assert.ok(run.trustBudgetLedger.entries.length, 'the trace should retain stakeholder and budget changes');
  assert.ok(run.trustBudgetLedger.entries.every(entry =>
    ['law', 'purchase', 'response', 'event', 'cascade', 'simulation'].includes(entry.source)
      && Number.isInteger(entry.tick) && Number.isFinite(entry.amount)));
  assert.ok(Object.values(run.trustBudgetLedger.reconciliation).every(check => check.reconciles));
  assert.ok(run.trace.lawChoices.length, 'the structural trace should include an enacted law');
  assert.ok(run.trace.purchaseChoices.length, 'the policy trace should include actual purchases');
  assert.ok(Array.isArray(run.trace.skippedPurchases));
  assert.ok(run.trace.purchaseRetries.some(retry => retry.deferredAtQuarter < retry.retriedAtQuarter),
    'a deferred wishlist purchase should be retried at a later council');
  assert.ok(run.decisions.length, 'the result should retain actual UI decisions');
  assert.equal(group.noActionReference.endingTick, group.noActionReference.horizonTicks);
  assert.equal(run.noActionComparison.comparable, true);
  assert.equal(evidence.safeguards.productionLeaderboardWrites, 0);
  assert.equal(evidence.safeguards.blockedNonGetRequestsBeforeNetwork, evidence.safeguards.blockedRequests.length);
});

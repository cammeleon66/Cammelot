import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

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
  assert.match(evidence.executable.inlineScriptSha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.executable.ministerHtmlSha256, /^[a-f0-9]{64}$/);
  assert.equal(run.scenario, 'cabinetcrisis');
  assert.equal(run.seed, 2468);
  assert.equal(run.completedDeclaredHorizon, true);
  assert.ok(run.trace.lawChoices.length, 'the structural trace should include an enacted law');
  assert.ok(run.trace.purchaseChoices.length, 'the policy trace should include actual purchases');
  assert.ok(Array.isArray(run.trace.skippedPurchases));
  assert.ok(run.decisions.length, 'the result should retain actual UI decisions');
  assert.equal(group.noActionReference.endingTick, group.noActionReference.horizonTicks);
  assert.equal(run.noActionComparison.comparable, true);
  assert.equal(evidence.safeguards.productionLeaderboardWrites, 0);
  assert.equal(evidence.safeguards.blockedNonGetRequestsBeforeNetwork, evidence.safeguards.blockedRequests.length);
});

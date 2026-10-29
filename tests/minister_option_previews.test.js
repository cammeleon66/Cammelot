import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { BASE, scenarios, sha, fixture, reference, runExhaustive } =
  require('../scripts/minister_option_previews.cjs');

test('Minister option previews match every applied effect and preserve reference runs', { timeout: 900_000 }, async () => {
  const baseline = JSON.parse(readFileSync(new URL('../scripts/output/minister_option_previews.json', import.meta.url), 'utf8'));
  assert.equal(baseline.base, BASE);

  const f = await fixture();
  try {
    const evidence = await runExhaustive(f);
    for (const scenario of scenarios) {
      assert.deepEqual(evidence.coverage[scenario], {
        ids: 137,
        expected: 137,
        missing: [],
        extra: [],
      });

      const current = await reference(f, scenario, false);
      assert.equal(Buffer.byteLength(current), baseline.references[scenario].bytes, `${scenario} reference byte count`);
      assert.equal(sha(current), baseline.references[scenario].sha256, `${scenario} reference hash`);
    }
  } finally {
    await f.close();
  }
});

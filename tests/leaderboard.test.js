import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLeaderboardServer, createLeaderboardStore, generatedName } from '../src/leaderboard/server.js';

function validRun(overrides = {}) {
  return {
    username: '', scenario: 'cabinetcrisis', seed: 2468, modelVersion: 'minister-care-3-paired',
    endTick: 416, score: 431, politicalOutcome: 'served',
    summary: { systemDeaths: 2, waiting: 3, meanWait: 7.5, treatments: 12, deathsWaiting: 1,
      admin: 0.17, budget: 120000, trust: 58, fragility: 40 },
    ...overrides,
  };
}

async function fixture(now) {
  const dir = await mkdtemp(join(tmpdir(), 'cammelot-leaderboard-'));
  const filePath = join(dir, 'leaderboard.json');
  const server = createLeaderboardServer({ filePath, now });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { filePath, base, close: () => new Promise(resolve => server.close(resolve)) };
}

async function post(base, body) {
  return fetch(`${base}/api/leaderboard`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

test('leaderboard generates a stable public name and persists a ranked run', async () => {
  const app = await fixture();
  try {
    const response = await post(app.base, validRun());
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.entry.username, generatedName(2468));
    assert.equal(created.entry.generatedUsername, true);
    assert.equal(created.rank, 1);
    const second = await post(app.base, validRun({ username: 'Vera van den Broek', score: 900,
      summary: { ...validRun().summary, systemDeaths: 4, treatments: 30 } }));
    assert.equal(second.status, 201);
    const otherSeed = await post(app.base, validRun({ username: 'Other town', seed: 1357, score: 999 }));
    assert.equal(otherSeed.status, 201);
    const board = await fetch(`${app.base}/api/leaderboard?scenario=cabinetcrisis&modelVersion=minister-care-3-paired&seed=2468`).then(r => r.json());
    assert.deepEqual(board.entries.map(entry => entry.username), [generatedName(2468), 'Vera van den Broek'],
      'fewer deaths must outrank a higher scalar score within the same town');
    assert.equal(board.entries.some(entry => entry.seed === 1357), false);
    const disk = JSON.parse(await readFile(app.filePath, 'utf8'));
    assert.equal(disk.entries.length, 3);
  } finally { await app.close(); }
});

test('leaderboard rejects unsafe input, excessive requests and duplicate runs', async () => {
  let time = 1000;
  const app = await fixture(() => time);
  try {
    assert.equal((await post(app.base, validRun({ username: '<script>' }))).status, 400);
    assert.equal((await post(app.base, validRun({ score: 10001 }))).status, 400);
    const first = await post(app.base, validRun({ username: 'Simone' }));
    assert.equal(first.status, 201);
    const duplicate = await post(app.base, validRun({ username: 'Different public name' }));
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).duplicate, true);
    for (let index = 0; index < 6; index++) await post(app.base, validRun({ seed: 3000 + index }));
    assert.equal((await post(app.base, validRun({ seed: 4000 }))).status, 429);
    time += 60_001;
    assert.equal((await post(app.base, validRun({ seed: 4001 }))).status, 201);
  } finally { await app.close(); }
});

test('leaderboard exposes no IP address and supports health checks', async () => {
  const app = await fixture();
  try {
    assert.deepEqual(await fetch(`${app.base}/healthz`).then(r => r.json()), { ok: true });
    const response = await post(app.base, validRun({ username: 'Minister Moss' }));
    const text = await response.text();
    assert.doesNotMatch(text, /127\.0\.0\.1|remoteAddress|ipAddress/i);
    assert.equal((await fetch(`${app.base}/api/leaderboard?scenario=unknown`)).status, 400);
    assert.equal((await fetch(`${app.base}/api/leaderboard?modelVersion=${'x'.repeat(600)}`)).status, 414);
  } finally { await app.close(); }
});

test('leaderboard moderation removes an entry without a public admin route', async () => {
  const app = await fixture();
  try {
    const created = await post(app.base, validRun({ username: 'Remove Me' })).then(response => response.json());
    const store = createLeaderboardStore(app.filePath);
    assert.equal((await store.remove(created.entry.id)).username, 'Remove Me');
    assert.deepEqual(await store.list({}, 20), []);
    assert.equal((await fetch(`${app.base}/api/leaderboard/${created.entry.id}`, { method: 'DELETE' })).status, 404);
  } finally { await app.close(); }
});

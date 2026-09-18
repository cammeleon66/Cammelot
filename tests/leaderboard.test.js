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

async function fixture(now, allowedOrigins = []) {
  const dir = await mkdtemp(join(tmpdir(), 'cammelot-leaderboard-'));
  const filePath = join(dir, 'leaderboard.json');
  const server = createLeaderboardServer({ filePath, now, allowedOrigins });
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

test('generated public names vary in style while remaining valid', () => {
  const names = Array.from({ length:100 }, (_, index) => generatedName(index + 1));
  names.forEach(name => assert.match(name, /^[\p{L}\p{N} ._'-]{2,24}$/u));
  assert.ok(new Set(names).size >= 35, 'seed-generated names should have useful variety');
  assert.ok(names.some(name => name.startsWith('The ')));
  assert.ok(names.some(name => name.endsWith(' of Cammelot')));
  assert.ok(names.some(name => name.startsWith('Minister ')));
  assert.ok(names.some(name => !name.startsWith('Minister ') && !name.startsWith('The ') && !name.endsWith(' of Cammelot')));
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

test('leaderboard serves an opening top five across persisted town seeds', async () => {
  const app = await fixture();
  try {
    for (let index = 0; index < 7; index++) {
      const response = await post(app.base, validRun({ username:`Player ${index + 1}`, seed:7000 + index,
        score:400 + index, summary:{...validRun().summary,systemDeaths:index % 4,deathsWaiting:index % 3} }));
      assert.equal(response.status,201);
    }
    const overall = await fetch(`${app.base}/api/leaderboard?scenario=cabinetcrisis&modelVersion=minister-care-3-paired&limit=5`).then(response=>response.json());
    assert.equal(overall.entries.length,5);
    assert.equal(new Set(overall.entries.map(entry=>entry.seed)).size,5);
    assert.deepEqual(overall.entries.map(entry=>entry.summary.systemDeaths),[0,0,1,1,2]);
    const sameTown = await fetch(`${app.base}/api/leaderboard?scenario=cabinetcrisis&modelVersion=minister-care-3-paired&seed=7003&limit=5`).then(response=>response.json());
    assert.deepEqual(sameTown.entries.map(entry=>entry.seed),[7003]);
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

test('leaderboard allows only configured browser origins', async () => {
  const app = await fixture(undefined, ['https://cammelot.org']);
  try {
    const preflight = await fetch(`${app.base}/api/leaderboard`, {
      method: 'OPTIONS', headers: { Origin: 'https://cammelot.org', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://cammelot.org');
    assert.equal(preflight.headers.get('access-control-allow-credentials'), null);
    const allowed = await fetch(`${app.base}/api/leaderboard`, { headers: { Origin: 'https://cammelot.org' } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://cammelot.org');
    const validation = await fetch(`${app.base}/api/leaderboard`, {
      method: 'POST', headers: { Origin: 'https://cammelot.org', 'content-type': 'application/json' },
      body: JSON.stringify(validRun({ username: '<script>' })),
    });
    assert.equal(validation.status, 400);
    assert.equal(validation.headers.get('access-control-allow-origin'), 'https://cammelot.org');
    assert.equal((await fetch(`${app.base}/api/leaderboard`, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(`${app.base}/api/leaderboard`, { method: 'OPTIONS' })).status, 403);
  } finally { await app.close(); }
});

test('rate limits separate clients behind a reverse proxy', async () => {
  const app = await fixture(() => 1000, ['https://cammelot.org']);
  try {
    for (let index = 0; index < 10; index++) {
      const response = await fetch(`${app.base}/api/leaderboard`, {
        method: 'POST', headers: { Origin:'https://cammelot.org', 'content-type':'application/json',
          'x-forwarded-for':`10.0.0.4, 203.0.113.10` },
        body: JSON.stringify(validRun({ seed:5000 + index })),
      });
      assert.equal(response.status, 201);
    }
    const limited = await fetch(`${app.base}/api/leaderboard`, {
      method:'POST', headers:{Origin:'https://cammelot.org','content-type':'application/json','x-forwarded-for':'10.0.0.4, 203.0.113.10'},
      body:JSON.stringify(validRun({seed:6000})),
    });
    assert.equal(limited.status,429);
    const otherClient = await fetch(`${app.base}/api/leaderboard`, {
      method:'POST', headers:{Origin:'https://cammelot.org','content-type':'application/json','x-forwarded-for':'10.0.0.4, 203.0.113.11'},
      body:JSON.stringify(validRun({seed:6001})),
    });
    assert.equal(otherClient.status,201);
  } finally { await app.close(); }
});

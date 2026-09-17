import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCENARIOS = new Set(['cabinetcrisis', 'campaign', 'sprint', 'zeeland', 'codeblack', 'sandbox']);
const OUTCOMES = new Set(['served', 'election', 'noconfidence', 'strike', 'protest', 'scandal', 'bankrupt']);
const ADJECTIVES = ['Amber', 'Brave', 'Calm', 'Copper', 'Green', 'Kind', 'Silver', 'Steady', 'Swift', 'Wise'];
const ANIMALS = ['Badger', 'Falcon', 'Fox', 'Heron', 'Hedgehog', 'Otter', 'Owl', 'Stag', 'Swan', 'Wolf'];
const FIRST_NAMES = ['Amara', 'Ingrid', 'Joris', 'Kofi', 'Mei', 'Noor', 'Ravi', 'Sanne', 'Tycho', 'Zainab'];
const CALL_SIGNS = ['Night Shift', 'Queue Tamer', 'Open Books', 'Long View', 'Calm Hands', 'Last Bed', 'Grid Watch', 'Care Keeper', 'Bridge Builder', 'Paper Slayer'];

function json(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
}

function number(value, name, min, max, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

export function generatedName(seed) {
  const hash = createHash('sha256').update(String(seed)).digest();
  const first = FIRST_NAMES[hash[1] % FIRST_NAMES.length];
  const callSign = CALL_SIGNS[hash[2] % CALL_SIGNS.length];
  switch (hash[0] % 5) {
    case 0: return `Minister ${ADJECTIVES[hash[1] % ADJECTIVES.length]} ${ANIMALS[hash[2] % ANIMALS.length]}`;
    case 1: return `${first} of Cammelot`;
    case 2: return `${first} ${callSign}`;
    case 3: return `The ${callSign}`;
    default: return `Minister ${callSign}`;
  }
}

function publicName(value, seed) {
  const normalized = String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!normalized) return { value: generatedName(seed), generated: true };
  if (!/^[\p{L}\p{N} ._'-]{2,24}$/u.test(normalized)) throw new Error('username must be 2-24 letters or numbers');
  return { value: normalized, generated: false };
}

function validateSummary(summary = {}) {
  return {
    systemDeaths: number(summary.systemDeaths, 'systemDeaths', 0, 1000, true),
    waiting: number(summary.waiting, 'waiting', 0, 5000, true),
    meanWait: number(summary.meanWait, 'meanWait', 0, 520),
    treatments: number(summary.treatments, 'treatments', 0, 100000, true),
    deathsWaiting: number(summary.deathsWaiting, 'deathsWaiting', 0, 1000, true),
    admin: number(summary.admin, 'admin', 0, 1),
    budget: number(summary.budget, 'budget', -1000000, 10000000, true),
    trust: number(summary.trust, 'trust', 0, 100, true),
    fragility: number(summary.fragility, 'fragility', 0, 100, true),
  };
}

function validateRun(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('JSON object required');
  const seed = number(input.seed, 'seed', 1, 0xffffffff, true);
  if (!SCENARIOS.has(input.scenario)) throw new Error('scenario is invalid');
  if (typeof input.modelVersion !== 'string' || !/^minister-care-\d+-[a-z0-9-]{2,32}$/.test(input.modelVersion)) throw new Error('modelVersion is invalid');
  if (!OUTCOMES.has(input.politicalOutcome)) throw new Error('politicalOutcome is invalid');
  const username = publicName(input.username, seed);
  const run = {
    username: username.value,
    generatedUsername: username.generated,
    scenario: input.scenario,
    seed,
    modelVersion: input.modelVersion,
    endTick: number(input.endTick, 'endTick', 1, 5000, true),
    score: number(input.score, 'score', 0, 10000, true),
    politicalOutcome: input.politicalOutcome,
    summary: validateSummary(input.summary),
  };
  return run;
}

function fingerprint(run) {
  const proof = { ...run, username: undefined, generatedUsername: undefined };
  return createHash('sha256').update(JSON.stringify(proof)).digest('hex').slice(0, 24);
}

export function createLeaderboardStore(filePath) {
  let loaded = false;
  let entries = [];
  let writeQueue = Promise.resolve();

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8'));
      entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  function sorted(filter = {}) {
    return entries.filter(entry => (!filter.scenario || entry.scenario === filter.scenario)
      && (!filter.modelVersion || entry.modelVersion === filter.modelVersion)
      && (!filter.seed || entry.seed === filter.seed))
      .sort((a, b) => a.summary.systemDeaths - b.summary.systemDeaths
        || a.summary.deathsWaiting - b.summary.deathsWaiting
        || b.summary.treatments - a.summary.treatments
        || a.summary.meanWait - b.summary.meanWait
        || Number(b.politicalOutcome === 'served') - Number(a.politicalOutcome === 'served')
        || b.score - a.score
        || a.submittedAt.localeCompare(b.submittedAt));
  }

  async function persist() {
    await mkdir(dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    await writeFile(temporary, JSON.stringify({ version: 1, entries }, null, 2), 'utf8');
    await rename(temporary, filePath);
  }

  return {
    async list(filter = {}, limit = 20) {
      await load();
      return sorted(filter).slice(0, Math.min(100, Math.max(1, limit)));
    },
    async submit(input) {
      await load();
      const run = validateRun(input);
      const id = fingerprint(run);
      const existing = entries.find(entry => entry.id === id);
      const filter = { scenario: run.scenario, modelVersion: run.modelVersion, seed: run.seed };
      if (existing) return { entry: existing, rank: sorted(filter).findIndex(entry => entry.id === id) + 1, duplicate: true };
      const entry = { id, ...run, submittedAt: new Date().toISOString() };
      entries.push(entry);
      if (entries.length > 5000) entries = entries.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 5000);
      writeQueue = writeQueue.then(persist);
      await writeQueue;
      return { entry, rank: sorted(filter).findIndex(item => item.id === id) + 1, duplicate: false };
    },
    async remove(id) {
      await load();
      const index = entries.findIndex(entry => entry.id === id);
      if (index < 0) return null;
      const [removed] = entries.splice(index, 1);
      writeQueue = writeQueue.then(persist);
      await writeQueue;
      return removed;
    },
  };
}

export function createLeaderboardServer({ filePath = resolve('data', 'leaderboard.json'), now = () => Date.now(),
  allowedOrigins = String(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean) } = {}) {
  const store = createLeaderboardStore(filePath);
  const rates = new Map();
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const origin = String(req.headers.origin || '');
      const cors = origin && allowedOrigins.includes(origin) ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
        'Vary': 'Origin',
      } : {};
      const reply = (status, body) => json(res, status, body, cors);
      if (url.pathname === '/healthz') return json(res, 200, { ok: true });
      if (url.pathname !== '/api/leaderboard') return json(res, 404, { error: 'not found' });
      if (req.method === 'OPTIONS') {
        if (!origin || !allowedOrigins.includes(origin)) return json(res, 403, { error: 'origin not allowed' });
        res.writeHead(204, cors); res.end(); return;
      }
      if (origin && !allowedOrigins.includes(origin)) return json(res, 403, { error: 'origin not allowed' });
      if (req.method === 'GET') {
        if (url.search.length > 512) return reply(414, { error: 'query too long' });
        const scenario = url.searchParams.get('scenario') || '';
        const modelVersion = url.searchParams.get('modelVersion') || '';
        const seed = url.searchParams.has('seed') ? Number.parseInt(url.searchParams.get('seed'), 10) : 0;
        if (scenario && !SCENARIOS.has(scenario)) return reply(400, { error: 'scenario is invalid' });
        if (modelVersion && !/^minister-care-\d+-[a-z0-9-]{2,32}$/.test(modelVersion)) return reply(400, { error: 'modelVersion is invalid' });
        if (seed && (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff)) return reply(400, { error: 'seed is invalid' });
        const limit = Number.parseInt(url.searchParams.get('limit') || '20', 10);
        return reply(200, { entries: await store.list({ scenario, modelVersion, seed }, Number.isFinite(limit) ? limit : 20) });
      }
      if (req.method !== 'POST') return reply(405, { error: 'method not allowed' });
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(value => value.trim()).filter(Boolean);
      const key = String(req.headers['x-client-ip'] || req.headers['x-real-ip'] || forwarded.at(-1)
        || req.socket.remoteAddress || 'unknown').slice(0, 64);
      const time = now();
      const recent = (rates.get(key) || []).filter(value => time - value < 60_000);
      if (recent.length >= 10) return reply(429, { error: 'too many submissions' });
      recent.push(time); rates.set(key, recent);
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) return reply(413, { error: 'request too large' });
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return reply(400, { error: 'invalid JSON' }); }
      const result = await store.submit(body);
      return reply(result.duplicate ? 200 : 201, result);
    } catch (error) {
      const origin = String(req.headers.origin || '');
      const headers = origin && allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};
      return json(res, 400, { error: error.message || 'invalid request' }, headers);
    }
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const port = Number.parseInt(process.env.PORT || '3015', 10);
  const server = createLeaderboardServer({ filePath: process.env.LEADERBOARD_FILE || resolve('data', 'leaderboard.json') });
  server.listen(port, '0.0.0.0', () => console.log(`Cammelot leaderboard listening on ${port}`));
}

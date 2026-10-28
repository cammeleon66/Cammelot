import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { chromium } from 'playwright-chromium';
import '../site/minister-model-core.js';
import { ministerModelExecutableId } from '../scripts/minister_model_identity.mjs';

const SITE_ROOT = join(process.cwd(), 'site');
const MIME_TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const core = globalThis.MinisterModelCore;
const R03_PARITY_FIXTURE = {
  scenario: core.R03_SCENARIO,
  seed: 60475,
  protocolVersion: core.R01_PROTOCOL_VERSION,
  interventionId: 'conventional_integration',
  inputs: {
    horizonTicks: 8,
    coordinationUnitsPerTick: 2,
    treatmentStartsPerTick: 1,
    episodes: [
      { id: 'pending-a', age: 70, arrivalTick: 0, startingWaitTicks: 8, criticalAtTick: 1, deathAtTick: 1 },
      { id: 'pending-b', age: 80, arrivalTick: 0, startingWaitTicks: 4, criticalAtTick: 1 },
      { id: 'new-c', age: 75, arrivalTick: 1, startingWaitTicks: 0, informationComplete: false },
    ],
  },
  schedule: {
    id: 'fixture-schedule-v1',
    events: [{ tick: 2, patientId: 'new-c', kind: 'information_available' }],
  },
};

function runR03ParityTrace({ fixture, modelExecutableId }) {
  const model = globalThis.MinisterModelCore;
  const run = model.createRun({ ...fixture, modelExecutableId });
  const cursor = run.eventsSince(0).cursor;
  run.applyCommand({ id: 'handoff-a', sequence: 1, kind: 'complete_handoff', patientId: 'pending-a' });
  run.applyCommand({ id: 'handoff-b', sequence: 2, kind: 'complete_handoff', patientId: 'pending-b' });
  run.advanceOneTick(cursor);
  const informationRequest = run.applyCommand({ id: 'request-info', sequence: 3,
    kind: 'request_information', patientId: 'new-c' });
  const secondTick = run.advanceOneTick(informationRequest.eventCursor);
  run.applyCommand({ id: 'handoff-c', sequence: 4, kind: 'complete_handoff', patientId: 'new-c' });
  run.advanceOneTick(secondTick.cursor);
  return { events: run.eventsSince(0).events, snapshot: run.snapshot() };
}

test('Minister script integrity pins the shared module bytes', () => {
  const moduleBytes = readFileSync(join(SITE_ROOT, 'minister-model-core.js'));
  const ministerHtml = readFileSync(join(SITE_ROOT, 'minister.html'), 'utf8');
  const integrity = ministerHtml.match(/<script src="minister-model-core\.js" integrity="([^"]+)"/)?.[1];
  assert.equal(integrity, `sha256-${createHash('sha256').update(moduleBytes).digest('base64')}`);
});

function startServer(root) {
  const server = createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filePath = resolve(root, `.${urlPath}`);
    const pathFromRoot = relative(root, filePath);
    if (isAbsolute(pathFromRoot) || pathFromRoot === '..' || pathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
        || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launchBrowser() {
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  browser.on('context', context => context.route(
    /https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|plausible\.io)\//,
    route => route.fulfill({ status: 200, body: '' }),
  ));
  return browser;
}

test('Minister browser and Node load the same deterministic model primitives', { timeout: 30000 }, async () => {
  const server = await startServer(SITE_ROOT);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,
      { waitUntil: 'domcontentloaded' });
    const browserResult = await page.evaluate(async () => {
      await MoC.record.ready;
      const random = MinisterModelCore.mulberry32(42);
      return {
        modelExecutableId: MoC.record.modelExecutableId,
        replayExecutableId: MoC.record.replayExecutableId,
        recordSchema: MoC.record.schema,
        replayVersion: MoC.record.replayVersion,
        ticks: [MinisterModelCore.TICKS_PER_WEEK, MinisterModelCore.QUARTER_TICKS,
          MinisterModelCore.TICKS_PER_YEAR, MinisterModelCore.STARTUP_CYCLE],
        random: [random(), random(), random()],
        annualProbability: MinisterModelCore.annualProbabilityToTick(0.2),
        hash: MinisterModelCore.hashCode('cammelot'),
        seeded: [MinisterModelCore.seededRandom(17)(), MinisterModelCore.seededRandom(17)()],
      };
    });
    const random = core.mulberry32(42);
    assert.equal(browserResult.modelExecutableId, await ministerModelExecutableId());
    assert.equal(browserResult.recordSchema, 'minister-command-record-2');
    assert.equal(browserResult.replayVersion, 'minister-command-replay-2');
    assert.deepEqual(browserResult.ticks,
      [core.TICKS_PER_WEEK, core.QUARTER_TICKS, core.TICKS_PER_YEAR, core.STARTUP_CYCLE]);
    assert.deepEqual(browserResult.random, [random(), random(), random()]);
    assert.equal(browserResult.annualProbability, core.annualProbabilityToTick(0.2));
    assert.equal(browserResult.hash, core.hashCode('cammelot'));
    assert.deepEqual(browserResult.seeded, [core.seededRandom(17)(), core.seededRandom(17)()]);
    assert.equal(browserResult.replayExecutableId.length, 64);
    await page.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('F08 refuses startup when identity-fetch bytes differ from the SRI-pinned script', { timeout: 30000 }, async () => {
  const server = await startServer(SITE_ROOT);
  const browser = await launchBrowser();
  try {
    const changedBytes = Buffer.concat([readFileSync(join(SITE_ROOT, 'minister-model-core.js')), Buffer.from('\n')]);
    const page = await browser.newPage();
    await page.route('**/minister-model-core.js', async route => {
      if (route.request().resourceType() === 'fetch') {
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: changedBytes });
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,
      { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => launchSimulation());
    await page.locator('#minister-model-error').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => ({
      tick: modelTick,
      started: !!window._mocGameStarted,
      record: MoC.record.export(),
      notice: document.querySelector('#minister-model-error').textContent,
    })), {
      tick: 0,
      started: false,
      record: null,
      notice: 'Minister model module digest does not match its integrity attribute.',
    });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('R03 browser pathway events and final snapshot match the Node fixture', { timeout: 30000 }, async () => {
  const server = await startServer(SITE_ROOT);
  const browser = await launchBrowser();
  try {
    const modelExecutableId = await ministerModelExecutableId();
    const nodeResult = runR03ParityTrace({ fixture: R03_PARITY_FIXTURE, modelExecutableId });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`,
      { waitUntil: 'domcontentloaded' });
    const browserResult = await page.evaluate(runR03ParityTrace, {
      fixture: R03_PARITY_FIXTURE,
      modelExecutableId,
    });
    assert.deepEqual(browserResult.events, nodeResult.events);
    assert.deepEqual(browserResult.snapshot, nodeResult.snapshot);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});

test('F08 rejects a record when shared module bytes change without a page or model-version change',
  { timeout: 30000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'minister-model-identity-'));
    const server = await startServer(root);
    const browser = await launchBrowser();
    try {
      const html = await readFile(join(SITE_ROOT, 'minister.html'));
      const moduleBytes = await readFile(join(SITE_ROOT, 'minister-model-core.js'));
      await writeFile(join(root, 'minister.html'), html);
      await writeFile(join(root, 'minister-model-core.js'), moduleBytes);
      const page = await browser.newPage();
      const url = `http://127.0.0.1:${server.address().port}/minister.html#scn=cabinetcrisis&seed=2468`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const original = await page.evaluate(async () => {
        await MoC.record.ready;
        const modelVersion = MoC.MODEL_VERSION;
        MoC.record.begin();
        return { record: MoC.record.export(), modelVersion, modelExecutableId: MoC.record.modelExecutableId,
          replayExecutableId: MoC.record.replayExecutableId };
      });
      await page.close();

      const changedModule = Buffer.concat([moduleBytes, Buffer.from('\n')]);
      const originalIntegrity = `sha256-${createHash('sha256').update(moduleBytes).digest('base64')}`;
      const changedIntegrity = `sha256-${createHash('sha256').update(changedModule).digest('base64')}`;
      await writeFile(join(root, 'minister-model-core.js'), changedModule);
      await writeFile(join(root, 'minister.html'),
        Buffer.from(html.toString('utf8').replace(originalIntegrity, changedIntegrity)));
      const replayPage = await browser.newPage();
      await replayPage.goto(url, { waitUntil: 'domcontentloaded' });
      const replay = await replayPage.evaluate(async record => {
        await MoC.record.ready;
        try {
          await MoC.record.run(record);
          return { error: null, modelVersion: MoC.MODEL_VERSION,
            modelExecutableId: MoC.record.modelExecutableId,
            replayExecutableId: MoC.record.replayExecutableId };
        } catch (error) {
          return { error: error.message, modelVersion: MoC.MODEL_VERSION,
            modelExecutableId: MoC.record.modelExecutableId,
            replayExecutableId: MoC.record.replayExecutableId };
        }
      }, original.record);
      assert.match(replay.error, /incompatible schema, replay, model, protocol or executable/);
      assert.equal(replay.modelVersion, original.modelVersion);
      assert.notEqual(replay.modelExecutableId, original.modelExecutableId);
      assert.equal(replay.modelExecutableId,
        await ministerModelExecutableId(Buffer.concat([moduleBytes, Buffer.from('\n')])));
      assert.notEqual(replay.replayExecutableId, original.replayExecutableId);
      await replayPage.close();
    } finally {
      await browser.close();
      await new Promise(resolve => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    }
  });

import { test } from 'node:test';
import assert from 'node:assert/strict';
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

      await writeFile(join(root, 'minister-model-core.js'), Buffer.concat([moduleBytes, Buffer.from('\n')]));
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

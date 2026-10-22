import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { extname, join, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright-chromium';

const REPO_ROOT = process.cwd();
const SITE_ROOT = join(REPO_ROOT, 'site');
const SCENARIOS = [
  { id: 'cabinetcrisis', quarters: 8 },
  { id: 'campaign', quarters: 40 },
];
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
};

function startArtifactServer() {
  const server = createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end('bad request');
      return;
    }
    const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
    const filePath = resolve(SITE_ROOT, relativePath);
    const fromRoot = relative(SITE_ROOT, filePath);
    if (fromRoot.startsWith(`..${sep}`) || fromRoot === '..'
      || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolveServer({
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((resolveClose, rejectClose) => {
          server.close(error => error ? rejectClose(error) : resolveClose());
        }),
      });
    });
  });
}

function startLocalPythonServer() {
  const executable = process.platform === 'win32' ? 'python' : 'python3';
  const child = spawn(executable, [
    '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', REPO_ROOT,
  ], {
    cwd: REPO_ROOT,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolveServer, reject) => {
    let output = '';
    let ready = false;
    const timeout = setTimeout(() => fail(new Error('Python HTTP server did not report its port')), 10000);
    const fail = error => {
      if (ready) return;
      clearTimeout(timeout);
      child.kill();
      reject(error);
    };
    const onOutput = chunk => {
      output += chunk.toString();
      const port = output.match(/port (\d+)/)?.[1];
      if (!port || ready) return;
      ready = true;
      clearTimeout(timeout);
      resolveServer({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise(resolveClose => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolveClose();
            return;
          }
          child.once('exit', resolveClose);
          child.kill();
        }),
      });
    };
    child.stdout.on('data', onOutput);
    child.stderr.on('data', chunk => {
      output += chunk.toString();
      if (child.exitCode !== null) fail(new Error(`Python HTTP server exited: ${output}`));
    });
    child.once('error', error => fail(new Error(`Could not start ${executable}: ${error.message}`)));
    child.once('exit', (code, signal) => {
      if (!ready) fail(new Error(`Python HTTP server exited before starting (${code ?? signal}): ${output}`));
    });
  });
}

async function exerciseSupportedPath({ name, serverFactory, pagePath }) {
  const server = await serverFactory();
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const baseUrl = `${server.baseUrl}${pagePath}`;
  const origin = new URL(baseUrl).origin;
  const attemptedSubmissions = [];

  try {
    for (const [index, scenario] of SCENARIOS.entries()) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const pageErrors = [];
      const sameOriginFailures = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('requestfailed', request => {
        if (new URL(request.url()).origin === origin) sameOriginFailures.push(request.url());
      });
      await page.addInitScript(() => localStorage.setItem('moc_muted_v2', 'true'));
      await page.route('**/*', route => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin !== origin) return route.abort();
        if (requestUrl.pathname.endsWith('/api/leaderboard')) {
          if (route.request().method() === 'POST') attemptedSubmissions.push(requestUrl.href);
          return route.fulfill({
            status: route.request().method() === 'POST' ? 501 : 200,
            contentType: 'application/json',
            body: JSON.stringify({ entries: [] }),
          });
        }
        return route.continue();
      });

      try {
        const response = await page.goto(`${baseUrl}#scn=${scenario.id}&seed=2468`, {
          waitUntil: 'domcontentloaded',
        });
        assert.equal(response?.status(), 200, `${name}: Minister HTML must be served`);
        await page.waitForFunction(() => typeof MoC !== 'undefined' && MoC.S?.scenario, null, { timeout: 15000 });
        const startup = await page.evaluate(() => ({
          scenario: MoC.S.scenario,
          quarters: MoC.TOTAL_QUARTERS,
          modelVersion: MoC.MODEL_VERSION,
          isBaseline: MoC.IS_BASELINE,
          openingScreen: document.querySelector('#play-overlay') !== null,
        }));
        assert.equal(startup.scenario, scenario.id, `${name}: selected scenario must initialize`);
        assert.equal(startup.quarters, scenario.quarters, `${name}: scenario horizon must load`);
        assert.equal(startup.modelVersion, 'minister-care-5-rollout');
        assert.equal(startup.isBaseline, false);
        assert.equal(startup.openingScreen, true, `${name}: player must start at the game opening`);

        if (index === 0) {
          await page.waitForFunction(() => {
            const frame = MoC?.baselineFrame;
            const reference = MoC?.baseline;
            if (!frame || !reference || !frame.contentWindow) return false;
            try {
              return frame.contentWindow.location.origin === location.origin
                && reference.type === 'mocBaseline'
                && reference.scenario === MoC.S.scenario
                && reference.seed === MoC.seed
                && reference.modelVersion === MoC.MODEL_VERSION
                && reference.protocol === MoC.REFERENCE_PROTOCOL
                && reference.scheduleId === MoC.environment.scheduleId
                && Object.keys(reference.snapshots || {}).length > 0;
            } catch {
              return false;
            }
          }, null, { timeout: 150000 });
          const reference = await page.evaluate(() => ({
            parentPath: location.pathname,
            frameUrl: MoC.baselineFrame.src,
            frameOrigin: MoC.baselineFrame.contentWindow.location.origin,
            framePath: MoC.baselineFrame.contentWindow.location.pathname,
            baselineMode: MoC.baselineFrame.contentWindow.eval('MoC.IS_BASELINE'),
            scenario: MoC.baseline.scenario,
            seed: MoC.baseline.seed,
            modelVersion: MoC.baseline.modelVersion,
            protocol: MoC.baseline.protocol,
            scheduleId: MoC.baseline.scheduleId,
            snapshots: Object.keys(MoC.baseline.snapshots).length,
          }));
          const frameUrl = new URL(reference.frameUrl);
          assert.equal(reference.frameOrigin, origin, `${name}: reference must be same-origin`);
          assert.equal(reference.framePath, reference.parentPath, `${name}: relative reference path must resolve beside Minister`);
          assert.equal(frameUrl.origin, origin);
          assert.equal(frameUrl.search, '');
          assert.equal(frameUrl.hash.includes(`scn=${scenario.id}`), true);
          assert.equal(frameUrl.hash.includes('baseline=1'), true);
          assert.equal(reference.baselineMode, true);
          assert.equal(reference.scenario, scenario.id);
          assert.equal(reference.seed, 2468);
          assert.equal(reference.modelVersion, 'minister-care-5-rollout');
          assert.equal(reference.protocol, 'no-discretionary-action-v1');
          assert.ok(reference.scheduleId);
          assert.ok(reference.snapshots > 0, `${name}: completed reference must contain snapshots`);
        }
        assert.deepEqual(pageErrors, [], `${name}: scenario startup must not throw`);
        assert.deepEqual(sameOriginFailures, [], `${name}: same-origin assets must load`);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(attemptedSubmissions, [], `${name}: smoke tests must never submit scores`);
  } finally {
    await browser.close();
    await server.close();
  }
}

test('GitHub Pages site artifact serves both supported Minister scenarios and its same-origin reference', {
  timeout: 180000,
}, async () => exerciseSupportedPath({
  name: 'Pages site artifact',
  serverFactory: startArtifactServer,
  pagePath: '/minister.html',
}));

test('documented local Python HTTP path serves both supported Minister scenarios and its same-origin reference', {
  timeout: 180000,
}, async () => exerciseSupportedPath({
  name: 'local Python HTTP',
  serverFactory: startLocalPythonServer,
  pagePath: '/site/minister.html',
}));

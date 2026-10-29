// B04 (#55): post-game explanation. Presentation-only checks for every ending type:
// the displayed gate values must equal the final state, contributors must come from the recorded ledger,
// and the model version / leaderboard payload must not change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-chromium';

const SITE_ROOT = join(process.cwd(), 'site');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const MODEL_VERSION = 'minister-care-11-political-trust-balance';

function startSiteServer() {
  const server = createServer((request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filePath = normalize(join(SITE_ROOT, urlPath === '/' ? 'minister.html' : urlPath.replace(/^\/+/, '')));
    if (!filePath.startsWith(SITE_ROOT) || !existsSync(filePath) || !statSync(filePath).isFile()) return response.writeHead(404).end('not found');
    response.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Opens a fresh town, never contacting a real leaderboard. POST bodies are captured, not forwarded.
async function withEnding(scenario, run, viewport = { width: 1280, height: 900 }) {
  const server = await startSiteServer();
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport });
  const posts = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('moc_muted_v2', 'true'));
  await page.route('**/*', route => {
    const request = route.request();
    if (!request.url().startsWith(`http://127.0.0.1:${server.address().port}/`)) {
      if (request.method() === 'POST') {
        posts.push(JSON.parse(request.postData() || '{}'));
        return route.fulfill({ status: 200, json: { entry: { username: 'Fixture Minister' }, rank: 1 } });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: /leaderboard/.test(request.url()) ? JSON.stringify({ entries: [] }) : '[]' });
    }
    if (request.method() === 'POST') { posts.push(JSON.parse(request.postData() || '{}')); return route.fulfill({ status: 200, json: { entry: { username: 'Fixture Minister' }, rank: 1 } }); }
    return route.continue();
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/minister.html?debug=1#scn=${scenario}&seed=2468`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { document.getElementById('play-overlay')?.remove(); clearInterval(autoTimer); autoTimer = null; MoC.paused = true; });
    await run(page, posts);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}

// Reads the rendered explanation and the live final state in one evaluation.
async function readEnding(page) {
  // The score counts up on screen; the displayed score gate must settle on the same number.
  await page.waitForFunction(() => { const gate = document.querySelector('[data-gate="win-score"]'); return !gate || document.getElementById('moc-scoreval').textContent === gate.dataset.actual; }, null, { timeout: 8000 });
  return page.evaluate(() => {
    const GS = MoC.S, root = document.getElementById('moc-why');
    const stage = Math.max(0, GS.cascades?.exodus?.stage || 0, GS.cascades?.rot?.stage || 0);
    const kept = (GS.promises || []).filter(i => GS.PROMISES[i]?.check()).length;
    const deaths = GRAVE_MARKERS.filter(g => g.cause === 'system_failure').length;
    const expected = {
      'parliament-trust': GS.trustP, 'vote-parliament-trust': GS.trustP, 'strong-parliament-trust': GS.trustP, 'parliament-confidence-vote': GS.trustP,
      'doctor-trust': GS.trustD, 'vote-doctor-trust': GS.trustD, 'strong-doctor-trust': GS.trustD, 'doctor-trust-strike': GS.trustD,
      'citizen-trust': GS.trustC, 'vote-citizen-trust': GS.trustC, 'strong-citizen-trust': GS.trustC,
      'system-deaths-limit': deaths, 'vote-system-deaths': deaths, 'strong-system-deaths': deaths,
      'budget-floor': GS.budget, 'household-departures': (GS._relocatedHouseholds || []).length,
      'promises-kept': kept, 'vote-cascade': stage, 'win-score': Number(document.getElementById('moc-scoreval').textContent)
    };
    const ops = { '>': (a, b) => a > b, '>=': (a, b) => a >= b, '<': (a, b) => a < b, '<=': (a, b) => a <= b };
    const gates = [...root.querySelectorAll('[data-gate]')].map(li => {
      const actual = li.dataset.actual === undefined ? null : Number(li.dataset.actual);
      return { id: li.dataset.gate, deciding: !li.closest('#moc-why-other'), actual, required: li.dataset.required === undefined ? null : Number(li.dataset.required),
        op: li.dataset.op, passed: li.dataset.passed === 'true', expected: expected[li.dataset.gate],
        recomputed: actual === null ? null : ops[li.dataset.op](actual, Number(li.dataset.required)),
        shown: li.querySelector('.moc-gate-actual').textContent, state: li.querySelector('.moc-gate-state').textContent };
    });
    const blocks = [...root.querySelectorAll('.moc-why-block')].map(b => ({ metric: b.dataset.metric, title: b.querySelector('h4').textContent,
      items: [...b.querySelectorAll('.moc-contrib li')].map(li => li.innerText.replace(/\s+/g, ' ').trim()), recon: b.querySelector('.moc-why-recon')?.textContent || '' }));
    return { ending: root.dataset.ending, kind: root.dataset.endingKind, tick: Number(root.dataset.tick), finalTick: GS._finalSnapshot.tick, gates, blocks,
      hint: document.getElementById('moc-why-hint').textContent, care: document.getElementById('moc-why-care').innerText,
      winStamp: !!document.querySelector('#moc-endscreen .moc-stamp.win'), text: root.innerText, modelVersion: MoC.MODEL_VERSION, endReason: GS.endReason,
      trust: { c: GS.trustC, d: GS.trustD, p: GS.trustP }, budget: GS.budget, ledgerEntries: MoC.trustLedger.entries.length };
  });
}

// Every displayed number equals the final state, and the pass/fail marker matches the displayed comparison.
function assertGatesMatchFinalState(result, label) {
  assert.equal(result.modelVersion, MODEL_VERSION, `${label}: model version is unchanged`);
  assert.equal(result.tick, result.finalTick, `${label}: explanation is stamped with the final tick`);
  assert.ok(result.gates.length > 0, `${label}: gates are displayed`);
  for (const gate of result.gates) {
    if (gate.actual === null) continue;
    assert.equal(gate.actual, gate.expected, `${label}: gate ${gate.id} shows the final-state value`);
    assert.equal(gate.shown.replace(/[€,]/g, ''), String(gate.expected), `${label}: gate ${gate.id} text equals the final-state value`);
    assert.equal(gate.passed, gate.recomputed, `${label}: gate ${gate.id} marker matches actual ${gate.op} required`);
    assert.match(gate.state, gate.passed ? /MET/ : /NOT MET/);
  }
}
const decidingFailed = result => result.gates.filter(g => g.deciding && !g.passed).map(g => g.id);

test('B04 no-confidence ending shows the parliament gate, ledger contributors and a hint', { timeout: 60000 }, async () => {
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { _mocDebug.applyFx({ trustP: -30 }, 'Law enacted: Hospital Reform Act'); _mocDebug.applyFx({ trustP: -12 }, 'Resident request: ignored'); MoC.S.trustP = MoC.S.trustP; _mocForceCouncil(2); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'noconfidence');
    assert.equal(result.ending, 'noconfidence'); assert.equal(result.kind, 'lost');
    assertGatesMatchFinalState(result, 'noconfidence');
    assert.deepEqual(decidingFailed(result), ['parliament-trust']);
    const gate = result.gates.find(g => g.id === 'parliament-trust');
    assert.ok(gate.actual <= 15 && gate.required === 15);
    const block = result.blocks.find(b => b.metric === 'parliament');
    assert.ok(block, 'contributors are listed for the failed metric');
    assert.match(block.items[0], /^Law enacted: Hospital Reform Act .*−30$/, 'largest recorded loss comes first');
    assert.ok(block.items.length <= 3);
    assert.match(block.recon, new RegExp(`= final ${result.trust.p}\\.`));
    assert.match(result.hint, /Law enacted: Hospital Reform Act/);
    assert.match(result.hint, /different choice/);
    assert.doesNotMatch(result.hint, /should|must|testimonial|unfortunately/i);
    assert.match(result.care, /pending or unavailable|same-seed no-action reference/i);
    assert.match(result.text, /model-classified system deaths/i);
  });
});

test('B04 protest ending: citizen trust gate and household-departure gate', { timeout: 60000 }, async () => {
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { _mocDebug.applyFx({ trustC: -40 }, 'Decision: Keep normal queue'); _mocForceCouncil(2); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'protest'); assert.equal(result.kind, 'lost');
    assertGatesMatchFinalState(result, 'protest/trust');
    assert.deepEqual(decidingFailed(result), ['citizen-trust']);
    assert.match(result.blocks.find(b => b.metric === 'citizens').items[0], /Decision: Keep normal queue .*−40$/);
  });
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { MoC.S._relocatedHouseholds = ['A. Jansen', 'B. Bakker', 'C. Visser', 'D. Mulder']; _mocDebug.endTerm('protest'); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assertGatesMatchFinalState(result, 'protest/households');
    assert.deepEqual(decidingFailed(result), ['household-departures']);
    assert.equal(result.gates.find(g => g.id === 'household-departures').actual, 4);
    assert.match(result.blocks.find(b => b.metric === 'households').items.join('|'), /Mulder household left/);
  });
});

test('B04 doctor strike, scandal and budget endings are explained from the final state', { timeout: 90000 }, async () => {
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { _mocDebug.applyFx({ trustD: -60 }, 'Decision: Push the staff harder'); _mocForceCouncil(2); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'strike');
    assertGatesMatchFinalState(result, 'strike');
    assert.deepEqual(decidingFailed(result), ['doctor-trust']);
  });
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => {
      for (let i = 0; i < 15; i++) GRAVE_MARKERS.push({ x: 0, y: 0, name: 'Fixture ' + i, age: 70, cause: 'system_failure', waitWeeks: 14, cycle: 10 + i, conditions: [] });
      MoC.S._sdLastQ = 15; _mocForceCouncil(2);
    });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'scandal');
    assertGatesMatchFinalState(result, 'scandal');
    assert.deepEqual(decidingFailed(result), ['system-deaths-limit']);
    assert.equal(result.gates.find(g => g.id === 'system-deaths-limit').actual, 15);
    assert.equal(result.blocks.find(b => b.metric === 'deaths').items.length, 1);
    assert.match(result.hint, /Year 1 \(15\)/);
  });
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { _mocDebug.applyFx({ budget: -900000 }, 'Spending: Emergency bridge'); _mocForceCouncil(2); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'bankrupt');
    assertGatesMatchFinalState(result, 'bankrupt');
    assert.deepEqual(decidingFailed(result), ['budget-floor']);
    assert.match(result.blocks.find(b => b.metric === 'budget').items[0], /Spending: Emergency bridge/);
  });
});

test('B04 lost final vote: Cabinet Crisis and Full Term election gates equal the final state', { timeout: 90000 }, async () => {
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { _mocDebug.applyFx({ trustC: -10, trustD: -5, trustP: -25 }, 'Law enacted: Fast-track Act'); MoC.onTermEnd(); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'election'); assert.equal(result.kind, 'lost');
    assertGatesMatchFinalState(result, 'cabinet election');
    assert.ok(result.gates.filter(g => g.deciding).every(g => /^vote-/.test(g.id)), 'only final-vote gates decide a lost vote');
    assert.ok(decidingFailed(result).includes('vote-parliament-trust'));
    assert.equal(result.gates.find(g => g.id === 'vote-parliament-trust').required, 35);
    assert.match(result.blocks.find(b => b.metric === 'parliament').items[0], /Law enacted: Fast-track Act .*−25$/);
  });
  await withEnding('campaign', async page => {
    await page.evaluate(() => {
      const GS = MoC.S; GS.promises = [0, 1, 2]; GS._electionHeld = true; GS._electionResult = 'failed';
      GS.cascades = { exodus: { stage: 3 } };
      _mocDebug.applyFx({ trustC: -20, trustP: -20 }, 'Resident request: Refer to local service');
      _mocDebug.endTerm('election');
    });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.ending, 'election'); assert.equal(result.kind, 'lost');
    assertGatesMatchFinalState(result, 'full-term election');
    const ids = result.gates.filter(g => g.deciding).map(g => g.id);
    assert.deepEqual(ids, ['promises-kept', 'vote-citizen-trust', 'vote-doctor-trust', 'vote-parliament-trust', 'vote-system-deaths', 'vote-cascade']);
    assert.ok(decidingFailed(result).includes('vote-cascade'));
    assert.equal(result.gates.find(g => g.id === 'vote-cascade').actual, 3);
    assert.equal(result.gates.find(g => g.id === 'promises-kept').required, 2);
    assert.ok(result.blocks.length >= 1 && result.blocks.length <= 3, 'at most three failed metrics are expanded');
    assert.ok(result.blocks.every(b => b.items.length <= 3));
  });
});

test('B04 served and won endings: win conditions are shown with final values and match the win stamp', { timeout: 120000 }, async () => {
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { _mocDebug.applyFx({ trustC: 20, trustD: 20, trustP: 20 }, 'Decision: Open the books'); MoC.onTermEnd(); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'served'); assert.equal(result.kind, 'won'); assert.equal(result.winStamp, true);
    assertGatesMatchFinalState(result, 'cabinet won');
    assert.deepEqual(decidingFailed(result), []);
    assert.match(result.text, /^Why you won/);
    assert.ok(result.blocks.length === 1 && /closest margin/i.test(result.blocks[0].title), 'a win names the closest margin instead of a failed metric');
  });
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => { _mocDebug.applyFx({ trustC: -10, trustD: -10, trustP: -10 }, 'Decision: Hold steady'); MoC.onTermEnd(); });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.equal(result.endReason, 'served'); assert.equal(result.kind, 'served'); assert.equal(result.winStamp, false);
    assertGatesMatchFinalState(result, 'cabinet served');
    assert.ok(decidingFailed(result).every(id => id.startsWith('strong-')));
    assert.ok(decidingFailed(result).length >= 1);
    assert.match(result.text, /^Why this was not a win/);
  });
  for (const [election, expectKind] of [['strong', null], ['narrow', 'served'], [undefined, 'served']]) {
    await withEnding('campaign', async page => {
      await page.evaluate(election => { const GS = MoC.S; GS._electionResult = election; GS._electionHeld = !!election; _mocDebug.endTerm('served'); }, election);
      await page.locator('#moc-why').waitFor();
      const result = await readEnding(page);
      assertGatesMatchFinalState(result, `full term served/${election}`);
      const midterm = result.gates.find(g => g.id === 'midterm-election');
      assert.equal(midterm.passed, election === 'strong');
      const scorePassed = result.gates.find(g => g.id === 'win-score').passed;
      assert.equal(result.kind === 'won', election === 'strong' && scorePassed);
      assert.equal(result.winStamp, result.kind === 'won', 'explanation agrees with the win stamp');
      if (expectKind) assert.equal(result.kind, expectKind);
    });
  }
  await withEnding('sprint', async page => {
    await page.evaluate(() => _mocDebug.endTerm('served'));
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assertGatesMatchFinalState(result, 'sprint served');
    assert.deepEqual(result.gates.filter(g => g.deciding).map(g => g.id), ['win-score']);
    assert.equal(result.winStamp, result.kind === 'won');
  });
});

test('B04 care outcome compares with the same-seed no-action reference only when one exists', { timeout: 90000 }, async () => {
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => {
      MoC.referencePolicy = true;
      for (let step = 0; step < 20; step++) tick();
      MoC.referencePolicy = false;
      MoC.care.sync();
      const reference = { ...MoC.care.snapshot(), systemDeaths: MoC.care.snapshot().systemDeaths + 2 };
      MoC.baseline = { protocol: MoC.REFERENCE_PROTOCOL, scheduleId: MoC.environment.scheduleId, modelVersion: MoC.MODEL_VERSION,
        seed: MoC.seed, scenario: MoC.S.scenario, snapshots: { [modelTick]: reference } };
      _mocDebug.endTerm('noconfidence');
    });
    await page.locator('#moc-why').waitFor();
    const result = await readEnding(page);
    assert.match(result.care, /2 fewer model-classified system deaths than the reference/);
    assert.match(result.care, /Model-classified system deaths\s+0 \/ 2/);
    assert.match(result.care, /not clinical evidence/);
  });
  await withEnding('cabinetcrisis', async page => {
    await page.evaluate(() => _mocDebug.endTerm('noconfidence'));
    await page.locator('#moc-why').waitFor();
    assert.match((await readEnding(page)).care, /pending or unavailable.*No benefit claimed/s);
  });
});

test('B04 leaves the leaderboard payload unchanged and never reaches a live service', { timeout: 60000 }, async () => {
  await withEnding('cabinetcrisis', async (page, posts) => {
    await page.evaluate(() => _mocDebug.endTerm('served'));
    await page.locator('#moc-why').waitFor();
    await page.evaluate(() => MoC.S._publishCompletedRun?.(true));
    await page.waitForFunction(() => document.querySelector('#moc-community-status')?.textContent.includes('rank'));
    assert.equal(posts.length, 1, 'exactly one captured, mocked submission');
    assert.deepEqual(Object.keys(posts[0]).sort(), ['endTick', 'modelVersion', 'politicalOutcome', 'scenario', 'score', 'seed', 'summary', 'username']);
    assert.deepEqual(Object.keys(posts[0].summary).sort(), ['admin', 'budget', 'deathsWaiting', 'fragility', 'meanWait', 'systemDeaths', 'treatments', 'trust', 'waiting']);
    assert.equal(posts[0].modelVersion, MODEL_VERSION);
  });
});

test('B04 ledger reconciles with the final trust state and does not alter it', { timeout: 60000 }, async () => {
  await withEnding('cabinetcrisis', async page => {
    const reconciled = await page.evaluate(() => {
      _mocDebug.applyFx({ trustC: -7, trustD: 4, trustP: -9 }, 'Law enacted: Test A');
      _mocDebug.applyFx({ trustC: -120 }, 'Law enacted: Test B'); // clamps at 0; the ledger records the applied change
      const ledger = MoC.trustLedger, GS = MoC.S;
      return ['citizens', 'doctors', 'parliament'].map(metric => {
        const sum = ledger.entries.filter(e => e.metric === metric).reduce((total, e) => total + e.amount, 0);
        return { metric, final: GS[{ citizens: 'trustC', doctors: 'trustD', parliament: 'trustP' }[metric]], rebuilt: ledger.baseline[metric] + sum };
      });
    });
    for (const row of reconciled) assert.equal(row.final, row.rebuilt, `${row.metric} ledger reconciles`);
  });
});

test('B04 end screen is responsive at 1024, 768 and 480 without overflow', { timeout: 120000 }, async () => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 480, height: 854 }, { width: 375, height: 667 }]) {
    await withEnding('cabinetcrisis', async page => {
      await page.evaluate(() => { _mocDebug.applyFx({ trustP: -50 }, 'Law enacted: Hospital Reform Act'); MoC.onTermEnd(); });
      await page.locator('#moc-why').waitFor();
      await page.waitForFunction(() => document.querySelector('#moc-endscreen .moc-box').getAnimations().every(a => a.playState === 'finished'));
      const layout = await page.evaluate(() => {
        const box = document.querySelector('#moc-endscreen .moc-box'), why = document.getElementById('moc-why');
        const wide = [...why.querySelectorAll('*')].filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.getBoundingClientRect().right > box.getBoundingClientRect().right + 1);
        return { pageOverflow: document.body.scrollWidth > innerWidth, boxOverflow: box.scrollWidth > box.clientWidth + 1,
          whyRight: why.getBoundingClientRect().right, boxRight: box.getBoundingClientRect().right, wide: wide.map(e => e.className) };
      });
      assert.equal(layout.pageOverflow, false, `no page overflow at ${viewport.width}`);
      assert.equal(layout.boxOverflow, false, `no modal overflow at ${viewport.width}`);
      assert.ok(layout.whyRight <= layout.boxRight + 1, `explanation stays inside the modal at ${viewport.width}`);
      assert.deepEqual(layout.wide, []);
      for (const summary of await page.locator('#moc-why summary:visible').all()) assert.ok((await summary.boundingBox()).height >= 43.9, 'touch target >= 44px');
      await page.locator('#moc-why-other summary').click();
      assert.equal(await page.evaluate(() => document.querySelector('#moc-endscreen .moc-box').scrollWidth <= document.querySelector('#moc-endscreen .moc-box').clientWidth + 1), true);
    }, viewport);
  }
});

const { createHash } = require('node:crypto');
const { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const { dirname, extname, join, resolve, sep } = require('node:path');
const { chromium } = require('playwright-chromium');

const root = resolve(process.cwd(), 'site');
const ministerPath = join(root, 'minister.html');
const mime = { '.html':'text/html', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.mp3':'audio/mpeg' };
const strategyDefinitions = {
  balanced: {
    description: 'Mix near-term capacity, workforce, prevention and resilience; rotate across governance tracks.',
    purchases: ['hire', 'mtvp', 'gpfund', 'scribes1', 'changeprog', 'prevention', 'resilience', 'security'],
    lawTracks: ['work', 'inno', 'dig'],
    promises: [0, 1, 4],
  },
  'technology-first': {
    description: 'Prioritize digital tools and platform build-out before physical capacity.',
    purchases: ['scribes1', 'platform', 'platformai', 'scribes2', 'a2a', 'twin', 'pilotgrant', 'security', 'resilience'],
    lawTracks: ['dig', 'inno', 'work'],
    promises: [2, 3, 4],
  },
  'capacity-first': {
    description: 'Prioritize staffing, GP support and routine treatment capacity.',
    purchases: ['hire', 'gpfund', 'mtvp', 'carersupport', 'prevention', 'resilience'],
    lawTracks: ['work', 'dig', 'inno'],
    promises: [0, 1, 4],
  },
  structural: {
    description: 'Prioritize workforce and innovation-governance laws, prevention and resilience.',
    purchases: ['changeprog', 'prevention', 'resilience', 'security', 'gpfund', 'mtvp', 'hire'],
    lawTracks: ['inno', 'work', 'dig'],
    promises: [0, 2, 4],
  },
  adversarial: {
    description: 'A deliberately short-term, fragmented digital-investment policy; not a recommended approach.',
    purchases: ['platform', 'platformai', 'pilotgrant', 'a2a', 'twin'],
    lawTracks: ['dig', 'work', 'inno'],
    promises: [0, 2, 3],
  },
};
const scenarioDefinitions = {
  cabinetcrisis: { name: 'Cabinet Crisis', horizonQuarters: 8 },
  campaign: { name: 'The Full Term', horizonQuarters: 40 },
};

function parseArgs(argv) {
  const options = { seeds: [2468, 1357, 7777], scenarios: Object.keys(scenarioDefinitions),
    policies: Object.keys(strategyDefinitions), concurrency: 3, output: null, repeatBalanced: true };
  for (let index = 0; index < argv.length; index += 1) {
    const [rawName, inlineValue] = argv[index].split('=', 2);
    const name = rawName.startsWith('--') ? rawName.slice(2) : null;
    if (!name) throw new Error(`Unexpected argument: ${argv[index]}`);
    if (name === 'help') {
      options.help = true;
      continue;
    }
    if (name === 'no-repeat-balanced') {
      options.repeatBalanced = false;
      continue;
    }
    const value = inlineValue === undefined ? argv[++index] : inlineValue;
    if (value === undefined) throw new Error(`Missing value for --${name}`);
    if (name === 'seeds') {
      options.seeds = value.split(',').map(Number);
      if (!options.seeds.length || options.seeds.some(seed => !Number.isSafeInteger(seed) || seed < 0))
        throw new Error('--seeds must be a comma-separated list of non-negative integers');
    } else if (name === 'scenarios') {
      options.scenarios = value.split(',').map(item => item.trim());
      if (!options.scenarios.length || options.scenarios.some(item => !scenarioDefinitions[item]))
        throw new Error(`--scenarios must use: ${Object.keys(scenarioDefinitions).join(', ')}`);
    } else if (name === 'policies') {
      options.policies = value.split(',').map(item => item.trim());
      if (!options.policies.length || options.policies.some(item => !strategyDefinitions[item]))
        throw new Error(`--policies must use: ${Object.keys(strategyDefinitions).join(', ')}`);
    } else if (name === 'concurrency') {
      options.concurrency = Number(value);
      if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 8)
        throw new Error('--concurrency must be an integer from 1 through 8');
    } else if (name === 'output') {
      options.output = resolve(value);
    } else if (name === 'repeat-balanced') {
      if (!['true', 'false'].includes(value)) throw new Error('--repeat-balanced must be true or false');
      options.repeatBalanced = value === 'true';
    } else {
      throw new Error(`Unknown option: --${name}`);
    }
  }
  if (new Set(options.seeds).size !== options.seeds.length) throw new Error('--seeds must not contain duplicates');
  if (new Set(options.scenarios).size !== options.scenarios.length) throw new Error('--scenarios must not contain duplicates');
  if (new Set(options.policies).size !== options.policies.length) throw new Error('--policies must not contain duplicates');
  return options;
}

function staticServer() {
  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const relativePath = pathname === '/' ? 'minister.html' : pathname.replace(/^\/+/, '');
    const file = resolve(root, relativePath);
    const withinSite = file === root || file.startsWith(root + sep);
    if (!withinSite || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  });
}

function responseScore(text, strategy) {
  const value = text.replace(/[−–]/g, '-').replace(/€/g, '').toLowerCase();
  const sum = pattern => [...value.matchAll(pattern)].reduce((total, match) => total + Number(match[1] || 0), 0);
  const trust = sum(/(?:trust|citizens?|doctors?|parliament)\s*([+-]\d+(?:\.\d+)?)/g);
  const money = sum(/([+-]\d+(?:\.\d+)?)\s*k/g);
  const capacity = sum(/(?:capacity|starts\/week)\s*([+-]\d+(?:\.\d+)?)/g);
  const admin = sum(/admin(?: burden)?\s*([+-]\d+(?:\.\d+)?)/g);
  const sick = sum(/(?:sick|absence)\s*([+-]\d+(?:\.\d+)?)/g);
  const fragmentation = sum(/fragmentation\s*([+-]\d+(?:\.\d+)?)/g);
  const dependence = sum(/dependence\s*([+-]\d+(?:\.\d+)?)/g);
  const words = value => value.split(/\s+/).some(word => text.includes(word));
  if (strategy === 'adversarial') {
    return money * 8 + fragmentation * 8 + dependence * 5 - trust * 2
      + (value.includes('take the deal') || value.includes('let both run') || value.includes('fasttrack') ? 12 : 0)
      + (value.includes('no comment') || value.includes('skip') || value.includes('refuse') ? 3 : 0);
  }
  if (strategy === 'technology-first') {
    return trust + money * 0.02 + (words('ai digital platform algorithm integration') ? 8 : 0)
      + (value.includes('fragmentation -') ? 5 : 0) - fragmentation * 5 - dependence * 0.5;
  }
  if (strategy === 'capacity-first') {
    return capacity * 20 - admin * 3 - sick * 5 + trust * 0.5
      + (words('workforce staffing locum recruitment health prevention') ? 8 : 0);
  }
  if (strategy === 'structural') {
    return trust * 2 + capacity * 6 - admin * 2 - sick * 3 - fragmentation * 5 - dependence
      + (words('transparen workforce community shared governance integration') ? 8 : 0);
  }
  return trust * 1.5 + capacity * 8 - admin * 2 - sick * 3 - fragmentation * 2
    + money * 0.02 + (words('health prevention resilience workforce') ? 5 : 0);
}

async function chooseResponse(buttons, strategy, stage, trace, page) {
  const count = await buttons.count();
  if (!count) return false;
  const texts = await buttons.allInnerTexts();
  let selected = 0;
  for (let index = 1; index < texts.length; index += 1) {
    if (responseScore(texts[index], strategy) > responseScore(texts[selected], strategy)) selected = index;
  }
  await buttons.nth(selected).click();
  trace.selectedChoices.push({
    stage,
    tick: await page.evaluate(() => modelTick),
    text: texts[selected].trim(),
  });
  return true;
}

async function setupContext(browser, base, networkGuard) {
  const context = await browser.newContext();
  await context.route('**/*', async route => {
    const request = route.request();
    if (request.url().startsWith(`${base}/`)) {
      if (request.method() === 'GET' || request.method() === 'HEAD') return route.continue();
      networkGuard.blockedWrites.push({ method: request.method(), url: request.url() });
      return route.abort();
    }
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      networkGuard.blockedWrites.push({ method: request.method(), url: request.url() });
      return route.abort();
    }
    networkGuard.blockedExternalReads += 1;
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com|plausible\.io/.test(request.url()))
      return route.fulfill({ status: 200, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"entries":[]}' });
  });
  await context.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    localStorage.setItem('moc_muted_v2', 'true');
  });
  return context;
}

async function beginPlayerRun(page, base, scenario, seed, strategy, trace, loaded = false) {
  page.setDefaultTimeout(5000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  if (!loaded) {
    await page.goto(`${base}/minister.html?debug=1#scn=${scenario}&seed=${seed}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
  }
  await page.evaluate(() => {
    document.getElementById('play-overlay')?.remove();
    MoC.paused = false;
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    window._mocShowManifesto();
  });
  if (scenario === 'campaign') {
    await page.locator('#moc-manifesto').waitFor();
    for (const index of strategy.promises) await page.locator(`#moc-manifesto [data-promise="${index}"]`).click();
    const promiseLabels = await page.locator('#moc-manifesto [data-promise]').evaluateAll(nodes =>
      nodes.filter(node => node.style.borderColor).map(node => node.innerText.trim()));
    trace.manifesto = { selectedIndices: strategy.promises, selectedLabels: promiseLabels };
    await page.locator('#moc-manifesto-done').click();
  }
  await page.evaluate(() => {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  });
  await page.evaluate(() => MoC.record.ready);
  return pageErrors;
}

async function chooseLaw(page, strategy, trace) {
  const available = await page.locator('#moc-laws [data-law]').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.law,
    label: node.closest('.moc-item')?.innerText.trim() || node.innerText.trim(),
    disabled: node.disabled,
  })));
  const owned = await page.evaluate(() => Object.keys(MoC.S.laws || {}));
  const unavailable = [];
  for (const track of strategy.lawTracks) {
    const candidate = available.find(law => law.id.startsWith(track));
    if (!candidate) {
      unavailable.push({ track, reason: owned.filter(id => id.startsWith(track)).length >= 3
        ? 'all laws in this track already enacted'
        : 'no player-visible law control for this track' });
      continue;
    }
    if (candidate.disabled) {
      unavailable.push({ track, id: candidate.id, reason: `disabled: ${candidate.label}` });
      continue;
    }
    const skipped = unavailable[0];
    if (skipped) trace.fallbacks.push({ kind: 'law', from: skipped.track, to: track, reason: skipped.reason });
    await page.locator(`#moc-laws [data-law="${candidate.id}"]`).click();
    trace.lawChoices.push({ tick: await page.evaluate(() => modelTick), track, id: candidate.id, label: candidate.label });
    return;
  }
  for (const item of unavailable) trace.skippedLaws.push({ tick: await page.evaluate(() => modelTick), ...item });
}

async function choosePurchases(page, strategy, trace) {
  const expansion = page.locator('#moc-shop-more');
  if (await expansion.count()) await expansion.click();
  const quarter = await page.evaluate(() => MoC.S.quarter);
  let bought = 0;
  let previousSkipped = null;
  for (let index = 0; index < strategy.purchases.length; index += 1) {
    const id = strategy.purchases[index];
    if (bought >= 2) {
      trace.skippedPurchases.push({ quarter, id, reason: 'deferred: two-purchase council limit' });
      continue;
    }
    const state = await page.evaluate(itemId => {
      const button = document.querySelector(`#moc-shop [data-buy="${itemId}"]`);
      return {
        owned: Number(MoC.S.owned[itemId] || 0),
        budget: MoC.S.budget,
        present: !!button,
        disabled: !!button?.disabled,
        label: button?.closest('.moc-item')?.innerText.trim() || '',
        controlText: button?.innerText.trim() || '',
      };
    }, id);
    if (!state.present || state.disabled) {
      const reason = state.present
        ? `disabled control "${state.controlText}" at budget ${state.budget}`
        : `no player-visible purchase control (currently owned: ${state.owned})`;
      trace.skippedPurchases.push({ quarter, id, reason });
      previousSkipped = previousSkipped || { id, reason };
      continue;
    }
    const label = state.label;
    await page.locator(`#moc-shop [data-buy="${id}"]`).click();
    trace.purchaseChoices.push({ quarter, id, label });
    if (previousSkipped) trace.fallbacks.push({ kind: 'purchase', from: previousSkipped.id, to: id, reason: previousSkipped.reason });
    previousSkipped = null;
    bought += 1;
  }
}

async function advanceCouncil(page, strategy, trace) {
  for (let step = 0; step < 8; step += 1) {
    if (await page.evaluate(() => MoC.S.over)) return false;
    if (await page.locator('#moc-laws').count()) {
      await chooseLaw(page, strategy, trace);
      const next = page.locator('#moc-wiz-next');
      if (!(await next.count())) return false;
      await next.click();
      continue;
    }
    if (await page.locator('#moc-shop').count()) {
      await choosePurchases(page, strategy, trace);
      const next = page.locator('#moc-wiz-next');
      if (!(await next.count())) return false;
      await next.click();
      return true;
    }
    const choices = page.locator('#moc-council .moc-opt:not(:disabled)');
    if (await choices.count()) await chooseResponse(choices, strategy.id, 'council decision', trace, page);
    const next = page.locator('#moc-wiz-next');
    if (!(await next.count())) return false;
    await next.click();
  }
  return false;
}

async function runPlayer(page, base, scenario, seed, strategy, loaded = false) {
  const trace = { selectedChoices: [], lawChoices: [], skippedLaws: [], purchaseChoices: [], skippedPurchases: [], fallbacks: [] };
  const pageErrors = await beginPlayerRun(page, base, scenario, seed, strategy, trace, loaded);
  let iterations = 0;
  let lastTick = -1;
  let stalled = 0;
  while (!(await page.evaluate(() => MoC.S.over)) && iterations++ < 500) {
    await page.evaluate(() => {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      if (MoC.paused && !MoC.S._councilDue) return;
      MoC.paused = false;
      for (let count = 0; count < 1000 && !MoC.paused && !MoC.S.over; count += 1) tick();
    });
    if (await page.evaluate(() => MoC.S.over)) break;
    const yearEnd = page.locator('#moc-yearend-btn');
    if (await yearEnd.count()) { await yearEnd.click(); continue; }
    const vote = page.locator('#moc-vote button.moc-opt:not(:disabled)');
    if (await vote.count()) {
      await chooseResponse(vote, strategy.id, 'confidence vote', trace, page);
      continue;
    }
    const flashChoices = page.locator('.moc-flash #moc-fa:not(:disabled),.moc-flash #moc-fb:not(:disabled)');
    if (await flashChoices.count()) {
      await chooseResponse(flashChoices, strategy.id, 'event decision', trace, page);
      continue;
    }
    const flashContinue = page.locator('#moc-flash-continue');
    if (await flashContinue.count()) { await flashContinue.click(); continue; }
    const bannerReady = page.locator('#moc-council-ready-banner button');
    const fallbackReady = page.locator('#moc-town-council');
    const ready = await bannerReady.count() && await bannerReady.isVisible() ? bannerReady : fallbackReady;
    if (await ready.count() && await ready.isVisible()) {
      await ready.click();
      await advanceCouncil(page, strategy, trace);
      continue;
    }
    const state = await page.evaluate(() => ({ tick: modelTick, over: MoC.S.over, paused: MoC.paused, blocked: MoC.isBlocked() }));
    if (state.tick === lastTick) stalled += 1;
    else stalled = 0;
    lastTick = state.tick;
    if (stalled > 3) throw new Error(`${strategy.id}/${scenario}/${seed}: no actionable UI at tick ${state.tick}`);
    await page.evaluate(() => {
      if (!MoC.S.over && !MoC.isBlocked()) MoC.paused = false;
    });
  }
  if (iterations >= 500) throw new Error(`${strategy.id}/${scenario}/${seed}: exceeded the bounded action loop`);
  const result = await page.evaluate(async () => {
    const horizonTicks = MoC.TOTAL_QUARTERS * MoC.QUARTER_TICKS;
    const care = MoC.S._finalSnapshot || MoC.care.snapshot();
    const executableIdentity = await MoC.record.ready;
    const history = JSON.parse(localStorage.getItem('moc_runs_' + MoC.MODEL_VERSION) || '[]');
    const saved = history.slice().reverse().find(item => item.seed === MoC.seed && item.scenario === MoC.S.scenario);
    const prior = MoC.previousRun;
    const priorAtTick = prior?.snapshots?.[care.tick] || null;
    const difference = (current, previous) => current == null || previous == null ? null : current - previous;
    const promiseList = MoC.S.PROMISES || [];
    return {
      modelVersion: MoC.MODEL_VERSION,
      referenceProtocol: MoC.REFERENCE_PROTOCOL,
      executableIdentity,
      seed: MoC.seed,
      scenario: MoC.S.scenario,
      horizonTicks,
      endingTick: care.tick,
      endedBeforeHorizon: care.tick < horizonTicks,
      completedDeclaredHorizon: care.tick >= horizonTicks,
      endReason: MoC.S.endReason,
      finalEndingLabel: document.querySelector('#moc-endscreen .moc-verdict .moc-stamp')?.innerText.trim() || null,
      score: saved?.score ?? null,
      cabinetResult: MoC.S._cabinetResult || null,
      cabinetReasons: MoC.S._cabinetReasons || [],
      electionResult: MoC.S._electionResult || null,
      election: MoC.S.electionSnapshot || null,
      manifesto: (MoC.S.promises || []).map(index => ({
        id: promiseList[index]?.id || null,
        label: promiseList[index]?.text || null,
        metAtEnd: !!promiseList[index]?.check(),
      })),
      care,
      trust: { citizens: MoC.S.trustC, doctors: MoC.S.trustD, parliament: MoC.S.trustP },
      budget: MoC.S.budget,
      dependence: MoC.S.dependence,
      fragmentation: MoC.S.fragmentation,
      laws: Object.entries(MoC.S.laws || {}).map(([id, quarter]) => ({ id, quarter })),
      interventions: MoC.S.interventions.slice(),
      decisions: (MoC.S.decisionLog || []).map(item => ({ tick: item.tick, quarter: item.quarter, id: item.id, text: item.text })),
      cascades: Object.fromEntries(Object.entries(MoC.S.cascades || {}).map(([id, state]) => [id, state.stage || 0])),
      externalSchedule: MoC.environment.schedule,
      scheduleId: MoC.environment.scheduleId,
      previousAttempt: prior ? {
        endingTick: prior.tick,
        endReason: prior.politicalReason,
        modelVersion: prior.modelVersion,
        careAtCurrentTick: priorAtTick,
        sameTickComparable: !!priorAtTick,
        playerMinusPrevious: priorAtTick ? {
          systemDeaths: difference(care.systemDeaths, priorAtTick.systemDeaths),
          treatments: difference(care.treatments, priorAtTick.treatments),
          waiting: difference(care.waiting, priorAtTick.waiting),
          meanWait: difference(care.meanWait, priorAtTick.meanWait),
        } : null,
      } : null,
    };
  });
  if (pageErrors.length) throw new Error(`${strategy.id}/${scenario}/${seed}: ${pageErrors.join('; ')}`);
  if (!result.endReason) throw new Error(`${strategy.id}/${scenario}/${seed}: no ending at tick ${result.endingTick}`);
  return { ...result, trace };
}

async function runReference(browser, base, scenario, seed, networkGuard) {
  const context = await setupContext(browser, base, networkGuard);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`${base}/minister.html#scn=${scenario}&seed=${seed}&baseline=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    const horizonTicks = scenarioDefinitions[scenario].horizonQuarters * 52;
    await page.waitForFunction(target => MoC?.IS_BASELINE && modelTick === target && MoC.paused,
      horizonTicks, { timeout: 180000, polling: 50 });
    const reference = await page.evaluate(() => ({
      modelVersion: MoC.MODEL_VERSION,
      referenceProtocol: MoC.REFERENCE_PROTOCOL,
      seed: MoC.seed,
      scenario: MoC.S.scenario,
      horizonTicks: MoC.TOTAL_QUARTERS * MoC.QUARTER_TICKS,
      endingTick: modelTick,
      care: MoC.care.snapshot(),
      snapshots: MoC.runSnapshots,
      scheduleId: MoC.environment.scheduleId,
      externalSchedule: MoC.environment.schedule,
    }));
    if (pageErrors.length) throw new Error(`no-action reference/${scenario}/${seed}: ${pageErrors.join('; ')}`);
    if (reference.endingTick !== reference.horizonTicks)
      throw new Error(`no-action reference/${scenario}/${seed}: stopped at ${reference.endingTick}/${reference.horizonTicks}`);
    return reference;
  } finally {
    await context.close();
  }
}

function careComparison(player, reference) {
  const snapshot = reference.snapshots[String(player.endingTick)];
  if (!snapshot || snapshot.tick !== player.endingTick) return { comparable: false, reason: 'No reference snapshot at the player ending tick.' };
  const fields = ['systemDeaths', 'deathsWaiting', 'treatments', 'waiting', 'meanWait', 'budget', 'admin'];
  return {
    comparable: true,
    endingTick: player.endingTick,
    rule: 'player minus no-action reference at the same model tick; positive means the player value is higher',
    noActionReference: snapshot,
    playerMinusReference: Object.fromEntries(fields.map(key => [
      key,
      Number.isFinite(player.care[key]) && Number.isFinite(snapshot[key]) ? player.care[key] - snapshot[key] : null,
    ])),
  };
}

async function runBalancedPair(browser, base, scenario, seed, networkGuard, repeatBalanced) {
  const context = await setupContext(browser, base, networkGuard);
  try {
    const page = await context.newPage();
    const first = await runPlayer(page, base, scenario, seed, { id: 'balanced', ...strategyDefinitions.balanced });
    const runs = [{ policy: 'balanced', repeatOf: null, ...first }];
    if (repeatBalanced) {
      await page.locator('#moc-again').click();
      await page.waitForFunction(() => MoC?.record?.ready && MoC.MODEL_VERSION, null, { timeout: 30000 });
      await page.evaluate(() => MoC.record.ready);
      const repeat = await runPlayer(page, base, scenario, seed,
        { id: 'balanced', ...strategyDefinitions.balanced }, true);
      runs.push({ policy: 'balanced-repeat', repeatOf: 'balanced', ...repeat });
    }
    return runs;
  } finally {
    await context.close();
  }
}

async function runPolicy(browser, base, scenario, seed, policy, networkGuard) {
  const context = await setupContext(browser, base, networkGuard);
  try {
    const page = await context.newPage();
    const result = await runPlayer(page, base, scenario, seed, { id: policy, ...strategyDefinitions[policy] });
    return { policy, repeatOf: null, ...result };
  } finally {
    await context.close();
  }
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
      if (index + 1 === items.length || (index + 1) % 2 === 0)
        console.error(`Completed ${index + 1}/${items.length} scenario-seed groups`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

function gitValue(command) {
  try { return execFileSync('git', command, { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function writeOutput(file, output) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, output, 'utf8');
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/benchmark_minister_strategies.cjs [--seeds 2468,1357,7777] [--scenarios cabinetcrisis,campaign] [--policies balanced,technology-first,capacity-first,structural,adversarial] [--concurrency 3] [--output path] [--no-repeat-balanced]');
    return;
  }
  const server = staticServer();
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const networkGuard = { blockedWrites: [], blockedExternalReads: 0 };
  const pageSha256 = createHash('sha256').update(readFileSync(ministerPath)).digest('hex');
  try {
    const groups = options.scenarios.flatMap(scenario => options.seeds.map(seed => ({ scenario, seed })));
    const results = await mapConcurrent(groups, options.concurrency, async ({ scenario, seed }) => {
      const runs = [];
      if (options.policies.includes('balanced')) {
        runs.push(...await runBalancedPair(browser, base, scenario, seed, networkGuard,
          options.repeatBalanced && options.policies.includes('balanced')));
      }
      for (const policy of options.policies) {
        if (policy === 'balanced') continue;
        runs.push(await runPolicy(browser, base, scenario, seed, policy, networkGuard));
      }
      const reference = await runReference(browser, base, scenario, seed, networkGuard);
      for (const run of runs) run.noActionComparison = careComparison(run, reference);
      return { scenario, seed, runs, noActionReference: {
        ...reference,
        snapshots: Object.fromEntries([...new Set(runs.map(run => run.endingTick))]
          .map(tick => [tick, reference.snapshots[String(tick)] || null])),
        fullHorizonExposureOnly: true,
      } };
    });
    const firstRun = results.flatMap(group => group.runs)[0];
    const document = {
      schemaVersion: 'minister-strategy-validation-v1',
      generatedAt: new Date().toISOString(),
      sourceRevision: gitValue(['rev-parse', 'HEAD']),
      sourceBranch: gitValue(['branch', '--show-current']),
      executable: {
        modelVersion: firstRun?.modelVersion || null,
        referenceProtocol: firstRun?.referenceProtocol || null,
        modelExecutableId: firstRun?.executableIdentity?.modelExecutableId || null,
        replayExecutableId: firstRun?.executableIdentity?.replayExecutableId || null,
        ministerHtmlSha256: pageSha256,
        modelModuleSha256: createHash('sha256').update(readFileSync(join(root, 'minister-model-core.js'))).digest('hex'),
      },
      design: {
        seeds: options.seeds,
        scenarios: options.scenarios.map(id => ({ id, ...scenarioDefinitions[id] })),
        declaredPolicies: Object.fromEntries(options.policies.map(id => [id, strategyDefinitions[id]])),
        repeatedPolicy: options.repeatBalanced && options.policies.includes('balanced') ? 'balanced, using the in-game Try another approach control' : null,
        noActionReference: 'Built-in no-discretionary-action-v1 reference, full declared horizon; player outcomes compare only at matching ending ticks.',
        seedSelectionNote: 'These declared seeds are a bounded reproducibility sample, not a random sample, holdout study, or win-rate estimate.',
      },
      safeguards: {
        localStaticServer: '127.0.0.1 only; GET/HEAD static reads from site/',
        externalReadsStubbed: networkGuard.blockedExternalReads,
        blockedNonGetRequestsBeforeNetwork: networkGuard.blockedWrites.length,
        blockedRequests: networkGuard.blockedWrites,
        productionLeaderboardWrites: 0,
      },
      groups: results,
    };
    const output = `${JSON.stringify(document, null, 2)}\n`;
    if (options.output) {
      writeOutput(options.output, output);
      console.error(`Wrote ${results.reduce((count, group) => count + group.runs.length + 1, 0)} scenario runs to ${options.output}`);
    } else {
      process.stdout.write(output);
    }
  } finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

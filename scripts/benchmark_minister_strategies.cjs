const { createHash } = require('node:crypto');
const { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const { dirname, extname, join, resolve, sep } = require('node:path');
const { chromium } = require('playwright-chromium');

const root = resolve(process.cwd(), 'site');
const ministerPath = join(root, 'minister.html');
const mime = { '.html':'text/html', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.mp3':'audio/mpeg' };
const purchasePolicyDefinitions = {
  balanced: {
    description: 'Mix near-term capacity, workforce, prevention and resilience; rotate across governance tracks.',
    purchases: ['hire', 'mtvp', 'gpfund', 'scribes1', 'changeprog', 'prevention', 'resilience', 'security'],
  },
  'technology-first': {
    description: 'Prioritize digital tools and platform build-out before physical capacity.',
    purchases: ['scribes1', 'platform', 'platformai', 'scribes2', 'a2a', 'twin', 'pilotgrant', 'security', 'resilience'],
  },
  'capacity-first': {
    description: 'Prioritize staffing, GP support and routine treatment capacity.',
    purchases: ['hire', 'gpfund', 'mtvp', 'carersupport', 'prevention', 'resilience'],
  },
  structural: {
    description: 'Prioritize workforce and innovation-governance laws, prevention and resilience.',
    purchases: ['changeprog', 'prevention', 'resilience', 'security', 'gpfund', 'mtvp', 'hire'],
  },
  adversarial: {
    description: 'A deliberately short-term, fragmented digital-investment policy; not a recommended approach.',
    purchases: ['platform', 'platformai', 'pilotgrant', 'a2a', 'twin'],
  },
};
const responsePolicyDefinitions = {
  balanced: { description: 'Trade off trust, care capacity, workload and cost.', heuristic: 'balanced' },
  'trust-first': { description: 'Prefer options that protect citizen, doctor and parliament trust.', heuristic: 'trust' },
  'budget-first': { description: 'Prefer options that retain or add budget.', heuristic: 'budget' },
  'care-first': { description: 'Prefer options that improve care capacity and reduce workload.', heuristic: 'care' },
  adversarial: { description: 'Prefer short-term cash and fragmented or dependent choices.', heuristic: 'adversarial' },
};
const governancePolicyDefinitions = {
  'no-laws': { description: 'Enact no laws.', lawTracks: [] },
  'parliament-first': { description: 'Prioritize Innovation Governance laws that directly support parliament.', lawTracks: ['inno'] },
  'care-bottleneck': { description: 'Prioritize digital-access and workforce laws that target care bottlenecks.', lawTracks: ['dig', 'work'] },
  'resilience-first': { description: 'Prioritize workforce resilience, then governance and digital law tracks.', lawTracks: ['work', 'inno', 'dig'] },
};
const legacyResponseAliases = {
  balanced: 'balanced',
  'technology-first': 'trust-first',
  'capacity-first': 'care-first',
  structural: 'balanced',
  adversarial: 'adversarial',
};
const campaignPromises = [0, 1, 4];
const scenarioDefinitions = {
  cabinetcrisis: { name: 'Cabinet Crisis', horizonQuarters: 8 },
  campaign: { name: 'The Full Term', horizonQuarters: 40 },
};

function parseArgs(argv) {
  const options = {
    seeds: [2468, 1357, 7777],
    scenarios: Object.keys(scenarioDefinitions),
    purchasePolicies: ['balanced', 'capacity-first', 'structural'],
    responsePolicies: ['trust-first', 'budget-first', 'care-first'],
    governancePolicies: Object.keys(governancePolicyDefinitions),
    concurrency: 3,
    output: null,
    repeatBalanced: true,
  };
  let legacyPolicies;
  const selectedAxes = new Set();
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
      if (legacyPolicies) throw new Error('--policies must not be specified more than once');
      legacyPolicies = value.split(',').map(item => item.trim());
      if (!legacyPolicies.length || legacyPolicies.some(item => !purchasePolicyDefinitions[item] || !legacyResponseAliases[item]))
        throw new Error(`--policies must use: ${Object.keys(purchasePolicyDefinitions).join(', ')}`);
    } else if (['purchase-policies', 'response-policies', 'governance-policies'].includes(name)) {
      const axis = name.replace(/-policies$/, '');
      if (selectedAxes.has(axis)) throw new Error(`--${name} must not be specified more than once`);
      selectedAxes.add(axis);
      const selected = value.split(',').map(item => item.trim());
      const definitions = axis === 'purchase' ? purchasePolicyDefinitions
        : axis === 'response' ? responsePolicyDefinitions : governancePolicyDefinitions;
      if (!selected.length || selected.some(item => !definitions[item]))
        throw new Error(`--${name} must use: ${Object.keys(definitions).join(', ')}`);
      options[`${axis}Policies`] = selected;
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
  if (legacyPolicies && selectedAxes.size)
    throw new Error('--policies cannot be combined with independent policy-axis options');
  if (legacyPolicies) {
    options.purchasePolicies = legacyPolicies;
    options.responsePolicies = [...new Set(legacyPolicies.map(item => legacyResponseAliases[item]))];
    options.governancePolicies = ['resilience-first'];
  }
  for (const axis of ['purchase', 'response', 'governance']) {
    const policies = options[`${axis}Policies`];
    if (new Set(policies).size !== policies.length)
      throw new Error(`--${axis}-policies must not contain duplicates`);
  }
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

function signedValues(text, pattern, multiplier = 1) {
  return [...text.matchAll(pattern)].reduce((total, match) => {
    const sign = (match[1] || match[3]) === '-' ? -1 : 1;
    const amount = match[2] || match[4];
    return total + sign * Number(amount.replace(/,/g, '')) * multiplier;
  }, 0);
}

function parseOptionHeuristics(text) {
  const normalized = text.replace(/[−–]/g, '-');
  const value = normalized.toLowerCase();
  return {
    trust: signedValues(normalized, /\b(?:all\s+)?(?:citizens?|doctors?|parliament|trust)(?:\s+trust)?\s*([+-])\s*(\d+(?:\.\d+)?)/gi),
    budget: signedValues(normalized, /([+-])\s*€?\s*(\d[\d,]*(?:\.\d+)?)\s*k\b/gi,
      1000),
    capacity: signedValues(normalized, /(?:capacity|starts\/week)\s*([+-])\s*(\d+(?:\.\d+)?)|([+-])\s*(\d+(?:\.\d+)?)\s*starts?\/week/gi),
    admin: signedValues(normalized, /admin(?:\s+burden)?\s*([+-])\s*(\d+(?:\.\d+)?)/gi),
    sick: signedValues(normalized, /(?:sick(?:\s+leave)?|absence)\s*([+-])\s*(\d+(?:\.\d+)?)/gi),
    fragmentation: signedValues(normalized, /fragmentation\s*([+-])\s*(\d+(?:\.\d+)?)/gi),
    dependence: signedValues(normalized, /dependence\s*([+-])\s*(\d+(?:\.\d+)?)/gi),
    text: value,
  };
}

function responseScore(text, policy) {
  const parsed = parseOptionHeuristics(text);
  const has = (...terms) => terms.some(term => parsed.text.includes(term));
  const heuristic = responsePolicyDefinitions[policy]?.heuristic || policy;
  if (heuristic === 'adversarial') {
    return parsed.budget / 1000 * 8 + parsed.fragmentation * 8 + parsed.dependence * 5 - parsed.trust * 2
      + (has('take the deal', 'let both run', 'fasttrack') ? 12 : 0)
      + (has('no comment', 'skip', 'refuse') ? 3 : 0);
  }
  if (heuristic === 'trust') return parsed.trust * 5 + parsed.budget / 1000 * 0.02;
  if (heuristic === 'budget') return parsed.budget / 1000 + parsed.trust * 0.05;
  if (heuristic === 'care') {
    return parsed.capacity * 20 - parsed.admin * 3 - parsed.sick * 5 + parsed.trust * 0.5
      + (has('workforce', 'staffing', 'locum', 'recruitment', 'health', 'prevention', 'care') ? 8 : 0);
  }
  return parsed.trust * 1.5 + parsed.capacity * 8 - parsed.admin * 2 - parsed.sick * 3
    - parsed.fragmentation * 2 + parsed.budget / 1000 * 0.02
    + (has('health', 'prevention', 'resilience', 'workforce') ? 5 : 0);
}

async function setLedgerSource(page, source) {
  await page.evaluate(value => {
    if (window.__ministerTrustBudgetLedger) window.__ministerTrustBudgetLedger.source = value;
  }, source);
}

async function installTrustBudgetLedger(page) {
  return page.evaluate(() => {
    const state = MoC.S;
    const fields = {
      citizens: 'trustC',
      doctors: 'trustD',
      parliament: 'trustP',
      budget: 'budget',
    };
    const ledger = {
      source: 'simulation',
      baseline: Object.fromEntries(Object.entries(fields).map(([name, key]) => [name, state[key]])),
      entries: [],
    };
    window.__ministerTrustBudgetLedger = ledger;

    for (const [name, key] of Object.entries(fields)) {
      let value = state[key];
      const descriptor = Object.getOwnPropertyDescriptor(state, key);
      if (descriptor && descriptor.configurable === false)
        throw new Error(`Cannot instrument non-configurable Minister state field: ${key}`);
      Object.defineProperty(state, key, {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: next => {
          const before = value;
          value = next;
          if (Number.isFinite(before) && Number.isFinite(next) && before !== next) {
            ledger.entries.push({
              source: ledger.source,
              tick: modelTick,
              metric: name,
              amount: next - before,
              before,
              after: next,
            });
          }
        },
      });
    }

    const originalTick = tick;
    window.tick = function instrumentedTick(...args) {
      const firstEntry = ledger.entries.length;
      const eventCount = state.eventLog?.length || 0;
      const cascadeStages = JSON.stringify(Object.fromEntries(
        Object.entries(state.cascades || {}).map(([id, cascade]) => [id, cascade.stage || 0]),
      ));
      ledger.source = 'simulation';
      try {
        return originalTick.apply(this, args);
      } finally {
        const eventOccurred = (state.eventLog?.length || 0) > eventCount;
        const nextCascadeStages = JSON.stringify(Object.fromEntries(
          Object.entries(state.cascades || {}).map(([id, cascade]) => [id, cascade.stage || 0]),
        ));
        const source = eventOccurred ? 'event' : nextCascadeStages !== cascadeStages ? 'cascade' : 'simulation';
        for (const entry of ledger.entries.slice(firstEntry)) {
          if (entry.source === 'simulation') entry.source = source;
        }
        ledger.source = 'simulation';
      }
    };
    return ledger.baseline;
  });
}

async function chooseResponse(buttons, strategy, stage, trace, page) {
  const count = await buttons.count();
  if (!count) return false;
  const texts = await buttons.allInnerTexts();
  let selected = 0;
  for (let index = 1; index < texts.length; index += 1) {
    if (responseScore(texts[index], strategy) > responseScore(texts[selected], strategy)) selected = index;
  }
  await setLedgerSource(page, stage === 'event decision' ? 'event' : 'response');
  try {
    await buttons.nth(selected).click();
  } finally {
    await setLedgerSource(page, 'simulation');
  }
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

async function chooseLaw(page, governancePolicy, trace) {
  const available = await page.locator('#moc-laws [data-law]').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.law,
    label: node.closest('.moc-item')?.innerText.trim() || node.innerText.trim(),
    disabled: node.disabled,
  })));
  const owned = await page.evaluate(() => Object.keys(MoC.S.laws || {}));
  const unavailable = [];
  for (const track of governancePolicy.lawTracks) {
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
    await setLedgerSource(page, 'law');
    try {
      await page.locator(`#moc-laws [data-law="${candidate.id}"]`).click();
    } finally {
      await setLedgerSource(page, 'simulation');
    }
    trace.lawChoices.push({ tick: await page.evaluate(() => modelTick), track, id: candidate.id, label: candidate.label });
    return;
  }
  for (const item of unavailable) trace.skippedLaws.push({ tick: await page.evaluate(() => modelTick), ...item });
}

async function choosePurchases(page, purchasePolicy, trace) {
  const expansion = page.locator('#moc-shop-more');
  if (await expansion.count()) await expansion.click();
  const quarter = await page.evaluate(() => MoC.S.quarter);
  let bought = 0;
  let previousSkipped = null;
  const deferredSince = new Map(Object.entries(trace.deferredPurchaseQuarters || {})
    .map(([id, firstQuarter]) => [id, Number(firstQuarter)]));
  for (let index = 0; index < purchasePolicy.purchases.length; index += 1) {
    const id = purchasePolicy.purchases[index];
    const retry = deferredSince.has(id);
    if (bought >= 2) {
      trace.skippedPurchases.push({ quarter, id, retry, reason: 'deferred: two-purchase council limit' });
      if (!deferredSince.has(id)) deferredSince.set(id, quarter);
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
      trace.skippedPurchases.push({ quarter, id, retry, reason });
      if (state.owned === 0) {
        if (!deferredSince.has(id)) deferredSince.set(id, quarter);
        previousSkipped = previousSkipped || { id, reason };
      } else {
        deferredSince.delete(id);
      }
      continue;
    }
    const label = state.label;
    await setLedgerSource(page, 'purchase');
    try {
      await page.locator(`#moc-shop [data-buy="${id}"]`).click();
    } finally {
      await setLedgerSource(page, 'simulation');
    }
    trace.purchaseChoices.push({ quarter, id, label });
    if (retry) {
      const deferredAtQuarter = deferredSince.get(id);
      trace.purchaseRetries.push({
        id,
        deferredAtQuarter,
        retriedAtQuarter: quarter,
        quartersDeferred: quarter - deferredAtQuarter,
      });
    }
    deferredSince.delete(id);
    if (previousSkipped) trace.fallbacks.push({ kind: 'purchase', from: previousSkipped.id, to: id, reason: previousSkipped.reason });
    previousSkipped = null;
    bought += 1;
  }
  trace.deferredPurchaseQuarters = Object.fromEntries(deferredSince);
  trace.deferredPurchaseIds = [...deferredSince.keys()];
}

async function advanceCouncil(page, policies, trace) {
  for (let step = 0; step < 8; step += 1) {
    if (await page.evaluate(() => MoC.S.over)) return false;
    if (await page.locator('#moc-laws').count()) {
      await chooseLaw(page, policies.governance, trace);
      const next = page.locator('#moc-wiz-next');
      if (!(await next.count())) return false;
      await next.click();
      continue;
    }
    if (await page.locator('#moc-shop').count()) {
      await choosePurchases(page, policies.purchase, trace);
      const next = page.locator('#moc-wiz-next');
      if (!(await next.count())) return false;
      await next.click();
      return true;
    }
    const choices = page.locator('#moc-council .moc-opt:not(:disabled)');
    if (await choices.count()) await chooseResponse(choices, policies.responseId, 'council decision', trace, page);
    const next = page.locator('#moc-wiz-next');
    if (!(await next.count())) return false;
    await next.click();
  }
  return false;
}

async function runPlayer(page, base, scenario, seed, policies, loaded = false) {
  const { purchase, response, governance } = policies;
  const runId = `${purchase.id}/${response.id}/${governance.id}`;
  const trace = {
    selectedChoices: [],
    lawChoices: [],
    skippedLaws: [],
    purchaseChoices: [],
    skippedPurchases: [],
    purchaseRetries: [],
    deferredPurchaseIds: [],
    deferredPurchaseQuarters: {},
    fallbacks: [],
  };
  const pageErrors = await beginPlayerRun(page, base, scenario, seed, {
    id: response.id,
    ...purchase,
    promises: campaignPromises,
  }, trace, loaded);
  const ledgerBaseline = await installTrustBudgetLedger(page);
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
      await chooseResponse(vote, response.id, 'confidence vote', trace, page);
      continue;
    }
    const flashChoices = page.locator('.moc-flash #moc-fa:not(:disabled),.moc-flash #moc-fb:not(:disabled)');
    if (await flashChoices.count()) {
      await chooseResponse(flashChoices, response.id, 'event decision', trace, page);
      continue;
    }
    const flashContinue = page.locator('#moc-flash-continue');
    if (await flashContinue.count()) { await flashContinue.click(); continue; }
    const bannerReady = page.locator('#moc-council-ready-banner button');
    const fallbackReady = page.locator('#moc-town-council');
    const ready = await bannerReady.count() && await bannerReady.isVisible() ? bannerReady : fallbackReady;
    if (await ready.count() && await ready.isVisible()) {
      await ready.click();
      await advanceCouncil(page, policies, trace);
      continue;
    }
    const state = await page.evaluate(() => ({ tick: modelTick, over: MoC.S.over, paused: MoC.paused, blocked: MoC.isBlocked() }));
    if (state.tick === lastTick) stalled += 1;
    else stalled = 0;
    lastTick = state.tick;
    if (stalled > 3) throw new Error(`${runId}/${scenario}/${seed}: no actionable UI at tick ${state.tick}`);
    await page.evaluate(() => {
      if (!MoC.S.over && !MoC.isBlocked()) MoC.paused = false;
    });
  }
  if (iterations >= 500) throw new Error(`${runId}/${scenario}/${seed}: exceeded the bounded action loop`);
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
    const actualVote = MoC.S.electionSnapshot?.result || null;
    const evaluation = actualVote || window._mocEvaluateElection?.() || null;
    const voteHeld = MoC.S.scenario === 'cabinetcrisis'
      ? care.tick >= horizonTicks
      : !!MoC.S._electionHeld;
    const trustFloor = evaluation?.trustFloor ?? (MoC.S.scenario === 'cabinetcrisis' ? 35 : 45);
    const deathCap = evaluation?.deathCap ?? (MoC.S.scenario === 'cabinetcrisis' ? 5 : 8);
    const cascadeStage = Math.max(0, ...Object.values(MoC.S.cascades || {}).map(item => item.stage || 0));
    const keptPromises = (MoC.S.promises || []).filter(index => promiseList[index]?.check()).length;
    const totalPromises = (MoC.S.promises || []).length;
    const minimumPromises = MoC.S.scenario === 'cabinetcrisis' ? 0 : Math.min(2, totalPromises);
    const ledger = window.__ministerTrustBudgetLedger || { baseline: {}, entries: [] };
    const finalValues = {
      citizens: MoC.S.trustC,
      doctors: MoC.S.trustD,
      parliament: MoC.S.trustP,
      budget: MoC.S.budget,
    };
    const reconciliation = Object.fromEntries(Object.entries(finalValues).map(([metric, finalValue]) => {
      const changes = ledger.entries.filter(entry => entry.metric === metric);
      const amount = changes.reduce((sum, entry) => sum + entry.amount, 0);
      const reconstructed = ledger.baseline[metric] + amount;
      return [metric, {
        initial: ledger.baseline[metric],
        change: amount,
        reconstructed,
        final: finalValue,
        difference: finalValue - reconstructed,
        reconciles: Math.abs(finalValue - reconstructed) < 1e-8,
      }];
    }));
    const finalVoteCriteria = {
      voteHeld,
      evaluatedAtTick: actualVote ? MoC.S.electionSnapshot?.tick ?? care.tick : care.tick,
      evaluation: voteHeld ? 'actual vote' : 'ending-state projection; no final vote was held',
      outcome: MoC.S._cabinetResult || MoC.S._electionResult || null,
      trustFloor,
      deathCap,
      gates: [
        { id: 'citizen-trust', value: MoC.S.trustC, target: trustFloor, operator: '>=', passed: MoC.S.trustC >= trustFloor },
        { id: 'doctor-trust', value: MoC.S.trustD, target: trustFloor, operator: '>=', passed: MoC.S.trustD >= trustFloor },
        { id: 'parliament-support', value: MoC.S.trustP, target: trustFloor, operator: '>=', passed: MoC.S.trustP >= trustFloor },
        { id: 'model-system-deaths', value: evaluation?.sd ?? care.systemDeaths, target: deathCap, operator: '<=', passed: (evaluation?.sd ?? care.systemDeaths) <= deathCap },
        { id: 'stage-3-cascade', value: cascadeStage, target: 3, operator: '<', passed: cascadeStage < 3 },
        { id: 'promises-kept', value: keptPromises, target: minimumPromises, operator: '>=', passed: keptPromises >= minimumPromises },
      ],
      failedGates: (evaluation?.reasons || []).slice(),
    };
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
      finalVoteCriteria,
      gateFailure: finalVoteCriteria.failedGates.length ? finalVoteCriteria.failedGates.join('; ') : null,
      manifesto: (MoC.S.promises || []).map(index => ({
        id: promiseList[index]?.id || null,
        label: promiseList[index]?.text || null,
        metAtEnd: !!promiseList[index]?.check(),
      })),
      care,
      trust: { citizens: MoC.S.trustC, doctors: MoC.S.trustD, parliament: MoC.S.trustP },
      budget: MoC.S.budget,
      trustBudgetLedger: {
        baseline: ledger.baseline,
        entries: ledger.entries,
        reconciliation,
      },
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
  if (pageErrors.length) throw new Error(`${runId}/${scenario}/${seed}: ${pageErrors.join('; ')}`);
  if (!result.endReason) throw new Error(`${runId}/${scenario}/${seed}: no ending at tick ${result.endingTick}`);
  const mismatches = Object.entries(result.trustBudgetLedger.reconciliation)
    .filter(([, check]) => !check.reconciles)
    .map(([metric, check]) => `${metric} mismatch ${check.difference}`);
  if (mismatches.length)
    throw new Error(`${runId}/${scenario}/${seed}: trust/budget ledger failed reconciliation: ${mismatches.join(', ')}`);
  if (!ledgerBaseline || Object.keys(ledgerBaseline).length !== 4)
    throw new Error(`${runId}/${scenario}/${seed}: trust/budget ledger baseline was not captured`);
  return {
    ...result,
    purchasePolicy: purchase.id,
    responsePolicy: response.id,
    governancePolicy: governance.id,
    policyId: runId,
    trace,
  };
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

async function runBalancedPair(browser, base, scenario, seed, policies, networkGuard, repeatBalanced) {
  const context = await setupContext(browser, base, networkGuard);
  try {
    const page = await context.newPage();
    const first = await runPlayer(page, base, scenario, seed, policies);
    const runs = [{ repeatOf: null, ...first }];
    if (repeatBalanced) {
      await page.locator('#moc-again').click();
      await page.waitForFunction(() => MoC?.record?.ready && MoC.MODEL_VERSION, null, { timeout: 30000 });
      await page.evaluate(() => MoC.record.ready);
      const repeat = await runPlayer(page, base, scenario, seed, policies, true);
      runs.push({ repeatOf: first.policyId, ...repeat });
    }
    return runs;
  } finally {
    await context.close();
  }
}

async function runPolicy(browser, base, scenario, seed, policies, networkGuard) {
  const context = await setupContext(browser, base, networkGuard);
  try {
    const page = await context.newPage();
    const result = await runPlayer(page, base, scenario, seed, policies);
    return { repeatOf: null, ...result };
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
    console.log('Usage: node scripts/benchmark_minister_strategies.cjs [--seeds 2468,1357,7777] [--scenarios cabinetcrisis,campaign] [--purchase-policies balanced,capacity-first,structural] [--response-policies trust-first,budget-first,care-first] [--governance-policies no-laws,parliament-first,care-bottleneck,resilience-first] [--concurrency 3] [--output path] [--no-repeat-balanced]');
    return;
  }
  const server = staticServer();
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
  const networkGuard = { blockedWrites: [], blockedExternalReads: 0 };
  const pageSha256 = createHash('sha256').update(readFileSync(ministerPath)).digest('hex');
  try {
    const combinations = options.purchasePolicies.flatMap(purchaseId =>
      options.responsePolicies.flatMap(responseId => options.governancePolicies.map(governanceId => ({
        id: `${purchaseId}/${responseId}/${governanceId}`,
        purchase: { id: purchaseId, ...purchasePolicyDefinitions[purchaseId] },
        response: { id: responseId, ...responsePolicyDefinitions[responseId] },
        governance: { id: governanceId, ...governancePolicyDefinitions[governanceId] },
      }))));
    const groups = options.scenarios.flatMap(scenario => options.seeds.map(seed => ({ scenario, seed })));
    const results = await mapConcurrent(groups, options.concurrency, async ({ scenario, seed }) => {
      const runs = [];
      for (const policies of combinations) {
        const shouldRepeat = options.repeatBalanced && policies.purchase.id === 'balanced'
          && policies.response.id === 'balanced' && policies.governance.id === 'resilience-first';
        if (shouldRepeat)
          runs.push(...await runBalancedPair(browser, base, scenario, seed, policies, networkGuard, true));
        else
          runs.push(await runPolicy(browser, base, scenario, seed, policies, networkGuard));
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
        declaredPolicies: {
          purchase: Object.fromEntries(options.purchasePolicies.map(id => [id, purchasePolicyDefinitions[id]])),
          response: Object.fromEntries(options.responsePolicies.map(id => [id, responsePolicyDefinitions[id]])),
          governance: Object.fromEntries(options.governancePolicies.map(id => [id, governancePolicyDefinitions[id]])),
        },
        matrix: combinations.map(({ id, purchase, response, governance }) => ({
          id,
          purchasePolicy: purchase.id,
          responsePolicy: response.id,
          governancePolicy: governance.id,
        })),
        repeatedPolicy: options.repeatBalanced ? 'balanced/balanced/resilience-first, using the in-game Try another approach control' : null,
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

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  governancePolicyDefinitions,
  parseArgs,
  parseOptionHeuristics,
  purchasePolicyDefinitions,
  responsePolicyDefinitions,
  responseScore,
};

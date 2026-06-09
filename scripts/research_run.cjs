// Headless research runner — extracts real simulation data for blog posts
// Usage: node scripts/research_run.js [IST|SOLL] [cycles]
const fs = require('fs');

const runMode = process.argv[2] || 'IST';
const nCycles = parseInt(process.argv[3] || '1000', 10);

process.stderr.write(`Running ${runMode} mode for ${nCycles} cycles...\n`);

// Read the HTML and extract the main script
const html = fs.readFileSync('site/world.html', 'utf8');
const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let mainJS = '';
for (const block of scriptBlocks) {
  const content = block.replace(/<\/?script[^>]*>/g, '');
  if (content.includes('let cycle=0')) { mainJS = content; break; }
}

if (!mainJS) { console.error('Could not extract simulation JS'); process.exit(1); }

// Stub DOM/Canvas/Audio APIs
const noop = () => {};

function createCanvasStub() {
  const ctx = {
    fillRect: noop, clearRect: noop, strokeRect: noop,
    fillText: noop, strokeText: noop, measureText: () => ({ width: 10 }),
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, stroke: noop, fill: noop, drawImage: noop, clip: noop,
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, transform: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
    setLineDash: noop, getLineDash: () => [],
    putImageData: noop, rect: noop, ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    getImageData: (x,y,w,h) => ({ data: new Uint8ClampedArray((w||1)*(h||1)*4), width: w||1, height: h||1 }),
    createImageData: (w,h) => ({ data: new Uint8ClampedArray((w||1)*(h||1)*4), width: w||1, height: h||1 }),
    isPointInPath: () => false,
  };
  // Use defineProperty for style setters
  ['fillStyle','strokeStyle','font','textAlign','textBaseline','lineWidth','lineCap','lineJoin',
   'globalAlpha','globalCompositeOperation','shadowBlur','shadowColor','shadowOffsetX','shadowOffsetY',
   'imageSmoothingEnabled','lineDashOffset','direction','filter'].forEach(p => {
    let _v = '';
    Object.defineProperty(ctx, p, { get: () => _v, set: (v) => { _v = v; }, enumerable: true });
  });
  ctx.canvas = { width: 1024, height: 768 };
  return {
    width: 1024, height: 768,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,AA==',
    style: {}, dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ top:0, left:0, width:1024, height:768, right:1024, bottom:768 }),
    offsetWidth: 1024, offsetHeight: 768,
    // DOM container methods — many world.html UI helpers (sayA2A, mayorSay, gazette,
    // chatlog appenders) call getElementById(...).appendChild/removeChild. Without these
    // they throw and silently abort the rest of tick() in headless, starving downstream
    // logic (burnout, cascade, social dynamics). Provide safe no-op container API.
    appendChild: noop, removeChild: noop, insertBefore: noop, replaceChild: noop,
    setAttribute: noop, removeAttribute: noop, append: noop, prepend: noop,
    querySelector: () => null, querySelectorAll: () => [],
    children: [], childNodes: [], firstChild: null, lastChild: null,
    innerHTML: '', textContent: '', innerText: '',
    scrollTop: 0, scrollHeight: 0, scrollLeft: 0, scrollWidth: 0,
    insertAdjacentHTML: noop, focus: noop, blur: noop, click: noop,
  };
}

function createElement(tag) {
  if (tag === 'canvas') return createCanvasStub();
  const el = {
    tagName: (tag||'div').toUpperCase(), style: {}, dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    children: [], childNodes: [], innerHTML: '', textContent: '', innerText: '',
    className: '', id: '', src: '', href: '', download: '', type: '',
    appendChild: (c) => { el.children.push(c); return c; },
    removeChild: noop, insertBefore: noop, replaceChild: noop,
    setAttribute: (k,v) => { el[k] = v; }, getAttribute: (k) => el[k] || null,
    removeAttribute: noop,
    addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getElementsByTagName: () => [], getElementsByClassName: () => [],
    closest: () => null, matches: () => false, contains: () => false,
    getBoundingClientRect: () => ({ top:0, left:0, width:300, height:300, right:300, bottom:300 }),
    offsetWidth: 300, offsetHeight: 300, clientWidth: 300, clientHeight: 300,
    scrollWidth: 300, scrollHeight: 300, scrollTop: 0, scrollLeft: 0,
    click: noop, focus: noop, blur: noop, dispatchEvent: noop,
    parentElement: null, parentNode: null, nextSibling: null, previousSibling: null,
    firstChild: null, lastChild: null,
    cloneNode: () => createElement(tag),
    remove: noop, before: noop, after: noop, prepend: noop, append: noop,
    replaceWith: noop, insertAdjacentHTML: noop, insertAdjacentElement: noop,
  };
  Object.defineProperty(el, 'value', { get: () => '', set: noop, enumerable: true });
  Object.defineProperty(el, 'checked', { get: () => false, set: noop, enumerable: true });
  Object.defineProperty(el, 'selectedIndex', { get: () => 0, set: noop, enumerable: true });
  Object.defineProperty(el, 'options', { get: () => [], enumerable: true });
  return el;
}

// Global stubs
global.document = {
  createElement, createElementNS: (_,tag) => createElement(tag),
  createTextNode: (t) => ({ textContent: t, nodeType: 3 }),
  createDocumentFragment: () => ({ appendChild: noop, children: [], querySelectorAll: () => [] }),
  getElementById: (id) => {
    return createCanvasStub(); // canvas stub has all div props + getContext
  },
  querySelector: (sel) => {
    return createCanvasStub();
  },
  querySelectorAll: () => {
    return [];
  },
  getElementsByTagName: () => [],
  getElementsByClassName: () => [],
  body: createElement('body'),
  head: createElement('head'),
  documentElement: createElement('html'),
  addEventListener: noop, removeEventListener: noop,
  title: 'Cammelot', cookie: '',
  activeElement: null,
  createEvent: () => ({ initEvent: noop }),
  execCommand: noop,
};
global.window = global;
global.self = global;
global.addEventListener = noop;
global.removeEventListener = noop;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = noop;
global.innerWidth = 1920;
global.innerHeight = 1080;
global.devicePixelRatio = 1;
global.location = { search: '', href: 'http://localhost:3014', hostname: 'localhost', pathname: '/', hash: '', origin: 'http://localhost:3014', protocol: 'http:' };
global.navigator = { userAgent: 'Node.js', platform: 'Win32', language: 'en', clipboard: { writeText: () => Promise.resolve() } };
global.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
global.getComputedStyle = () => new Proxy({}, { get: (_, p) => p === 'getPropertyValue' ? () => '' : '' });
global.performance = { now: () => Date.now(), mark: noop, measure: noop };
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop };
global.sessionStorage = global.localStorage;
global.URL = { createObjectURL: () => 'blob:null', revokeObjectURL: noop };
global.Blob = class { constructor() {} };
global.File = class extends global.Blob { constructor() { super(); } };
global.FileReader = class { readAsText() {} readAsDataURL() {} set onload(v) {} set onerror(v) {} };
global.XMLHttpRequest = class { open() {} send() {} setRequestHeader() {} set onload(v) {} set onerror(v) {} };
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
global.Audio = class { play() { return Promise.resolve(); } pause() {} load() {} set volume(v) {} set currentTime(v) {} set loop(v) {} set src(v) {} addEventListener() {} removeEventListener() {} };
global.AudioContext = class { createOscillator() { return { connect: noop, start: noop, stop: noop, frequency: { setValueAtTime: noop, linearRampToValueAtTime: noop } }; } createGain() { return { connect: noop, gain: { value: 1, setValueAtTime: noop, exponentialRampToValueAtTime: noop, linearRampToValueAtTime: noop } }; } get destination() { return {}; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } get currentTime() { return 0; } };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { if (this.onload) setTimeout(() => this.onload(), 0); } set onload(v) { this._onload = v; } get onload() { return this._onload; } get width() { return 16; } get height() { return 16; } };
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
global.MutationObserver = class { observe() {} disconnect() {} };
global.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
global.Event = class { constructor(type) { this.type = type; } preventDefault() {} stopPropagation() {} };
global.KeyboardEvent = class extends global.Event { constructor(type, opts) { super(type); Object.assign(this, opts); } };
global.MouseEvent = class extends global.Event { constructor(type, opts) { super(type); Object.assign(this, opts); } };
global.TouchEvent = class extends global.Event { constructor(type, opts) { super(type); } };
global.DOMParser = class { parseFromString() { return { querySelector: () => null, querySelectorAll: () => [] }; } };
global.indexedDB = null; // disable IndexedDB to skip saveGame
global.open = noop;
global.close = noop;
global.scrollTo = noop;
global.scroll = noop;
global.alert = noop;
global.confirm = () => true;
global.prompt = () => '';
global.print = noop;
global.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080 };
global.visualViewport = { width: 1920, height: 1080, addEventListener: noop };
global.CSS = { supports: () => false };
global.Map = Map;
global.Set = Set;
global.WeakMap = WeakMap;
global.WeakSet = WeakSet;
global.Symbol = Symbol;
global.Promise = Promise;
global.Proxy = Proxy;
global.Reflect = Reflect;

// Execute the simulation code
// Strategy: Set _headlessMode flag, then patch startNewGame and loop to skip DOM
let patchedJS = mainJS;

// Persona A/B toggle: PERSONA=off prepends `var PERSONA_ENABLED=false;` so all
// numeric persona behavior effects in world.html are gated off (assignment/thoughts stay).
const PERSONA_OFF = String(process.env.PERSONA || '').toLowerCase() === 'off';
if (PERSONA_OFF) {
  patchedJS = 'var PERSONA_ENABLED=false;\n' + patchedJS;
  process.stderr.write('PERSONA=off — persona numeric effects DISABLED\n');
} else {
  process.stderr.write('PERSONA=on — persona numeric effects ENABLED\n');
}

// Patch startNewGame to skip DOM-dependent calls in headless mode
patchedJS = patchedJS.replace(
  'function startNewGame(){',
  'function startNewGame(){if(typeof _headlessMode!=="undefined"&&_headlessMode){try{buildWaypointGraph();}catch(e){}try{initAgentBehaviors();}catch(e){}try{seedInitialCrisis(agents);}catch(e){}return;}'
);

// Patch loop to be noop in headless
patchedJS = patchedJS.replace(
  'function loop(){',
  'function loop(){if(typeof _headlessMode!=="undefined"&&_headlessMode)return;'
);

// Access eval'd globals — const/let in eval create local scope, need global assignment
// Patch: expose key variables to global scope
patchedJS += '\nglobal._agents = agents;\nglobal._EVENT_LOG = EVENT_LOG;\nglobal._BIAS_DATA = BIAS_DATA;\nglobal._M = M;\nglobal._WEEKLY_REPORTS = WEEKLY_REPORTS;\nglobal._S = S;\n';
patchedJS += 'global._tick = function() { tick(); global._erAdmissionCount = erAdmissionCount; global._proactiveAlertCount = proactiveAlertCount; global._ketenzorgInterventions = ketenzorgInterventions; global._ketenzorgCostEur = ketenzorgCostEur; global._fairnessGuardrailActive = fairnessGuardrailActive; global._researchQueriesCompleted = researchQueriesCompleted; global._researchOptOutRefusals = researchOptOutRefusals; global._researchCohortTooSmall = researchCohortTooSmall; global._benchmarkReportsGenerated = benchmarkReportsGenerated; global._cycle = cycle; global._BIAS_DATA = BIAS_DATA; global._WEEKLY_REPORTS = WEEKLY_REPORTS; };\n';
patchedJS += 'global._setMode = function(m) { mode = m; };\n';
patchedJS += 'global._erAdmissionCount = 0; global._proactiveAlertCount = 0; global._ketenzorgInterventions = 0; global._ketenzorgCostEur = 0; global._fairnessGuardrailActive = false; global._researchQueriesCompleted = 0; global._researchOptOutRefusals = 0; global._researchCohortTooSmall = 0; global._benchmarkReportsGenerated = 0; global._cycle = 0;\n';

// Keep stdout clean: the engine is chatty during eval/ticks, but research_run stdout must be JSON-only.
const realConsoleLog = console.log;
const realConsoleInfo = console.info;
const realConsoleWarn = console.warn;
console.log = noop;
console.info = noop;
console.warn = noop;

// Set headless flag before eval
global._headlessMode = true;

try {
  eval(patchedJS);
} catch(e) {
  process.stderr.write('Init error: ' + e.message + '\n');
  process.stderr.write(e.stack?.split('\n').slice(0, 3).join('\n') + '\n');
  process.exit(1);
}

// Override noisy functions
try { showToast = noop; } catch(e) {}
try { updateUI = noop; } catch(e) {}
try { updateTicker = noop; } catch(e) {}
try { drawTimeline = noop; } catch(e) {}
try { selectAgent = noop; } catch(e) {}
try { saveGame = noop; } catch(e) {}
try { setPanelContent = noop; } catch(e) {}
try { say = noop; } catch(e) {}
try { sayA2A = noop; } catch(e) {}
try { playAdmitSound = noop; } catch(e) {}
try { playDeathBell = noop; } catch(e) {}
try { playGhostSound = noop; } catch(e) {}

// Set mode
try { eval('mode = "' + runMode + '"'); } catch(e) {}

process.stderr.write(`Sim initialized. Population: ${(global._agents||[]).length} agents\n`);
process.stderr.write(`Running ${nCycles} cycles in ${runMode} mode...\n`);
const startTime = Date.now();

// Set mode
global._setMode(runMode);

// Tracking: individual agent timelines + death log + Gini rolling avg
const agentTimelines = {}; // id → [{cycle, hp, state, waitWeeks}]
const deathLog = []; // [{name, age, cycle, cause, conditions, waitWeeks, hp_history}]
const giniRolling = []; // smoothed Gini values (50-cycle rolling avg)
const giniRaw = [];

// Identify interesting agents to track: elderly, multi-morbid, or with lethal conditions
const LETHAL_CODES = ['I25','I50','C34','J44','F03'];
const trackAgents = (global._agents || []).filter(a => {
  if (a.type !== 'patient' && a.type !== 'citizen') return false;
  if (a.age >= 65) return true;
  if (a.conditions && a.conditions.length >= 2) return true;
  if (a.conditions && a.conditions.some(c => LETHAL_CODES.includes(c.code))) return true;
  return false;
});
for (const a of trackAgents) {
  agentTimelines[a.id] = [];
}

for (let i = 0; i < nCycles; i++) {
  try { global._tick(); } catch(e) {
    if (process.env.DEBUG && !global.__firstErr) {
      global.__firstErr = true;
      process.stderr.write('TICK ERROR at cycle ' + i + ': ' + e.message + '\n' + (e.stack||'').split('\n').slice(0,4).join('\n') + '\n');
    }
    if (i === 0) {
      process.stderr.write('Tick error at cycle ' + i + ': ' + e.message + '\n');
      process.stderr.write(e.stack?.split('\n').slice(0,3).join('\n') + '\n');
      process.exit(1);
    }
  }

  // Headless movement driver: agent locomotion lives in render() (never runs headless),
  // so in-transit patients would never reach GP/hospital queues — starving the clinical
  // pipeline (burnout, referrals, ER, treeknorm). Complete pending paths so tick()'s
  // arrival logic fires. Only transit states are advanced; queue/clinical timing is
  // unaffected (waitWeeks accrues in queue/hospital states, not travel).
  const _agentsLive = global._agents || [];
  for (let k = 0; k < _agentsLive.length; k++) {
    const a = _agentsLive[k];
    if (a && a.pathComplete === false &&
        (a.behaviorState === 'going_to_gp' || a.behaviorState === 'going_to_hospital' ||
         a.behaviorState === 'queuing' || a.behaviorState === 'protesting')) {
      a.pathComplete = true;
    }
  }

  // Sample agent HP every 10 cycles
  if (i % 10 === 0) {
    for (const a of trackAgents) {
      if (agentTimelines[a.id]) {
        agentTimelines[a.id].push({
          cycle: i,
          hp: Math.round(a.hp),
          state: a.behaviorState,
          waitWeeks: Math.round((a.waitWeeks || 0) * 10) / 10,
        });
      }
    }
  }

  // Capture deaths as they happen
  for (const a of trackAgents) {
    if (a.hp <= 0 && agentTimelines[a.id] && !agentTimelines[a.id]._dead) {
      agentTimelines[a.id]._dead = true;
      deathLog.push({
        name: a.name,
        age: a.age,
        cycle: i,
        cause: a.causeOfDeath || 'unknown',
        conditions: (a.conditions || []).map(c => c.code + '/' + c.severity),
        waitWeeks: Math.round((a.waitWeeks || 0) * 10) / 10,
        hp_at_death: 0,
      });
    }
  }

  // Gini tracking (every 10 cycles)
  if (i % 10 === 0) {
    const g = (global._BIAS_DATA || {}).currentGini || 0;
    giniRaw.push(g);
    // 50-sample rolling average
    const window = giniRaw.slice(-5);
    const avg = window.reduce((s,v) => s+v, 0) / window.length;
    giniRolling.push(Math.round(avg * 1000) / 1000);
  }
}

// Run a few extra ticks to flush pending death processing
for (let i = 0; i < 5; i++) { try { global._tick(); } catch(e) {} }

const elapsed = Date.now() - startTime;
process.stderr.write(`Done in ${elapsed}ms (${Math.round(nCycles/elapsed*1000)} cycles/sec)\n`);

// Extract metrics from global scope (populated by _tick wrapper)
const agents = global._agents || [];
const EVENT_LOG = global._EVENT_LOG || [];
const BIAS_DATA = global._BIAS_DATA || {};
const M = global._M || {};
const WEEKLY_REPORTS = global._WEEKLY_REPORTS || [];
const erAdmissionCount = global._erAdmissionCount || 0;
const proactiveAlertCount = global._proactiveAlertCount || 0;
const ketenzorgInterventions = global._ketenzorgInterventions || 0;
const ketenzorgCostEur = global._ketenzorgCostEur || 0;
const fairnessGuardrailActive = global._fairnessGuardrailActive || false;
const researchQueriesCompleted = global._researchQueriesCompleted || 0;
const researchOptOutRefusals = global._researchOptOutRefusals || 0;
const researchCohortTooSmall = global._researchCohortTooSmall || 0;
const benchmarkReportsGenerated = global._benchmarkReportsGenerated || 0;
const S = global._S || {};

const pop = agents.filter(a => a.type === 'patient' || a.type === 'citizen');
// Count deaths from actual agent state (more reliable than EVENT_LOG timing)
const allDead = pop.filter(a => a.hp <= 0);
const systemDead = allDead.filter(a => a.causeOfDeath === 'system_failure');
const naturalDead = allDead.filter(a => a.causeOfDeath === 'natural');
const withConditions = pop.filter(a => a.conditions && a.conditions.length > 0);
const lowHP = pop.filter(a => a.hp > 0 && a.hp < 50);
const treeknormViolations = EVENT_LOG.filter(e => e.type === 'treeknorm_violation');
const worsened = EVENT_LOG.filter(e => e.type === 'worsened');

const ageBins = { '0-44': { pop: 0, dead: 0, waits: [], hps: [] }, '45-64': { pop: 0, dead: 0, waits: [], hps: [] }, '65-79': { pop: 0, dead: 0, waits: [], hps: [] }, '80+': { pop: 0, dead: 0, waits: [], hps: [] } };
pop.forEach(a => {
  const bin = a.age >= 80 ? '80+' : a.age >= 65 ? '65-79' : a.age >= 45 ? '45-64' : '0-44';
  ageBins[bin].pop++;
  if (a.hp <= 0) ageBins[bin].dead++;
  if (a.waitWeeks > 0 && a.hp > 0) { ageBins[bin].waits.push(a.waitWeeks); ageBins[bin].hps.push(a.hp); }
});

const results = {
  mode: runMode,
  cycles: nCycles,
  elapsed_ms: elapsed,
  population: pop.length,
  system_deaths: systemDead.length,
  natural_deaths: naturalDead.length,
  total_deaths: allDead.length,
  er_admissions: erAdmissionCount,
  proactive_alerts: proactiveAlertCount,
  ketenzorg_interventions: ketenzorgInterventions,
  ketenzorg_cost_eur: Math.round(ketenzorgCostEur),
  admin_waste_eur: Math.round(nCycles * 12.43 * ((M[runMode] || {}).admin || 0.3) * 3),
  gini: Math.round((BIAS_DATA.currentGini||0) * 1000)/1000,
  bias_score: Math.round((BIAS_DATA.currentBiasScore||0)*1000)/1000,
  fairness_guardrail: fairnessGuardrailActive,
  research_queries_completed: researchQueriesCompleted,
  research_opt_out_refusals: researchOptOutRefusals,
  research_cohort_too_small: researchCohortTooSmall,
  benchmark_reports_generated: benchmarkReportsGenerated,
  gini_history_samples: (BIAS_DATA.giniHistory||[]).filter((_,i) => i % 10 === 0).map(v => Math.round(v*1000)/1000),
  age_analysis: {},
  gp_burnout: agents.filter(a => a.type === 'gp').map(gp => ({ name: gp.name, burnout: Math.round(gp.burnoutLevel || 0) })),
  persona_enabled: !PERSONA_OFF,
  gp_peak_burnout: agents.filter(a => a.type === 'gp').map(gp => ({ name: gp.name, peak: Math.round(gp.peakBurnout || 0) })),
  gp_avg_burnout: agents.filter(a => a.type === 'gp').map(gp => ({ name: gp.name, avg: gp.burnoutSamples ? Math.round((gp.burnoutSum / gp.burnoutSamples) * 10) / 10 : 0 })),
  gp_sick_leave: agents.filter(a => a.type === 'gp').map(gp => ({ name: gp.name, count: gp.sickLeaveCount || 0 })),
  sick_leave_events: EVENT_LOG.filter(e => e.type === 'sick_leave').length,
  weekly_reports_count: WEEKLY_REPORTS.length,
  preventable_death_cost_eur: systemDead.length * 5845,
  total_admin_waste_annual_per_gp: Math.round(365 * 12.43 * ((M[runMode]||{}).admin||0.3) * 30 / nCycles * nCycles / 3),

  // Named death reports
  death_reports: [
    ...deathLog,
    // Also capture deaths from non-tracked agents
    ...allDead.filter(a => !deathLog.find(d => d.name === a.name)).map(a => ({
      name: a.name, age: a.age, cycle: '?',
      cause: a.causeOfDeath || 'unknown',
      conditions: (a.conditions||[]).map(c => c.code+'/'+c.severity),
      waitWeeks: Math.round((a.waitWeeks||0)*10)/10,
    }))
  ].sort((a,b) => (a.cycle === '?' ? 9999 : a.cycle) - (b.cycle === '?' ? 9999 : b.cycle)),

  // Individual agent journeys (most interesting agents)
  agent_stories: Object.entries(agentTimelines)
    .filter(([id, timeline]) => timeline.length > 0)
    .map(([id, timeline]) => {
      const a = (global._agents||[]).find(ag => ag.id === id);
      if (!a) return null;
      return {
        name: a.name, age: a.age, 
        persona_label: (a.persona && a.persona.label) || null,
        archetype: (a.persona && a.persona.archetypeId) || null,
        bigFive: (a.persona && a.persona.bigFive) || null,
        conditions: (a.conditions||[]).map(c => c.name + ' (' + c.code + '/' + c.severity + ')'),
        outcome: a.hp <= 0 ? (a.causeOfDeath === 'natural' ? 'died_natural' : 'died_system') : 'survived',
        final_hp: Math.round(a.hp),
        max_wait_weeks: Math.round(Math.max(...timeline.map(t => t.waitWeeks)) * 10) / 10,
        hp_timeline: timeline.filter((_,i) => i % 3 === 0).map(t => t.hp), // every 30 cycles
        key_moments: timeline.filter(t => 
          t.hp < 50 || t.waitWeeks > 4 || t.state === 'dead' || t.state === 'emergency'
        ).slice(0, 10),
      };
    }).filter(Boolean)
    .sort((a,b) => a.final_hp - b.final_hp), // most dramatic first

  // Smoothed Gini timeline
  gini_rolling_avg: giniRolling,
  diagnostics: {
    agents_with_conditions: withConditions.length,
    agents_low_hp: lowHP.length,
    treeknorm_violations: treeknormViolations.length,
    disease_progressions: worsened.length,
    hp_distribution: pop.filter(a => a.hp > 0).map(a => Math.round(a.hp)).sort((a,b) => a-b),
    condition_summary: withConditions.map(a => ({ name: a.name, age: a.age, hp: Math.round(a.hp), conditions: a.conditions.map(c => c.code + '/' + c.severity), waitWeeks: Math.round(a.waitWeeks||0), state: a.behaviorState })),
  },
};

for (const [bin, data] of Object.entries(ageBins)) {
  const avgWait = data.waits.length > 0 ? data.waits.reduce((s,v) => s+v, 0) / data.waits.length : 0;
  const avgHp = data.hps.length > 0 ? data.hps.reduce((s,v) => s+v, 0) / data.hps.length : 0;
  results.age_analysis[bin] = {
    population: data.pop,
    deaths: data.dead,
    mortality_pct: data.pop > 0 ? Math.round(data.dead / data.pop * 1000) / 10 : 0,
    avg_wait_weeks: Math.round(avgWait * 10) / 10,
    avg_hp_in_queue: Math.round(avgHp),
    waiting_count: data.waits.length,
  };
}

// Output results
console.log = realConsoleLog;
console.info = realConsoleInfo;
console.warn = realConsoleWarn;
if (process.env.DEBUG) {
  const evHist = {};
  for (const e of EVENT_LOG) { evHist[e.type] = (evHist[e.type]||0)+1; }
  const bsHist = {};
  for (const a of pop) { bsHist[a.behaviorState] = (bsHist[a.behaviorState]||0)+1; }
  process.stderr.write('EVENT_LOG hist: ' + JSON.stringify(evHist) + '\n');
  process.stderr.write('behaviorState hist: ' + JSON.stringify(bsHist) + '\n');
  process.stderr.write('GP burnout: ' + JSON.stringify(agents.filter(a=>a.type==='gp').map(g=>({id:g.id,peak:Math.round(g.peakBurnout||0),avg:g.burnoutSamples?Math.round(g.burnoutSum/g.burnoutSamples*10)/10:0,sick:g.sickLeaveCount||0}))) + '\n');
}
console.log(JSON.stringify(results, null, 2));
process.exit(0);

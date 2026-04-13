// Headless replay recorder — captures simulation snapshots for playback
// Usage: node scripts/replay_recorder.cjs [IST|SOLL] [cycles] > output.json
// All status output goes to stderr, JSON to stdout
const fs = require('fs');

const runMode = process.argv[2] || 'IST';
const nCycles = parseInt(process.argv[3] || '1000', 10);
const SNAPSHOT_INTERVAL = 4; // every 4 ticks

process.stderr.write(`Recording ${runMode} mode for ${nCycles} cycles...\n`);

// Read the HTML and extract the main script
const html = fs.readFileSync('src/frontend/v4.html', 'utf8');
const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let mainJS = '';
for (const block of scriptBlocks) {
  const content = block.replace(/<\/?script[^>]*>/g, '');
  if (content.includes('let cycle=0')) { mainJS = content; break; }
}

if (!mainJS) { process.stderr.write('Could not extract simulation JS\n'); process.exit(1); }

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
    return createCanvasStub();
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
global.indexedDB = null;
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

// Speech capture storage
global._lastSpeech = {};

// Execute the simulation code
let patchedJS = mainJS;

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

// Expose key variables to global scope (including QUEUES and BUILDINGS)
patchedJS += '\nglobal._agents = agents;\nglobal._EVENT_LOG = EVENT_LOG;\nglobal._M = M;\n';
patchedJS += '\nglobal._QUEUES = QUEUES;\nglobal._BUILDINGS = BUILDINGS;\n';
patchedJS += 'global._tick = function() { tick(); global._cycle = cycle; };\n';
patchedJS += 'global._setMode = function(m) { mode = m; };\n';
patchedJS += 'global._cycle = 0;\n';

// Set headless flag before eval
global._headlessMode = true;

try {
  eval(patchedJS);
} catch(e) {
  process.stderr.write('Init error: ' + e.message + '\n');
  process.stderr.write(e.stack?.split('\n').slice(0, 3).join('\n') + '\n');
  process.exit(1);
}

// Override noisy functions — say() gets speech capture version
try { showToast = noop; } catch(e) {}
try { updateUI = noop; } catch(e) {}
try { updateTicker = noop; } catch(e) {}
try { drawTimeline = noop; } catch(e) {}
try { selectAgent = noop; } catch(e) {}
try { saveGame = noop; } catch(e) {}
try { setPanelContent = noop; } catch(e) {}
try { eval('say = function(w, t, c) { global._lastSpeech[w] = { text: t, cycle: global._cycle || 0 }; };'); } catch(e) {}
try { playAdmitSound = noop; } catch(e) {}
try { playDeathBell = noop; } catch(e) {}
try { playGhostSound = noop; } catch(e) {}

// Set mode
try { eval('mode = "' + runMode + '"'); } catch(e) {}
global._setMode(runMode);

process.stderr.write(`Sim initialized. Population: ${(global._agents||[]).length} agents\n`);
process.stderr.write(`Recording ${nCycles} cycles in ${runMode} mode (snapshot every ${SNAPSHOT_INTERVAL} ticks)...\n`);
const startTime = Date.now();

// --- Snapshot / delta-encoding state ---
let prevAgentState = {}; // id -> {x, y, hp, bs, ww, ib, cod, speech}

function isDifferent(prev, curr) {
  if (!prev) return true;
  if (prev.x !== curr.x || prev.y !== curr.y) return true;
  if (prev.hp !== curr.hp) return true;
  if (prev.bs !== curr.bs) return true;
  if ((prev.ww || 0) !== (curr.ww || 0)) return true;
  if ((prev.ib || null) !== (curr.ib || null)) return true;
  if ((prev.cod || null) !== (curr.cod || null)) return true;
  if (prev.speech !== curr.speech) return true;
  return false;
}

function captureReplaySnapshot(cycleNum) {
  const agents = global._agents || [];
  const snapshot = {
    cycle: cycleNum,
    agents: agents.map(a => {
      const entry = {
        id: a.id,
        x: Math.round(a.x * 1000) / 1000,
        y: Math.round(a.y * 1000) / 1000,
        hp: Math.round(a.hp),
        bs: a.behaviorState || a.state || 'idle',
      };
      if (a.waitWeeks > 0) entry.ww = Math.round(a.waitWeeks * 10) / 10;
      if (a.insideBuilding) entry.ib = a.insideBuilding;
      if (a.hp <= 0 && a.causeOfDeath) entry.cod = a.causeOfDeath;
      // Speech bubble from captured say() calls
      const speech = global._lastSpeech[a.name];
      if (speech && speech.cycle >= cycleNum - SNAPSHOT_INTERVAL) {
        entry.speech = speech.text;
      }
      return entry;
    }),
    queues: {}
  };

  // Queue sizes
  const QUEUES = global._QUEUES || {};
  for (const [k, q] of Object.entries(QUEUES)) {
    if (q.agents && q.agents.length > 0) {
      snapshot.queues[k] = q.agents.length;
    }
  }

  return snapshot;
}

// --- Event capture ---
let lastEventIdx = 0;

function captureEvents() {
  const log = global._EVENT_LOG || [];
  const newEvents = [];
  for (let i = lastEventIdx; i < log.length; i++) {
    const e = log[i];
    newEvents.push({
      c: e.cycle,
      t: e.type,
      id: e.agentId,
      n: e.agentName,
      d: e.detail || undefined,
      hp: e.hp
    });
  }
  lastEventIdx = log.length;
  return newEvents;
}

// --- Main recording loop ---
const snapshots = [];
const allEvents = [];

for (let i = 0; i < nCycles; i++) {
  try { global._tick(); } catch(e) {
    if (i === 0) { process.stderr.write('Tick error: ' + e.message + '\n'); process.exit(1); }
  }

  // Capture events every tick
  const newEvents = captureEvents();
  if (newEvents.length > 0) allEvents.push(...newEvents);

  // Capture snapshot every SNAPSHOT_INTERVAL ticks
  if (i % SNAPSHOT_INTERVAL === 0) {
    const isKeyframe = (i % 100 === 0);
    let snap;
    try {
      snap = captureReplaySnapshot(i);
    } catch(e) {
      process.stderr.write(`Snapshot error at cycle ${i}: ${e.message}\n`);
      continue;
    }

    const fullAgents = snap ? snap.agents : [];
    if (!snap) continue;

    if (!isKeyframe && i > 0) {
      // Delta encode: only keep changed agents
      snap.agents = fullAgents.filter(a => isDifferent(prevAgentState[a.id], a));
      snap.delta = true;
    }

    // Update prev state from full snapshot
    for (const a of fullAgents) {
      prevAgentState[a.id] = { x: a.x, y: a.y, hp: a.hp, bs: a.bs, ww: a.ww, ib: a.ib, cod: a.cod, speech: a.speech };
    }

    snapshots.push(snap);
  }

  if (i > 0 && i % 500 === 0) {
    process.stderr.write(`  Cycle ${i}/${nCycles}...\n`);
  }
}

const elapsed = Date.now() - startTime;
process.stderr.write(`Done in ${elapsed}ms (${Math.round(nCycles/elapsed*1000)} cycles/sec)\n`);

// --- Build output ---
const agents = global._agents || [];
const BUILDINGS = global._BUILDINGS || [];

const output = {
  metadata: {
    mode: runMode,
    cycles: nCycles,
    population: agents.length,
    date: new Date().toISOString(),
    snapshotInterval: SNAPSHOT_INTERVAL,
    keyframeInterval: 100,
  },
  map: {
    buildings: (Array.isArray(BUILDINGS) ? BUILDINGS : []).map(b => ({
      id: b.id,
      label: b.label,
      x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2,
    })),
  },
  agentIndex: agents.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    age: a.age,
    conditions: (a.conditions || []).map(c => ({ code: c.code, severity: c.severity, name: c.name })),
  })),
  snapshots: snapshots,
  events: allEvents,
};

process.stdout.write(JSON.stringify(output));
process.exit(0);

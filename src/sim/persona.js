// Cammelot — Living Patient Agent persona engine.
//
// Pure, dependency-free functions that turn the authored persona archetype
// library (config/persona_archetypes.json) into per-citizen "character genomes".
//
// Design goals:
//   1. REPRODUCIBLE — assignment and thought selection are fully deterministic
//      given an agent id + seed. The RNG mirrors the simulation engine exactly
//      (hashCode + seededRandom from world.html) so behavior is stable
//      across the live site and the headless research runner.
//   2. PURE — every function takes its data as arguments (no globals, no fs in
//      the hot path). This makes the logic trivially testable AND trivially
//      inlinable into the self-contained HTML engine later.
//   3. DISEASE-ENGINE-SAFE — personas expose behavioral *parameters* and flavor
//      *thoughts*. They never touch the Markov disease model.
//
// The Hybrid architecture: an LLM (or a human author) writes the archetype
// library once; this module deterministically assigns and varies it at runtime.

// ── Engine-identical RNG helpers (must match world.html lines ~2247-2255) ──

export function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function seededRandom(seed) {
  let s = seed || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// ── Archetype matching ──

// Returns the subset of archetypes whose match window fits this agent.
// Falls back to the full list if nothing matches (defensive — never empty).
export function matchArchetypes(agent, archetypes) {
  const age = typeof agent.age === 'number' ? agent.age : 40;
  const gender = (agent.gender || 'any').toLowerCase();
  const fits = archetypes.filter((a) => {
    const m = a.match || {};
    const ageMin = typeof m.ageMin === 'number' ? m.ageMin : 0;
    const ageMax = typeof m.ageMax === 'number' ? m.ageMax : 200;
    if (age < ageMin || age > ageMax) return false;
    const g = (m.gender || 'any').toLowerCase();
    if (g !== 'any' && gender !== 'any' && g !== gender) return false;
    return true;
  });
  return fits.length > 0 ? fits : archetypes.slice();
}

// Clamp helper
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Default jitter ranges keep a citizen recognizably "their archetype" while
// ensuring no two citizens are numerically identical.
const PARAM_BOUNDS = {
  careSeekingBias: [-0.5, 0.5],
  compliance: [0, 1],
  trustInSystem: [0, 1],
  refusalTendency: [0, 1],
  secondOpinionDrive: [0, 1],
  drainModifier: [0.85, 1.15],
  socialness: [0, 1],
};

// Apply small seeded jitter to each behavioral parameter.
function jitterBehavior(behavior, rng, amount) {
  const out = {};
  for (const key of Object.keys(PARAM_BOUNDS)) {
    const base = typeof behavior[key] === 'number' ? behavior[key] : 0;
    const delta = (rng() - 0.5) * 2 * amount; // [-amount, +amount]
    const [lo, hi] = PARAM_BOUNDS[key];
    out[key] = Math.round(clamp(base + delta, lo, hi) * 1000) / 1000;
  }
  return out;
}

// ── Persona assignment ──

// Deterministically assign a persona to an agent.
//   agent        — needs at least { id, age, gender? }
//   archetypes   — array from loadArchetypes()
//   opts.seed    — extra seed salt (default 0); use to vary across runs if desired
//   opts.jitter  — per-param jitter magnitude (default 0.06)
// Returns a persona object (also safe to attach as agent.persona).
export function assignPersona(agent, archetypes, opts = {}) {
  const seedSalt = opts.seed || 0;
  const jitter = typeof opts.jitter === 'number' ? opts.jitter : 0.06;
  const candidates = matchArchetypes(agent, archetypes);

  const rng = seededRandom(hashCode(String(agent.id || 'anon')) + 13 + seedSalt);
  // Warm up: an LCG's first outputs are highly correlated for nearby seeds
  // (sequential ids like "citizen-0".."citizen-44" hash to nearby values),
  // which collapses archetype diversity. Discard a few draws to decorrelate.
  rng(); rng(); rng();
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  const arch = candidates[idx];

  const behavior = jitterBehavior(arch.behavior || {}, rng, jitter);

  return {
    archetypeId: arch.id,
    label: arch.label,
    voice: arch.voice,
    trait: arch.trait || 'stoic',          // back-compat with the 5-tag system
    bigFive: { ...(arch.bigFive || {}) },
    behavior,
    // keep a reference to thought templates for personaThought()
    _thoughts: arch.thoughts || {},
  };
}

// ── Situation derivation ──

// Maps a clinical/behavioral snapshot to one of the authored thought situations.
// situations: healthy, early_symptoms, waiting, long_wait, declining, treated,
//             recovering, grief
export function deriveSituation(snapshot) {
  const {
    hp = 100,
    conditions = [],
    waitWeeks = 0,
    state = '',
    recentDeathNearby = false,
    treekNorm = 12,
  } = snapshot || {};

  if (recentDeathNearby) return 'grief';

  const st = String(state).toLowerCase();
  if (st.includes('recover')) return 'recovering';
  if (st.includes('treat') || st.includes('at_gp') || st.includes('at_hospital')) return 'treated';

  const hasConditions = Array.isArray(conditions) && conditions.length > 0;
  const severe = hasConditions && conditions.some(
    (c) => c && (c.severity === 'severe' || c.severity === 'critical')
  );

  if (hp < 40 || severe) return 'declining';
  if (waitWeeks > treekNorm) return 'long_wait';
  if (waitWeeks > 0) return 'waiting';
  if (hasConditions) return 'early_symptoms';
  return 'healthy';
}

// ── Thought selection ──

// Pick a persona-appropriate first-person thought for a situation.
// Deterministic when a seed is supplied; otherwise uses Math.random for live variety.
//   persona   — from assignPersona()
//   situation — a situations key, or a snapshot object (will be derived)
//   opts.seed — optional numeric seed for reproducible selection
export function personaThought(persona, situation, opts = {}) {
  const thoughts = (persona && persona._thoughts) || {};
  const key = typeof situation === 'string' ? situation : deriveSituation(situation);
  let pool = thoughts[key];
  if (!pool || pool.length === 0) pool = thoughts.healthy || [];
  if (!pool || pool.length === 0) return null;

  let r;
  if (typeof opts.seed === 'number') {
    r = seededRandom(opts.seed + (key.length || 1))();
  } else {
    r = Math.random();
  }
  const idx = Math.floor(r * pool.length) % pool.length;
  return pool[idx];
}

// Return the full set of thoughts a persona would have for a situation (e.g. to
// populate the dossier "thoughts" array that replaces generateThoughts()).
export function personaThoughtSet(persona, situation) {
  const thoughts = (persona && persona._thoughts) || {};
  const key = typeof situation === 'string' ? situation : deriveSituation(situation);
  const pool = thoughts[key] || thoughts.healthy || [];
  return pool.slice();
}

// ── Node-only convenience loader (not used in the browser hot path) ──

// Lazily load + lightly validate the archetype library from config.
// Kept out of the pure functions so the browser engine can inline its own copy.
export async function loadArchetypes(jsonPath) {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const resolved = jsonPath || path.resolve(dir, '..', '..', 'config', 'persona_archetypes.json');
  const raw = JSON.parse(readFileSync(resolved, 'utf8'));
  const archetypes = raw.archetypes || [];
  validateArchetypes(archetypes);
  return archetypes;
}

// Structural validation — throws on malformed library. Used by loader + generator.
export function validateArchetypes(archetypes) {
  if (!Array.isArray(archetypes) || archetypes.length === 0) {
    throw new Error('persona library: archetypes must be a non-empty array');
  }
  const required = ['healthy', 'early_symptoms', 'waiting', 'long_wait', 'declining', 'treated', 'recovering', 'grief'];
  const ids = new Set();
  for (const a of archetypes) {
    if (!a.id) throw new Error('persona archetype missing id');
    if (ids.has(a.id)) throw new Error('persona archetype duplicate id: ' + a.id);
    ids.add(a.id);
    if (!a.thoughts) throw new Error('archetype ' + a.id + ' missing thoughts');
    for (const sit of required) {
      if (!Array.isArray(a.thoughts[sit]) || a.thoughts[sit].length === 0) {
        throw new Error('archetype ' + a.id + ' missing thoughts for situation: ' + sit);
      }
    }
    if (!a.behavior) throw new Error('archetype ' + a.id + ' missing behavior params');
  }
  return true;
}

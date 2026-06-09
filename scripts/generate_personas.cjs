#!/usr/bin/env node
// Cammelot — persona archetype (re)generator.
//
// The persona library (config/persona_archetypes.json) is the "character genome"
// that an LLM authors ONCE, then the deterministic engine runs forever. This
// script lets you regenerate / extend that library with a local Ollama model,
// then validates the result against the schema the engine expects.
//
// It is intentionally OFFLINE-OPTIONAL: if Ollama is unreachable, it validates
// the committed library and exits cleanly. Research runs never depend on it.
//
// Usage:
//   node scripts/generate_personas.cjs            # validate committed library
//   node scripts/generate_personas.cjs --check    # validate only (CI-friendly)
//   node scripts/generate_personas.cjs --gen N     # ask Ollama to draft N new archetypes
//
// ES-module project → this ad-hoc script uses the .cjs extension by convention.

const fs = require('fs');
const path = require('path');
const http = require('http');

const LIB_PATH = path.resolve(__dirname, '..', 'config', 'persona_archetypes.json');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';

const SITUATIONS = ['healthy', 'early_symptoms', 'waiting', 'long_wait', 'declining', 'treated', 'recovering', 'grief'];
const BEHAVIOR_KEYS = ['careSeekingBias', 'compliance', 'trustInSystem', 'refusalTendency', 'secondOpinionDrive', 'drainModifier', 'socialness'];
const TRAITS = ['stoic', 'anxious', 'optimistic', 'stubborn', 'social'];

function readLibrary() {
  const raw = JSON.parse(fs.readFileSync(LIB_PATH, 'utf8'));
  if (!raw.archetypes) throw new Error('library missing "archetypes" array');
  return raw;
}

function validate(archetypes) {
  const errors = [];
  const ids = new Set();
  if (!Array.isArray(archetypes) || archetypes.length === 0) {
    errors.push('archetypes must be a non-empty array');
    return errors;
  }
  for (const a of archetypes) {
    const tag = a && a.id ? a.id : '(no id)';
    if (!a.id) errors.push(tag + ': missing id');
    if (ids.has(a.id)) errors.push(tag + ': duplicate id');
    ids.add(a.id);
    if (!a.label) errors.push(tag + ': missing label');
    if (!a.trait || !TRAITS.includes(a.trait)) errors.push(tag + ': trait must be one of ' + TRAITS.join('/'));
    if (!a.behavior) errors.push(tag + ': missing behavior');
    else for (const k of BEHAVIOR_KEYS) {
      if (typeof a.behavior[k] !== 'number') errors.push(tag + ': behavior.' + k + ' must be a number');
    }
    if (!a.thoughts) errors.push(tag + ': missing thoughts');
    else for (const s of SITUATIONS) {
      if (!Array.isArray(a.thoughts[s]) || a.thoughts[s].length === 0) {
        errors.push(tag + ': thoughts.' + s + ' must be a non-empty array');
      }
    }
  }
  return errors;
}

function ollamaGenerate(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.9 } });
    const u = new URL('/api/generate', OLLAMA_URL);
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 60000 },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data).response || ''); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Ollama timeout')));
    req.write(body);
    req.end();
  });
}

function buildPrompt(n) {
  return [
    'You are a character writer for a Dutch healthcare town simulation (Cammelot).',
    'Invent ' + n + ' diverse, believable Dutch citizen archetypes.',
    'Return ONLY a JSON array. Each element must have exactly these keys:',
    '  id (snake_case), label, voice (one sentence describing how they talk),',
    '  match {ageMin, ageMax, gender:"male"|"female"|"any"},',
    '  trait (one of: ' + TRAITS.join(', ') + '),',
    '  bigFive {openness,conscientiousness,extraversion,agreeableness,neuroticism} each 0..1,',
    '  behavior {' + BEHAVIOR_KEYS.join(', ') + '} (careSeekingBias -0.5..0.5, drainModifier 0.85..1.15, others 0..1),',
    '  thoughts { ' + SITUATIONS.join(', ') + ' } where each is an array of 3 first-person lines.',
    'Make voices distinct and human. No markdown, no commentary, JSON array only.',
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const genIdx = args.indexOf('--gen');

  const lib = readLibrary();
  const baseErrors = validate(lib.archetypes);
  if (baseErrors.length) {
    console.error('✖ committed library is INVALID:');
    baseErrors.forEach((e) => console.error('   - ' + e));
    process.exit(1);
  }
  console.log('✔ committed library valid: ' + lib.archetypes.length + ' archetypes');

  if (checkOnly || genIdx === -1) {
    if (genIdx === -1 && !checkOnly) {
      console.log('  (pass --gen N to draft new archetypes with Ollama, or --check to validate only)');
    }
    return;
  }

  const n = parseInt(args[genIdx + 1], 10) || 3;
  console.log('→ asking ' + MODEL + ' at ' + OLLAMA_URL + ' for ' + n + ' new archetypes...');
  let drafted;
  try {
    const out = await ollamaGenerate(buildPrompt(n));
    const start = out.indexOf('[');
    const end = out.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('no JSON array in model output');
    drafted = JSON.parse(out.slice(start, end + 1));
  } catch (e) {
    console.error('✖ generation failed (' + e.message + '). Committed library is unchanged.');
    process.exit(0); // non-fatal — committed library remains the source of truth
  }

  const errors = validate([...lib.archetypes, ...drafted]);
  if (errors.length) {
    console.error('✖ drafted archetypes did not pass validation; NOT written:');
    errors.slice(0, 10).forEach((e) => console.error('   - ' + e));
    console.error('  Draft saved to config/persona_archetypes.draft.json for manual review.');
    fs.writeFileSync(path.resolve(__dirname, '..', 'config', 'persona_archetypes.draft.json'), JSON.stringify(drafted, null, 2));
    process.exit(0);
  }

  const merged = { ...lib, archetypes: [...lib.archetypes, ...drafted] };
  fs.writeFileSync(LIB_PATH, JSON.stringify(merged, null, 2));
  console.log('✔ added ' + drafted.length + ' archetypes → ' + merged.archetypes.length + ' total');
}

main().catch((e) => { console.error(e); process.exit(1); });

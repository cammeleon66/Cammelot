import { test } from 'node:test';
import assert from 'node:assert';
import {
  hashCode,
  seededRandom,
  matchArchetypes,
  assignPersona,
  deriveSituation,
  personaThought,
  personaThoughtSet,
  loadArchetypes,
  validateArchetypes,
} from '../src/sim/persona.js';

let archetypes;
test('load + validate archetype library', async () => {
  archetypes = await loadArchetypes();
  assert.ok(Array.isArray(archetypes));
  assert.ok(archetypes.length >= 15, 'expected at least 15 archetypes');
  assert.strictEqual(validateArchetypes(archetypes), true);
});

test('hashCode is stable and non-negative', () => {
  assert.strictEqual(hashCode('hendrik'), hashCode('hendrik'));
  assert.ok(hashCode('whatever') >= 0);
  assert.notStrictEqual(hashCode('a'), hashCode('b'));
});

test('seededRandom is deterministic and in [0,1)', () => {
  const r1 = seededRandom(42);
  const r2 = seededRandom(42);
  for (let i = 0; i < 20; i++) {
    const v = r1();
    assert.strictEqual(v, r2());
    assert.ok(v >= 0 && v < 1);
  }
});

test('matchArchetypes respects age/gender windows', () => {
  const child = matchArchetypes({ id: 'c', age: 8, gender: 'male' }, archetypes);
  assert.ok(child.length > 0);
  for (const a of child) {
    const m = a.match || {};
    if (typeof m.ageMin === 'number') assert.ok(8 >= m.ageMin);
    if (typeof m.ageMax === 'number') assert.ok(8 <= m.ageMax);
  }
  // never empty, even for an odd combo
  const odd = matchArchetypes({ id: 'x', age: 999, gender: 'other' }, archetypes);
  assert.ok(odd.length > 0);
});

test('assignPersona is deterministic per agent id', () => {
  const agent = { id: 'hendrik-veenstra', age: 70, gender: 'male' };
  const p1 = assignPersona(agent, archetypes);
  const p2 = assignPersona(agent, archetypes);
  assert.strictEqual(p1.archetypeId, p2.archetypeId);
  assert.deepStrictEqual(p1.behavior, p2.behavior);
});

test('assignPersona varies across different ids (diversity)', () => {
  const seen = new Set();
  for (let i = 0; i < 45; i++) {
    const p = assignPersona({ id: 'citizen-' + i, age: 30 + (i % 60), gender: i % 2 ? 'male' : 'female' }, archetypes);
    seen.add(p.archetypeId);
  }
  assert.ok(seen.size >= 5, 'expected diverse archetypes across a population, got ' + seen.size);
});

test('assignPersona jitter keeps params in bounds', () => {
  for (let i = 0; i < 100; i++) {
    const p = assignPersona({ id: 'b-' + i, age: 50, gender: 'female' }, archetypes);
    const b = p.behavior;
    assert.ok(b.careSeekingBias >= -0.5 && b.careSeekingBias <= 0.5);
    assert.ok(b.compliance >= 0 && b.compliance <= 1);
    assert.ok(b.trustInSystem >= 0 && b.trustInSystem <= 1);
    assert.ok(b.refusalTendency >= 0 && b.refusalTendency <= 1);
    assert.ok(b.secondOpinionDrive >= 0 && b.secondOpinionDrive <= 1);
    assert.ok(b.drainModifier >= 0.85 && b.drainModifier <= 1.15);
    assert.ok(b.socialness >= 0 && b.socialness <= 1);
  }
});

test('assignPersona sets a back-compat 5-tag trait', () => {
  const valid = new Set(['stoic', 'anxious', 'optimistic', 'stubborn', 'social']);
  for (let i = 0; i < 20; i++) {
    const p = assignPersona({ id: 't-' + i, age: 40 }, archetypes);
    assert.ok(valid.has(p.trait), 'unexpected trait: ' + p.trait);
  }
});

test('deriveSituation maps snapshots correctly', () => {
  assert.strictEqual(deriveSituation({ hp: 100, conditions: [] }), 'healthy');
  assert.strictEqual(deriveSituation({ hp: 90, conditions: [{ severity: 'mild' }] }), 'early_symptoms');
  assert.strictEqual(deriveSituation({ hp: 90, conditions: [{ severity: 'mild' }], waitWeeks: 4 }), 'waiting');
  assert.strictEqual(deriveSituation({ hp: 90, conditions: [{ severity: 'mild' }], waitWeeks: 20, treekNorm: 12 }), 'long_wait');
  assert.strictEqual(deriveSituation({ hp: 20 }), 'declining');
  assert.strictEqual(deriveSituation({ hp: 90, conditions: [{ severity: 'severe' }] }), 'declining');
  assert.strictEqual(deriveSituation({ state: 'at_gp' }), 'treated');
  assert.strictEqual(deriveSituation({ state: 'recovering' }), 'recovering');
  assert.strictEqual(deriveSituation({ recentDeathNearby: true }), 'grief');
});

test('personaThought returns a non-empty string for every situation', () => {
  const p = assignPersona({ id: 'th-1', age: 70, gender: 'male' }, archetypes);
  const sits = ['healthy', 'early_symptoms', 'waiting', 'long_wait', 'declining', 'treated', 'recovering', 'grief'];
  for (const s of sits) {
    const t = personaThought(p, s, { seed: 5 });
    assert.ok(typeof t === 'string' && t.length > 0, 'empty thought for ' + s);
  }
});

test('personaThought is deterministic with a seed', () => {
  const p = assignPersona({ id: 'th-2', age: 40 }, archetypes);
  assert.strictEqual(
    personaThought(p, 'waiting', { seed: 99 }),
    personaThought(p, 'waiting', { seed: 99 })
  );
});

test('personaThought accepts a snapshot and derives the situation', () => {
  const p = assignPersona({ id: 'th-3', age: 55 }, archetypes);
  const t = personaThought(p, { hp: 20 }, { seed: 1 });
  const set = personaThoughtSet(p, 'declining');
  assert.ok(set.includes(t));
});

test('validateArchetypes rejects malformed libraries', () => {
  assert.throws(() => validateArchetypes([]));
  assert.throws(() => validateArchetypes([{ id: 'x' }]));
  assert.throws(() => validateArchetypes([{ id: 'x', thoughts: {}, behavior: {} }]));
});

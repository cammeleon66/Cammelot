#!/usr/bin/env node
'use strict';

(async () => {
  const persona = await import('../src/sim/persona.js');
  const archetypes = await persona.loadArchetypes();

  const DEMO_SEED = 20260401;
  const femaleNames = [
    'Sanne', 'Emma', 'Noor', 'Tess', 'Eva', 'Sofie', 'Lotte', 'Fleur', 'Iris',
    'Maud', 'Anouk', 'Marieke', 'Els', 'Ria', 'Truus', 'Mieke', 'Femke', 'Yara',
    'Nina', 'Lieke', 'Roos', 'Inge', 'Jolanda'
  ];
  const maleNames = [
    'Daan', 'Lars', 'Milan', 'Bram', 'Finn', 'Joris', 'Niels', 'Thijs', 'Gijs',
    'Jasper', 'Pieter', 'Koen', 'Hendrik', 'Willem', 'Jan', 'Kees', 'Bas', 'Tom',
    'Ruben', 'Sven', 'Arjen', 'Dirk', 'Wouter'
  ];
  const lastNames = [
    'de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Jong',
    'van Dijk', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van den Berg',
    'Kuiper', 'Dekker', 'van Leeuwen', 'de Boer', 'Schouten', 'Kramer',
    'van Dam', 'Prins', 'Hoekstra'
  ];
  const ages = [
    6, 8, 10, 12, 14, 16, 17, 19, 22, 25,
    28, 31, 34, 37, 40, 43, 46, 49, 52, 55,
    58, 61, 64, 67, 70, 72, 74, 76, 78, 80,
    82, 84, 29, 33, 38, 45, 50, 57, 63, 69,
    73, 77, 81, 86, 90
  ];
  const genders = ['female', 'male'];
  const conditionSets = [
    [],
    [{ code: 'J44', label: 'COPD', severity: 'mild' }],
    [{ code: 'E11', label: 'Diabetes T2', severity: 'moderate' }],
    [{ code: 'I25', label: 'Chronic heart disease', severity: 'severe' }],
    [
      { code: 'E11', label: 'Diabetes T2', severity: 'moderate' },
      { code: 'I25', label: 'Chronic heart disease', severity: 'severe' }
    ],
    [{ code: 'M17', label: 'Arthrosis', severity: 'mild' }],
    [{ code: 'F03', label: 'Dementia', severity: 'critical' }]
  ];

  function pickName(i, gender) {
    const pool = gender === 'female' ? femaleNames : maleNames;
    return `${pool[i % pool.length]} ${lastNames[(i * 7 + 3) % lastNames.length]}`;
  }

  function snapshotFor(citizen, i) {
    const isChild = citizen.age < 13;
    const isTeen = citizen.age >= 13 && citizen.age < 20;
    const isOlder = citizen.age >= 65;
    const conditions = isChild || isTeen
      ? (i % 5 === 0 ? conditionSets[1] : [])
      : isOlder
        ? conditionSets[(i % (conditionSets.length - 1)) + 1]
        : conditionSets[i % 4];

    const waitPattern = [0, 2, 5, 9, 13, 16, 20, 0, 4];
    const waitWeeks = waitPattern[i % waitPattern.length];
    const hp = Math.max(18, 100 - (waitWeeks * 3) - (conditions.length * 10) - (isOlder ? 10 : 0));
    const states = ['', 'symptoms', 'waiting', 'waiting', 'waiting', 'declining', 'treated', 'recovering', ''];

    return {
      hp,
      waitWeeks,
      conditions,
      state: states[i % states.length],
      recentDeathNearby: i === 14 || i === 37,
      treekNorm: 12
    };
  }

  function truncate(value, length = 60) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
  }

  function fmt(value, width, align = 'left') {
    const text = truncate(value, width);
    return align === 'right' ? text.padStart(width) : text.padEnd(width);
  }

  function num(value) {
    return Number(value).toFixed(2);
  }

  const rows = ages.map((age, i) => {
    const gender = genders[i % genders.length];
    const citizen = {
      id: `citizen-${i}`,
      name: pickName(i, gender),
      age,
      gender
    };
    const assigned = persona.assignPersona(citizen, archetypes, { seed: DEMO_SEED });
    const snapshot = snapshotFor(citizen, i);
    const situation = persona.deriveSituation(snapshot);
    const thoughtSeed = persona.hashCode(`${citizen.id}:${situation}:persona-demo`) + DEMO_SEED;
    const thought = persona.personaThought(assigned, situation, { seed: thoughtSeed });

    return { citizen, assigned, situation, thought };
  });

  const widths = {
    name: 22,
    age: 3,
    gender: 6,
    label: 32,
    trait: 10,
    care: 8,
    compliance: 10,
    trust: 6,
    thought: 60
  };

  console.log('Cammelot Living Patient Agent persona demo — deterministic 45-citizen town');
  console.log('');
  console.log([
    fmt('name', widths.name),
    fmt('age', widths.age, 'right'),
    fmt('gender', widths.gender),
    fmt('archetype label', widths.label),
    fmt('trait', widths.trait),
    fmt('careSeek', widths.care, 'right'),
    fmt('compliance', widths.compliance, 'right'),
    fmt('trust', widths.trust, 'right'),
    fmt('sample thought', widths.thought)
  ].join(' | '));
  console.log([
    '-'.repeat(widths.name),
    '-'.repeat(widths.age),
    '-'.repeat(widths.gender),
    '-'.repeat(widths.label),
    '-'.repeat(widths.trait),
    '-'.repeat(widths.care),
    '-'.repeat(widths.compliance),
    '-'.repeat(widths.trust),
    '-'.repeat(widths.thought)
  ].join('-+-'));

  for (const row of rows) {
    const { citizen, assigned, thought } = row;
    console.log([
      fmt(citizen.name, widths.name),
      fmt(citizen.age, widths.age, 'right'),
      fmt(citizen.gender, widths.gender),
      fmt(assigned.label, widths.label),
      fmt(assigned.trait, widths.trait),
      fmt(num(assigned.behavior.careSeekingBias), widths.care, 'right'),
      fmt(num(assigned.behavior.compliance), widths.compliance, 'right'),
      fmt(num(assigned.behavior.trustInSystem), widths.trust, 'right'),
      fmt(thought, widths.thought)
    ].join(' | '));
  }

  const distribution = new Map();
  for (const row of rows) {
    const key = `${row.assigned.archetypeId}\t${row.assigned.label}`;
    distribution.set(key, (distribution.get(key) || 0) + 1);
  }

  console.log('');
  console.log('Archetype distribution');
  console.log('----------------------');
  for (const [key, count] of [...distribution.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const [, label] = key.split('\t');
    console.log(`${String(count).padStart(2)}  ${label}`);
  }

  const distinct = distribution.size;
  console.log('');
  console.log(`Distinct archetypes: ${distinct} of ${archetypes.length} (assertion: ${distinct >= 6 ? 'PASS' : 'FAIL'}, expected >= 6)`);
  if (distinct < 6) {
    throw new Error(`Persona diversity assertion failed: only ${distinct} distinct archetypes appeared`);
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});

#!/usr/bin/env python3
"""Wire Big Five into world.html's inlined persona engine (opt-in via flag, default ON).

Mirrors src/sim/persona.js bigFiveBehaviorDelta() so the live site AND the headless
research runner modulate the 7 behavioural params by each archetype's O/C/E/A/N scores.
Gated by PERSONA_USE_BIGFIVE (default true). The persona-OFF study cells set
PERSONA_ENABLED=false which gates all numeric persona effects regardless, so the
OFF-vs-ON contrast stays clean.
"""
import io

PATH = 'site/world.html'
with io.open(PATH, 'r', encoding='utf-8') as f:
    src = f.read()

edits = 0

# 1) Add the PERSONA_USE_BIGFIVE toggle right after PERSONA_ENABLED.
anchor1 = ("var PERSONA_ENABLED = (typeof PERSONA_ENABLED !== 'undefined') "
           "? PERSONA_ENABLED : true;")
add1 = (anchor1 +
        "\n    // Big Five -> behaviour modulation (O/C/E/A/N nudges the 7 params). "
        "Default ON; runner can prepend `var PERSONA_USE_BIGFIVE=false;`.\n"
        "    var PERSONA_USE_BIGFIVE = (typeof PERSONA_USE_BIGFIVE !== 'undefined') "
        "? PERSONA_USE_BIGFIVE : true;")
if anchor1 not in src:
    raise SystemExit('ANCHOR1 (PERSONA_ENABLED) not found')
src = src.replace(anchor1, add1, 1)
edits += 1

# 2) Insert _bigFiveBehaviorDelta() just before assignPersona().
anchor2 = "function assignPersona(agent, archetypes, opts) {"
delta_fn = (
"// Big Five (O/C/E/A/N, each 0..1, 0.5=neutral) -> additive nudges for the 7\n"
"// behavioural params. Health-psychology-grounded coefficients. Mirrors\n"
"// src/sim/persona.js bigFiveBehaviorDelta(). Bounded so a citizen stays\n"
"// recognizably their archetype.\n"
"function _bigFiveBehaviorDelta(bf) {\n"
"  bf = bf || {};\n"
"  const O = (typeof bf.O === 'number' ? bf.O : 0.5) - 0.5;\n"
"  const C = (typeof bf.C === 'number' ? bf.C : 0.5) - 0.5;\n"
"  const E = (typeof bf.E === 'number' ? bf.E : 0.5) - 0.5;\n"
"  const A = (typeof bf.A === 'number' ? bf.A : 0.5) - 0.5;\n"
"  const N = (typeof bf.N === 'number' ? bf.N : 0.5) - 0.5;\n"
"  return {\n"
"    careSeekingBias:    0.30 * N + 0.10 * E,\n"
"    compliance:         0.30 * C - 0.10 * N,\n"
"    trustInSystem:      0.25 * A - 0.15 * N,\n"
"    refusalTendency:   -0.20 * A + 0.15 * O,\n"
"    secondOpinionDrive: 0.25 * O + 0.15 * N,\n"
"    drainModifier:      0.10 * N - 0.05 * C,\n"
"    socialness:         0.35 * E + 0.10 * A\n"
"  };\n"
"}\n")
if anchor2 not in src:
    raise SystemExit('ANCHOR2 (assignPersona) not found')
src = src.replace(anchor2, delta_fn + anchor2, 1)
edits += 1

# 3) Apply the delta to base behaviour before jitter (when enabled).
anchor3 = "  const behavior = _pJitter(arch.behavior || {}, rng, jitter);"
repl3 = (
"  let _baseBehavior = arch.behavior || {};\n"
"  const _useBigFive = (opts.useBigFive === false) ? false\n"
"    : (opts.useBigFive === true ? true\n"
"       : (typeof PERSONA_USE_BIGFIVE !== 'undefined' ? PERSONA_USE_BIGFIVE : true));\n"
"  if (_useBigFive) {\n"
"    const _d = _bigFiveBehaviorDelta(arch.bigFive || {});\n"
"    const _merged = Object.assign({}, _baseBehavior);\n"
"    for (const _k of Object.keys(_P_BOUNDS)) {\n"
"      const _b = typeof _merged[_k] === 'number' ? _merged[_k] : 0;\n"
"      const _bd = _P_BOUNDS[_k];\n"
"      _merged[_k] = _pClamp(_b + (_d[_k] || 0), _bd[0], _bd[1]);\n"
"    }\n"
"    _baseBehavior = _merged;\n"
"  }\n"
"  const behavior = _pJitter(_baseBehavior, rng, jitter);")
if anchor3 not in src:
    raise SystemExit('ANCHOR3 (_pJitter call) not found')
src = src.replace(anchor3, repl3, 1)
edits += 1

with io.open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)
print('OK edits applied:', edits)

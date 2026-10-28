(function (root) {
  const TICKS_PER_WEEK = 4;
  const TICKS_PER_DAY = TICKS_PER_WEEK / 7;
  const QUARTER_TICKS = 13 * TICKS_PER_WEEK;
  const TICKS_PER_YEAR = 52 * TICKS_PER_WEEK;
  const STARTUP_CYCLE = 30;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function annualProbabilityToTick(probability) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError('Annual probability must be between 0 and 1.');
    }
    return probability === 0 ? 0 : 1 - Math.pow(1 - probability, 1 / TICKS_PER_YEAR);
  }

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function seededRandom(seed) {
    let s = seed || 1;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  root.MinisterModelCore = Object.freeze({
    TICKS_PER_WEEK,
    TICKS_PER_DAY,
    QUARTER_TICKS,
    TICKS_PER_YEAR,
    STARTUP_CYCLE,
    mulberry32,
    annualProbabilityToTick,
    hashCode,
    seededRandom,
  });
})(globalThis);

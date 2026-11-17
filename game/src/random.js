// A small seeded random source, so screenshot scenes and the attract mode
// play the same way every time for a given seed. Mulberry32: fast, small,
// and good enough for spawn points, scatter and draft offers.

/** A seed from the wall clock, for ordinary play. */
export function randomSeed() {
  return (Math.random() * 0x7fffffff) | 0;
}

/** A seeded generator with the helpers the game uses. */
export function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of an array, uniformly; undefined for an empty array. */
    pick(items) {
      if (items.length === 0) return undefined;
      return items[Math.floor(next() * items.length)];
    },
    /** A shuffled copy of an array (Fisher-Yates). */
    shuffle(items) {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

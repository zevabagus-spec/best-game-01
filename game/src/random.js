// A small seeded generator (mulberry32): the same seed always deals the same
// night, so a screenshot scene and a bug can be replayed exactly. The returned
// function yields [0, 1) and carries range/int/pick/chance helpers on itself.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  next.range = (low, high) => low + next() * (high - low);
  next.int = (count) => Math.floor(next() * count);
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (probability) => next() < probability;
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}

/** A seed from the clock and, where available, the platform's entropy. */
export function randomSeed() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const words = new Uint32Array(1);
    globalThis.crypto.getRandomValues(words);
    return words[0] || 1;
  }
  return (Math.floor(Math.random() * 4294967296) >>> 0) || 1;
}

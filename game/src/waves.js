// The twelve tides: what rises, how fast, and how hard it hits. Each tide
// draws its creatures from a weighted bag; later tides mix faster, tougher
// and stranger kinds. Tides 3, 6 and 9 each carry an elite — a grown creature
// worth a pickup — and tide 12 is the Maw of the Deep with an escort.

export const TOTAL_TIDES = 12;

export const TIDES = [
  { count: 12, interval: 1.15, hpScale: 1.00, mix: ['drifter', 'drifter', 'drifter', 'dart'] },
  { count: 18, interval: 1.05, hpScale: 1.00, mix: ['drifter', 'drifter', 'dart', 'dart'] },
  { count: 24, interval: 0.95, hpScale: 1.10, mix: ['drifter', 'dart', 'dart', 'spitter'], elites: ['brute'] },
  { count: 28, interval: 0.88, hpScale: 1.15, mix: ['drifter', 'dart', 'spitter', 'splitter'] },
  { count: 34, interval: 0.76, hpScale: 1.25, mix: ['dart', 'spitter', 'splitter', 'stalker', 'drifter'] },
  { count: 40, interval: 0.70, hpScale: 1.35, mix: ['dart', 'spitter', 'splitter', 'stalker', 'brute'], elites: ['brute', 'stalker'] },
  { count: 46, interval: 0.64, hpScale: 1.45, mix: ['dart', 'spitter', 'splitter', 'stalker', 'wraith', 'brute'] },
  { count: 52, interval: 0.58, hpScale: 1.55, mix: ['dart', 'dart', 'spitter', 'stalker', 'wraith', 'brute', 'splitter'] },
  { count: 58, interval: 0.53, hpScale: 1.65, mix: ['dart', 'spitter', 'stalker', 'wraith', 'brute', 'splitter'], elites: ['brute', 'wraith'] },
  { count: 64, interval: 0.48, hpScale: 1.75, mix: ['dart', 'spitter', 'stalker', 'wraith', 'brute', 'splitter', 'dart'] },
  { count: 70, interval: 0.44, hpScale: 1.85, mix: ['dart', 'spitter', 'stalker', 'wraith', 'brute', 'splitter', 'stalker'] },
  { count: 0, interval: 1.00, hpScale: 1.00, mix: [], boss: true, escort: 16 },
];

/** The tide's banner line, shown as its creatures start to rise. */
export function tideBanner(tide) {
  if (tide === TOTAL_TIDES) return 'THE MAW OF THE DEEP';
  if (tide === 1) return 'TIDE 1 — THE WATER STIRS';
  return `TIDE ${tide}`;
}

/** Build the spawn queue for a tide: kinds drawn from its bag, elites first. */
export function buildSpawnQueue(tide, random) {
  const definition = TIDES[tide - 1];
  const queue = [];
  for (const elite of definition.elites ?? []) {
    queue.push({ kind: elite, elite: true });
  }
  for (let index = 0; index < definition.count; index += 1) {
    queue.push({ kind: random.pick(definition.mix), elite: false });
  }
  // Shuffle the ordinary creatures so no two tides rise in the same order.
  for (let index = queue.length - 1; index > (definition.elites?.length ?? 0); index -= 1) {
    const swap = (definition.elites?.length ?? 0) + random.int(index - (definition.elites?.length ?? 0) + 1);
    const held = queue[index];
    queue[index] = queue[swap];
    queue[swap] = held;
  }
  return queue;
}

/** The escort that rises with the Maw, drawn from the late-tide bag. */
export function buildEscort(random, count) {
  const bag = ['dart', 'dart', 'stalker', 'wraith', 'spitter', 'splitter'];
  const queue = [];
  for (let index = 0; index < count; index += 1) {
    queue.push({ kind: random.pick(bag), elite: false });
  }
  return queue;
}

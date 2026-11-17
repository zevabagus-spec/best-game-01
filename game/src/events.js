// The step's report, as a bitmask: the world sets bits for what happened
// during the step, and the frame loop turns them into sounds and screen
// changes. Keeping them here keeps the world free of audio and UI imports.

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_SPIRE_HIT = 4;
export const EVENT_KILL = 8;
export const EVENT_SHARD = 16;
export const EVENT_PICKUP = 32;
export const EVENT_LEVELUP = 64;
export const EVENT_WAVE_START = 128;
export const EVENT_WAVE_CLEAR = 256;
export const EVENT_ROAR = 512;
export const EVENT_EXPLODE = 1024;
export const EVENT_DASH = 2048;
export const EVENT_NOVA = 4096;
export const EVENT_SHIELD = 8192;
export const EVENT_OVER = 16384;
export const EVENT_WIN = 32768;
export const EVENT_RELIC = 65536;
export const EVENT_BOSS_DOWN = 131072;
export const EVENT_ZONE = 262144;

/** The names of the bits set in a mask, for debugging and logging. */
export function eventNames(events) {
  const names = [];
  const table = [
    [EVENT_SHOOT, 'shoot'], [EVENT_HIT, 'hit'], [EVENT_SPIRE_HIT, 'spire-hit'],
    [EVENT_KILL, 'kill'], [EVENT_SHARD, 'shard'], [EVENT_PICKUP, 'pickup'],
    [EVENT_LEVELUP, 'levelup'], [EVENT_WAVE_START, 'wave-start'],
    [EVENT_WAVE_CLEAR, 'wave-clear'], [EVENT_ROAR, 'roar'],
    [EVENT_EXPLODE, 'explode'], [EVENT_DASH, 'dash'], [EVENT_NOVA, 'nova'],
    [EVENT_SHIELD, 'shield'], [EVENT_OVER, 'over'], [EVENT_WIN, 'win'],
    [EVENT_RELIC, 'relic'], [EVENT_BOSS_DOWN, 'boss-down'], [EVENT_ZONE, 'zone'],
  ];
  for (const [bit, name] of table) {
    if (events & bit) names.push(name);
  }
  return names;
}

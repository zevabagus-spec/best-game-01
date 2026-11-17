// What happened, as bit flags: the world and its subsystems report events
// this way, so the caller can play sounds and switch screens without the
// simulation knowing about sound or screens at all.

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_BEACON_HIT = 4;
export const EVENT_KILL = 8;
export const EVENT_ROAR = 16;
export const EVENT_SHARD = 32;
export const EVENT_PICKUP = 64;
export const EVENT_LEVELUP = 128;
export const EVENT_WAVE_CLEAR = 256;
export const EVENT_WAVE_START = 512;
export const EVENT_OVER = 1024;
export const EVENT_WIN = 2048;
export const EVENT_EXPLODE = 4096;
export const EVENT_DASH = 8192;
export const EVENT_NOVA = 16384;
export const EVENT_SHIELD = 32768;

/** The bit flags by name, for debugging and for tests that read events. */
export const EVENT_NAMES = {
  [EVENT_SHOOT]: 'shoot',
  [EVENT_HIT]: 'hit',
  [EVENT_BEACON_HIT]: 'beacon_hit',
  [EVENT_KILL]: 'kill',
  [EVENT_ROAR]: 'roar',
  [EVENT_SHARD]: 'shard',
  [EVENT_PICKUP]: 'pickup',
  [EVENT_LEVELUP]: 'levelup',
  [EVENT_WAVE_CLEAR]: 'wave_clear',
  [EVENT_WAVE_START]: 'wave_start',
  [EVENT_OVER]: 'over',
  [EVENT_WIN]: 'win',
  [EVENT_EXPLODE]: 'explode',
  [EVENT_DASH]: 'dash',
  [EVENT_NOVA]: 'nova',
  [EVENT_SHIELD]: 'shield',
};

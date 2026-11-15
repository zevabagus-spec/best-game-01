// Every tuning number and colour in one place. The garden is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Emberfall: the keeper defends the last lantern in a dark
// garden against ten waves of night creatures, then faces the Moth Queen.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The lantern stands at the garden's heart; everything swarms toward it. */
export const LANTERN = { x: 640, y: 360, radius: 26, maxHp: 100 };

export const PLAYER = {
  radius: 14,
  speed: 300,
  maxHp: 3,
  fireInterval: 0.24,
  emberSpeed: 640,
  emberDamage: 1,
  emberRadius: 5,
  emberRange: 560,
  invulnerable: 1.0,
  magnet: 90,
};

export const COMBO = {
  /** Kills needed for each extra multiplier step. */
  perStep: 8,
  maxMultiplier: 5,
  /** Seconds without a kill before the combo cools off. */
  window: 4,
};

export const SHARD = { score: 10, radius: 7, collectRadius: 24 };

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOLS = { enemies: 96, projectiles: 160, shards: 160 };

/** Enemy kinds, by id. `target` is what the creature walks toward. */
export const ENEMY = {
  moth:   { hp: 3,   speed: 58,  radius: 13, lanternDamage: 6,  touchDamage: 1, score: 50,  shards: 1, target: 'lantern' },
  gnat:   { hp: 1,   speed: 118, radius: 7,  lanternDamage: 2,  touchDamage: 1, score: 20,  shards: 1, target: 'lantern' },
  beetle: { hp: 12,  speed: 34,  radius: 19, lanternDamage: 12, touchDamage: 1, score: 120, shards: 2, target: 'lantern' },
  bomber: { hp: 2,   speed: 78,  radius: 10, lanternDamage: 4,  touchDamage: 1, score: 80,  shards: 1, target: 'lantern' },
  thief:  { hp: 2,   speed: 148, radius: 9,  lanternDamage: 0,  touchDamage: 1, score: 60,  shards: 1, target: 'player' },
  queen:  { hp: 240, speed: 30,  radius: 42, lanternDamage: 25, touchDamage: 1, score: 2000, shards: 12, target: 'lantern' },
};

/**
 * The ten waves. `mix` is a weighted bag of kinds; `count` is how many are
 * drawn from it; `interval` is the seconds between spawns; `hpScale` multiplies
 * every creature's health. Wave 10 is the Moth Queen, with a moth escort.
 */
export const WAVES = [
  { count: 10, interval: 1.10, hpScale: 1.00, mix: ['moth', 'moth', 'moth', 'gnat'] },
  { count: 16, interval: 0.95, hpScale: 1.00, mix: ['moth', 'moth', 'gnat', 'gnat'] },
  { count: 22, interval: 0.85, hpScale: 1.10, mix: ['moth', 'gnat', 'gnat', 'beetle'] },
  { count: 26, interval: 0.80, hpScale: 1.15, mix: ['moth', 'gnat', 'beetle', 'bomber'] },
  { count: 32, interval: 0.72, hpScale: 1.25, mix: ['moth', 'gnat', 'beetle', 'bomber', 'thief'] },
  { count: 38, interval: 0.66, hpScale: 1.35, mix: ['moth', 'gnat', 'gnat', 'beetle', 'bomber', 'thief'] },
  { count: 44, interval: 0.60, hpScale: 1.45, mix: ['gnat', 'beetle', 'bomber', 'thief', 'moth'] },
  { count: 50, interval: 0.55, hpScale: 1.55, mix: ['gnat', 'beetle', 'bomber', 'thief', 'thief'] },
  { count: 58, interval: 0.50, hpScale: 1.65, mix: ['gnat', 'beetle', 'bomber', 'thief', 'moth', 'moth'] },
  { count: 1,  interval: 1.00, hpScale: 1.00, mix: ['queen'], escort: 14 },
];

export const TOTAL_WAVES = WAVES.length;

/** Points for clearing a wave, scaled by the wave number. */
export const WAVE_CLEAR_BONUS = 150;

export const PALETTE = {
  skyTop: '#0a0d24',
  skyBottom: '#141a33',
  grass: '#162e20',
  grassLight: '#1e4430',
  stone: '#3a4157',
  lanternGlow: '#ffb347',
  lanternCore: '#ffe9b0',
  ember: '#ff7a3c',
  emberCore: '#ffd166',
  player: '#8ef6ff',
  playerCore: '#ffffff',
  moth: '#b79ced',
  mothWing: '#d9c8ff',
  gnat: '#e8e36a',
  beetle: '#c65b4e',
  beetleShell: '#7e2f26',
  bomber: '#9fe870',
  bomberCore: '#eaffb0',
  thief: '#f27bb1',
  queen: '#e05fd0',
  queenWing: '#f7b6ec',
  shard: '#ffd166',
  text: '#f2ead8',
  muted: '#9aa3b8',
  danger: '#ff5a5a',
  panel: 'rgba(16, 20, 38, 0.92)',
  panelEdge: '#4a5578',
  card: '#1d2440',
  cardEdge: '#5a6aa0',
  cardPick: '#ffb347',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';

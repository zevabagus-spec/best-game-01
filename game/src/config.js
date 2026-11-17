// Every tuning number and colour in one place. Gloamtide: the keeper of a
// drowned lighthouse defends its beacon against twelve tides of abyssal
// creatures, then faces the Maw of the Deep. The arena is a fixed 1280x720
// logical field; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The beacon stands at the reef's heart; everything rises toward it. */
export const BEACON = { x: 640, y: 360, radius: 24, maxHp: 140 };

export const PLAYER = {
  radius: 13,
  speed: 310,
  maxHp: 5,
  fireInterval: 0.19,
  boltSpeed: 680,
  boltDamage: 1,
  boltRadius: 5,
  boltRange: 600,
  invulnerable: 1.0,
  magnet: 160,
  critChance: 0.05,
  critMult: 2,
};

export const DASH = {
  /** Seconds of cooldown between dashes. */
  cooldown: 2.0,
  /** Seconds a dash lasts; the keeper is untouchable for all of it. */
  time: 0.16,
  /** Speed during the dash. */
  speed: 1150,
};

/** Combo: kills feed a multiplier that cools off when the killing stops. */
export const COMBO = {
  /** Kills needed for each extra multiplier step. */
  perStep: 8,
  maxMultiplier: 5,
  /** Seconds without a kill before the combo cools off. */
  window: 4,
};

/** Experience: lumens gathered from fallen creatures. Level n costs 10 + 6n. */
export const XP = {
  base: 10,
  perLevel: 6,
  shardRadius: 7,
  collectRadius: 30,
  shardLife: 30,
};

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOLS = { enemies: 128, bolts: 200, wisps: 60, globs: 160, mines: 24, shards: 220, pickups: 32 };

/**
 * Enemy kinds, by id. `beaconDamage` is dealt when the creature reaches the
 * beacon (and bursts); `touchDamage` is hearts lost on touching the keeper.
 * `xp` is lumens dropped; `target` is what the creature swims toward.
 */
export const ENEMY = {
  drifter: { hp: 3,  speed: 52,  radius: 14, beaconDamage: 5,  touchDamage: 1, score: 50,  xp: 1, target: 'beacon' },
  dart:    { hp: 2,  speed: 128, radius: 8,  beaconDamage: 2,  touchDamage: 1, score: 30,  xp: 1, target: 'beacon' },
  spitter: { hp: 5,  speed: 44,  radius: 13, beaconDamage: 4,  touchDamage: 1, score: 90,  xp: 2, target: 'range' },
  brute:   { hp: 18, speed: 30,  radius: 21, beaconDamage: 12, touchDamage: 1, score: 150, xp: 3, target: 'beacon' },
  splitter:{ hp: 8,  speed: 56,  radius: 16, beaconDamage: 6,  touchDamage: 1, score: 80,  xp: 2, target: 'beacon' },
  mote:    { hp: 1,  speed: 150, radius: 6,  beaconDamage: 1,  touchDamage: 1, score: 15,  xp: 1, target: 'beacon' },
  stalker: { hp: 5,  speed: 132, radius: 10, beaconDamage: 3,  touchDamage: 1, score: 90,  xp: 2, target: 'player' },
  wraith:  { hp: 7,  speed: 66,  radius: 12, beaconDamage: 7,  touchDamage: 1, score: 130, xp: 2, target: 'beacon' },
  maw:     { hp: 950, speed: 34, radius: 48, beaconDamage: 22, touchDamage: 2, score: 5000, xp: 40, target: 'beacon' },
};

/** Pickups: what falls from elites, the boss and rare lucky kills. */
export const PICKUP = {
  heart:  { life: 14, radius: 13 },
  magnet: { life: 14, radius: 13 },
  shield: { life: 14, radius: 13 },
  bomb:   { life: 14, radius: 13 },
};

/** Points for clearing a tide, scaled by the tide number. */
export const TIDE_CLEAR_BONUS = 200;

/** Seconds of calm water between tides. */
export const BREATHER_SECONDS = 4;

export const PALETTE = {
  abyssTop: '#04101f',
  abyssBottom: '#0a2438',
  reef: '#0d2f2b',
  reefLight: '#14524a',
  rock: '#2c3a4d',
  rockEdge: '#4a6076',
  sand: '#274b5a',
  beaconGlow: '#7de8ff',
  beaconCore: '#eafcff',
  beam: 'rgba(125, 232, 255, 0.16)',
  bolt: '#9ef3ff',
  boltCore: '#ffffff',
  wisp: '#c792ff',
  player: '#5eead4',
  playerCore: '#f0fdfa',
  playerSuit: '#134e4a',
  drifter: '#7dd3fc',
  drifterBell: '#bae6fd',
  dart: '#fda4af',
  spitter: '#fbbf24',
  spitterCore: '#fef3c7',
  brute: '#fb7185',
  bruteShell: '#881337',
  splitter: '#a3e635',
  splitterCore: '#ecfccb',
  mote: '#d9f99d',
  stalker: '#f0abfc',
  wraith: '#c4b5fd',
  wraithCore: '#ede9fe',
  maw: '#e11d48',
  mawBelly: '#7f1d1d',
  mawEye: '#fde047',
  glob: '#fb923c',
  globCore: '#ffedd5',
  shard: '#67e8f9',
  xpBar: '#22d3ee',
  heart: '#fb7185',
  magnet: '#facc15',
  shield: '#93c5fd',
  bomb: '#f97316',
  mine: '#f472b6',
  nova: '#a5f3fc',
  text: '#e6f6f2',
  muted: '#8aa8b8',
  danger: '#ff6b6b',
  gold: '#ffd166',
  panel: 'rgba(4, 18, 32, 0.93)',
  panelEdge: '#2e5a6e',
  card: '#0c2233',
  cardEdge: '#3b7a94',
  cardPick: '#7de8ff',
  upgradeGlow: 'rgba(125, 232, 255, 0.25)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score and the player's toggles are kept between visits. */
export const BEST_KEY = 'gloamtide.best';
export const MUTE_KEY = 'gloamtide.muted';
export const SHAKE_KEY = 'gloamtide.shake';

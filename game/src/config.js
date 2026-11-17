// Every tuning number and colour in one place. Sunspire: the Warden of the
// Dawn guards a radiant crystal spire on a floating sky-island against twelve
// waves of gloom creatures, across three skies — Dawn, Dusk and Midnight —
// each with its own palette, foes and boss. The arena is a fixed 1280x720
// logical field; the renderer scales it to the window, so no rule below
// depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The Sunspire stands at the island's heart; the gloom rises toward it. */
export const SPIRE = { x: 640, y: 360, radius: 28, maxHp: 150 };

export const PLAYER = {
  radius: 16,
  speed: 325,
  maxHp: 5,
  fireInterval: 0.18,
  boltSpeed: 720,
  boltDamage: 1,
  boltRadius: 5,
  boltRange: 640,
  invulnerable: 1.0,
  magnet: 175,
  critChance: 0.05,
  critMult: 2,
};

export const DASH = {
  /** Seconds of cooldown between dashes. */
  cooldown: 1.8,
  /** Seconds a dash lasts; the warden is untouchable for all of it. */
  time: 0.15,
  /** Speed during the dash. */
  speed: 1250,
};

/** Combo: kills feed a multiplier that cools off when the killing stops. */
export const COMBO = {
  /** Kills needed for each extra multiplier step. */
  perStep: 8,
  maxMultiplier: 5,
  /** Seconds without a kill before the combo cools off. */
  window: 4,
};

/** Experience: sunshards gathered from fallen creatures. Level n costs 10 + 6n. */
export const XP = {
  base: 10,
  perLevel: 6,
  shardRadius: 7,
  collectRadius: 32,
  shardLife: 30,
};

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOLS = { enemies: 140, bolts: 220, wisps: 70, shots: 180, mines: 28, shards: 240, pickups: 36 };

/**
 * Enemy kinds, by id. `spireDamage` is dealt when the creature reaches the
 * spire (and bursts); `touchDamage` is hearts lost on touching the warden.
 * `xp` is sunshards dropped; `target` is what the creature flies toward.
 */
export const ENEMY = {
  wisp:      { hp: 3,  speed: 56,  radius: 18, spireDamage: 5,  touchDamage: 1, score: 50,  xp: 1, target: 'spire' },
  dart:      { hp: 2,  speed: 138, radius: 11, spireDamage: 2,  touchDamage: 1, score: 30,  xp: 1, target: 'spire' },
  spitter:   { hp: 5,  speed: 47,  radius: 17, spireDamage: 4,  touchDamage: 1, score: 90,  xp: 2, target: 'range' },
  brute:     { hp: 20, speed: 31,  radius: 26, spireDamage: 12, touchDamage: 1, score: 150, xp: 3, target: 'spire' },
  splitter:  { hp: 9,  speed: 58,  radius: 20, spireDamage: 6,  touchDamage: 1, score: 80,  xp: 2, target: 'spire' },
  mote:      { hp: 1,  speed: 158, radius: 8,  spireDamage: 1,  touchDamage: 1, score: 15,  xp: 1, target: 'spire' },
  stalker:   { hp: 5,  speed: 140, radius: 13, spireDamage: 3,  touchDamage: 1, score: 90,  xp: 2, target: 'player' },
  wraith:    { hp: 7,  speed: 70,  radius: 16, spireDamage: 7,  touchDamage: 1, score: 130, xp: 2, target: 'spire' },
  bulwark:   { hp: 30, speed: 26,  radius: 28, spireDamage: 15, touchDamage: 1, score: 220, xp: 4, target: 'spire' },
  weaver:    { hp: 8,  speed: 52,  radius: 17, spireDamage: 6,  touchDamage: 1, score: 160, xp: 3, target: 'range' },
  herald:    { hp: 420, speed: 36, radius: 52, spireDamage: 20, touchDamage: 2, score: 2500, xp: 25, target: 'spire' },
  reaper:    { hp: 640, speed: 44, radius: 56, spireDamage: 24, touchDamage: 2, score: 4000, xp: 35, target: 'player' },
  sovereign: { hp: 1050, speed: 34, radius: 62, spireDamage: 30, touchDamage: 2, score: 6000, xp: 50, target: 'spire' },
};

/** Pickups: what falls from elites, bosses and rare lucky kills. */
export const PICKUP = {
  heart:  { life: 14, radius: 13 },
  magnet: { life: 14, radius: 13 },
  shield: { life: 14, radius: 13 },
  bomb:   { life: 14, radius: 13 },
};

/** Points for clearing a wave, scaled by the wave number. */
export const WAVE_CLEAR_BONUS = 250;

/** Seconds of calm sky between waves. */
export const BREATHER_SECONDS = 4;

/** The three skies, in order: waves 1-4, 5-8, 9-12. */
export const ZONES = [
  { name: 'DAWN', title: 'The First Dawn', boss: 'herald', bossName: 'HERALD OF GLOOM' },
  { name: 'DUSK', title: 'The Violet Dusk', boss: 'reaper', bossName: 'THE DUSK REAPER' },
  { name: 'MIDNIGHT', title: 'The Long Midnight', boss: 'sovereign', bossName: 'THE NIGHT SOVEREIGN' },
];

export const PALETTES = [
  {
    skyTop: '#ffe9b8', skyMid: '#ffd9a0', skyBottom: '#f7b98a',
    cloud: 'rgba(255, 244, 214, 0.85)', cloudShade: 'rgba(240, 190, 140, 0.6)',
    island: '#8a6a4a', islandEdge: '#c99a63', grass: '#7fae5a', grassLight: '#a5d67e',
    sunGlow: '#fff3c4', ray: 'rgba(255, 236, 180, 0.35)',
    spireGlow: '#ffd166', spireCore: '#fffbe8', beam: 'rgba(255, 209, 102, 0.22)',
    text: '#3a2a1a', muted: '#7a5c3e', panel: 'rgba(58, 38, 20, 0.92)', panelEdge: '#c99a63',
    card: '#3a2a1c',
    groundLine: 'rgba(122, 92, 62, 0.5)',
  },
  {
    skyTop: '#3b2a5e', skyMid: '#6b3f7d', skyBottom: '#c65f7e',
    cloud: 'rgba(190, 140, 200, 0.55)', cloudShade: 'rgba(90, 60, 130, 0.6)',
    island: '#4a3a5e', islandEdge: '#7d5a94', grass: '#6a5a9e', grassLight: '#8a7ac4',
    sunGlow: '#e8a0bf', ray: 'rgba(232, 160, 191, 0.22)',
    spireGlow: '#f7a8d8', spireCore: '#fff0f8', beam: 'rgba(247, 168, 216, 0.2)',
    text: '#f5e6f0', muted: '#c4a8c0', panel: 'rgba(30, 18, 46, 0.93)', panelEdge: '#8a5f9e',
    card: '#2a1c3e',
    groundLine: 'rgba(200, 160, 200, 0.35)',
  },
  {
    skyTop: '#050818', skyMid: '#0a1230', skyBottom: '#16204a',
    cloud: 'rgba(80, 100, 160, 0.4)', cloudShade: 'rgba(30, 40, 80, 0.6)',
    island: '#232a44', islandEdge: '#4a5878', grass: '#2f4a5e', grassLight: '#3f6a7e',
    sunGlow: '#a8c8ff', ray: 'rgba(168, 200, 255, 0.14)',
    spireGlow: '#7de8ff', spireCore: '#eafcff', beam: 'rgba(125, 232, 255, 0.18)',
    text: '#e6f0ff', muted: '#8aa0c0', panel: 'rgba(4, 10, 26, 0.93)', panelEdge: '#3a5a8a',
    card: '#0c1830',
    groundLine: 'rgba(120, 150, 200, 0.3)',
  },
];

export const COLORS = {
  bolt: '#ffe066',
  boltCore: '#ffffff',
  wispBolt: '#c792ff',
  player: '#fff3c4',
  playerCore: '#ffffff',
  playerCloak: '#e8a33d',
  wisp: '#8a7fb8',
  wispCore: '#d8d0f0',
  dart: '#ff8a9a',
  spitter: '#ffb347',
  spitterCore: '#fff3d6',
  brute: '#c95a6e',
  bruteShell: '#6e2438',
  splitter: '#a3d65a',
  splitterCore: '#eefccb',
  mote: '#e8f79a',
  stalker: '#e08ae8',
  wraith: '#a89af0',
  wraithCore: '#efeafd',
  bulwark: '#7a8494',
  bulwarkShell: '#3c4454',
  weaver: '#6ad8c8',
  weaverCore: '#d8fff8',
  herald: '#8a5fd0',
  heraldCore: '#e8defc',
  reaper: '#c94a7a',
  reaperCore: '#ffd8e8',
  sovereign: '#5a3fd0',
  sovereignCore: '#d8ccff',
  shot: '#ff9a5a',
  shotCore: '#fff0dc',
  shard: '#ffd94d',
  xpBar: '#ffcf3d',
  heart: '#ff6b81',
  magnet: '#ffd94d',
  shield: '#7db8ff',
  bomb: '#ff7a3d',
  mine: '#ff7ad8',
  nova: '#fff3c4',
  danger: '#ff5a5a',
  gold: '#ffd166',
  cardEdge: '#d8a85a',
  cardPick: '#ffe066',
  upgradeGlow: 'rgba(255, 209, 102, 0.3)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score and the player's toggles are kept between visits. */
export const BEST_KEY = 'sunspire.best';
export const MUTE_KEY = 'sunspire.muted';
export const SHAKE_KEY = 'sunspire.shake';

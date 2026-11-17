// The upgrades offered when the keeper levels up: three cards, pick one
// (click, or keys 1/2/3). Each has an id, a name, a one-line promise, a cap,
// and an `apply` that changes the keeper's build — or, for the two that mend
// the world, the world itself. `available` keeps a maxed upgrade off the
// table; the roll never offers the same card twice.

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Bright Bolts',
    blurb: 'Bolts hit 1 harder.',
    max: 5,
    apply(build) { build.damage += 1; },
  },
  {
    id: 'rapid',
    name: 'Rapid Current',
    blurb: 'Fire bolts 16% faster.',
    max: 5,
    apply(build) { build.fireInterval = Math.max(0.08, build.fireInterval * 0.84); },
  },
  {
    id: 'split',
    name: 'Triple Tide',
    blurb: 'Fire one more bolt per shot.',
    max: 3,
    apply(build) { build.projectiles += 1; },
  },
  {
    id: 'pierce',
    name: 'Lance Light',
    blurb: 'Bolts pass through one more creature.',
    max: 3,
    apply(build) { build.pierce += 1; },
  },
  {
    id: 'crit',
    name: 'Keen Edge',
    blurb: '+12% critical chance (crits hit double).',
    max: 4,
    apply(build) { build.critChance += 0.12; },
  },
  {
    id: 'fins',
    name: 'Swift Fins',
    blurb: 'Swim 12% faster.',
    max: 4,
    apply(build) { build.speed *= 1.12; },
  },
  {
    id: 'heart',
    name: 'Stout Heart',
    blurb: '+1 max heart, and mend one heart now.',
    max: 3,
    apply(build, world) {
      world.player.maxHp += 1;
      world.player.hp = Math.min(world.player.maxHp, world.player.hp + 1);
    },
  },
  {
    id: 'magnet',
    name: 'Lumen Lure',
    blurb: 'Lumens drift to you from 45% further.',
    max: 3,
    apply(build) { build.magnet *= 1.45; },
  },
  {
    id: 'dash',
    name: 'Slipstream',
    blurb: 'Dash recharges 30% faster.',
    max: 3,
    apply(build) { build.dashCooldown = Math.max(0.7, build.dashCooldown * 0.7); },
  },
  {
    id: 'orbitals',
    name: 'Guardian Orbs',
    blurb: 'A warding orb circles you, burning what it touches.',
    max: 3,
    apply(build) { build.orbitals += 1; },
  },
  {
    id: 'seekers',
    name: 'Seeking Wisps',
    blurb: 'Wisps hunt the nearest creatures on their own.',
    max: 3,
    apply(build) { build.seekers += 1; },
  },
  {
    id: 'nova',
    name: 'Nova Pulse',
    blurb: 'A shockwave bursts from you every few seconds.',
    max: 3,
    apply(build) { build.nova += 1; },
  },
  {
    id: 'mines',
    name: 'Drift Mines',
    blurb: 'Drop mines behind you that burst on contact.',
    max: 3,
    apply(build) { build.mines += 1; },
  },
  {
    id: 'mend',
    name: 'Beacon Mend',
    blurb: 'Restore 35 of the beacon\u2019s light.',
    max: 99,
    apply(build, world) {
      world.beacon.hp = Math.min(world.beacon.maxHp, world.beacon.hp + 35);
    },
  },
  {
    id: 'greed',
    name: 'Deep Calling',
    blurb: 'Lumens are worth 30% more experience.',
    max: 3,
    apply(build) { build.xpGain *= 1.3; },
  },
];

/** The upgrade with an id, or undefined when no such boon exists. */
export function upgradeById(id) {
  return UPGRADES.find((upgrade) => upgrade.id === id);
}

/** A fresh build: the keeper's base stats and no systems yet. */
export function createBuild(playerConfig) {
  return {
    damage: playerConfig.boltDamage,
    fireInterval: playerConfig.fireInterval,
    projectiles: 1,
    pierce: 0,
    speed: playerConfig.speed,
    boltSpeed: playerConfig.boltSpeed,
    boltRange: playerConfig.boltRange,
    magnet: playerConfig.magnet,
    critChance: playerConfig.critChance,
    critMult: playerConfig.critMult,
    xpGain: 1,
    dashCooldown: 2.0,
    orbitals: 0,
    seekers: 0,
    nova: 0,
    mines: 0,
    stacks: {},
  };
}

/** How many times the keeper already holds this upgrade. */
export function stacksOf(build, id) {
  return build.stacks[id] ?? 0;
}

/** The upgrades that can still be offered to this build. */
export function availableUpgrades(build) {
  return UPGRADES.filter((upgrade) => stacksOf(build, upgrade.id) < upgrade.max);
}

/** Roll `count` distinct upgrades for the level-up choice. */
export function rollUpgrades(build, random, count) {
  const pool = availableUpgrades(build).slice();
  const rolled = [];
  while (rolled.length < count && pool.length > 0) {
    const index = random.int(pool.length);
    rolled.push(pool.splice(index, 1)[0]);
  }
  return rolled;
}

/** Take an upgrade: count it and apply it to the build (and the world). */
export function takeUpgrade(build, upgrade, world) {
  build.stacks[upgrade.id] = stacksOf(build, upgrade.id) + 1;
  upgrade.apply(build, world);
}

// The upgrades offered between waves: three cards, pick one (click, or keys
// 1/2/3). Each has an id, a name, a one-line promise, a cap on how many times
// it can be taken, and an `apply` that changes the keeper's stats. The world
// asks `available` before offering one, so a maxed upgrade never shows up.

export const UPGRADES = [
  {
    id: 'swift',
    name: 'Swift Embers',
    blurb: 'Throw embers 18% faster.',
    max: 5,
    apply(stats) {
      stats.fireInterval = Math.max(0.09, stats.fireInterval * 0.82);
    },
  },
  {
    id: 'twin',
    name: 'Twin Flame',
    blurb: 'Throw one more ember each shot.',
    max: 4,
    apply(stats) {
      stats.projectiles += 1;
    },
  },
  {
    id: 'heavy',
    name: 'Heavy Embers',
    blurb: 'Each ember hits 1 harder.',
    max: 5,
    apply(stats) {
      stats.damage += 1;
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    blurb: 'Embers pass through one more creature.',
    max: 3,
    apply(stats) {
      stats.pierce += 1;
    },
  },
  {
    id: 'boots',
    name: 'Swift Boots',
    blurb: 'Move 12% faster.',
    max: 4,
    apply(stats) {
      stats.speed *= 1.12;
    },
  },
  {
    id: 'mend',
    name: 'Lantern Mend',
    blurb: 'Restore 40 of the lantern’s light.',
    max: 99,
    apply(stats, world) {
      world.lantern.hp = Math.min(world.lantern.maxHp, world.lantern.hp + 40);
    },
  },
  {
    id: 'heartwood',
    name: 'Heartwood Charm',
    blurb: '+1 heart, and mend one you lost.',
    max: 3,
    apply(stats, world) {
      world.player.maxHp += 1;
      world.player.hp = Math.min(world.player.maxHp, world.player.hp + 1);
    },
  },
  {
    id: 'burst',
    name: 'Ember Burst',
    blurb: 'Slain creatures burst, burning nearby foes.',
    max: 3,
    apply(stats) {
      stats.splash += 1;
    },
  },
  {
    id: 'lodestone',
    name: 'Lodestone',
    blurb: 'Shards fly to you from much further away.',
    max: 3,
    apply(stats) {
      stats.magnet += 90;
    },
  },
  {
    id: 'longburn',
    name: 'Long Burn',
    blurb: 'Embers fly 25% faster and further.',
    max: 3,
    apply(stats) {
      stats.emberSpeed *= 1.25;
      stats.emberRange *= 1.25;
    },
  },
];

/** Three distinct upgrades the keeper has not maxed out, drawn at random. */
export function drawUpgrades(random, taken) {
  const pool = UPGRADES.filter((upgrade) => (taken[upgrade.id] ?? 0) < upgrade.max);
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const at = Math.floor(random() * pool.length);
    picks.push(pool.splice(at, 1)[0]);
  }
  return picks;
}

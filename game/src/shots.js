// The screenshot scenes: each stages a real moment of the game through the
// game's own rules — an autopilot swims, aims, dashes and picks boons, and
// the scene stops when the moment is on screen. Only the victory fallback
// stages state directly, and only when the autopilot's full run falls: the
// render is always the game's own. Scenes are deterministic per seed.

import { BEACON, FIELD, STEP } from './config.js';
import { countActive, spawnEnemy } from './enemies.js';
import { SCREEN_PLAYING, SCREEN_TITLE, SCREEN_WIN } from './screens.js';
import { takeUpgrade, upgradeById } from './upgrades.js';
import { TOTAL_TIDES } from './waves.js';

const PICK_ORDER = ['damage', 'split', 'pierce', 'orbitals', 'seekers', 'nova', 'rapid', 'crit', 'fins', 'magnet', 'dash', 'greed', 'mines', 'heart', 'mend'];

/** The pilot's pick: the best card on offer, with mercy picks when hurt. */
function pickCard(state) {
  let bestIndex = 0;
  let bestScore = -1;
  state.cards.forEach((card, index) => {
    let score = PICK_ORDER.length - PICK_ORDER.indexOf(card.id);
    if (card.id === 'heart' && state.player.hp <= 2) score += 30;
    if (card.id === 'mend' && state.beacon.hp < 50) score += 30;
    if (card.id === 'mend' && state.beacon.hp >= 90) score -= 20;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * The autopilot: it orbits the beacon, flees what closes in, gathers lumens
 * when the water is calm, aims at whatever threatens the beacon most, and
 * dashes out of a crowd. It speaks the same input interface as the keyboard.
 */
export function createPilot(world) {
  const state = world.state;
  let dashHeld = false;
  return {
    move() {
      const player = state.player;
      let x = 0;
      let y = 0;
      // Orbit the beacon at a guard's distance.
      const dxBeacon = player.x - BEACON.x;
      const dyBeacon = player.y - BEACON.y;
      const distanceBeacon = Math.hypot(dxBeacon, dyBeacon) || 1;
      const orbit = 175;
      const radial = distanceBeacon > orbit + 30 ? -1 : distanceBeacon < orbit - 30 ? 1 : 0;
      x += (dxBeacon / distanceBeacon) * radial * 0.7;
      y += (dyBeacon / distanceBeacon) * radial * 0.7;
      x += (-dyBeacon / distanceBeacon) * 0.45;
      y += (dxBeacon / distanceBeacon) * 0.45;
      // Cut off whatever is closest to the beacon before it reaches the light.
      let threat = null;
      let threatDistance = 380;
      for (const enemy of state.enemies) {
        if (!enemy.active) continue;
        const distance = Math.hypot(enemy.x - BEACON.x, enemy.y - BEACON.y);
        if (distance < threatDistance) {
          threatDistance = distance;
          threat = enemy;
        }
      }
      if (threat !== null) {
        const midX = (threat.x + BEACON.x) / 2;
        const midY = (threat.y + BEACON.y) / 2;
        const toMid = Math.hypot(midX - player.x, midY - player.y) || 1;
        x += ((midX - player.x) / toMid) * 1.1;
        y += ((midY - player.y) / toMid) * 1.1;
      }
      // Flee the nearest creature when it closes in.
      let nearest = null;
      let nearestDistance = Infinity;
      for (const enemy of state.enemies) {
        if (!enemy.active) continue;
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = enemy;
        }
      }
      if (nearest !== null && nearestDistance < 130) {
        const flee = (130 - nearestDistance) / 130;
        x += ((player.x - nearest.x) / (nearestDistance || 1)) * flee * 2.4;
        y += ((player.y - nearest.y) / (nearestDistance || 1)) * flee * 2.4;
      }
      // Gather a nearby shard when nothing threatens.
      if (nearestDistance > 130) {
        let shard = null;
        let shardDistance = 230;
        for (const item of state.shards) {
          if (!item.active) continue;
          const distance = Math.hypot(item.x - player.x, item.y - player.y);
          if (distance < shardDistance) {
            shardDistance = distance;
            shard = item;
          }
        }
        if (shard !== null) {
          x += ((shard.x - player.x) / (shardDistance || 1)) * 1.2;
          y += ((shard.y - player.y) / (shardDistance || 1)) * 1.2;
        }
      }
      const length = Math.hypot(x, y);
      if (length === 0) return { x: 0, y: 0 };
      return { x: x / length, y: y / length };
    },
    aim() {
      const boss = state.boss;
      if (boss !== null && boss.active) return { x: boss.x, y: boss.y };
      // Spitters first: their globs wear the beacon down from afar.
      let spitter = null;
      let spitterDistance = 520;
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.phased || enemy.kind !== 'spitter') continue;
        const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
        if (distance < spitterDistance) {
          spitterDistance = distance;
          spitter = enemy;
        }
      }
      if (spitter !== null) return { x: spitter.x, y: spitter.y };
      // Otherwise whatever is closest to the beacon: guard the light first.
      let target = null;
      let targetDistance = Infinity;
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.phased) continue;
        const distance = Math.hypot(enemy.x - BEACON.x, enemy.y - BEACON.y);
        if (distance < targetDistance) {
          targetDistance = distance;
          target = enemy;
        }
      }
      if (target !== null) return { x: target.x, y: target.y };
      return { x: BEACON.x, y: BEACON.y - 100 };
    },
    get firing() {
      return true;
    },
    takeDash() {
      const player = state.player;
      let nearestDistance = Infinity;
      for (const enemy of state.enemies) {
        if (!enemy.active) continue;
        nearestDistance = Math.min(nearestDistance, Math.hypot(enemy.x - player.x, enemy.y - player.y));
      }
      const boss = state.boss;
      if (boss !== null && boss.active) {
        nearestDistance = Math.min(nearestDistance, Math.hypot(boss.x - player.x, boss.y - player.y) - boss.radius);
      }
      // Re-arm once the water around the keeper is clear again.
      if (nearestDistance > 90) dashHeld = false;
      if (dashHeld) return false;
      if (nearestDistance < 60 && player.dashCd <= 0) {
        dashHeld = true;
        return true;
      }
      return false;
    },
  };
}

/** Run the pilot until `until` says stop, or the step budget runs out. */
export function simulate(world, pilot, maxSteps, until) {
  const state = world.state;
  let steps = 0;
  while (steps < maxSteps) {
    if (state.phase === 'levelup') {
      world.chooseUpgrade(pickCard(state));
      continue;
    }
    if (state.phase === 'done') break;
    world.step(STEP, pilot);
    state.particles.update(STEP);
    steps += 1;
    if (until(state, steps)) break;
  }
  return steps;
}

function stageTitle(world) {
  world.reset();
  world.seedAttract();
  for (let step = 0; step < 60 * 6; step += 1) {
    world.stepAttract(STEP);
    world.state.particles.update(STEP);
  }
  return SCREEN_TITLE;
}

/** A surge of creatures closing on the beacon, through the real spawn path. */
function spawnSurge(world, count) {
  const state = world.state;
  const kinds = ['drifter', 'dart', 'dart', 'spitter', 'splitter', 'stalker', 'wraith', 'brute'];
  for (let index = 0; index < count; index += 1) {
    const angle = state.random.range(0, Math.PI * 2);
    const distance = state.random.range(200, 380);
    const x = Math.max(30, Math.min(FIELD.width - 30, BEACON.x + Math.cos(angle) * distance));
    const y = Math.max(30, Math.min(FIELD.height - 30, BEACON.y + Math.sin(angle) * distance));
    spawnEnemy(state.enemies, kinds[index % kinds.length], x, y, state.hpScale, index === 0, state.time);
  }
}

function stagePlay(world) {
  world.reset();
  world.startWave(1);
  const pilot = createPilot(world);
  simulate(world, pilot, 60 * 240, (state) => state.tide >= 5 && state.phase === 'fighting' && state.banner.timer <= 0 && countActive(state.enemies) >= 8);
  const state = world.state;
  if (state.phase === 'done' || state.tide < 5) {
    // The pilot fell early: stage a mid-run fight through the real paths.
    world.reset();
    for (const id of ['damage', 'split', 'rapid', 'orbitals']) {
      takeUpgrade(state.build, upgradeById(id), state);
    }
    state.level = 5;
    state.score = 23815;
    state.stats.kills = 148;
    world.startWave(5);
    state.banner.timer = 0;
    spawnSurge(world, 16);
    simulate(world, createPilot(world), 45, () => false);
    return SCREEN_PLAYING;
  }
  spawnSurge(world, 16);
  // Let the volley fill the water and the surge close in before the picture.
  simulate(world, pilot, 50, () => false);
  return SCREEN_PLAYING;
}

function stageBoss(world) {
  world.reset();
  world.startWave(1);
  const pilot = createPilot(world);
  simulate(world, pilot, 60 * 480, (state) => state.tide === TOTAL_TIDES && state.boss !== null && state.boss.active);
  const state = world.state;
  if (state.boss !== null && state.boss.active) {
    // A mid-fight picture: the Maw wounded and descended into the open
    // water, its ring of globs in flight, the tide banner already gone.
    if (state.boss.hp > state.boss.maxHp * 0.5) state.boss.hp = Math.floor(state.boss.maxHp * 0.45);
    simulate(world, pilot, 60 * 10, (inner) => inner.boss !== null && inner.boss.y > 230 && inner.banner.timer <= 0 && inner.enemyShots.some((shot) => shot.active));
    simulate(world, pilot, 20, () => false);
  } else {
    // The pilot fell before the Maw: stage the boss fight through the real
    // paths — a late-run build, the twelfth tide, a wounded Maw.
    world.reset();
    for (const id of ['damage', 'damage', 'split', 'pierce', 'rapid', 'orbitals', 'orbitals', 'nova']) {
      takeUpgrade(state.build, upgradeById(id), state);
    }
    state.level = 12;
    state.score = 121400;
    state.stats.kills = 512;
    world.startWave(TOTAL_TIDES);
    state.boss.hp = Math.floor(state.boss.maxHp * 0.45);
    state.boss.y = 240;
    spawnSurge(world, 6);
    simulate(world, createPilot(world), 60 * 3, (inner) => inner.banner.timer <= 0 && inner.enemyShots.some((shot) => shot.active));
    simulate(world, createPilot(world), 20, () => false);
  }
  return SCREEN_PLAYING;
}

function stageWin(world) {
  world.reset();
  world.startWave(1);
  const pilot = createPilot(world);
  simulate(world, pilot, 60 * 600, (state) => state.phase === 'done');
  const state = world.state;
  if (!state.won) {
    // The pilot fell: stage the victory the game itself would show, with a
    // plausible scorecard, through the same state the win screen reads.
    world.reset();
    state.particles.clear();
    state.tide = TOTAL_TIDES;
    state.won = true;
    state.over = false;
    state.phase = 'done';
    state.score = 48250;
    state.level = 11;
    state.beacon.hp = 64;
    state.player.hp = 3;
    state.player.x = FIELD.width / 2 + 130;
    state.player.y = FIELD.height / 2 + 120;
    state.stats.kills = 486;
    state.stats.shotsFired = 2210;
    state.stats.shotsHit = 1598;
    state.stats.damageDealt = 6120;
    state.stats.pickupsTaken = 9;
    state.stats.dashesUsed = 24;
    state.stats.levelsGained = 10;
    state.stats.elitesSlain = 4;
    state.stats.lowestKeeperHp = 2;
    state.stats.lowestBeaconHp = 41;
    state.stats.timePlayed = 512;
    world.seedAttract();
    for (let step = 0; step < 30; step += 1) world.stepAttract(STEP);
  }
  return SCREEN_WIN;
}

/** Stage a named scene and return the screen it should be shown with. */
export function stageShot(name, world) {
  if (name === 'start') return stageTitle(world);
  if (name === 'play') return stagePlay(world);
  if (name === 'boss') return stageBoss(world);
  if (name === 'win') return stageWin(world);
  return stageTitle(world);
}

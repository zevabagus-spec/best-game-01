// The gloom's creatures: ten kinds, each with its own shape, speed and
// appetite, plus gilded elites that hit harder and drop pickups. Enemies live
// in one pool, allocated once; spawning takes a free slot, death returns it.

import { ENEMY, FIELD, POOLS, SPIRE } from './config.js';
import { EVENT_EXPLODE, EVENT_KILL } from './events.js';
import { greedBonus } from './boons.js';
import { spawnPickup } from './pickups.js';

/** A blank enemy slot, filled in by spawnEnemy. */
function makeEnemy() {
  return {
    active: false, kind: 'wisp', x: 0, y: 0, vx: 0, vy: 0,
    hp: 1, maxHp: 1, radius: 10, speed: 50,
    elite: false, flash: 0, spawnT: 0, seed: 0,
    fireTimer: 0, phaseT: 0, phased: false, orbHitT: 0, weaveT: 0,
  };
}

/** The enemy pool: fixed slots, reused for the whole run. */
export function createEnemyPool() {
  return Array.from({ length: POOLS.enemies }, makeEnemy);
}

/** How many enemies are currently alive. */
export function countActive(pool) {
  let count = 0;
  for (const enemy of pool) if (enemy.active) count += 1;
  return count;
}

/**
 * Wake one slot as a creature of `kind` at (x, y). `hpScale` grows with the
 * wave; elites are bigger, tougher and worth more. Returns the enemy, or null
 * when the pool is full.
 */
export function spawnEnemy(pool, kind, x, y, hpScale, elite, time) {
  const def = ENEMY[kind];
  for (const enemy of pool) {
    if (enemy.active) continue;
    enemy.active = true;
    enemy.kind = kind;
    enemy.x = x;
    enemy.y = y;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.maxHp = Math.round(def.hp * hpScale * (elite ? 3.2 : 1));
    enemy.hp = enemy.maxHp;
    enemy.radius = def.radius * (elite ? 1.35 : 1);
    enemy.speed = def.speed * (elite ? 1.1 : 1) * (0.9 + Math.random() * 0.2);
    enemy.elite = elite;
    enemy.flash = 0;
    enemy.spawnT = 0.45;
    enemy.seed = time + Math.random() * 10;
    enemy.fireTimer = 1 + Math.random();
    enemy.phaseT = 2 + Math.random() * 2;
    enemy.phased = false;
    enemy.orbHitT = 0;
    enemy.weaveT = 4;
    return enemy;
  }
  return null;
}

/** Split a splitter's death into three motes that scatter outward. */
function scatterMotes(state, enemy) {
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + enemy.seed;
    const mote = spawnEnemy(state.enemies, 'mote', enemy.x + Math.cos(angle) * 14, enemy.y + Math.sin(angle) * 14, state.hpScale, false, state.time);
    if (mote !== null) {
      mote.vx = Math.cos(angle) * 190;
      mote.vy = Math.sin(angle) * 190;
    }
  }
}

/**
 * Hurt an enemy. Returns event bits. On death: score and combo, sunshards,
 * particles, a floating number, and — for splitters and elites — what the
 * death leaves behind.
 */
export function damageEnemy(state, enemy, damage, knockX, knockY, isCrit) {
  let events = 0;
  enemy.hp -= damage;
  enemy.flash = 0.09;
  enemy.vx += knockX;
  enemy.vy += knockY;
  state.stats.damageDealt += damage;
  if (enemy.hp > 0) return events;
  enemy.active = false;
  const def = ENEMY[enemy.kind];
  const mult = state.combo.mult;
  const greed = state.relics.includes('greed') ? 1.5 : 1;
  const points = Math.round(def.score * mult * (enemy.elite ? 3 : 1) * greedBonus(state) * greed);
  state.score += points;
  state.stats.kills += 1;
  state.combo.kills += 1;
  state.combo.timer = 4;
  if (state.combo.kills % 8 === 0 && mult < 5) {
    state.combo.mult = Math.min(5, mult + 1);
    state.particles.float(enemy.x, enemy.y - 20, `COMBO x${state.combo.mult}!`, '#ffd166', 20);
  }
  state.stats.highestCombo = Math.max(state.stats.highestCombo, state.combo.mult);
  state.particles.burst(enemy.x, enemy.y, enemy.elite ? 26 : 12, enemy.elite ? '#ffd166' : '#b8a8e8', enemy.elite ? 300 : 220, 0.55, 3);
  state.particles.float(enemy.x, enemy.y - 8, `+${points}`, isCrit ? '#ffd166' : '#ffffff', isCrit ? 18 : 14);
  const shards = def.xp * (enemy.elite ? 3 : 1);
  for (let i = 0; i < shards; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    spawnShard(state, enemy.x + Math.cos(angle) * 10, enemy.y + Math.sin(angle) * 10);
  }
  if (enemy.kind === 'splitter') scatterMotes(state, enemy);
  if (enemy.elite) {
    state.stats.elitesSlain += 1;
    state.hitStop = Math.max(state.hitStop, 0.06);
    state.shake = Math.max(state.shake, 5);
    spawnPickup(state, enemy.x, enemy.y, state.random.pick(['heart', 'magnet', 'shield', 'bomb']));
  } else if (state.random.chance(0.012)) {
    spawnPickup(state, enemy.x, enemy.y, state.random.pick(['heart', 'magnet', 'shield', 'bomb']));
  }
  events |= EVENT_KILL;
  if (enemy.kind === 'brute' || enemy.kind === 'bulwark') events |= EVENT_EXPLODE;
  return events;
}

/** Drop one sunshard into the shard pool. */
export function spawnShard(state, x, y) {
  for (const shard of state.shards) {
    if (shard.active) continue;
    shard.active = true;
    shard.x = x;
    shard.y = y;
    shard.vx = (Math.random() - 0.5) * 90;
    shard.vy = (Math.random() - 0.5) * 90;
    shard.life = 30;
    shard.seed = Math.random() * 10;
    return;
  }
}

/** Move and think every live enemy for one step. */
export function updateEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.spawnT = Math.max(0, enemy.spawnT - dt);
    enemy.orbHitT = Math.max(0, enemy.orbHitT - dt);
    const def = ENEMY[enemy.kind];

    // Wraiths blink in and out of the world: untouchable while phased.
    if (enemy.kind === 'wraith') {
      enemy.phaseT -= dt;
      if (enemy.phaseT <= 0) {
        enemy.phased = !enemy.phased;
        enemy.phaseT = enemy.phased ? 1.1 : 2.2 + Math.random();
        if (enemy.phased) state.particles.burst(enemy.x, enemy.y, 6, '#a89af0', 120, 0.4, 2);
      }
    }

    let targetX = SPIRE.x;
    let targetY = SPIRE.y;
    if (def.target === 'player') {
      targetX = player.x;
      targetY = player.y;
    } else if (def.target === 'range') {
      // Spitters and weavers hold a firing distance from the spire.
      const dx = enemy.x - SPIRE.x;
      const dy = enemy.y - SPIRE.y;
      const distance = Math.hypot(dx, dy) || 1;
      const hold = 300;
      const radial = distance > hold + 40 ? -1 : distance < hold - 40 ? 1 : 0;
      targetX = enemy.x + (dx / distance) * radial * 60 + -dy / distance * 40;
      targetY = enemy.y + (dy / distance) * radial * 60 + dx / distance * 40;
    }
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    // A gentle wobble, so the swarm never marches in straight lines.
    const wobble = Math.sin(state.time * 2.2 + enemy.seed) * 0.35;
    const nx = dx / distance;
    const ny = dy / distance;
    const steerX = nx - ny * wobble;
    const steerY = ny + nx * wobble;
    const steerLength = Math.hypot(steerX, steerY) || 1;
    enemy.vx += ((steerX / steerLength) * enemy.speed - enemy.vx) * Math.min(1, 3 * dt);
    enemy.vy += ((steerY / steerLength) * enemy.speed - enemy.vy) * Math.min(1, 3 * dt);
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.x = Math.max(16, Math.min(FIELD.width - 16, enemy.x));
    enemy.y = Math.max(16, Math.min(FIELD.height - 16, enemy.y));

    // Spitters lob gloom globs at the spire; weavers spin new motes.
    if (enemy.kind === 'spitter') {
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && !enemy.phased) {
        enemy.fireTimer = 2.6 + Math.random() * 0.8;
        fireGlob(state, enemy.x, enemy.y, SPIRE.x, SPIRE.y, 170, 3);
      }
    }
    if (enemy.kind === 'weaver') {
      enemy.weaveT -= dt;
      if (enemy.weaveT <= 0) {
        enemy.weaveT = 5.5;
        const mote = spawnEnemy(state.enemies, 'mote', enemy.x, enemy.y, state.hpScale, false, state.time);
        if (mote !== null) state.particles.burst(enemy.x, enemy.y, 8, '#6ad8c8', 140, 0.4, 2);
      }
    }
  }
}

/** A glob of gloom, arcing toward a target: the spitter's shot. */
export function fireGlob(state, x, y, targetX, targetY, speed, damage) {
  for (const shot of state.enemyShots) {
    if (shot.active) continue;
    const dx = targetX - x;
    const dy = targetY - y;
    const distance = Math.hypot(dx, dy) || 1;
    shot.active = true;
    shot.x = x;
    shot.y = y;
    shot.vx = (dx / distance) * speed;
    shot.vy = (dy / distance) * speed;
    shot.radius = 7;
    shot.damage = damage;
    shot.life = 6;
    return;
  }
}

/** Move enemy shots; the world tests their collisions. */
export function updateEnemyShots(state, dt) {
  for (const shot of state.enemyShots) {
    if (!shot.active) continue;
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (shot.life <= 0 || shot.x < -20 || shot.x > FIELD.width + 20 || shot.y < -20 || shot.y > FIELD.height + 20) {
      shot.active = false;
    }
  }
}

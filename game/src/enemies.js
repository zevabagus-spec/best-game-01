// The creatures of the deep: their pool, their spawning, and how each kind
// swims. Drifters pulse toward the beacon, darts streak in, spitters hold
// their range and fire globs, brutes crawl forward unstoppably, splitters
// burst into motes, stalkers hunt the keeper, and wraiths phase in and out of
// the water itself. Collisions and deaths live in the world; this file only
// moves creatures and lets spitters shoot.

import { BEACON, ENEMY, FIELD } from './config.js';

function blankEnemy() {
  return {
    active: false, kind: 'drifter', id: 0, x: 0, y: 0, vx: 0, vy: 0,
    hp: 1, maxHp: 1, radius: 10, speed: 50, elite: false,
    wobble: 0, fireTimer: 0, phaseTimer: 0, phased: false,
    flash: 0, orbCd: 0, touchCd: 0, knockX: 0, knockY: 0,
  };
}

/** The fixed pool of creatures, allocated once at boot. */
export function createEnemyPool(capacity) {
  const pool = [];
  for (let index = 0; index < capacity; index += 1) pool.push(blankEnemy());
  return pool;
}

/** How many creatures are swimming right now. */
export function countActive(pool) {
  let count = 0;
  for (let index = 0; index < pool.length; index += 1) {
    if (pool[index].active) count += 1;
  }
  return count;
}

/** Wake one creature of a kind at a point; returns it, or null when full. */
export function spawnEnemy(pool, kind, x, y, hpScale, elite, time) {
  const definition = ENEMY[kind];
  for (let index = 0; index < pool.length; index += 1) {
    const enemy = pool[index];
    if (enemy.active) continue;
    enemy.active = true;
    enemy.kind = kind;
    enemy.id = index;
    enemy.x = x;
    enemy.y = y;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.maxHp = Math.round(definition.hp * hpScale * (elite ? 3 : 1));
    enemy.hp = enemy.maxHp;
    enemy.radius = definition.radius * (elite ? 1.35 : 1);
    enemy.speed = definition.speed * (elite ? 0.92 : 1);
    enemy.elite = elite;
    enemy.wobble = time * 2 + index;
    enemy.fireTimer = 1.2 + (index % 5) * 0.3;
    enemy.phaseTimer = 2.2;
    enemy.phased = false;
    enemy.flash = 0;
    enemy.orbCd = 0;
    enemy.touchCd = 0;
    enemy.knockX = 0;
    enemy.knockY = 0;
    return enemy;
  }
  return null;
}

/** A point on a random edge of the field, where creatures rise. */
export function edgeSpawnPoint(random) {
  const side = random.int(4);
  const margin = 24;
  if (side === 0) return { x: random.range(margin, FIELD.width - margin), y: margin };
  if (side === 1) return { x: random.range(margin, FIELD.width - margin), y: FIELD.height - margin };
  if (side === 2) return { x: margin, y: random.range(margin, FIELD.height - margin) };
  return { x: FIELD.width - margin, y: random.range(margin, FIELD.height - margin) };
}

/** What a splitter leaves behind: two motes bursting outward. */
export function burstSplitter(state, enemy) {
  for (let index = 0; index < 2; index += 1) {
    const angle = state.random.range(0, Math.PI * 2);
    const mote = spawnEnemy(state.enemies, 'mote', enemy.x, enemy.y, state.hpScale, false, state.time);
    if (mote !== null) {
      mote.knockX = Math.cos(angle) * 190;
      mote.knockY = Math.sin(angle) * 190;
    }
  }
}

function steerToward(enemy, targetX, targetY, speed, dt) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  enemy.vx = (dx / distance) * speed;
  enemy.vy = (dy / distance) * speed;
}

/** One step of creature movement and spitter fire for the whole pool. */
export function updateEnemies(state, dt) {
  const player = state.player;
  const time = state.time;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (!enemy.active) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.orbCd = Math.max(0, enemy.orbCd - dt);
    enemy.touchCd = Math.max(0, enemy.touchCd - dt);
    const wobble = Math.sin(time * 2.2 + enemy.wobble) * 0.45;

    if (enemy.kind === 'wraith') {
      enemy.phaseTimer -= dt;
      if (enemy.phaseTimer <= 0) {
        enemy.phased = !enemy.phased;
        enemy.phaseTimer = enemy.phased ? 1.4 : 2.2;
      }
    }

    const speed = enemy.speed * (enemy.phased ? 1.4 : 1);
    if (enemy.kind === 'stalker') {
      steerToward(enemy, player.x, player.y, speed, dt);
    } else if (enemy.kind === 'spitter') {
      const dx = BEACON.x - enemy.x;
      const dy = BEACON.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > 300) {
        steerToward(enemy, BEACON.x, BEACON.y, speed, dt);
      } else if (distance < 210) {
        enemy.vx = (-dx / distance) * speed * 0.8;
        enemy.vy = (-dy / distance) * speed * 0.8;
      } else {
        // Hold range and strafe around the beacon.
        enemy.vx = (-dy / distance) * speed * 0.55;
        enemy.vy = (dx / distance) * speed * 0.55;
      }
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = 3.4;
        fireGlob(state, enemy);
      }
    } else {
      steerToward(enemy, BEACON.x, BEACON.y, speed, dt);
    }

    // A sideways wobble, so the swarm never marches in straight lines.
    const sideX = -enemy.vy;
    const sideY = enemy.vx;
    const sideLength = Math.hypot(sideX, sideY) || 1;
    enemy.x += (enemy.vx + (sideX / sideLength) * wobble * 30 + enemy.knockX) * dt;
    enemy.y += (enemy.vy + (sideY / sideLength) * wobble * 30 + enemy.knockY) * dt;
    enemy.knockX *= Math.max(0, 1 - 6 * dt);
    enemy.knockY *= Math.max(0, 1 - 6 * dt);
    enemy.x = Math.max(8, Math.min(FIELD.width - 8, enemy.x));
    enemy.y = Math.max(8, Math.min(FIELD.height - 8, enemy.y));
  }
  separateEnemies(state.enemies);
}

/** A spitter's glob: a slow, arcing shot aimed at the beacon. */
function fireGlob(state, enemy) {
  const glob = state.enemyShots.find((shot) => !shot.active);
  if (glob === undefined) return;
  const dx = BEACON.x - enemy.x;
  const dy = BEACON.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const speed = 155;
  glob.active = true;
  glob.x = enemy.x;
  glob.y = enemy.y;
  glob.vx = (dx / distance) * speed;
  glob.vy = (dy / distance) * speed;
  glob.radius = 7;
  glob.damage = 3;
  glob.life = 6;
  state.particles.mote(enemy.x, enemy.y, '#fb923c', 5, 0.4, 20);
}

/** Push overlapping creatures apart, so the swarm reads as individuals. */
function separateEnemies(pool) {
  for (let first = 0; first < pool.length; first += 1) {
    const a = pool[first];
    if (!a.active) continue;
    for (let second = first + 1; second < pool.length; second += 1) {
      const b = pool[second];
      if (!b.active) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDistance = a.radius + b.radius;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= minDistance * minDistance || distanceSquared === 0) continue;
      const distance = Math.sqrt(distanceSquared);
      const push = (minDistance - distance) * 0.5;
      const nx = dx / distance;
      const ny = dy / distance;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}

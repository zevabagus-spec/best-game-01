// The keeper's arsenal and every projectile in the water: aimed bolts,
// homing wisps, guardian orbitals, nova pulses, drift mines, and the
// creatures' own globs. Damage, deaths, score and drops are settled here, in
// one place, so every weapon behaves the same way when it lands a hit.

import { COMBO, ENEMY, FIELD } from './config.js';
import { EVENT_EXPLODE, EVENT_KILL, EVENT_NOVA, EVENT_SHOOT } from './events.js';
import { burstSplitter } from './enemies.js';

function blankBolt() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 5, damage: 1, pierce: 0, life: 0, crit: false, hits: new Int16Array(8), hitCount: 0 };
}

function blankWisp() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 7, damage: 2, life: 0, target: null };
}

function blankGlob() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 7, damage: 5, life: 0 };
}

function blankMine() {
  return { active: false, x: 0, y: 0, radius: 10, damage: 6, armTimer: 0, life: 0 };
}

export function createBoltPool(capacity) {
  const pool = [];
  for (let index = 0; index < capacity; index += 1) pool.push(blankBolt());
  return pool;
}

export function createWispPool(capacity) {
  const pool = [];
  for (let index = 0; index < capacity; index += 1) pool.push(blankWisp());
  return pool;
}

export function createGlobPool(capacity) {
  const pool = [];
  for (let index = 0; index < capacity; index += 1) pool.push(blankGlob());
  return pool;
}

export function createMinePool(capacity) {
  const pool = [];
  for (let index = 0; index < capacity; index += 1) pool.push(blankMine());
  return pool;
}

/** The combo multiplier from the kill count: +1 every 8 kills, up to x5. */
export function comboMultiplier(comboKills) {
  return Math.min(COMBO.maxMultiplier, 1 + Math.floor(comboKills / COMBO.perStep));
}

function alreadyHit(bolt, id) {
  for (let index = 0; index < bolt.hitCount; index += 1) {
    if (bolt.hits[index] === id) return true;
  }
  return false;
}

function markHit(bolt, id) {
  if (bolt.hitCount < bolt.hits.length) {
    bolt.hits[bolt.hitCount] = id;
    bolt.hitCount += 1;
  }
}

/**
 * Hurt one creature. Settles the flash, the knockback, the floating damage
 * text, and — when it falls — the score, the combo, the drops and the burst.
 * Returns events. Phased wraiths cannot be hurt at all.
 */
export function damageEnemy(state, enemy, amount, crit, knockX, knockY) {
  if (!enemy.active || enemy.phased) return 0;
  let events = 0;
  enemy.hp -= amount;
  enemy.flash = 0.09;
  enemy.knockX += knockX;
  enemy.knockY += knockY;
  state.stats.damageDealt += amount;
  if (crit) {
    state.particles.addText(enemy.x, enemy.y - enemy.radius - 6, `${amount}!`, '#ffd166', 17);
  }
  if (enemy.hp > 0) return events;
  enemy.active = false;
  const definition = ENEMY[enemy.kind];
  state.stats.kills += 1;
  state.combo.kills += 1;
  state.combo.timer = COMBO.window;
  const multiplier = comboMultiplier(state.combo.kills);
  const points = definition.score * (enemy.elite ? 3 : 1) * multiplier;
  state.score += points;
  state.particles.addText(enemy.x, enemy.y - 6, `+${points}`, '#e6f6f2', enemy.elite ? 19 : 14);
  state.particles.burst(enemy.x, enemy.y, '#7dd3fc', enemy.elite ? 26 : 12, enemy.elite ? 240 : 170, 0.55, enemy.elite ? 4 : 3);
  if (enemy.elite) {
    state.stats.elitesSlain += 1;
    state.hitStop = Math.max(state.hitStop, 0.06);
    state.particles.addShake(0.3);
    state.particles.ring(enemy.x, enemy.y, '#ffd166', enemy.radius + 16, 0.5);
  }
  state.dropQueue.push({ x: enemy.x, y: enemy.y, xp: definition.xp * (enemy.elite ? 3 : 1), pickup: enemy.elite ? 'random' : (state.random.chance(0.02) ? 'random' : null) });
  if (enemy.kind === 'splitter') {
    burstSplitter(state, enemy);
    events |= EVENT_EXPLODE;
  }
  return events | EVENT_KILL;
}

/** Hurt the Maw. Its death is the victory; the world watches for it. */
export function damageBoss(state, amount, crit) {
  const boss = state.boss;
  if (boss === null || !boss.active) return 0;
  boss.hp -= amount;
  boss.flash = 0.09;
  state.stats.damageDealt += amount;
  if (crit) {
    state.particles.addText(boss.x, boss.y - boss.radius - 8, `${amount}!`, '#ffd166', 19);
  }
  if (boss.hp <= 0) {
    boss.hp = 0;
    boss.active = false;
    state.particles.burst(boss.x, boss.y, '#e11d48', 60, 320, 1.1, 5);
    state.particles.ring(boss.x, boss.y, '#fde047', boss.radius + 40, 0.9);
    state.particles.addShake(0.8);
    state.hitStop = Math.max(state.hitStop, 0.18);
    return EVENT_KILL | EVENT_EXPLODE;
  }
  return 0;
}

/** Hurt everything within a radius of a point (novas, mines, bombs). */
export function damageAllInRadius(state, x, y, radius, damage) {
  let events = 0;
  const radiusSquared = radius * radius;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (!enemy.active) continue;
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    if (dx * dx + dy * dy > radiusSquared) continue;
    const distance = Math.hypot(dx, dy) || 1;
    events |= damageEnemy(state, enemy, damage, false, (dx / distance) * 160, (dy / distance) * 160);
  }
  const boss = state.boss;
  if (boss !== null && boss.active) {
    const dx = boss.x - x;
    const dy = boss.y - y;
    if (dx * dx + dy * dy <= (radius + boss.radius) * (radius + boss.radius)) {
      events |= damageBoss(state, damage, false);
    }
  }
  return events;
}

/** Where the guardian orbs currently circle, for drawing and collisions. */
export function orbitalPositions(state) {
  const build = state.build;
  const positions = [];
  if (build.orbitals <= 0) return positions;
  const radius = 58;
  const spin = state.time * 2.6;
  for (let index = 0; index < build.orbitals; index += 1) {
    const angle = spin + (index / build.orbitals) * Math.PI * 2;
    positions.push({ x: state.player.x + Math.cos(angle) * radius, y: state.player.y + Math.sin(angle) * radius, radius: 12 });
  }
  return positions;
}

function nearestEnemy(state, fromX, fromY, maxDistance) {
  let best = null;
  let bestDistance = maxDistance * maxDistance;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (!enemy.active || enemy.phased) continue;
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }
  const boss = state.boss;
  if (boss !== null && boss.active) {
    const dx = boss.x - fromX;
    const dy = boss.y - fromY;
    if (dx * dx + dy * dy < bestDistance) best = boss;
  }
  return best;
}

function fireVolley(state, input) {
  const build = state.build;
  const player = state.player;
  const aim = input.aim();
  const baseAngle = Math.atan2(aim.y - player.y, aim.x - player.x);
  const spread = 0.1;
  const count = build.projectiles;
  for (let index = 0; index < count; index += 1) {
    const bolt = state.bolts.find((shot) => !shot.active);
    if (bolt === undefined) return;
    const offset = (index - (count - 1) / 2) * spread;
    const angle = baseAngle + offset;
    const crit = state.random.chance(build.critChance);
    bolt.active = true;
    bolt.x = player.x + Math.cos(angle) * (player.radius + 6);
    bolt.y = player.y + Math.sin(angle) * (player.radius + 6);
    bolt.vx = Math.cos(angle) * build.boltSpeed;
    bolt.vy = Math.sin(angle) * build.boltSpeed;
    bolt.radius = 5;
    bolt.damage = build.damage * (crit ? build.critMult : 1);
    bolt.pierce = build.pierce;
    bolt.life = build.boltRange / build.boltSpeed;
    bolt.crit = crit;
    bolt.hitCount = 0;
    state.stats.shotsFired += 1;
  }
  state.particles.mote(player.x + Math.cos(baseAngle) * 20, player.y + Math.sin(baseAngle) * 20, '#9ef3ff', 3, 0.25, 10);
}

/**
 * The keeper's weapons for one step: the bolt volley while the trigger is
 * held, the orbitals' burning circle, seeking wisps, the nova pulse and
 * drift mines. Returns events.
 */
export function updateWeapons(state, dt, input) {
  const build = state.build;
  const player = state.player;
  let events = 0;

  state.fireTimer -= dt;
  if (input.firing && state.fireTimer <= 0) {
    state.fireTimer = build.fireInterval;
    fireVolley(state, input);
    events |= EVENT_SHOOT;
  }

  if (build.orbitals > 0) {
    for (const orb of orbitalPositions(state)) {
      for (let index = 0; index < state.enemies.length; index += 1) {
        const enemy = state.enemies[index];
        if (!enemy.active || enemy.orbCd > 0) continue;
        const dx = enemy.x - orb.x;
        const dy = enemy.y - orb.y;
        const reach = orb.radius + enemy.radius;
        if (dx * dx + dy * dy <= reach * reach) {
          enemy.orbCd = 0.45;
          events |= damageEnemy(state, enemy, 2, false, dx * 2, dy * 2);
        }
      }
      const boss = state.boss;
      if (boss !== null && boss.active) {
        const dx = boss.x - orb.x;
        const dy = boss.y - orb.y;
        const reach = orb.radius + boss.radius;
        if (dx * dx + dy * dy <= reach * reach && boss.touchCd <= 0) {
          boss.touchCd = 0.45;
          events |= damageBoss(state, 2, false);
        }
      }
    }
  }

  if (build.seekers > 0) {
    state.seekerTimer -= dt;
    if (state.seekerTimer <= 0) {
      state.seekerTimer = Math.max(0.7, 1.5 - build.seekers * 0.18);
      for (let index = 0; index < build.seekers; index += 1) {
        const wisp = state.wisps.find((shot) => !shot.active);
        if (wisp === undefined) break;
        const target = nearestEnemy(state, player.x, player.y, 520);
        if (target === null) break;
        const angle = Math.atan2(target.y - player.y, target.x - player.x) + (index - (build.seekers - 1) / 2) * 0.5;
        wisp.active = true;
        wisp.x = player.x;
        wisp.y = player.y;
        wisp.vx = Math.cos(angle) * 380;
        wisp.vy = Math.sin(angle) * 380;
        wisp.radius = 7;
        wisp.damage = 2;
        wisp.life = 3;
        wisp.target = target;
      }
    }
  }

  if (build.nova > 0) {
    state.novaTimer -= dt;
    if (state.novaTimer <= 0) {
      state.novaTimer = 3.4;
      const radius = 120 + build.nova * 40;
      events |= damageAllInRadius(state, player.x, player.y, radius, 1 + build.nova);
      state.particles.ring(player.x, player.y, '#a5f3fc', radius, 0.5);
      state.particles.addShake(0.15);
      events |= EVENT_NOVA;
    }
  }

  if (build.mines > 0) {
    state.mineTimer -= dt;
    if (state.mineTimer <= 0) {
      state.mineTimer = 2.6;
      let active = 0;
      for (const mine of state.mines) if (mine.active) active += 1;
      if (active < 4 + build.mines * 2) {
        const mine = state.mines.find((slot) => !slot.active);
        if (mine !== undefined) {
          mine.active = true;
          mine.x = player.x;
          mine.y = player.y;
          mine.radius = 10;
          mine.damage = 6;
          mine.armTimer = 0.6;
          mine.life = 14;
        }
      }
    }
  }

  return events;
}

/** Move every projectile one step and settle its collisions. Returns events. */
export function updateProjectiles(state, dt) {
  let events = 0;

  for (let index = 0; index < state.bolts.length; index += 1) {
    const bolt = state.bolts[index];
    if (!bolt.active) continue;
    bolt.life -= dt;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    if (bolt.life <= 0 || bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20) {
      bolt.active = false;
      continue;
    }
    for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
      const enemy = state.enemies[enemyIndex];
      if (!enemy.active || enemy.phased || alreadyHit(bolt, enemy.id)) continue;
      const dx = enemy.x - bolt.x;
      const dy = enemy.y - bolt.y;
      const reach = enemy.radius + bolt.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      markHit(bolt, enemy.id);
      state.stats.shotsHit += 1;
      events |= damageEnemy(state, enemy, bolt.damage, bolt.crit, bolt.vx * 0.06, bolt.vy * 0.06);
      state.particles.burst(bolt.x, bolt.y, '#9ef3ff', 3, 120, 0.25, 2);
      if (bolt.hitCount > bolt.pierce) {
        bolt.active = false;
        break;
      }
    }
    if (!bolt.active) continue;
    const boss = state.boss;
    if (boss !== null && boss.active && !alreadyHit(bolt, -1)) {
      const dx = boss.x - bolt.x;
      const dy = boss.y - bolt.y;
      const reach = boss.radius + bolt.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        markHit(bolt, -1);
        state.stats.shotsHit += 1;
        events |= damageBoss(state, bolt.damage, bolt.crit);
        state.particles.burst(bolt.x, bolt.y, '#9ef3ff', 4, 140, 0.3, 2);
        if (bolt.hitCount > bolt.pierce) bolt.active = false;
      }
    }
  }

  for (let index = 0; index < state.wisps.length; index += 1) {
    const wisp = state.wisps[index];
    if (!wisp.active) continue;
    wisp.life -= dt;
    if (wisp.life <= 0) {
      wisp.active = false;
      continue;
    }
    const target = wisp.target;
    if (target !== null && target.active && !target.phased) {
      const want = Math.atan2(target.y - wisp.y, target.x - wisp.x);
      const have = Math.atan2(wisp.vy, wisp.vx);
      let turn = want - have;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const maxTurn = 6 * dt;
      const heading = have + Math.max(-maxTurn, Math.min(maxTurn, turn));
      const speed = Math.hypot(wisp.vx, wisp.vy);
      wisp.vx = Math.cos(heading) * speed;
      wisp.vy = Math.sin(heading) * speed;
    }
    wisp.x += wisp.vx * dt;
    wisp.y += wisp.vy * dt;
    let struck = false;
    for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
      const enemy = state.enemies[enemyIndex];
      if (!enemy.active || enemy.phased) continue;
      const dx = enemy.x - wisp.x;
      const dy = enemy.y - wisp.y;
      const reach = enemy.radius + wisp.radius;
      if (dx * dx + dy * dy > reach * reach) continue;
      events |= damageEnemy(state, enemy, wisp.damage, false, 0, 0);
      struck = true;
      break;
    }
    const boss = state.boss;
    if (!struck && boss !== null && boss.active) {
      const dx = boss.x - wisp.x;
      const dy = boss.y - wisp.y;
      const reach = boss.radius + wisp.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        events |= damageBoss(state, wisp.damage, false);
        struck = true;
      }
    }
    if (struck) {
      wisp.active = false;
      state.particles.burst(wisp.x, wisp.y, '#c792ff', 5, 130, 0.3, 3);
    }
  }

  for (let index = 0; index < state.enemyShots.length; index += 1) {
    const glob = state.enemyShots[index];
    if (!glob.active) continue;
    glob.life -= dt;
    glob.x += glob.vx * dt;
    glob.y += glob.vy * dt;
    if (glob.life <= 0 || glob.x < -30 || glob.x > FIELD.width + 30 || glob.y < -30 || glob.y > FIELD.height + 30) {
      glob.active = false;
    }
  }

  for (let index = 0; index < state.mines.length; index += 1) {
    const mine = state.mines[index];
    if (!mine.active) continue;
    mine.life -= dt;
    mine.armTimer -= dt;
    if (mine.life <= 0) {
      mine.active = false;
      continue;
    }
    if (mine.armTimer > 0) continue;
    let triggered = false;
    for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
      const enemy = state.enemies[enemyIndex];
      if (!enemy.active) continue;
      const dx = enemy.x - mine.x;
      const dy = enemy.y - mine.y;
      if (dx * dx + dy * dy <= 50 * 50) {
        triggered = true;
        break;
      }
    }
    const boss = state.boss;
    if (!triggered && boss !== null && boss.active) {
      const dx = boss.x - mine.x;
      const dy = boss.y - mine.y;
      if (dx * dx + dy * dy <= (50 + boss.radius) * (50 + boss.radius)) triggered = true;
    }
    if (triggered) {
      mine.active = false;
      events |= damageAllInRadius(state, mine.x, mine.y, 120, mine.damage);
      state.particles.burst(mine.x, mine.y, '#f472b6', 22, 260, 0.5, 4);
      state.particles.ring(mine.x, mine.y, '#f472b6', 110, 0.4);
      state.particles.addShake(0.25);
      events |= EVENT_EXPLODE;
    }
  }

  return events;
}

/** Silence every projectile: used when a run ends or restarts. */
export function clearProjectiles(state) {
  for (const pool of [state.bolts, state.wisps, state.enemyShots, state.mines]) {
    for (const shot of pool) shot.active = false;
  }
}

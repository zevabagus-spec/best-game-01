// The warden's arsenal: sunbolts aimed by the mouse, and the five systems
// the boons unlock — splitting shots, piercing light, orbiting embers,
// seeking wisps, shockwave novas and sky-mines. All of it runs on pooled
// projectiles, so a late run with a full build never allocates.

import { PLAYER } from './config.js';
import { EVENT_EXPLODE, EVENT_HIT, EVENT_NOVA, EVENT_SHOOT } from './events.js';
import { damageBoss } from './bosses.js';
import { damageEnemy } from './enemies.js';

/** A fresh build: every system at level 0, the plain sunbolt alone. */
export function createBuild() {
  return {
    damage: 0, split: 0, pierce: 0, rapid: 0, orbitals: 0, seekers: 0,
    nova: 0, mines: 0, crit: 0, speed: 0, magnet: 0, dash: 0, greed: 0,
  };
}

export function createBoltPool() {
  return Array.from({ length: 220 }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierce: 0, rangeLeft: 0, radius: 5, crit: false,
  }));
}

export function createWispPool() {
  return Array.from({ length: 70 }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, life: 0, radius: 6,
  }));
}

export function createMinePool() {
  return Array.from({ length: 28 }, () => ({
    active: false, x: 0, y: 0, armT: 0, radius: 10,
  }));
}

/** Bolt damage after the damage boons and the Sunbrand relic. */
function boltDamage(state) {
  let damage = PLAYER.boltDamage + state.build.damage;
  if (state.relics.includes('sunbrand')) damage = Math.round(damage * 1.3);
  return damage;
}

/** Whether this shot crits, after the crit boons. */
function rollCrit(state) {
  const chance = PLAYER.critChance + state.build.crit * 0.08;
  return state.random.next() < chance;
}

/** Fire one bolt along an angle, from the warden's staff. */
function fireBolt(state, angle, damage, isCrit) {
  for (const bolt of state.bolts) {
    if (bolt.active) continue;
    const player = state.player;
    bolt.active = true;
    bolt.x = player.x + Math.cos(angle) * 18;
    bolt.y = player.y + Math.sin(angle) * 18;
    bolt.vx = Math.cos(angle) * PLAYER.boltSpeed;
    bolt.vy = Math.sin(angle) * PLAYER.boltSpeed;
    bolt.damage = damage;
    bolt.pierce = state.build.pierce;
    bolt.rangeLeft = PLAYER.boltRange;
    bolt.radius = PLAYER.boltRadius + (isCrit ? 2 : 0);
    bolt.crit = isCrit;
    state.stats.shotsFired += 1;
    return;
  }
}

/** The main volley: one bolt, plus side pairs from the split boon. */
function fireVolley(state, angle) {
  const isCrit = rollCrit(state);
  const damage = boltDamage(state) * (isCrit ? PLAYER.critMult : 1);
  fireBolt(state, angle, damage, isCrit);
  const pairs = Math.min(3, state.build.split);
  for (let pair = 1; pair <= pairs; pair += 1) {
    const spread = pair * 0.16;
    fireBolt(state, angle - spread, damage, isCrit);
    fireBolt(state, angle + spread, damage, isCrit);
  }
}

/** The nearest live foe to a point, boss included, within a range. */
function nearestFoe(state, x, y, maxRange) {
  let best = null;
  let bestDistance = maxRange;
  for (const enemy of state.enemies) {
    if (!enemy.active || enemy.phased) continue;
    const distance = Math.hypot(enemy.x - x, enemy.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }
  const boss = state.boss;
  if (boss !== null && boss.active) {
    const distance = Math.hypot(boss.x - x, boss.y - y);
    if (distance < bestDistance) best = boss;
  }
  return best;
}

/**
 * Where the i-th orbiting ember sits: the renderer draws the embers from
 * this same formula, so what the eye sees is what the collision tests.
 */
export function orbitalPosition(state, index, count) {
  const angle = state.time * 2.6 + (index / count) * Math.PI * 2;
  return {
    x: state.player.x + Math.cos(angle) * 72,
    y: state.player.y + Math.sin(angle) * 72,
  };
}

/** The orbiting embers: positions, and their contact damage. */
function updateOrbitals(state, dt) {
  const count = state.build.orbitals;
  if (count === 0) return 0;
  let events = 0;
  const player = state.player;
  const damage = boltDamage(state);
  for (let i = 0; i < count; i += 1) {
    const { x, y } = orbitalPosition(state, i, count);
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.phased || enemy.orbHitT > 0) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + 12) {
        enemy.orbHitT = 0.5;
        events |= damageEnemy(state, enemy, damage, (enemy.x - player.x) * 2, (enemy.y - player.y) * 2, false);
        state.particles.burst(x, y, 4, '#ffd166', 140, 0.3, 2);
      }
    }
    const boss = state.boss;
    if (boss !== null && boss.active && Math.hypot(boss.x - x, boss.y - y) < boss.radius + 12) {
      if (state.orbBossCd <= 0) {
        state.orbBossCd = 0.5;
        events |= damageBoss(state, damage, 0, 0, false);
      }
    }
  }
  state.orbBossCd = Math.max(0, state.orbBossCd - dt);
  return events;
}

/** Seekers: homing wisps that chase the nearest foe. */
function updateSeekers(state, dt) {
  let events = 0;
  state.seekerTimer -= dt;
  if (state.seekerTimer <= 0 && state.build.seekers > 0) {
    state.seekerTimer = 1.15;
    const target = nearestFoe(state, state.player.x, state.player.y, 620);
    if (target !== null) {
      for (let i = 0; i < Math.min(3, state.build.seekers); i += 1) {
        for (const wisp of state.wisps) {
          if (wisp.active) continue;
          const angle = Math.atan2(target.y - state.player.y, target.x - state.player.x) + (i - 1) * 0.5;
          wisp.active = true;
          wisp.x = state.player.x;
          wisp.y = state.player.y;
          wisp.vx = Math.cos(angle) * 320;
          wisp.vy = Math.sin(angle) * 320;
          wisp.damage = boltDamage(state);
          wisp.life = 3;
          break;
        }
      }
    }
  }
  for (const wisp of state.wisps) {
    if (!wisp.active) continue;
    wisp.life -= dt;
    const target = nearestFoe(state, wisp.x, wisp.y, 700);
    if (target !== null) {
      const angle = Math.atan2(target.y - wisp.y, target.x - wisp.x);
      const current = Math.atan2(wisp.vy, wisp.vx);
      let diff = angle - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-6 * dt, Math.min(6 * dt, diff));
      const speed = Math.min(560, Math.hypot(wisp.vx, wisp.vy) + 260 * dt);
      const next = current + turn;
      wisp.vx = Math.cos(next) * speed;
      wisp.vy = Math.sin(next) * speed;
    }
    wisp.x += wisp.vx * dt;
    wisp.y += wisp.vy * dt;
    if (wisp.life <= 0) {
      wisp.active = false;
      continue;
    }
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.phased) continue;
      if (Math.hypot(enemy.x - wisp.x, enemy.y - wisp.y) < enemy.radius + wisp.radius) {
        wisp.active = false;
        state.stats.shotsHit += 1;
        events |= damageEnemy(state, enemy, wisp.damage, wisp.vx * 0.15, wisp.vy * 0.15, false);
        break;
      }
    }
    if (!wisp.active) continue;
    const boss = state.boss;
    if (boss !== null && boss.active && Math.hypot(boss.x - wisp.x, boss.y - wisp.y) < boss.radius + wisp.radius) {
      wisp.active = false;
      state.stats.shotsHit += 1;
      events |= damageBoss(state, wisp.damage, 0, 0, false);
    }
  }
  return events;
}

/** Novas: a shockwave around the warden, on a timer shortened by the boon. */
function updateNova(state, dt) {
  let events = 0;
  if (state.build.nova === 0) return events;
  state.novaTimer -= dt;
  if (state.novaTimer > 0) return events;
  state.novaTimer = Math.max(2.2, 6 - state.build.nova * 1.1);
  const radius = 130 + state.build.nova * 25;
  const damage = boltDamage(state) + 1;
  const player = state.player;
  state.particles.ring(player.x, player.y, '#fff3c4', radius, 0.4);
  state.particles.burst(player.x, player.y, 20, '#ffd166', 260, 0.4, 3);
  for (const enemy of state.enemies) {
    if (!enemy.active || enemy.phased) continue;
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < radius + enemy.radius) {
      const push = 260;
      events |= damageEnemy(state, enemy, damage, ((enemy.x - player.x) / (distance || 1)) * push, ((enemy.y - player.y) / (distance || 1)) * push, false);
    }
  }
  const boss = state.boss;
  if (boss !== null && boss.active && Math.hypot(boss.x - player.x, boss.y - player.y) < radius + boss.radius) {
    events |= damageBoss(state, damage, 0, 0, false);
  }
  events |= EVENT_NOVA;
  return events;
}

/** Mines: dropped behind the warden, armed, then bursting on contact. */
function updateMines(state, dt) {
  let events = 0;
  state.mineTimer -= dt;
  if (state.mineTimer <= 0 && state.build.mines > 0) {
    state.mineTimer = 2.2;
    const maxMines = 4 + state.build.mines * 2;
    let active = 0;
    for (const mine of state.mines) if (mine.active) active += 1;
    if (active < maxMines) {
      for (const mine of state.mines) {
        if (mine.active) continue;
        mine.active = true;
        mine.x = state.player.x;
        mine.y = state.player.y;
        mine.armT = 0.5;
        break;
      }
    }
  }
  for (const mine of state.mines) {
    if (!mine.active) continue;
    mine.armT -= dt;
    if (mine.armT > 0) continue;
    let trigger = false;
    for (const enemy of state.enemies) {
      if (enemy.active && Math.hypot(enemy.x - mine.x, enemy.y - mine.y) < enemy.radius + 26) {
        trigger = true;
        break;
      }
    }
    const boss = state.boss;
    if (!trigger && boss !== null && boss.active && Math.hypot(boss.x - mine.x, boss.y - mine.y) < boss.radius + 26) trigger = true;
    if (!trigger) continue;
    mine.active = false;
    const damage = boltDamage(state) + 3;
    state.particles.burst(mine.x, mine.y, 22, '#ff7ad8', 320, 0.5, 3);
    state.particles.ring(mine.x, mine.y, '#ff7ad8', 90, 0.35);
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.phased) continue;
      const distance = Math.hypot(enemy.x - mine.x, enemy.y - mine.y);
      if (distance < 95 + enemy.radius) {
        events |= damageEnemy(state, enemy, damage, ((enemy.x - mine.x) / (distance || 1)) * 300, ((enemy.y - mine.y) / (distance || 1)) * 300, false);
      }
    }
    if (boss !== null && boss.active && Math.hypot(boss.x - mine.x, boss.y - mine.y) < 95 + boss.radius) {
      events |= damageBoss(state, damage, 0, 0, false);
    }
    events |= EVENT_EXPLODE;
  }
  return events;
}

/** Fire the held weapon and run every unlocked system for one step. */
export function fireWeapons(state, dt, input) {
  let events = 0;
  const player = state.player;
  player.fireTimer -= dt;
  if (input.firing && player.fireTimer <= 0) {
    const interval = PLAYER.fireInterval * Math.pow(0.88, state.build.rapid);
    player.fireTimer = interval;
    const aim = input.aim();
    const angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    fireVolley(state, angle);
    state.particles.burst(player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20, 2, '#ffe066', 90, 0.18, 2);
    events |= EVENT_SHOOT;
  }
  events |= updateOrbitals(state, dt);
  events |= updateSeekers(state, dt);
  events |= updateNova(state, dt);
  events |= updateMines(state, dt);
  return events;
}

/** Move bolts and test them against every foe; pierce passes through. */
export function updateBolts(state, dt) {
  let events = 0;
  for (const bolt of state.bolts) {
    if (!bolt.active) continue;
    const stepX = bolt.vx * dt;
    const stepY = bolt.vy * dt;
    bolt.x += stepX;
    bolt.y += stepY;
    bolt.rangeLeft -= Math.hypot(stepX, stepY);
    if (bolt.rangeLeft <= 0 || bolt.x < -20 || bolt.x > 1300 || bolt.y < -20 || bolt.y > 740) {
      bolt.active = false;
      continue;
    }
    let consumed = false;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.phased) continue;
      if (Math.hypot(enemy.x - bolt.x, enemy.y - bolt.y) > enemy.radius + bolt.radius) continue;
      state.stats.shotsHit += 1;
      events |= EVENT_HIT;
      events |= damageEnemy(state, enemy, bolt.damage, bolt.vx * 0.08, bolt.vy * 0.08, bolt.crit);
      state.particles.burst(bolt.x, bolt.y, 3, '#ffe066', 120, 0.25, 2);
      if (bolt.pierce > 0) {
        bolt.pierce -= 1;
      } else {
        consumed = true;
      }
      break;
    }
    if (consumed) {
      bolt.active = false;
      continue;
    }
    const boss = state.boss;
    if (boss !== null && boss.active && Math.hypot(boss.x - bolt.x, boss.y - bolt.y) < boss.radius + bolt.radius) {
      state.stats.shotsHit += 1;
      events |= EVENT_HIT;
      events |= damageBoss(state, bolt.damage, 0, 0, bolt.crit);
      state.particles.burst(bolt.x, bolt.y, 4, '#ffe066', 140, 0.25, 2);
      if (bolt.pierce > 0) {
        bolt.pierce -= 1;
      } else {
        bolt.active = false;
      }
    }
  }
  return events;
}

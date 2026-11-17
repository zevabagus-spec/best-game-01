// The three bosses, one per sky: the Herald of Gloom, the Dusk Reaper and
// the Night Sovereign. Each has phases that change its attacks as its health
// falls, a telegraphed charge or burst, and a death worth a relic.

import { ENEMY, FIELD, SPIRE, ZONES } from './config.js';
import { EVENT_BOSS_DOWN, EVENT_EXPLODE, EVENT_KILL, EVENT_ROAR } from './events.js';
import { greedBonus } from './boons.js';
import { fireGlob, spawnEnemy, spawnShard } from './enemies.js';

/** Wake the boss of a zone at the top of the field. */
export function createBoss(state, zoneIndex) {
  const zone = ZONES[zoneIndex];
  const def = ENEMY[zone.boss];
  state.boss = {
    active: true,
    kind: zone.boss,
    name: zone.bossName,
    x: FIELD.width / 2,
    y: 110,
    vx: 0,
    vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed,
    phase: 1,
    attackTimer: 2.2,
    summonTimer: 6,
    chargeTimer: 5,
    charging: 0,
    chargeX: 0,
    chargeY: 0,
    flash: 0,
    spawnT: 1.2,
    seed: state.time,
    ringAngle: 0,
  };
  return state.boss;
}

/** A ring of globs, evenly spaced, from the boss's heart. */
function radialBurst(state, boss, count, speed, damage) {
  for (let i = 0; i < count; i += 1) {
    const angle = boss.ringAngle + (i / count) * Math.PI * 2;
    fireGlob(state, boss.x, boss.y, boss.x + Math.cos(angle) * 100, boss.y + Math.sin(angle) * 100, speed, damage);
  }
  boss.ringAngle += 0.35;
}

/** Summon a few small creatures around the boss. */
function summonMinions(state, boss, kind, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + state.time;
    spawnEnemy(state.enemies, kind, boss.x + Math.cos(angle) * (boss.radius + 26), boss.y + Math.sin(angle) * (boss.radius + 26), state.hpScale, false, state.time);
  }
  state.particles.burst(boss.x, boss.y, 18, '#8a5fd0', 200, 0.5, 3);
}

/** Move the boss and run its attack patterns for one step. */
export function updateBoss(state, dt) {
  const boss = state.boss;
  if (boss === null || !boss.active) return;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.spawnT = Math.max(0, boss.spawnT - dt);
  const player = state.player;
  const def = ENEMY[boss.kind];

  // Phase changes: new patterns, a roar, and a shockwave that clears the air.
  const hpFraction = boss.hp / boss.maxHp;
  const nextPhase = boss.kind === 'sovereign'
    ? hpFraction < 0.33 ? 3 : hpFraction < 0.66 ? 2 : 1
    : hpFraction < 0.5 ? 2 : 1;
  if (nextPhase !== boss.phase) {
    boss.phase = nextPhase;
    boss.attackTimer = 1.2;
    state.particles.ring(boss.x, boss.y, '#ffd166', 190, 0.6);
    state.particles.burst(boss.x, boss.y, 30, '#ffd166', 320, 0.6, 3);
    state.shake = Math.max(state.shake, 8);
    state.hitStop = Math.max(state.hitStop, 0.08);
    state.banner = { text: boss.name, sub: boss.phase === 3 ? 'ENRAGED — the night itself fights' : 'The gloom deepens', timer: 2.2 };
  }

  // Charging: the Reaper and the Sovereign telegraph, then dash at the warden.
  if (boss.charging > 0) {
    boss.charging -= dt;
    boss.x += boss.chargeX * dt;
    boss.y += boss.chargeY * dt;
    boss.x = Math.max(40, Math.min(FIELD.width - 40, boss.x));
    boss.y = Math.max(40, Math.min(FIELD.height - 40, boss.y));
    if (Math.random() < 0.6) state.particles.ember(boss.x, boss.y, '#c94a7a', 3);
    return;
  }

  // Drift: the Herald and Sovereign press the spire; the Reaper hunts.
  const targetX = def.target === 'player' ? player.x : SPIRE.x;
  const targetY = def.target === 'player' ? player.y : SPIRE.y;
  const dx = targetX - boss.x;
  const dy = targetY - boss.y;
  const distance = Math.hypot(dx, dy) || 1;
  const speed = boss.speed * (boss.phase === 3 ? 1.5 : boss.phase === 2 ? 1.25 : 1);
  boss.vx += ((dx / distance) * speed - boss.vx) * Math.min(1, 2 * dt);
  boss.vy += ((dy / distance) * speed - boss.vy) * Math.min(1, 2 * dt);
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  boss.attackTimer -= dt;
  boss.summonTimer -= dt;
  boss.chargeTimer -= dt;

  if (boss.kind === 'herald') {
    if (boss.attackTimer <= 0) {
      boss.attackTimer = boss.phase === 2 ? 2.1 : 2.9;
      radialBurst(state, boss, boss.phase === 2 ? 14 : 10, 150, 4);
    }
    if (boss.summonTimer <= 0) {
      boss.summonTimer = 8;
      summonMinions(state, boss, 'dart', 3);
    }
  } else if (boss.kind === 'reaper') {
    if (boss.attackTimer <= 0) {
      boss.attackTimer = boss.phase === 2 ? 1.7 : 2.4;
      // A spiral: three arms of globs that sweep as the ring turns.
      for (let arm = 0; arm < 3; arm += 1) {
        const angle = boss.ringAngle + (arm / 3) * Math.PI * 2;
        fireGlob(state, boss.x, boss.y, boss.x + Math.cos(angle) * 100, boss.y + Math.sin(angle) * 100, 190, 4);
      }
      boss.ringAngle += 0.55;
    }
    if (boss.chargeTimer <= 0) {
      boss.chargeTimer = boss.phase === 2 ? 4.5 : 6;
      boss.charging = 0.55;
      const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
      boss.chargeX = Math.cos(aim) * 520;
      boss.chargeY = Math.sin(aim) * 520;
      state.particles.ring(boss.x, boss.y, '#ff6b81', 90, 0.35);
    }
  } else {
    // The Sovereign: rings, summons, and — enraged — a ceaseless spiral.
    if (boss.attackTimer <= 0) {
      boss.attackTimer = boss.phase === 3 ? 1.1 : boss.phase === 2 ? 1.8 : 2.6;
      radialBurst(state, boss, boss.phase === 3 ? 18 : boss.phase === 2 ? 14 : 12, boss.phase === 3 ? 200 : 165, 5);
    }
    if (boss.summonTimer <= 0) {
      boss.summonTimer = boss.phase === 3 ? 6 : 8;
      summonMinions(state, boss, boss.phase === 3 ? 'stalker' : 'wisp', 3);
    }
    if (boss.phase >= 2 && boss.chargeTimer <= 0) {
      boss.chargeTimer = 7;
      boss.charging = 0.5;
      const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
      boss.chargeX = Math.cos(aim) * 480;
      boss.chargeY = Math.sin(aim) * 480;
      state.particles.ring(boss.x, boss.y, '#a89af0', 100, 0.35);
    }
  }
}

/**
 * Hurt the boss. Returns event bits. On death: a shower of shards, a burst
 * of light, and the relic choice the run earned.
 */
export function damageBoss(state, damage, knockX, knockY, isCrit) {
  const boss = state.boss;
  let events = 0;
  if (boss === null || !boss.active) return events;
  boss.hp -= damage;
  boss.flash = 0.09;
  boss.vx += knockX * 0.15;
  boss.vy += knockY * 0.15;
  state.stats.damageDealt += damage;
  if (boss.hp > 0) return events;
  boss.active = false;
  const def = ENEMY[boss.kind];
  const greed = state.relics.includes('greed') ? 1.5 : 1;
  const points = Math.round(def.score * state.combo.mult * greedBonus(state) * greed);
  state.score += points;
  state.stats.bossesSlain += 1;
  state.particles.burst(boss.x, boss.y, 60, '#ffd166', 380, 0.8, 4);
  state.particles.burst(boss.x, boss.y, 30, '#ffffff', 260, 0.6, 3);
  state.particles.ring(boss.x, boss.y, '#ffd166', 260, 0.7);
  state.particles.float(boss.x, boss.y - 30, `+${points}`, '#ffd166', 26);
  state.shake = Math.max(state.shake, 10);
  state.hitStop = Math.max(state.hitStop, 0.12);
  for (let i = 0; i < def.xp; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    spawnShard(state, boss.x + Math.cos(angle) * 30, boss.y + Math.sin(angle) * 30);
  }
  events |= EVENT_KILL | EVENT_EXPLODE | EVENT_BOSS_DOWN | EVENT_ROAR;
  return events;
}

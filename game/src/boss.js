// The Maw of the Deep: the final tide's boss, in three phases. It lumbers
// toward the beacon, spits rings of globs, summons creatures, and — once
// wounded — telegraphs a charge at the keeper and spins a spiral of shots.
// Its health bar hangs over the fight; its death is the victory.

import { BEACON, ENEMY, FIELD } from './config.js';
import { EVENT_ROAR } from './events.js';
import { edgeSpawnPoint, spawnEnemy } from './enemies.js';

const PHASE_TWO_AT = 2 / 3;
const PHASE_THREE_AT = 1 / 3;

/** The boss, woken at the top of the field with full health. */
export function createBoss(random) {
  const definition = ENEMY.maw;
  return {
    active: true,
    kind: 'maw',
    x: FIELD.width / 2,
    y: 90,
    vx: 0,
    vy: 0,
    hp: definition.hp,
    maxHp: definition.hp,
    radius: definition.radius,
    speed: definition.speed,
    elite: true,
    phase: 1,
    attackTimer: 2.5,
    summonTimer: 5,
    chargeTimer: 6,
    chargeState: 'idle',
    chargeTime: 0,
    chargeX: 0,
    chargeY: 0,
    flash: 0,
    touchCd: 0,
    wobble: random.range(0, Math.PI * 2),
    announced: false,
  };
}

/** The phase the Maw's remaining health puts it in (1, 2 or 3). */
export function bossPhase(boss) {
  const fraction = boss.hp / boss.maxHp;
  if (fraction <= PHASE_THREE_AT) return 3;
  if (fraction <= PHASE_TWO_AT) return 2;
  return 1;
}

function fireRing(state, boss, count, speed, offset) {
  for (let index = 0; index < count; index += 1) {
    const glob = state.enemyShots.find((shot) => !shot.active);
    if (glob === undefined) return;
    const angle = offset + (index / count) * Math.PI * 2;
    glob.active = true;
    glob.x = boss.x;
    glob.y = boss.y;
    glob.vx = Math.cos(angle) * speed;
    glob.vy = Math.sin(angle) * speed;
    glob.radius = 8;
    glob.damage = 6;
    glob.life = 7;
  }
  state.particles.ring(boss.x, boss.y, '#fb923c', boss.radius + 10, 0.4);
}

function summonEscort(state, boss, count) {
  const bag = ['dart', 'dart', 'stalker', 'wraith'];
  for (let index = 0; index < count; index += 1) {
    const point = edgeSpawnPoint(state.random);
    spawnEnemy(state.enemies, state.random.pick(bag), point.x, point.y, state.hpScale, false, state.time);
  }
  state.particles.burst(boss.x, boss.y, '#e11d48', 18, 160, 0.6, 4);
}

/** One step of the Maw: drift, attacks, summons and charges. Returns events. */
export function updateBoss(state, dt) {
  const boss = state.boss;
  if (boss === null || !boss.active) return 0;
  let events = 0;
  boss.flash = Math.max(0, boss.flash - dt);
  boss.touchCd = Math.max(0, boss.touchCd - dt);
  const nextPhase = bossPhase(boss);
  if (nextPhase !== boss.phase) {
    boss.phase = nextPhase;
    boss.attackTimer = 1.2;
    state.hitStop = Math.max(state.hitStop, 0.12);
    state.particles.ring(boss.x, boss.y, '#e11d48', boss.radius + 30, 0.7);
    state.particles.addText(boss.x, boss.y - boss.radius - 18, boss.phase === 2 ? 'THE MAW STIRS' : 'THE MAW RAGES', '#fda4af', 24);
    events |= EVENT_ROAR;
  }

  if (boss.chargeState === 'telegraph') {
    boss.chargeTime -= dt;
    if (boss.chargeTime <= 0) {
      boss.chargeState = 'charging';
      boss.chargeTime = 0.7;
      const dx = boss.chargeX - boss.x;
      const dy = boss.chargeY - boss.y;
      const distance = Math.hypot(dx, dy) || 1;
      boss.vx = (dx / distance) * 520;
      boss.vy = (dy / distance) * 520;
      state.particles.burst(boss.x, boss.y, '#fda4af', 14, 200, 0.4, 4);
    }
    return events;
  }
  if (boss.chargeState === 'charging') {
    boss.chargeTime -= dt;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    if (boss.chargeTime <= 0 || boss.x < 40 || boss.x > FIELD.width - 40 || boss.y < 40 || boss.y > FIELD.height - 40) {
      boss.chargeState = 'idle';
      boss.vx = 0;
      boss.vy = 0;
      state.particles.addShake(0.35);
    }
    boss.x = Math.max(30, Math.min(FIELD.width - 30, boss.x));
    boss.y = Math.max(30, Math.min(FIELD.height - 30, boss.y));
    return events;
  }

  // Drift toward the beacon with a slow, heavy sway.
  const dx = BEACON.x - boss.x;
  const dy = BEACON.y - boss.y;
  const distance = Math.hypot(dx, dy) || 1;
  const sway = Math.sin(state.time * 0.9 + boss.wobble) * 0.3;
  const speed = boss.speed * (boss.phase === 3 ? 1.5 : boss.phase === 2 ? 1.25 : 1);
  boss.x += ((dx / distance) * speed + -dy / distance * sway * 26) * dt;
  boss.y += ((dy / distance) * speed + dx / distance * sway * 26) * dt;

  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0) {
    if (boss.phase === 1) {
      fireRing(state, boss, 8, 150, state.time);
      boss.attackTimer = 4.0;
    } else if (boss.phase === 2) {
      fireRing(state, boss, 12, 175, state.time * 1.3);
      boss.attackTimer = 3.4;
    } else {
      fireRing(state, boss, 10, 200, state.time * 2.1);
      fireRing(state, boss, 10, 150, state.time * 2.1 + Math.PI / 10);
      boss.attackTimer = 2.8;
    }
  }

  boss.summonTimer -= dt;
  if (boss.summonTimer <= 0) {
    summonEscort(state, boss, boss.phase === 3 ? 3 : 2);
    boss.summonTimer = boss.phase === 3 ? 7 : 9;
  }

  if (boss.phase >= 2) {
    boss.chargeTimer -= dt;
    if (boss.chargeTimer <= 0) {
      boss.chargeState = 'telegraph';
      boss.chargeTime = 0.8;
      boss.chargeX = state.player.x;
      boss.chargeY = state.player.y;
      boss.chargeTimer = boss.phase === 3 ? 7 : 9;
      state.particles.addText(boss.x, boss.y - boss.radius - 18, '!', '#fde047', 30);
    }
  }
  return events;
}

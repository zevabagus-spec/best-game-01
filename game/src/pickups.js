// What the gloom drops: hearts, magnets, shields and bombs — and the relics,
// the run-changing treasures a boss's fall earns. A relic always costs
// something: the choice between three of them is the run's sharpest decision.

import { PICKUP, PLAYER } from './config.js';
import { EVENT_PICKUP, EVENT_SHIELD } from './events.js';
import { damageBoss } from './bosses.js';
import { damageEnemy } from './enemies.js';

export function createPickupPool() {
  return Array.from({ length: 36 }, () => ({
    active: false, kind: 'heart', x: 0, y: 0, life: 0, seed: 0,
  }));
}

export function createShardPool() {
  return Array.from({ length: 240 }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, seed: 0,
  }));
}

/** Drop a pickup of `kind` at (x, y), if a slot is free. */
export function spawnPickup(state, x, y, kind) {
  for (const pickup of state.pickups) {
    if (pickup.active) continue;
    pickup.active = true;
    pickup.kind = kind;
    pickup.x = x;
    pickup.y = y;
    pickup.life = PICKUP[kind].life;
    pickup.seed = Math.random() * 10;
    return;
  }
}

/** The bomb: every foe on the field takes a heavy hit. */
function detonateBomb(state) {
  const player = state.player;
  state.particles.ring(player.x, player.y, '#ff7a3d', 420, 0.6);
  state.particles.burst(player.x, player.y, 40, '#ff7a3d', 420, 0.6, 4);
  state.shake = Math.max(state.shake, 9);
  let events = 0;
  for (const enemy of state.enemies) {
    if (!enemy.active || enemy.phased) continue;
    events |= damageEnemy(state, enemy, 6, 0, 0, false);
  }
  const boss = state.boss;
  if (boss !== null && boss.active) events |= damageBoss(state, 30, 0, 0, false);
  return events;
}

/** Apply a pickup's effect and announce it. Returns event bits. */
function takePickup(state, pickup) {
  const player = state.player;
  let events = EVENT_PICKUP;
  if (pickup.kind === 'heart') {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    state.particles.float(player.x, player.y - 24, '+1 HEART', '#ff6b81', 18);
  } else if (pickup.kind === 'magnet') {
    for (const shard of state.shards) {
      if (!shard.active) continue;
      const angle = Math.atan2(player.y - shard.y, player.x - shard.x);
      shard.vx = Math.cos(angle) * 520;
      shard.vy = Math.sin(angle) * 520;
    }
    state.particles.float(player.x, player.y - 24, 'SHARDS CALL!', '#ffd94d', 18);
  } else if (pickup.kind === 'shield') {
    player.shield = true;
    state.particles.float(player.x, player.y - 24, 'SHIELD UP', '#7db8ff', 18);
    events |= EVENT_SHIELD;
  } else if (pickup.kind === 'bomb') {
    events |= detonateBomb(state);
    state.particles.float(player.x, player.y - 24, 'SKYFIRE!', '#ff7a3d', 20);
  }
  state.stats.pickupsTaken += 1;
  state.particles.burst(pickup.x, pickup.y, 10, '#ffffff', 160, 0.4, 2);
  return events;
}

/** Age pickups and collect the ones the warden touches. */
export function updatePickups(state, dt) {
  let events = 0;
  const player = state.player;
  for (const pickup of state.pickups) {
    if (!pickup.active) continue;
    pickup.life -= dt;
    if (pickup.life <= 0) {
      pickup.active = false;
      continue;
    }
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < PICKUP[pickup.kind].radius + PLAYER.radius + 4) {
      pickup.active = false;
      events |= takePickup(state, pickup);
    }
  }
  return events;
}

/**
 * Relics, by id: each names its gift and its price. Offered three at a time
 * after a boss falls; a relic already held is never offered again.
 */
export const RELICS = {
  sunbrand: { name: 'Sunbrand', gift: '+30% bolt damage', price: '−1 max heart', icon: '☀' },
  swiftwing: { name: 'Swiftwing', gift: '+20% move speed', price: '−10% bolt damage', icon: '➤' },
  greed: { name: 'Greed Sigil', gift: '+50% score', price: 'Foes +10% health', icon: '◆' },
  thornmantle: { name: 'Thornmantle', gift: 'Touching foes take 2 damage', price: '−15% fire rate', icon: '✦' },
  seconddawn: { name: 'Second Dawn', gift: 'Revive once at 1 heart', price: '−20% sunshards', icon: '✚' },
  gloompact: { name: 'Gloom Pact', gift: 'Double sunshards', price: 'Spire −20 max light', icon: '☾' },
};

/** Apply a relic's immediate price or gift; ongoing ones are read live. */
export function takeRelic(state, id) {
  state.relics.push(id);
  state.stats.relicsTaken += 1;
  const player = state.player;
  if (id === 'sunbrand') {
    player.maxHp = Math.max(1, player.maxHp - 1);
    player.hp = Math.min(player.hp, player.maxHp);
  } else if (id === 'gloompact') {
    state.spire.maxHp = Math.max(40, state.spire.maxHp - 20);
    state.spire.hp = Math.min(state.spire.hp, state.spire.maxHp);
  } else if (id === 'greed') {
    state.hpScale *= 1.1;
  }
}

/** Whether the warden may revive, and the revive itself. */
export function tryRevive(state) {
  if (!state.relics.includes('seconddawn') || state.revived) return false;
  state.revived = true;
  state.player.hp = 1;
  state.player.invuln = 2;
  state.particles.ring(state.player.x, state.player.y, '#fff3c4', 200, 0.7);
  state.particles.float(state.player.x, state.player.y - 30, 'SECOND DAWN!', '#ffd166', 24);
  return true;
}

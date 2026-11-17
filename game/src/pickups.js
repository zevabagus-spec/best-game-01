// The things left on the reef floor: lumen shards, the experience the
// keeper gathers to level up, and pickups — hearts, magnets, shields and
// bombs — dropped by elites, the boss and lucky kills. Shards drift, then
// rush to the keeper when close; pickups bob and wait to be gathered.

import { BEACON, PICKUP, XP } from './config.js';
import { EVENT_PICKUP, EVENT_SHARD } from './events.js';

function blankShard() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, value: 1, life: 0 };
}

function blankPickup() {
  return { active: false, kind: 'heart', x: 0, y: 0, life: 0, bob: 0 };
}

export function createShardPool(capacity) {
  const pool = [];
  for (let index = 0; index < capacity; index += 1) pool.push(blankShard());
  return pool;
}

export function createPickupPool(capacity) {
  const pool = [];
  for (let index = 0; index < capacity; index += 1) pool.push(blankPickup());
  return pool;
}

/** Scatter `count` lumen shards around a point. */
export function spawnShards(state, x, y, count) {
  for (let index = 0; index < count; index += 1) {
    const shard = state.shards.find((slot) => !slot.active);
    if (shard === undefined) return;
    const angle = state.random.range(0, Math.PI * 2);
    const speed = state.random.range(40, 150);
    shard.active = true;
    shard.x = x;
    shard.y = y;
    shard.vx = Math.cos(angle) * speed;
    shard.vy = Math.sin(angle) * speed;
    shard.value = 1;
    shard.life = XP.shardLife;
  }
}

/** The experience the next level costs. */
export function xpForLevel(level) {
  return XP.base + XP.perLevel * level;
}

/** Drop one pickup; 'random' rolls a kind, favouring hearts when hurt. */
export function dropPickup(state, x, y, kind) {
  const slot = state.pickups.find((item) => !item.active);
  if (slot === undefined) return;
  let rolled = kind;
  if (rolled === 'random') {
    const bag = ['heart', 'magnet', 'shield', 'bomb', 'heart'];
    if (state.player.hp <= 2) bag.push('heart', 'heart');
    rolled = state.random.pick(bag);
  }
  slot.active = true;
  slot.kind = rolled;
  slot.x = Math.max(20, Math.min(1260, x));
  slot.y = Math.max(20, Math.min(700, y));
  slot.life = PICKUP[rolled].life;
  slot.bob = state.random.range(0, Math.PI * 2);
}

/** Move shards and pickups, gather what the keeper touches. Returns events. */
export function updateGround(state, dt) {
  const player = state.player;
  const build = state.build;
  let events = 0;

  for (let index = 0; index < state.shards.length; index += 1) {
    const shard = state.shards[index];
    if (!shard.active) continue;
    shard.life -= dt;
    if (shard.life <= 0) {
      shard.active = false;
      continue;
    }
    const dx = player.x - shard.x;
    const dy = player.y - shard.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < build.magnet) {
      const pull = 1400 * (1 - distance / (build.magnet + 60));
      shard.vx += (dx / distance) * pull * dt * 4;
      shard.vy += (dy / distance) * pull * dt * 4;
    } else {
      // Lumens drift toward the beacon's light, so none is ever truly lost.
      const bx = BEACON.x - shard.x;
      const by = BEACON.y - shard.y;
      const beaconDistance = Math.hypot(bx, by) || 1;
      shard.vx += (bx / beaconDistance) * 26 * dt;
      shard.vy += (by / beaconDistance) * 26 * dt;
    }
    shard.vx *= Math.max(0, 1 - 3 * dt);
    shard.vy *= Math.max(0, 1 - 3 * dt);
    shard.x += shard.vx * dt;
    shard.y += shard.vy * dt;
    if (distance < XP.collectRadius) {
      shard.active = false;
      state.xp += shard.value * build.xpGain;
      state.particles.mote(player.x, player.y - 10, '#67e8f9', 3, 0.3, 40);
      events |= EVENT_SHARD;
    }
  }

  for (let index = 0; index < state.pickups.length; index += 1) {
    const pickup = state.pickups[index];
    if (!pickup.active) continue;
    pickup.life -= dt;
    pickup.bob += dt * 3;
    if (pickup.life <= 0) {
      pickup.active = false;
      continue;
    }
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const reach = PICKUP[pickup.kind].radius + player.radius + 6;
    if (dx * dx + dy * dy > reach * reach) continue;
    pickup.active = false;
    state.stats.pickupsTaken += 1;
    events |= applyPickup(state, pickup.kind) | EVENT_PICKUP;
  }

  return events;
}

/** What a gathered pickup does. The bomb arms a blast the world sets off. */
function applyPickup(state, kind) {
  const player = state.player;
  if (kind === 'heart') {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    state.particles.addText(player.x, player.y - 24, '+1 HEART', '#fb7185', 16);
    state.particles.burst(player.x, player.y, '#fb7185', 10, 120, 0.5, 3);
    return 0;
  }
  if (kind === 'magnet') {
    let gathered = 0;
    for (const shard of state.shards) {
      if (!shard.active) continue;
      shard.active = false;
      state.xp += shard.value * state.build.xpGain;
      gathered += 1;
    }
    state.particles.addText(player.x, player.y - 24, `+${gathered} LUMENS`, '#facc15', 16);
    state.particles.ring(player.x, player.y, '#facc15', 120, 0.5);
    return 0;
  }
  if (kind === 'shield') {
    player.shield = 3;
    player.shieldTimer = 12;
    state.particles.addText(player.x, player.y - 24, 'WARD UP', '#93c5fd', 16);
    state.particles.ring(player.x, player.y, '#93c5fd', 46, 0.5);
    return 0;
  }
  // Bomb: the world detonates it through damageAllInRadius.
  state.pendingBlast = { x: player.x, y: player.y, radius: 430, damage: 15 };
  state.particles.addText(player.x, player.y - 24, 'DEPTH CHARGE!', '#f97316', 18);
  return 0;
}

/** Clear the reef floor: used when a run ends or restarts. */
export function clearGround(state) {
  for (const shard of state.shards) shard.active = false;
  for (const pickup of state.pickups) pickup.active = false;
}

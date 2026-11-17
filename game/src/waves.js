// The wave director: twelve waves across three skies, the boss at the end
// of each sky, and the sky events — shard rain, meteor strikes and gloom
// fog — that break up the middle waves. Compositions are fixed per wave so
// the difficulty curve is deliberate, not random.

import { FIELD } from './config.js';
import { EVENT_ROAR, EVENT_WAVE_START, EVENT_ZONE } from './events.js';
import { createBoss } from './bosses.js';
import { spawnEnemy, spawnShard } from './enemies.js';

export const TOTAL_WAVES = 12;

/** Which sky a wave belongs to: 0 Dawn, 1 Dusk, 2 Midnight. */
export function zoneOfWave(wave) {
  return wave <= 4 ? 0 : wave <= 8 ? 1 : 2;
}

/** Boss waves close each sky: 4, 8 and 12. */
export function isBossWave(wave) {
  return wave % 4 === 0;
}

/** The fixed composition of a wave: [kind, count] pairs. */
const COMPOSITIONS = {
  1: [['wisp', 10]],
  2: [['wisp', 8], ['dart', 6]],
  3: [['wisp', 8], ['dart', 6], ['spitter', 3]],
  4: [['wisp', 6], ['dart', 4]],
  5: [['dart', 10], ['spitter', 6], ['splitter', 4]],
  6: [['wisp', 8], ['stalker', 8], ['brute', 4]],
  7: [['spitter', 6], ['wraith', 6], ['splitter', 4], ['bulwark', 2]],
  8: [['stalker', 6], ['wraith', 4]],
  9: [['wraith', 10], ['weaver', 6], ['brute', 6]],
  10: [['stalker', 8], ['dart', 8], ['bulwark', 4], ['weaver', 4]],
  11: [['splitter', 10], ['spitter', 8], ['brute', 6], ['bulwark', 2]],
  12: [['wisp', 8], ['stalker', 6]],
};

/** A spawn point on a random edge, just inside the field. */
function edgePoint(random) {
  const side = random.int(0, 3);
  const along = random.range(40, FIELD.width - 40);
  const down = random.range(40, FIELD.height - 40);
  if (side === 0) return { x: along, y: 30 };
  if (side === 1) return { x: along, y: FIELD.height - 30 };
  if (side === 2) return { x: 30, y: down };
  return { x: FIELD.width - 30, y: down };
}

/** Build the spawn queue for a wave: shuffled kinds, grouped by pacing. */
function buildQueue(wave, random) {
  const queue = [];
  for (const [kind, count] of COMPOSITIONS[wave]) {
    for (let i = 0; i < count; i += 1) queue.push(kind);
  }
  const shuffled = random.shuffle(queue);
  const eliteChance = wave >= 11 ? 0.2 : wave >= 5 ? 0.12 : 0;
  return shuffled.map((kind) => ({ kind, elite: random.chance(eliteChance) && kind !== 'mote' }));
}

/**
 * Open a wave: the banner, the boss when one is due, the zone card when the
 * sky changes, and the spawn queue. Returns event bits.
 */
export function startWave(state, wave) {
  let events = EVENT_WAVE_START;
  state.wave = wave;
  state.zone = zoneOfWave(wave);
  state.hpScale = 1 + (wave - 1) * 0.14;
  state.spawnQueue = buildQueue(wave, state.random);
  state.spawnTimer = 0.5;
  state.phase = 'fighting';
  state.killsThisWave = 0;
  state.skyEvent = null;
  state.skyEventRolled = false;
  if (isBossWave(wave)) {
    createBoss(state, state.zone);
    state.banner = { text: state.boss.name, sub: 'The sky darkens — hold the light', timer: 3 };
    events |= EVENT_ROAR;
  } else {
    state.banner = { text: `WAVE ${wave} / ${TOTAL_WAVES}`, sub: '', timer: 2.2 };
  }
  const newZone = zoneOfWave(wave);
  if (wave === 1 || newZone !== zoneOfWave(wave - 1)) {
    state.zoneCard = { timer: 3.2, title: ['THE FIRST DAWN', 'THE VIOLET DUSK', 'THE LONG MIDNIGHT'][newZone] };
    events |= EVENT_ZONE;
  }
  return events;
}

/** Foes still to arrive or alive, boss included. */
export function remainingFoes(state) {
  let count = state.spawnQueue.length;
  for (const enemy of state.enemies) if (enemy.active) count += 1;
  if (state.boss !== null && state.boss.active) count += 1;
  return count;
}

/** Roll one sky event per wave, from wave 3 on, once the fighting is joined. */
function maybeRollEvent(state) {
  if (state.skyEventRolled || state.wave < 3 || isBossWave(state.wave)) return;
  state.skyEventRolled = true;
  if (!state.random.chance(0.45)) return;
  const kind = state.random.pick(['shardrain', 'meteor', 'fog']);
  state.skyEvent = { kind, timer: kind === 'fog' ? 10 : 6, tick: 0 };
  state.banner = {
    text: kind === 'shardrain' ? 'SHARD RAIN' : kind === 'meteor' ? 'METEOR STRIKE' : 'GLOOM FOG',
    sub: kind === 'shardrain' ? 'Sunshards fall from the sky' : kind === 'meteor' ? 'The sky itself fights back' : 'Darkness gathers — hold on for a bonus',
    timer: 2.4,
  };
  if (kind === 'fog') {
    for (let i = 0; i < 6; i += 1) {
      const point = edgePoint(state.random);
      spawnEnemy(state.enemies, 'dart', point.x, point.y, state.hpScale, false, state.time);
    }
  }
}

/** Run the active sky event's effects for one step. */
function updateSkyEvent(state, dt) {
  const event = state.skyEvent;
  if (event === null) return;
  event.timer -= dt;
  event.tick -= dt;
  if (event.kind === 'shardrain' && event.tick <= 0) {
    event.tick = 0.4;
    for (let i = 0; i < 3; i += 1) {
      spawnShard(state, state.random.range(60, FIELD.width - 60), state.random.range(60, FIELD.height - 60));
    }
  } else if (event.kind === 'meteor' && event.tick <= 0) {
    event.tick = 0.9;
    let target = null;
    for (const enemy of state.enemies) {
      if (enemy.active) {
        target = enemy;
        break;
      }
    }
    if (target !== null) {
      state.pendingBooms.push({ x: target.x, y: target.y, timer: 0.4 });
      state.particles.ring(target.x, target.y, '#ff7a3d', 60, 0.4);
    }
  }
  if (event.timer <= 0) {
    if (event.kind === 'fog') {
      state.score += 500;
      state.particles.float(640, 200, '+500 FOG SURVIVED', '#ffd166', 20);
    }
    state.skyEvent = null;
  }
}

/** Trickle the queue into the field, in small groups, from the edges. */
export function updateSpawning(state, dt) {
  maybeRollEvent(state);
  updateSkyEvent(state, dt);
  if (state.spawnQueue.length === 0) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = 0.85;
  const group = Math.min(state.spawnQueue.length, 2 + Math.floor(state.wave / 4));
  for (let i = 0; i < group; i += 1) {
    const next = state.spawnQueue.shift();
    const point = edgePoint(state.random);
    spawnEnemy(state.enemies, next.kind, point.x, point.y, state.hpScale, next.elite, state.time);
  }
}

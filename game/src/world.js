// The game's rules and state, with no drawing and no browser in it: the
// keeper, the beacon, the pools, the tides, the combo and the score. step()
// advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, screens) without the world knowing about them.
// Nothing here allocates after createWorld returns, except the short spawn
// queue and drop queue a tide builds.

import { BEACON, BREATHER_SECONDS, COMBO, DASH, ENEMY, FIELD, PLAYER, POOLS, TIDE_CLEAR_BONUS } from './config.js';
import { EVENT_BEACON_HIT, EVENT_DASH, EVENT_EXPLODE, EVENT_HIT, EVENT_LEVELUP, EVENT_OVER, EVENT_ROAR, EVENT_SHIELD, EVENT_WAVE_CLEAR, EVENT_WAVE_START, EVENT_WIN } from './events.js';
import { createRunStats } from './stats.js';
import { countActive, createEnemyPool, edgeSpawnPoint, spawnEnemy, updateEnemies } from './enemies.js';
import { createBoss, updateBoss } from './boss.js';
import { clearProjectiles, createBoltPool, createGlobPool, createMinePool, createWispPool, damageAllInRadius, updateProjectiles, updateWeapons } from './weapons.js';
import { clearGround, createPickupPool, createShardPool, dropPickup, spawnShards, updateGround, xpForLevel } from './pickups.js';
import { availableUpgrades, createBuild, rollUpgrades, takeUpgrade } from './upgrades.js';
import { TIDES, TOTAL_TIDES, buildEscort, buildSpawnQueue, tideBanner } from './waves.js';

export function createWorld(random, particles) {
  const state = {
    random,
    particles,
    time: 0,
    player: {
      x: FIELD.width / 2, y: FIELD.height - 160,
      radius: PLAYER.radius,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      invulnerable: 0, shield: 0, shieldTimer: 0,
      dashCd: 0, dashTime: 0, dashX: 0, dashY: 0,
      aimX: FIELD.width / 2, aimY: 0,
    },
    beacon: { hp: BEACON.maxHp, maxHp: BEACON.maxHp },
    build: createBuild(PLAYER),
    enemies: createEnemyPool(POOLS.enemies),
    boss: null,
    bolts: createBoltPool(POOLS.bolts),
    wisps: createWispPool(POOLS.wisps),
    enemyShots: createGlobPool(POOLS.globs),
    mines: createMinePool(POOLS.mines),
    shards: createShardPool(POOLS.shards),
    pickups: createPickupPool(POOLS.pickups),
    tide: 0,
    phase: 'attract',
    spawnQueue: [],
    spawnTimer: 0,
    hpScale: 1,
    bossSpawned: false,
    breatherTimer: 0,
    score: 0,
    combo: { kills: 0, timer: 0 },
    xp: 0,
    level: 1,
    xpNext: xpForLevel(1),
    pendingLevels: 0,
    cards: [],
    stats: createRunStats(),
    hitStop: 0,
    banner: { text: '', sub: '', timer: 0 },
    fireTimer: 0,
    seekerTimer: 0,
    novaTimer: 0,
    mineTimer: 0,
    dropQueue: [],
    pendingBlast: null,
    won: false,
    over: false,
  };

  /** Fresh state for a new run; the pools are reused, never rebuilt. */
  function reset() {
    state.time = 0;
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height - 160;
    state.player.hp = PLAYER.maxHp;
    state.player.maxHp = PLAYER.maxHp;
    state.player.invulnerable = 0;
    state.player.shield = 0;
    state.player.shieldTimer = 0;
    state.player.dashCd = 0;
    state.player.dashTime = 0;
    state.player.aimX = FIELD.width / 2;
    state.player.aimY = 0;
    state.beacon.hp = BEACON.maxHp;
    state.beacon.maxHp = BEACON.maxHp;
    state.build = createBuild(PLAYER);
    for (const enemy of state.enemies) enemy.active = false;
    state.boss = null;
    clearProjectiles(state);
    clearGround(state);
    state.tide = 0;
    state.phase = 'attract';
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.hpScale = 1;
    state.bossSpawned = false;
    state.breatherTimer = 0;
    state.score = 0;
    state.combo.kills = 0;
    state.combo.timer = 0;
    state.xp = 0;
    state.level = 1;
    state.xpNext = xpForLevel(1);
    state.pendingLevels = 0;
    state.cards = [];
    state.stats = createRunStats();
    state.stats.lowestKeeperHp = PLAYER.maxHp;
    state.stats.lowestBeaconHp = BEACON.maxHp;
    state.hitStop = 0;
    state.banner.text = '';
    state.banner.sub = '';
    state.banner.timer = 0;
    state.fireTimer = 0;
    state.seekerTimer = 0;
    state.novaTimer = 0;
    state.mineTimer = 0;
    state.dropQueue.length = 0;
    state.pendingBlast = null;
    state.won = false;
    state.over = false;
  }

  /** The title screen's living background: drifters wandering the reef. */
  function seedAttract() {
    for (let index = 0; index < 9; index += 1) {
      const x = random.range(80, FIELD.width - 80);
      const y = random.range(80, FIELD.height - 80);
      const kind = index % 3 === 0 ? 'dart' : 'drifter';
      spawnEnemy(state.enemies, kind, x, y, 1, false, state.time);
    }
  }

  /** Begin a tide: its queue, its banner, and the Maw on the last one. */
  function startWave(tide) {
    const definition = TIDES[tide - 1];
    state.tide = tide;
    state.hpScale = definition.hpScale;
    state.phase = 'fighting';
    state.banner.text = tideBanner(tide);
    state.banner.sub = tide === TOTAL_TIDES ? 'Hold the light. End the Maw.' : `Tide ${tide} of ${TOTAL_TIDES}`;
    state.banner.timer = 2.4;
    if (definition.boss) {
      state.boss = createBoss(random);
      state.bossSpawned = true;
      state.spawnQueue = buildEscort(random, definition.escort);
      state.spawnTimer = 1.5;
      return EVENT_WAVE_START | EVENT_ROAR;
    }
    state.spawnQueue = buildSpawnQueue(tide, random);
    state.spawnTimer = 0.8;
    return EVENT_WAVE_START;
  }

  /** Hurt the keeper: the ward absorbs a blow first, then a heart is lost. */
  function damagePlayer(amount) {
    const player = state.player;
    if (player.invulnerable > 0 || player.dashTime > 0) return 0;
    if (player.shield > 0) {
      player.shield -= 1;
      player.invulnerable = 0.5;
      particles.ring(player.x, player.y, '#93c5fd', 34, 0.4);
      return EVENT_SHIELD;
    }
    player.hp -= amount;
    player.invulnerable = PLAYER.invulnerable;
    particles.burst(player.x, player.y, '#5eead4', 16, 200, 0.5, 3);
    particles.addShake(0.4);
    state.stats.lowestKeeperHp = Math.min(state.stats.lowestKeeperHp, player.hp);
    return EVENT_HIT;
  }

  /** Hurt the beacon: the light dims, and the reef shakes. */
  function damageBeacon(amount) {
    state.beacon.hp -= amount;
    particles.burst(BEACON.x, BEACON.y, '#7de8ff', 14, 180, 0.5, 3);
    particles.addShake(0.35);
    state.stats.lowestBeaconHp = Math.min(state.stats.lowestBeaconHp, state.beacon.hp);
    return EVENT_BEACON_HIT;
  }

  /** Settle every touch: creatures, the boss and globs against keeper and beacon. */
  function collide(dt) {
    let events = 0;
    const player = state.player;
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (!enemy.active) continue;
      const definition = ENEMY[enemy.kind];
      const dxPlayer = enemy.x - player.x;
      const dyPlayer = enemy.y - player.y;
      const reachPlayer = enemy.radius + PLAYER.radius;
      if (dxPlayer * dxPlayer + dyPlayer * dyPlayer <= reachPlayer * reachPlayer && enemy.touchCd <= 0) {
        enemy.touchCd = 0.8;
        events |= damagePlayer(definition.touchDamage);
        const distance = Math.hypot(dxPlayer, dyPlayer) || 1;
        enemy.knockX += (dxPlayer / distance) * 220;
        enemy.knockY += (dyPlayer / distance) * 220;
      }
      const dxBeacon = enemy.x - BEACON.x;
      const dyBeacon = enemy.y - BEACON.y;
      const reachBeacon = enemy.radius + BEACON.radius;
      if (dxBeacon * dxBeacon + dyBeacon * dyBeacon <= reachBeacon * reachBeacon) {
        enemy.active = false;
        events |= damageBeacon(definition.beaconDamage);
        particles.burst(enemy.x, enemy.y, '#e11d48', 12, 170, 0.5, 3);
      }
    }

    const boss = state.boss;
    if (boss !== null && boss.active) {
      const dxPlayer = boss.x - player.x;
      const dyPlayer = boss.y - player.y;
      const reachPlayer = boss.radius + PLAYER.radius;
      if (dxPlayer * dxPlayer + dyPlayer * dyPlayer <= reachPlayer * reachPlayer && boss.touchCd <= 0) {
        boss.touchCd = 0.8;
        events |= damagePlayer(ENEMY.maw.touchDamage);
      }
      const dxBeacon = boss.x - BEACON.x;
      const dyBeacon = boss.y - BEACON.y;
      const reachBeacon = boss.radius + BEACON.radius;
      if (dxBeacon * dxBeacon + dyBeacon * dyBeacon <= reachBeacon * reachBeacon && boss.touchCd <= 0) {
        boss.touchCd = 1.2;
        events |= damageBeacon(ENEMY.maw.beaconDamage);
        // The Maw recoils from the beacon's heart-light instead of chewing it down.
        boss.x = FIELD.width / 2;
        boss.y = 90;
        boss.chargeState = 'idle';
        particles.ring(BEACON.x, BEACON.y, '#7de8ff', 90, 0.6);
      }
    }

    for (let index = 0; index < state.enemyShots.length; index += 1) {
      const glob = state.enemyShots[index];
      if (!glob.active) continue;
      const dxPlayer = glob.x - player.x;
      const dyPlayer = glob.y - player.y;
      const reachPlayer = glob.radius + PLAYER.radius;
      if (dxPlayer * dxPlayer + dyPlayer * dyPlayer <= reachPlayer * reachPlayer) {
        glob.active = false;
        events |= damagePlayer(1);
        continue;
      }
      const dxBeacon = glob.x - BEACON.x;
      const dyBeacon = glob.y - BEACON.y;
      const reachBeacon = glob.radius + BEACON.radius;
      if (dxBeacon * dxBeacon + dyBeacon * dyBeacon <= reachBeacon * reachBeacon) {
        glob.active = false;
        events |= damageBeacon(glob.damage);
      }
    }
    return events;
  }

  /** Drain the drop queue: shards scatter, pickups land. */
  function settleDrops() {
    for (const drop of state.dropQueue) {
      spawnShards(state, drop.x, drop.y, drop.xp);
      if (drop.pickup !== null) dropPickup(state, drop.x, drop.y, drop.pickup);
    }
    state.dropQueue.length = 0;
  }

  /** Move the keeper: swim, dash, and count down every timer that guards her. */
  function movePlayer(dt, input) {
    const player = state.player;
    const build = state.build;
    const aim = input.aim();
    player.aimX = aim.x;
    player.aimY = aim.y;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    if (player.shieldTimer > 0) {
      player.shieldTimer -= dt;
      if (player.shieldTimer <= 0) player.shield = 0;
    }
    let events = 0;
    if (input.takeDash() && player.dashCd <= 0 && player.dashTime <= 0) {
      const move = input.move();
      let dirX = move.x;
      let dirY = move.y;
      if (dirX === 0 && dirY === 0) {
        const dx = aim.x - player.x;
        const dy = aim.y - player.y;
        const distance = Math.hypot(dx, dy) || 1;
        dirX = dx / distance;
        dirY = dy / distance;
      }
      player.dashX = dirX;
      player.dashY = dirY;
      player.dashTime = DASH.time;
      player.dashCd = build.dashCooldown;
      state.stats.dashesUsed += 1;
      particles.burst(player.x, player.y, '#5eead4', 8, 140, 0.3, 3);
      events |= EVENT_DASH;
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.x += player.dashX * DASH.speed * dt;
      player.y += player.dashY * DASH.speed * dt;
      particles.mote(player.x, player.y, '#5eead4', 3, 0.3, 10);
    } else {
      const move = input.move();
      player.x += move.x * build.speed * dt;
      player.y += move.y * build.speed * dt;
    }
    player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x));
    player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y));
    return events;
  }

  /** One fixed step of the fighting game. Returns events. */
  function step(dt, input) {
    if (state.phase === 'levelup' || state.phase === 'done') return 0;
    let events = 0;
    state.time += dt;
    state.stats.timePlayed += dt;
    state.banner.timer = Math.max(0, state.banner.timer - dt);
    if (state.combo.timer > 0) {
      state.combo.timer -= dt;
      if (state.combo.timer <= 0) state.combo.kills = 0;
    }

    if (state.phase === 'breather') {
      state.breatherTimer -= dt;
      events |= movePlayer(dt, input);
      events |= updateGround(state, dt);
      settleDrops();
      if (state.breatherTimer <= 0) {
        events |= startWave(state.tide + 1);
      }
      return events;
    }

    events |= movePlayer(dt, input);

    // The tide rises: one creature per interval, from a random edge.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = TIDES[state.tide - 1].interval;
        const next = state.spawnQueue.shift();
        const point = edgeSpawnPoint(random);
        spawnEnemy(state.enemies, next.kind, point.x, point.y, state.hpScale, next.elite, state.time);
      }
    }

    updateEnemies(state, dt);
    events |= updateBoss(state, dt);
    events |= updateWeapons(state, dt, input);
    events |= updateProjectiles(state, dt);
    events |= updateGround(state, dt);
    settleDrops();

    if (state.pendingBlast !== null) {
      const blast = state.pendingBlast;
      state.pendingBlast = null;
      events |= damageAllInRadius(state, blast.x, blast.y, blast.radius, blast.damage);
      particles.ring(blast.x, blast.y, '#f97316', blast.radius, 0.6);
      particles.burst(blast.x, blast.y, '#fdba74', 30, 300, 0.6, 4);
      particles.addShake(0.5);
      events |= EVENT_EXPLODE;
    }

    events |= collide(dt);

    // Level-ups queue: each one stops the fight for a choice of three.
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = xpForLevel(state.level);
      state.pendingLevels += 1;
      state.stats.levelsGained += 1;
    }
    if (state.pendingLevels > 0 && state.phase === 'fighting') {
      if (availableUpgrades(state.build).length === 0) {
        state.pendingLevels = 0;
        state.score += 500;
      } else {
        state.cards = rollUpgrades(state.build, random, 3);
        state.phase = 'levelup';
        particles.ring(state.player.x, state.player.y, '#7de8ff', 80, 0.7);
        events |= EVENT_LEVELUP;
      }
    }

    // The Maw's fall is the victory; the reef is cleared in celebration.
    if (state.tide === TOTAL_TIDES && state.bossSpawned && state.boss !== null && !state.boss.active && !state.won) {
      for (const enemy of state.enemies) {
        if (!enemy.active) continue;
        enemy.active = false;
        particles.burst(enemy.x, enemy.y, '#7dd3fc', 8, 150, 0.5, 3);
      }
      clearProjectiles(state);
      state.won = true;
      state.phase = 'done';
      state.score += state.beacon.hp * 10 + state.level * 50 + ENEMY.maw.score;
      events |= EVENT_WIN;
      return events;
    }

    // A tide is cleared when nothing is left to rise and nothing swims.
    if (state.phase === 'fighting' && state.tide < TOTAL_TIDES && state.spawnQueue.length === 0 && countActive(state.enemies) === 0) {
      state.score += TIDE_CLEAR_BONUS * state.tide;
      state.phase = 'breather';
      state.breatherTimer = BREATHER_SECONDS;
      state.banner.text = `TIDE ${state.tide} CLEARED`;
      state.banner.sub = `+${TIDE_CLEAR_BONUS * state.tide} — the water calms`;
      state.banner.timer = 2.2;
      state.beacon.hp = Math.min(state.beacon.maxHp, state.beacon.hp + 10);
      events |= EVENT_WAVE_CLEAR;
    }

    if (!state.won && (state.beacon.hp <= 0 || state.player.hp <= 0)) {
      state.beacon.hp = Math.max(0, state.beacon.hp);
      state.player.hp = Math.max(0, state.player.hp);
      state.over = true;
      state.phase = 'done';
      events |= EVENT_OVER;
    }
    return events;
  }

  /** The title screen's water: drifters wander, nothing fights. */
  function stepAttract(dt) {
    state.time += dt;
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (!enemy.active) continue;
      const angle = state.time * 0.25 + enemy.wobble;
      enemy.x += Math.cos(angle) * 26 * dt;
      enemy.y += Math.sin(angle * 0.7) * 20 * dt;
      if (enemy.x < 20) enemy.x = FIELD.width - 20;
      if (enemy.x > FIELD.width - 20) enemy.x = 20;
      if (enemy.y < 20) enemy.y = FIELD.height - 20;
      if (enemy.y > FIELD.height - 20) enemy.y = 20;
    }
  }

  /** Take one of the offered cards; more queued levels roll again. */
  function chooseUpgrade(index) {
    if (state.phase !== 'levelup' || index < 0 || index >= state.cards.length) return false;
    const card = state.cards[index];
    takeUpgrade(state.build, card, state);
    state.pendingLevels -= 1;
    if (state.pendingLevels > 0 && availableUpgrades(state.build).length > 0) {
      state.cards = rollUpgrades(state.build, random, 3);
    } else {
      state.pendingLevels = 0;
      state.cards = [];
      state.phase = 'fighting';
    }
    return true;
  }

  /** Foes still to face this tide: queued, swimming, and the Maw. */
  function remainingFoes() {
    let count = state.spawnQueue.length + countActive(state.enemies);
    if (state.boss !== null && state.boss.active) count += 1;
    return count;
  }

  reset();
  return { state, reset, seedAttract, startWave, step, stepAttract, chooseUpgrade, remainingFoes };
}

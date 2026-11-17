// The world: the run's state, the fixed step, and every collision. The
// step moves the warden, fires the arsenal, thinks the gloom, resolves
// touches and shots, gathers shards, and turns the wave crank — then reports
// what happened as event bits for sound and screens.

import { BREATHER_SECONDS, DASH, ENEMY, FIELD, PLAYER, SPIRE, WAVE_CLEAR_BONUS, XP } from './config.js';
import {
  EVENT_DASH, EVENT_HIT, EVENT_LEVELUP, EVENT_OVER, EVENT_RELIC, EVENT_SHARD, EVENT_SHIELD, EVENT_SPIRE_HIT, EVENT_WAVE_CLEAR, EVENT_WIN,
} from './events.js';
import { createStats } from './stats.js';
import { createBuild, createBoltPool, createMinePool, createWispPool, fireWeapons, updateBolts } from './weapons.js';
import { countActive, createEnemyPool, damageEnemy, spawnEnemy, updateEnemies, updateEnemyShots } from './enemies.js';
import { updateBoss } from './bosses.js';
import { RELICS, createPickupPool, createShardPool, takeRelic, tryRevive, updatePickups } from './pickups.js';
import { drawBoons, greedBonus, takeBoon } from './boons.js';
import { TOTAL_WAVES, isBossWave, remainingFoes, startWave as openWave, updateSpawning } from './waves.js';

function createShotPool() {
  return Array.from({ length: 180 }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 7, damage: 3, life: 0,
  }));
}

export function createWorld(random, particles) {
  const state = {
    time: 0,
    random,
    particles,
    phase: 'fighting',
    wave: 0,
    zone: 0,
    hpScale: 1,
    score: 0,
    level: 1,
    xp: 0,
    xpNeed: XP.base + XP.perLevel,
    player: null,
    spire: null,
    build: null,
    relics: [],
    revived: false,
    enemies: createEnemyPool(),
    boss: null,
    bolts: createBoltPool(),
    wisps: createWispPool(),
    mines: createMinePool(),
    enemyShots: createShotPool(),
    shards: createShardPool(),
    pickups: createPickupPool(),
    combo: { kills: 0, mult: 1, timer: 0 },
    banner: null,
    zoneCard: null,
    shake: 0,
    hitStop: 0,
    stats: createStats(),
    spawnQueue: [],
    spawnTimer: 0,
    skyEvent: null,
    skyEventRolled: false,
    pendingBooms: [],
    seekerTimer: 0,
    novaTimer: 0,
    mineTimer: 0,
    orbBossCd: 0,
    breather: 0,
    pendingLevels: 0,
    cards: [],
    relicCards: [],
    over: false,
    won: false,
    killsThisWave: 0,
  };

  function freshPlayer() {
    return {
      x: SPIRE.x + 150, y: SPIRE.y + 90, vx: 0, vy: 0,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      fireTimer: 0, dashTime: 0, dashCd: 0, dashDirX: 1, dashDirY: 0,
      invuln: 0, shield: false, trail: [],
    };
  }

  function clearPools() {
    for (const pool of [state.enemies, state.bolts, state.wisps, state.mines, state.enemyShots, state.shards, state.pickups]) {
      for (const item of pool) item.active = false;
    }
  }

  function reset() {
    state.time = 0;
    state.phase = 'fighting';
    state.wave = 0;
    state.zone = 0;
    state.hpScale = 1;
    state.score = 0;
    state.level = 1;
    state.xp = 0;
    state.xpNeed = XP.base + XP.perLevel;
    state.player = freshPlayer();
    state.spire = { hp: SPIRE.maxHp, maxHp: SPIRE.maxHp };
    state.build = createBuild();
    state.relics = [];
    state.revived = false;
    state.boss = null;
    state.combo = { kills: 0, mult: 1, timer: 0 };
    state.banner = null;
    state.zoneCard = null;
    state.shake = 0;
    state.hitStop = 0;
    state.stats = createStats();
    state.stats.lowestSpireHp = SPIRE.maxHp;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.skyEvent = null;
    state.skyEventRolled = false;
    state.pendingBooms = [];
    state.seekerTimer = 0;
    state.novaTimer = 0;
    state.mineTimer = 0;
    state.orbBossCd = 0;
    state.breather = 0;
    state.pendingLevels = 0;
    state.cards = [];
    state.relicCards = [];
    state.over = false;
    state.won = false;
    state.killsThisWave = 0;
    clearPools();
    particles.clear();
  }

  function startWave(wave) {
    return openWave(state, wave);
  }

  /** Offer three relics the run does not already hold. */
  function drawRelics() {
    const held = new Set(state.relics);
    const ids = Object.keys(RELICS).filter((id) => !held.has(id));
    return state.random.shuffle(ids).slice(0, 3);
  }

  /** Take a draft card: apply the boon, or deal again when levels queue. */
  function chooseUpgrade(index) {
    if (state.phase !== 'levelup' || index < 0 || index >= state.cards.length) return false;
    takeBoon(state, state.cards[index]);
    state.pendingLevels -= 1;
    if (state.pendingLevels > 0) {
      state.cards = drawBoons(state);
    } else {
      state.phase = 'fighting';
      state.cards = [];
    }
    return true;
  }

  /** Take a relic card, then a short breather before the next wave. */
  function chooseRelic(index) {
    if (state.phase !== 'relic' || index < 0 || index >= state.relicCards.length) return false;
    takeRelic(state, state.relicCards[index]);
    state.relicCards = [];
    state.phase = 'breather';
    state.breather = 2;
    return true;
  }

  /** Hurt the warden: shield, invulnerability, thorns and revival in turn. */
  function hurtPlayer(damage, fromX, fromY) {
    const player = state.player;
    if (player.invuln > 0 || player.dashTime > 0) return 0;
    if (player.shield) {
      player.shield = false;
      player.invuln = 0.8;
      particles.ring(player.x, player.y, '#7db8ff', 60, 0.35);
      return EVENT_SHIELD;
    }
    player.hp -= damage;
    player.invuln = PLAYER.invulnerable;
    const angle = Math.atan2(player.y - fromY, player.x - fromX);
    player.vx += Math.cos(angle) * 320;
    player.vy += Math.sin(angle) * 320;
    particles.burst(player.x, player.y, 14, '#ff6b81', 240, 0.5, 3);
    state.shake = Math.max(state.shake, 6);
    state.stats.lowestWardenHp = Math.min(state.stats.lowestWardenHp, player.hp);
    if (player.hp <= 0 && tryRevive(state)) return EVENT_HIT;
    return EVENT_HIT;
  }

  /** Hurt the spire; the run ends when its light runs out. */
  function hurtSpire(damage, x, y) {
    state.spire.hp -= damage;
    state.stats.lowestSpireHp = Math.min(state.stats.lowestSpireHp, state.spire.hp);
    particles.burst(x, y, 12, '#ffd166', 200, 0.5, 3);
    state.shake = Math.max(state.shake, 5);
    return EVENT_SPIRE_HIT;
  }

  function endRun(won) {
    state.phase = 'done';
    state.over = !won;
    state.won = won;
    return won ? EVENT_WIN : EVENT_OVER;
  }

  /** Move the warden: keys, dash, and the trail it leaves behind. Returns event bits. */
  function movePlayer(dt, input) {
    let events = 0;
    const player = state.player;
    player.invuln = Math.max(0, player.invuln - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    let speed = PLAYER.speed * (1 + state.build.speed * 0.1);
    if (state.relics.includes('swiftwing')) speed *= 1.2;
    const move = input.move();
    if (input.takeDash() && player.dashCd <= 0 && player.dashTime <= 0) {
      const aim = input.aim();
      const dashX = move.x !== 0 || move.y !== 0 ? move.x : aim.x - player.x;
      const dashY = move.x !== 0 || move.y !== 0 ? move.y : aim.y - player.y;
      const length = Math.hypot(dashX, dashY) || 1;
      player.dashDirX = dashX / length;
      player.dashDirY = dashY / length;
      player.dashTime = DASH.time;
      player.dashCd = DASH.cooldown * Math.pow(0.8, state.build.dash);
      state.stats.dashesUsed += 1;
      particles.burst(player.x, player.y, 8, '#fff3c4', 180, 0.3, 2);
      events |= EVENT_DASH;
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.dashDirX * DASH.speed;
      player.vy = player.dashDirY * DASH.speed;
      player.trail.push({ x: player.x, y: player.y, life: 0.25 });
    } else {
      const targetX = move.x * speed;
      const targetY = move.y * speed;
      player.vx += (targetX - player.vx) * Math.min(1, 14 * dt);
      player.vy += (targetY - player.vy) * Math.min(1, 14 * dt);
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(20, Math.min(FIELD.width - 20, player.x));
    player.y = Math.max(20, Math.min(FIELD.height - 20, player.y));
    for (let i = player.trail.length - 1; i >= 0; i -= 1) {
      player.trail[i].life -= dt;
      if (player.trail[i].life <= 0) player.trail.splice(i, 1);
    }
    return events;
  }

  /** Shards drift, answer the magnet, and level the warden up. */
  function updateShards(dt) {
    let events = 0;
    const player = state.player;
    const magnet = PLAYER.magnet * (1 + state.build.magnet * 0.4);
    for (const shard of state.shards) {
      if (!shard.active) continue;
      shard.life -= dt;
      if (shard.life <= 0) {
        shard.active = false;
        continue;
      }
      const dx = player.x - shard.x;
      const dy = player.y - shard.y;
      const distance = Math.hypot(dx, dy);
      if (distance < magnet) {
        const pull = 900 * (1 - distance / (magnet + 1)) + 260;
        shard.vx += (dx / (distance || 1)) * pull * dt * 4;
        shard.vy += (dy / (distance || 1)) * pull * dt * 4;
      }
      shard.vx *= Math.max(0, 1 - 3 * dt);
      shard.vy *= Math.max(0, 1 - 3 * dt);
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (distance < XP.collectRadius) {
        shard.active = false;
        state.stats.shardsGathered += 1;
        let gain = 1;
        if (state.relics.includes('gloompact')) gain = 2;
        if (state.relics.includes('seconddawn')) gain *= 0.8;
        state.xp += gain;
        particles.burst(shard.x, shard.y, 3, '#ffd94d', 90, 0.3, 2);
        events |= EVENT_SHARD;
        while (state.xp >= state.xpNeed) {
          state.xp -= state.xpNeed;
          state.level += 1;
          state.stats.levelsGained += 1;
          state.xpNeed = XP.base + XP.perLevel * state.level;
          state.pendingLevels += 1;
        }
      }
    }
    return events;
  }

  /** Every touch: foes on the warden, foes on the spire, shots on both. */
  function resolveTouches() {
    let events = 0;
    const player = state.player;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.spawnT > 0) continue;
      const def = ENEMY[enemy.kind];
      const toPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (toPlayer < enemy.radius + PLAYER.radius) {
        if (state.relics.includes('thornmantle')) {
          events |= damageEnemy(state, enemy, 2, 0, 0, false);
        }
        events |= hurtPlayer(def.touchDamage, enemy.x, enemy.y);
        if (state.player.hp <= 0) return events;
      }
      const toSpire = Math.hypot(enemy.x - SPIRE.x, enemy.y - SPIRE.y);
      if (toSpire < enemy.radius + SPIRE.radius) {
        enemy.active = false;
        events |= hurtSpire(def.spireDamage * (enemy.elite ? 2 : 1), enemy.x, enemy.y);
        particles.burst(enemy.x, enemy.y, 10, '#b8a8e8', 180, 0.4, 3);
        if (state.spire.hp <= 0) return events;
      }
    }
    const boss = state.boss;
    if (boss !== null && boss.active && boss.spawnT <= 0) {
      const def = ENEMY[boss.kind];
      if (Math.hypot(boss.x - player.x, boss.y - player.y) < boss.radius + PLAYER.radius) {
        events |= hurtPlayer(def.touchDamage, boss.x, boss.y);
      }
      if (Math.hypot(boss.x - SPIRE.x, boss.y - SPIRE.y) < boss.radius + SPIRE.radius) {
        events |= hurtSpire(def.spireDamage, boss.x, boss.y);
        const angle = Math.atan2(boss.y - SPIRE.y, boss.x - SPIRE.x);
        boss.x = SPIRE.x + Math.cos(angle) * (boss.radius + SPIRE.radius + 30);
        boss.y = SPIRE.y + Math.sin(angle) * (boss.radius + SPIRE.radius + 30);
      }
    }
    for (const shot of state.enemyShots) {
      if (!shot.active) continue;
      if (Math.hypot(shot.x - player.x, shot.y - player.y) < shot.radius + PLAYER.radius) {
        shot.active = false;
        events |= hurtPlayer(1, shot.x, shot.y);
        if (state.player.hp <= 0) return events;
        continue;
      }
      if (Math.hypot(shot.x - SPIRE.x, shot.y - SPIRE.y) < shot.radius + SPIRE.radius) {
        shot.active = false;
        events |= hurtSpire(shot.damage, shot.x, shot.y);
        if (state.spire.hp <= 0) return events;
      }
    }
    return events;
  }

  /** Meteor telegraphs whose timers ran out: the sky comes down. */
  function updatePendingBooms(dt) {
    let events = 0;
    for (let i = state.pendingBooms.length - 1; i >= 0; i -= 1) {
      const boom = state.pendingBooms[i];
      boom.timer -= dt;
      if (boom.timer > 0) continue;
      state.pendingBooms.splice(i, 1);
      particles.burst(boom.x, boom.y, 24, '#ff7a3d', 340, 0.55, 4);
      particles.ring(boom.x, boom.y, '#ff7a3d', 110, 0.4);
      state.shake = Math.max(state.shake, 4);
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.phased) continue;
        if (Math.hypot(enemy.x - boom.x, enemy.y - boom.y) < 75 + enemy.radius) {
          events |= damageEnemy(state, enemy, 5, 0, 0, false);
        }
      }
    }
    return events;
  }

  /** One fixed step of the fighting world. Returns event bits. */
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    state.stats.timePlayed += dt;
    if (state.banner !== null) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }
    if (state.zoneCard !== null) {
      state.zoneCard.timer -= dt;
      if (state.zoneCard.timer <= 0) state.zoneCard = null;
    }
    state.shake = Math.max(0, state.shake - 26 * dt);
    if (state.combo.timer > 0) {
      state.combo.timer -= dt;
      if (state.combo.timer <= 0) {
        state.combo.kills = 0;
        state.combo.mult = 1;
      }
    }

    if (state.phase === 'breather') {
      state.breather -= dt;
      updateShards(dt);
      particles.update(dt);
      if (state.breather <= 0) events |= startWave(state.wave + 1);
      return events;
    }
    if (state.phase !== 'fighting') return events;

    events |= movePlayer(dt, input);
    events |= fireWeapons(state, dt, input);
    events |= updateBolts(state, dt);
    updateEnemies(state, dt);
    updateBoss(state, dt);
    updateEnemyShots(state, dt);
    events |= updatePickups(state, dt);
    events |= updateShards(dt);
    events |= updatePendingBooms(dt);
    events |= resolveTouches();
    updateSpawning(state, dt);

    // The wave ends when nothing is left to arrive or alive.
    if (state.player.hp <= 0) return events | endRun(false);
    if (state.spire.hp <= 0) return events | endRun(false);
    if (state.pendingLevels > 0) {
      state.phase = 'levelup';
      state.cards = drawBoons(state);
      particles.ring(state.player.x, state.player.y, '#ffd166', 120, 0.5);
      return events | EVENT_LEVELUP;
    }
    if (remainingFoes(state) === 0) {
      if (state.wave >= TOTAL_WAVES) return events | endRun(true);
      const bonus = Math.round(WAVE_CLEAR_BONUS * state.wave * greedBonus(state));
      state.score += bonus;
      state.banner = { text: `WAVE ${state.wave} CLEAR`, sub: `+${bonus} bonus`, timer: 2.4 };
      if (isBossWave(state.wave)) {
        state.phase = 'relic';
        state.relicCards = drawRelics();
        return events | EVENT_WAVE_CLEAR | EVENT_RELIC;
      }
      state.phase = 'breather';
      state.breather = BREATHER_SECONDS;
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  /** Seed the title screen's living backdrop: drifting gloom over the dawn. */
  function seedAttract() {
    reset();
    state.zone = 0;
    for (let i = 0; i < 9; i += 1) {
      const angle = state.random.range(0, Math.PI * 2);
      const distance = state.random.range(160, 420);
      spawnEnemy(state.enemies, state.random.pick(['wisp', 'wisp', 'dart', 'spitter']), SPIRE.x + Math.cos(angle) * distance, SPIRE.y + Math.sin(angle) * distance, 1, false, state.time);
    }
  }

  /** Drift the attract backdrop: slow orbits, embers, no combat. */
  function stepAttract(dt) {
    state.time += dt;
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      const angle = Math.atan2(enemy.y - SPIRE.y, enemy.x - SPIRE.x) + dt * 0.12;
      const distance = Math.hypot(enemy.x - SPIRE.x, enemy.y - SPIRE.y);
      enemy.x = SPIRE.x + Math.cos(angle) * distance;
      enemy.y = SPIRE.y + Math.sin(angle) * distance + Math.sin(state.time + enemy.seed) * 6 * dt;
      enemy.spawnT = 0;
    }
    if (Math.random() < 0.25) {
      particles.ember(state.random.range(80, FIELD.width - 80), state.random.range(380, FIELD.height - 60), '#ffd166', 2);
    }
  }

  reset();

  return {
    state,
    reset,
    startWave,
    chooseUpgrade,
    chooseRelic,
    step,
    seedAttract,
    stepAttract,
    remainingFoes: () => remainingFoes(state),
    countActive: () => countActive(state.enemies),
  };
}

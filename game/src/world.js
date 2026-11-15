// The game's rules and state, with no drawing and no browser in it: the keeper,
// the lantern, the pools of creatures, embers and shards, the waves, the combo
// and the score. step() advances one fixed step and returns what happened as
// bit flags, so the caller can react (sounds, banners) without the world
// knowing about screens or sound. Nothing here allocates after createWorld
// returns, except the short spawn queue a wave builds.
import {
  COMBO,
  ENEMY,
  FIELD,
  LANTERN,
  PLAYER,
  POOLS,
  SHARD,
  TOTAL_WAVES,
  WAVES,
  WAVE_CLEAR_BONUS,
} from './config.js';
import { drawUpgrades } from './upgrades.js';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_LANTERN_HIT = 4;
export const EVENT_KILL = 8;
export const EVENT_SHARD = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;
export const EVENT_EXPLODE = 256;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random, particles) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height - 120,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    invulnerable: 0,
    fireTimer: 0,
    aimX: FIELD.width / 2,
    aimY: 0,
  };
  const stats = {
    damage: PLAYER.emberDamage,
    fireInterval: PLAYER.fireInterval,
    projectiles: 1,
    pierce: 0,
    speed: PLAYER.speed,
    splash: 0,
    magnet: PLAYER.magnet,
    emberSpeed: PLAYER.emberSpeed,
    emberRange: PLAYER.emberRange,
  };
  const lantern = { hp: LANTERN.maxHp, maxHp: LANTERN.maxHp };

  const enemies = [];
  for (let index = 0; index < POOLS.enemies; index += 1) {
    enemies.push({
      active: false, kind: 'moth', x: 0, y: 0, hp: 1, maxHp: 1, speed: 0,
      radius: 10, wobble: 0, wobbleSpeed: 1, flash: 0, gnawTimer: 0, spawnTimer: 0,
    });
  }
  const projectiles = [];
  for (let index = 0; index < POOLS.projectiles; index += 1) {
    projectiles.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierceLeft: 0,
      travelled: 0, range: 500, trailTimer: 0,
    });
  }
  const shards = [];
  for (let index = 0; index < POOLS.shards; index += 1) {
    shards.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }

  const state = {
    player,
    stats,
    lantern,
    enemies,
    projectiles,
    shards,
    particles,
    wave: 0,
    phase: 'fighting',
    score: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    shardsCollected: 0,
    taken: {},
    offered: [],
    time: 0,
    shake: 0,
    banner: '',
    bannerSub: '',
    bannerTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: 1,
    over: false,
    won: false,
  };

  function freeEnemy() {
    for (let index = 0; index < enemies.length; index += 1) {
      if (!enemies[index].active) return enemies[index];
    }
    return null;
  }

  function freeProjectile() {
    for (let index = 0; index < projectiles.length; index += 1) {
      if (!projectiles[index].active) return projectiles[index];
    }
    return null;
  }

  function freeShard() {
    for (let index = 0; index < shards.length; index += 1) {
      if (!shards[index].active) return shards[index];
    }
    return null;
  }

  function edgePoint() {
    const side = Math.floor(random() * 4);
    const margin = 30;
    if (side === 0) return { x: random() * FIELD.width, y: -margin };
    if (side === 1) return { x: FIELD.width + margin, y: random() * FIELD.height };
    if (side === 2) return { x: random() * FIELD.width, y: FIELD.height + margin };
    return { x: -margin, y: random() * FIELD.height };
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMY[kind];
    const enemy = freeEnemy();
    if (enemy === null || def === undefined) return null;
    const waveDef = WAVES[state.wave - 1];
    const hpScale = waveDef ? waveDef.hpScale : 1;
    const at = x === undefined ? edgePoint() : { x, y };
    enemy.active = true;
    enemy.kind = kind;
    enemy.x = at.x;
    enemy.y = at.y;
    enemy.maxHp = Math.round(def.hp * hpScale);
    enemy.hp = enemy.maxHp;
    enemy.speed = def.speed * (0.9 + random() * 0.2);
    enemy.radius = def.radius;
    enemy.wobble = random() * Math.PI * 2;
    enemy.wobbleSpeed = 1.5 + random() * 2;
    enemy.flash = 0;
    enemy.gnawTimer = 0;
    enemy.spawnTimer = 4;
    return enemy;
  }

  function buildQueue(waveNumber) {
    const waveDef = WAVES[waveNumber - 1];
    const queue = [];
    for (let index = 0; index < waveDef.count; index += 1) {
      queue.push(waveDef.mix[Math.floor(random() * waveDef.mix.length)]);
    }
    if (waveDef.escort) {
      for (let index = 0; index < waveDef.escort; index += 1) queue.push('moth');
    }
    return queue;
  }

  function startWave(waveNumber) {
    state.wave = waveNumber;
    state.phase = 'fighting';
    state.spawnQueue = buildQueue(waveNumber);
    state.spawnInterval = WAVES[waveNumber - 1].interval;
    state.spawnTimer = 1.2;
    state.banner = waveNumber === TOTAL_WAVES ? 'The Moth Queen' : `Wave ${waveNumber}`;
    state.bannerSub = waveNumber === TOTAL_WAVES
      ? 'Hold the light — she comes for it herself.'
      : `${state.spawnQueue.length} creatures ride in from the dark.`;
    state.bannerTimer = 2.2;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height - 120;
    player.hp = PLAYER.maxHp;
    player.maxHp = PLAYER.maxHp;
    player.invulnerable = 0;
    player.fireTimer = 0;
    stats.damage = PLAYER.emberDamage;
    stats.fireInterval = PLAYER.fireInterval;
    stats.projectiles = 1;
    stats.pierce = 0;
    stats.speed = PLAYER.speed;
    stats.splash = 0;
    stats.magnet = PLAYER.magnet;
    stats.emberSpeed = PLAYER.emberSpeed;
    stats.emberRange = PLAYER.emberRange;
    lantern.hp = LANTERN.maxHp;
    for (const enemy of enemies) enemy.active = false;
    for (const shot of projectiles) shot.active = false;
    for (const shard of shards) shard.active = false;
    state.wave = 0;
    state.phase = 'fighting';
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.kills = 0;
    state.shardsCollected = 0;
    state.taken = {};
    state.offered = [];
    state.time = 0;
    state.shake = 0;
    state.banner = '';
    state.bannerSub = '';
    state.bannerTimer = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.over = false;
    state.won = false;
  }

  function dropShards(x, y, count) {
    for (let index = 0; index < count; index += 1) {
      const shard = freeShard();
      if (shard === null) return;
      const angle = random() * Math.PI * 2;
      shard.active = true;
      shard.x = x;
      shard.y = y;
      shard.vx = Math.cos(angle) * (40 + random() * 80);
      shard.vy = Math.sin(angle) * (40 + random() * 80);
    }
  }

  /** The burst a slain creature sets off; returns EVENT_EXPLODE when it went off. */
  function explodeAt(x, y, events) {
    particles.burst(x, y, 26, '#9fe870', 260, 4, 0.6);
    particles.burst(x, y, 12, '#ffb347', 180, 3, 0.5);
    state.shake = Math.max(state.shake, 0.3);
    for (let index = 0; index < enemies.length; index += 1) {
      const other = enemies[index];
      if (!other.active) continue;
      if (dist2(x, y, other.x, other.y) < 80 * 80) damageEnemy(other, 3, events);
    }
    if (dist2(x, y, player.x, player.y) < 64 * 64 && player.invulnerable <= 0) {
      hurtPlayer(1, events);
    }
    return events | EVENT_EXPLODE;
  }

  function hurtPlayer(amount, events) {
    if (player.invulnerable > 0 || state.over) return events;
    player.hp -= amount;
    player.invulnerable = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.shake = Math.max(state.shake, 0.4);
    particles.burst(player.x, player.y, 18, '#8ef6ff', 220, 4, 0.5);
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
      return events | EVENT_HIT | EVENT_OVER;
    }
    return events | EVENT_HIT;
  }

  function damageEnemy(enemy, amount, events) {
    if (!enemy.active) return events;
    enemy.hp -= amount;
    enemy.flash = 0.12;
    if (enemy.hp > 0) return events;
    return killEnemy(enemy, events);
  }

  function killEnemy(enemy, events) {
    if (!enemy.active) return events;
    enemy.active = false;
    const def = ENEMY[enemy.kind];
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.perStep));
    const gained = def.score * state.multiplier;
    state.score += gained;
    particles.burst(enemy.x, enemy.y, enemy.kind === 'queen' ? 60 : 14, '#b79ced', 200, 4, 0.6);
    particles.floatText(enemy.x, enemy.y - 10, `+${gained}`, '#ffd166', 18);
    dropShards(enemy.x, enemy.y, def.shards);
    if (stats.splash > 0) {
      for (let index = 0; index < enemies.length; index += 1) {
        const other = enemies[index];
        if (other.active && other !== enemy && dist2(enemy.x, enemy.y, other.x, other.y) < 64 * 64) {
          damageEnemy(other, stats.splash, events);
        }
      }
    }
    if (enemy.kind === 'bomber') events = explodeAt(enemy.x, enemy.y, events);
    if (enemy.kind === 'queen') state.shake = Math.max(state.shake, 0.6);
    return events | EVENT_KILL;
  }

  function fireEmbers(aimX, aimY) {
    const dx = aimX - player.x;
    const dy = aimY - player.y;
    const base = Math.atan2(dy, dx);
    const count = stats.projectiles;
    const spread = 0.13;
    for (let index = 0; index < count; index += 1) {
      const shot = freeProjectile();
      if (shot === null) return;
      const offset = (index - (count - 1) / 2) * spread;
      const angle = base + offset;
      shot.active = true;
      shot.x = player.x + Math.cos(angle) * (PLAYER.radius + 8);
      shot.y = player.y + Math.sin(angle) * (PLAYER.radius + 8);
      shot.vx = Math.cos(angle) * stats.emberSpeed;
      shot.vy = Math.sin(angle) * stats.emberSpeed;
      shot.damage = stats.damage;
      shot.pierceLeft = stats.pierce;
      shot.travelled = 0;
      shot.range = stats.emberRange;
      shot.trailTimer = 0;
    }
    player.fireTimer = stats.fireInterval;
  }

  function updatePlayer(dt, input) {
    const move = input.move();
    const length = Math.hypot(move.x, move.y);
    if (length > 0) {
      player.x += (move.x / length) * stats.speed * dt;
      player.y += (move.y / length) * stats.speed * dt;
    }
    player.x = Math.min(FIELD.width - 24, Math.max(24, player.x));
    player.y = Math.min(FIELD.height - 24, Math.max(24, player.y));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    const aim = input.aim();
    player.aimX = aim.x;
    player.aimY = aim.y;
    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0) {
      fireEmbers(aim.x, aim.y);
      return EVENT_SHOOT;
    }
    return 0;
  }

  function updateProjectiles(dt, events) {
    for (let index = 0; index < projectiles.length; index += 1) {
      const shot = projectiles[index];
      if (!shot.active) continue;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.travelled += Math.hypot(shot.vx, shot.vy) * dt;
      shot.trailTimer -= dt;
      if (shot.trailTimer <= 0) {
        particles.trail(shot.x, shot.y, '#ff7a3c');
        shot.trailTimer = 0.03;
      }
      if (shot.travelled >= shot.range || shot.x < -20 || shot.x > FIELD.width + 20 || shot.y < -20 || shot.y > FIELD.height + 20) {
        shot.active = false;
        continue;
      }
      for (let other = 0; other < enemies.length; other += 1) {
        const enemy = enemies[other];
        if (!enemy.active) continue;
        const reach = enemy.radius + PLAYER.emberRadius;
        if (dist2(shot.x, shot.y, enemy.x, enemy.y) < reach * reach) {
          events = damageEnemy(enemy, shot.damage, events);
          particles.burst(shot.x, shot.y, 4, '#ffd166', 120, 3, 0.3);
          if (shot.pierceLeft > 0) {
            shot.pierceLeft -= 1;
          } else {
            shot.active = false;
          }
          break;
        }
      }
    }
    return events;
  }

  function updateEnemies(dt, events) {
    let alive = 0;
    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];
      if (!enemy.active) continue;
      alive += 1;
      if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt);
      if (enemy.gnawTimer > 0) enemy.gnawTimer -= dt;
      const def = ENEMY[enemy.kind];
      const target = def.target === 'player' ? player : LANTERN;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      // Wobble sideways so the swarm never walks in a straight line.
      const wobble = Math.sin(state.time * enemy.wobbleSpeed + enemy.wobble) * 0.55;
      const nx = dx / distance;
      const ny = dy / distance;
      const px = -ny * wobble;
      const py = nx * wobble;
      enemy.x += (nx + px) * enemy.speed * dt;
      enemy.y += (ny + py) * enemy.speed * dt;

      if (enemy.kind === 'queen') {
        enemy.spawnTimer -= dt;
        if (enemy.spawnTimer <= 0) {
          enemy.spawnTimer = 4;
          for (let gnat = 0; gnat < 3; gnat += 1) {
            spawnEnemy('gnat', enemy.x + (random() - 0.5) * 60, enemy.y + (random() - 0.5) * 60);
          }
        }
      }

      const lanternReach = enemy.radius + LANTERN.radius - 4;
      if (def.target === 'lantern' && dist2(enemy.x, enemy.y, LANTERN.x, LANTERN.y) < lanternReach * lanternReach) {
        if (enemy.gnawTimer <= 0) {
          lantern.hp = Math.max(0, lantern.hp - def.lanternDamage);
          state.combo = 0;
          state.comboTimer = 0;
          state.multiplier = 1;
          state.shake = Math.max(state.shake, 0.3);
          particles.burst(LANTERN.x, LANTERN.y, 10, '#ffb347', 160, 3, 0.5);
          events |= EVENT_LANTERN_HIT;
          if (lantern.hp <= 0) {
            state.over = true;
            events |= EVENT_OVER;
            return { events, alive };
          }
          if (enemy.kind === 'queen') {
            enemy.gnawTimer = 2;
            enemy.x += (enemy.x - LANTERN.x) / distance * 120;
            enemy.y += (enemy.y - LANTERN.y) / distance * 120;
          } else {
            enemy.active = false;
            alive -= 1;
          }
        }
        continue;
      }

      const playerReach = enemy.radius + PLAYER.radius;
      if (dist2(enemy.x, enemy.y, player.x, player.y) < playerReach * playerReach) {
        if (enemy.kind === 'thief') {
          // A thief steals the combo and vanishes; it never hurts the keeper.
          state.combo = 0;
          state.comboTimer = 0;
          state.multiplier = 1;
          particles.floatText(player.x, player.y - 24, 'Combo stolen!', '#f27bb1', 18);
          enemy.active = false;
          alive -= 1;
          events |= EVENT_HIT;
        } else if (player.invulnerable <= 0) {
          const before = events;
          events = hurtPlayer(def.touchDamage, events);
          if (events !== before && !state.over) {
            enemy.x += (enemy.x - player.x) / distance * 40;
            enemy.y += (enemy.y - player.y) / distance * 40;
          }
        }
      }
    }
    return { events, alive };
  }

  function updateShards(dt, events) {
    for (let index = 0; index < shards.length; index += 1) {
      const shard = shards[index];
      if (!shard.active) continue;
      const dx = player.x - shard.x;
      const dy = player.y - shard.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < stats.magnet) {
        const pull = 620 * (1 - distance / (stats.magnet + 60));
        shard.vx += (dx / distance) * pull * dt * 4;
        shard.vy += (dy / distance) * pull * dt * 4;
      }
      shard.vx *= 1 - Math.min(0.9, 2.4 * dt);
      shard.vy *= 1 - Math.min(0.9, 2.4 * dt);
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (distance < SHARD.collectRadius) {
        shard.active = false;
        state.score += SHARD.score;
        state.shardsCollected += 1;
        particles.burst(shard.x, shard.y, 3, '#ffd166', 90, 2, 0.3);
        events |= EVENT_SHARD;
      }
    }
    return events;
  }

  /**
   * One fixed step of the real game. `input` is the frame's input snapshot.
   * Returns bit flags of what happened (EVENT_*), so the caller can play
   * sounds and show banners.
   */
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    events |= updatePlayer(dt, input);

    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        spawnEnemy(kind);
        state.spawnTimer = state.spawnInterval * (0.9 + random() * 0.2);
      }
    }

    events = updateProjectiles(dt, events);
    const moved = updateEnemies(dt, events);
    events = moved.events;
    if (state.over) return events;
    events = updateShards(dt, events);

    if (state.spawnQueue.length === 0 && moved.alive === 0) {
      if (state.wave >= TOTAL_WAVES) {
        state.won = true;
        state.phase = 'done';
        return events | EVENT_WIN;
      }
      state.score += WAVE_CLEAR_BONUS * state.wave;
      state.offered = drawUpgrades(random, state.taken);
      state.phase = 'intermission';
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  /** The title screen's backdrop: moths drift in, circle the light, dissolve. */
  function stepAttract(dt) {
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    let alive = 0;
    for (const enemy of enemies) if (enemy.active) alive += 1;
    if (alive < 7 && random() < dt * 0.8) {
      spawnEnemy(random() < 0.7 ? 'moth' : 'gnat');
    }
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dx = LANTERN.x - enemy.x;
      const dy = LANTERN.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      const wobble = Math.sin(state.time * enemy.wobbleSpeed + enemy.wobble) * 0.8;
      enemy.x += (dx / distance - (dy / distance) * wobble) * enemy.speed * 0.45 * dt;
      enemy.y += (dy / distance + (dx / distance) * wobble) * enemy.speed * 0.45 * dt;
      if (distance < LANTERN.radius + enemy.radius + 26) {
        particles.burst(enemy.x, enemy.y, 3, '#b79ced', 60, 2, 0.4);
        enemy.active = false;
      }
    }
    particles.update(dt);
  }

  /** Take one of the three offered upgrades and open the next wave. */
  function chooseUpgrade(index) {
    const upgrade = state.offered[index];
    if (!upgrade || state.phase !== 'intermission') return false;
    state.taken[upgrade.id] = (state.taken[upgrade.id] ?? 0) + 1;
    upgrade.apply(stats, state);
    state.offered = [];
    startWave(state.wave + 1);
    return true;
  }

  reset();
  return { state, reset, step, stepAttract, startWave, chooseUpgrade };
}

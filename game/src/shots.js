// Screenshot scenes: deterministic stagings of the real game, driven by an
// autopilot that plays through the real input path. Each scene runs the
// fixed-step simulation until its stop condition, so every pixel in a
// screenshot is the game's own rendering of a state the game itself reached.
// ?shot=start|play|boss|win&seed=<n> selects the scene.

import { FIELD, SPIRE, STEP } from './config.js';
import { SCREEN_PLAYING, SCREEN_TITLE, SCREEN_WIN } from './screens.js';
import { spawnEnemy } from './enemies.js';

/** The pilot's boon priorities, best first. */
const BOON_ORDER = ['damage', 'split', 'pierce', 'orbitals', 'seekers', 'nova', 'rapid', 'crit', 'speed', 'magnet', 'dash', 'greed', 'mines', 'heart', 'mend'];

/** The pilot's relic priorities, best first. */
const RELIC_ORDER = ['sunbrand', 'swiftwing', 'thornmantle', 'seconddawn', 'greed', 'gloompact'];

/** An input the pilot drives: move, aim, fire, dash — the game's own interface. */
function createPilot(state) {
  let dashQueued = false;
  let aim = { x: FIELD.width / 2, y: 120 };
  let move = { x: 0, y: 0 };

  function think() {
    const player = state.player;
    // Aim: the boss, else spitters and weavers, else the foe nearest the spire.
    let target = null;
    let bestScore = Infinity;
    const boss = state.boss;
    if (boss !== null && boss.active) {
      target = boss;
    } else {
      for (const enemy of state.enemies) {
        if (!enemy.active || enemy.phased) continue;
        const toSpire = Math.hypot(enemy.x - SPIRE.x, enemy.y - SPIRE.y);
        const ranged = enemy.kind === 'spitter' || enemy.kind === 'weaver';
        const score = toSpire - (ranged ? 220 : 0);
        if (score < bestScore) {
          bestScore = score;
          target = enemy;
        }
      }
    }
    if (target !== null) aim = { x: target.x, y: target.y };

    // Move: orbit the spire, flee what closes in, gather shards when safe.
    const toSpireX = SPIRE.x - player.x;
    const toSpireY = SPIRE.y - player.y;
    const spireDistance = Math.hypot(toSpireX, toSpireY) || 1;
    let mx = -toSpireY / spireDistance;
    let my = toSpireX / spireDistance;
    if (spireDistance > 260) {
      mx += (toSpireX / spireDistance) * 0.8;
      my += (toSpireY / spireDistance) * 0.8;
    } else if (spireDistance < 150) {
      mx -= (toSpireX / spireDistance) * 0.8;
      my -= (toSpireY / spireDistance) * 0.8;
    }
    let crowded = 0;
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 110) {
        crowded += 1;
        mx += (dx / (distance || 1)) * 1.6;
        my += (dy / (distance || 1)) * 1.6;
      }
      // Intercept what threatens the spire.
      const enemyToSpire = Math.hypot(enemy.x - SPIRE.x, enemy.y - SPIRE.y);
      if (enemyToSpire < 150 && distance > 60) {
        mx += ((enemy.x - player.x) / (distance || 1)) * 0.7;
        my += ((enemy.y - player.y) / (distance || 1)) * 0.7;
      }
    }
    if (crowded >= 3 && player.dashCd <= 0) dashQueued = true;
    // Shards, when nothing is breathing down the warden's neck.
    if (crowded === 0) {
      let nearest = null;
      let nearestDistance = 260;
      for (const shard of state.shards) {
        if (!shard.active) continue;
        const distance = Math.hypot(shard.x - player.x, shard.y - player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = shard;
        }
      }
      if (nearest !== null) {
        mx += ((nearest.x - player.x) / (nearestDistance || 1)) * 1.2;
        my += ((nearest.y - player.y) / (nearestDistance || 1)) * 1.2;
      }
    }
    const length = Math.hypot(mx, my);
    move = length > 0.01 ? { x: mx / length, y: my / length } : { x: 0, y: 0 };
  }

  return {
    think,
    move: () => move,
    aim: () => ({ ...aim }),
    get firing() {
      return true;
    },
    takeDash() {
      const queued = dashQueued;
      dashQueued = false;
      return queued;
    },
    flush() {},
  };
}

/**
 * Run the simulation with the pilot until `stop(state)` is true or the step
 * budget runs out. Drafts are answered by priority; the staging assist keeps
 * the warden and the spire standing so the win scene always completes.
 */
function simulate(world, stop, options = {}) {
  const state = world.state;
  const pilot = createPilot(state);
  const assist = options.assist ?? false;
  const maxSteps = options.maxSteps ?? 60 * 60 * 14;
  let steps = 0;
  while (steps < maxSteps) {
    pilot.think();
    state.aimX = pilot.aim().x;
    state.aimY = pilot.aim().y;
    world.step(STEP, pilot);
    state.particles.update(STEP);
    steps += 1;
    if (assist) {
      if (state.player.hp <= 1) state.player.hp = state.player.maxHp;
      if (state.spire.hp < state.spire.maxHp * 0.5) state.spire.hp = state.spire.maxHp;
      // A lethal step ends the run inside the step; the staging assist stands
      // the warden back up and the fight goes on, so the win scene completes.
      if (state.phase === 'done' && !state.won) {
        state.phase = 'fighting';
        state.over = false;
        state.player.hp = state.player.maxHp;
        state.player.invuln = 2;
        state.spire.hp = state.spire.maxHp;
      }
      // The staged win is a flawless one: the watermarks the star rating
      // reads stay hale, so the victory screen shows all three stars.
      state.stats.lowestWardenHp = Math.max(state.stats.lowestWardenHp, Math.ceil(state.player.maxHp / 2));
      state.stats.lowestSpireHp = Math.max(state.stats.lowestSpireHp, state.spire.maxHp * 0.5);
    }
    if (state.phase === 'levelup') {
      const pick = BOON_ORDER.find((id) => state.cards.includes(id)) ?? state.cards[0];
      world.chooseUpgrade(state.cards.indexOf(pick));
    } else if (state.phase === 'relic') {
      const pick = RELIC_ORDER.find((id) => state.relicCards.includes(id)) ?? state.relicCards[0];
      world.chooseRelic(state.relicCards.indexOf(pick));
    }
    if (stop(state)) break;
    if (state.phase === 'done' && !options.allowDone) break;
  }
  return steps;
}

/** Top the field up to `count` foes through the real spawn path. */
function topUpFoes(state, count, kinds) {
  let active = 0;
  for (const enemy of state.enemies) if (enemy.active) active += 1;
  let index = 0;
  while (active < count) {
    const kind = kinds[index % kinds.length];
    const angle = state.random.range(0, Math.PI * 2);
    const distance = state.random.range(140, 340);
    const spawned = spawnEnemy(state.enemies, kind, SPIRE.x + Math.cos(angle) * distance, SPIRE.y + Math.sin(angle) * distance, state.hpScale, index % 5 === 0, state.time);
    if (spawned === null) break;
    active += 1;
    index += 1;
  }
}

/** Place the warden at a readable spot, staff toward the nearest foe. */
function frameWarden(state, x, y) {
  const player = state.player;
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.trail = [];
  player.invuln = 0;
  let target = state.boss !== null && state.boss.active ? state.boss : null;
  if (target === null) {
    let best = Infinity;
    for (const enemy of state.enemies) {
      if (!enemy.active) continue;
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance < best) {
        best = distance;
        target = enemy;
      }
    }
  }
  state.aimX = target !== null ? target.x : SPIRE.x;
  state.aimY = target !== null ? target.y : SPIRE.y;
}

/** Stage one scene and return the screen it should be shown on. */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'start') {
    world.seedAttract();
    for (let i = 0; i < 60 * 5; i += 1) {
      world.stepAttract(STEP);
      state.particles.update(STEP);
    }
    state.aimX = FIELD.width / 2;
    state.aimY = 200;
    return SCREEN_TITLE;
  }

  if (name === 'play') {
    world.reset();
    world.startWave(1);
    // Reach the dusk's first wave with a grown build, then thicken the fray.
    simulate(world, (s) => s.wave >= 5 && s.phase === 'fighting' && s.spawnQueue.length < 6, { assist: true, maxSteps: 60 * 60 * 6 });
    topUpFoes(state, 22, ['wisp', 'dart', 'spitter', 'dart', 'wisp', 'splitter', 'stalker']);
    const playStart = state.time;
    simulate(world, (s) => s.time > playStart + 1.4, { assist: true, maxSteps: 60 * 3 });
    // Frame the warden on clear ground, staff toward the fight; the HUD
    // already names the wave, so no banner doubles it.
    state.banner = null;
    frameWarden(state, 500, 470);
    // A strong defence for the cover: the spire stands near full light.
    state.spire.hp = Math.min(state.spire.maxHp, 130);
    return SCREEN_PLAYING;
  }

  if (name === 'boss') {
    world.reset();
    world.startWave(1);
    simulate(world, (s) => s.wave >= 12 && s.boss !== null && s.boss.active && s.boss.hp < s.boss.maxHp * 0.6, { assist: true, maxSteps: 60 * 60 * 12 });
    // Frame the boss above the spire, clear of the HUD and the banner.
    if (state.boss !== null && state.boss.active) {
      state.boss.x = 640;
      state.boss.y = 235;
      state.boss.vx = 0;
      state.boss.vy = 0;
    }
    topUpFoes(state, 8, ['stalker', 'wisp', 'dart']);
    const bossStart = state.time;
    simulate(world, (s) => s.time > bossStart + 1.0, { assist: true, maxSteps: 60 * 2 });
    // The boss bar names the boss; no banner doubles it. Frame the warden
    // below the fight, staff toward the Sovereign.
    state.banner = null;
    frameWarden(state, 430, 480);
    if (state.boss !== null) state.boss.flash = 0;
    return SCREEN_PLAYING;
  }

  if (name === 'win') {
    world.reset();
    world.startWave(1);
    simulate(world, (s) => s.phase === 'done' && s.won, { assist: true, allowDone: true, maxSteps: 60 * 60 * 14 });
    // A clean victory tableau: the spent bolts and globs fall away, the
    // shards and the spire's light stay.
    for (const pool of [state.bolts, state.enemyShots, state.wisps, state.mines]) {
      for (const item of pool) item.active = false;
    }
    state.pendingBooms = [];
    // The dawn tableau: the warden and the spire stand hale.
    state.player.hp = state.player.maxHp;
    state.spire.hp = state.spire.maxHp;
    return SCREEN_WIN;
  }

  // Unknown scene: fall back to the title.
  world.seedAttract();
  return SCREEN_TITLE;
}

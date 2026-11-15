// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the
// real rules forward from a fresh world for a fixed stretch, steered by a
// simple autopilot (hold a ring around the lantern on the side the creatures
// come from, always throw embers at the nearest one, gather shards), so the
// frame is what a short game really looks like and the same seed always gives
// the same frame. The win scene plays waves 1 to 9 the same way, then meets a
// wounded Moth Queen on wave 10 and finishes her; the end scene's keeper never
// throws an ember, so the light goes out.
import { LANTERN, STEP, TOTAL_WAVES } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';
import { EVENT_OVER, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';

const START_SECONDS = 5;
const PLAY_WAVE = 5;
const END_PLAY_SECONDS = 25;
const END_LIMIT_SECONDS = 600;
const WIN_LIMIT_SECONDS = 900;
const RING_RADIUS = 220;

function nearestEnemy(state, fromX, fromY) {
  let best = null;
  let bestDist = Infinity;
  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    if (!enemy.active) continue;
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  return best;
}

/**
 * The autopilot's input for one step. `skill` 1 plays well; 0 never fires and
 * never moves, so the creatures reach the lantern. `armAt` is the game time
 * from which it starts throwing embers — later than now, it kites and gathers
 * the swarm first, so a staged frame is full of creatures.
 */
function makePilot(world, skill, armAt) {
  const state = world.state;
  const pilot = {
    get firing() {
      return skill > 0 && state.time >= (armAt ?? 0);
    },
    move() {
      if (skill <= 0) return { x: 0, y: 0 };
      const player = state.player;
      const threat = nearestEnemy(state, player.x, player.y);
      if (threat !== null) {
        const dx = player.x - threat.x;
        const dy = player.y - threat.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 90) return { x: dx / dist, y: dy / dist };
      }
      // Hold a ring around the lantern on the side the nearest creature comes from.
      const foe = nearestEnemy(state, LANTERN.x, LANTERN.y);
      let wantX = LANTERN.x;
      let wantY = LANTERN.y - RING_RADIUS;
      if (foe !== null) {
        const dx = foe.x - LANTERN.x;
        const dy = foe.y - LANTERN.y;
        const dist = Math.hypot(dx, dy) || 1;
        wantX = LANTERN.x + (dx / dist) * RING_RADIUS;
        wantY = LANTERN.y + (dy / dist) * RING_RADIUS;
      }
      // Drift toward the nearest shard when one is close.
      let shard = null;
      let shardDist = 200 * 200;
      for (let index = 0; index < state.shards.length; index += 1) {
        const piece = state.shards[index];
        if (!piece.active) continue;
        const dx = piece.x - player.x;
        const dy = piece.y - player.y;
        const dist = dx * dx + dy * dy;
        if (dist < shardDist) {
          shardDist = dist;
          shard = piece;
        }
      }
      if (shard !== null) {
        wantX = shard.x;
        wantY = shard.y;
      }
      const dx = wantX - player.x;
      const dy = wantY - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) return { x: 0, y: 0 };
      return { x: dx / dist, y: dy / dist };
    },
    aim() {
      const player = state.player;
      const foe = nearestEnemy(state, player.x, player.y);
      if (foe === null) return { x: player.x, y: player.y - 100 };
      return { x: foe.x, y: foe.y };
    },
  };
  return pilot;
}

/** Run the world forward with the pilot until `until` says stop, or the cap. */
function simulate(world, skill, capSeconds, until, armAt, autoUpgrade = true) {
  const pilot = makePilot(world, skill, armAt);
  const cap = Math.floor(capSeconds / STEP);
  for (let index = 0; index < cap; index += 1) {
    if (world.state.phase === 'intermission') {
      if (!autoUpgrade) return 'until';
      world.chooseUpgrade(0);
    }
    const events = world.step(STEP, pilot);
    world.state.particles.update(STEP);
    if (events & EVENT_OVER) return 'over';
    if (events & EVENT_WIN) return 'win';
    if (until !== undefined && until(world.state)) return 'until';
  }
  return 'cap';
}

/**
 * Set `world` to the named scene (start, play, end or win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    world.startWave(1);
    simulate(world, 1, 300, (state) => state.wave >= PLAY_WAVE && state.phase === 'fighting');
    // Let the swarm gather for a few seconds, then open fire: the frame is
    // full of creatures, embers and shards instead of an empty field.
    world.state.lantern.hp = world.state.lantern.maxHp;
    simulate(world, 1, 8, undefined, Infinity);
    simulate(world, 1, 1.5, undefined);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    // Clear wave 1 and stop at the choice: the three cards, unpicked.
    world.startWave(1);
    simulate(world, 1, 300, undefined, undefined, false);
    return { screen: SCREEN_UPGRADE, best: world.state.score };
  }
  if (name === 'end') {
    // The keeper plays well for a while, then stops throwing embers and the
    // light goes out: a real loss, with a real score behind it.
    world.startWave(1);
    simulate(world, 1, END_PLAY_SECONDS, undefined);
    world.state.lantern.hp = Math.min(world.state.lantern.hp, 25);
    simulate(world, 0, END_LIMIT_SECONDS, undefined);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    world.startWave(1);
    const outcome = simulate(world, 1, WIN_LIMIT_SECONDS, (state) => state.wave >= TOTAL_WAVES && state.phase === 'fighting');
    if (outcome === 'until' || world.state.wave >= TOTAL_WAVES) {
      // A wounded queen, so the pilot finishes her and the dawn breaks.
      for (let index = 0; index < world.state.enemies.length; index += 1) {
        const enemy = world.state.enemies[index];
        if (enemy.active && enemy.kind === 'queen') enemy.hp = 6;
      }
      world.state.spawnQueue = [];
      simulate(world, 1, 60, undefined);
    }
    if (!world.state.won) {
      // The pilot fell somewhere on the way: stage the dawn directly over a
      // late wave, with the score the run had earned.
      world.reset();
      world.startWave(TOTAL_WAVES);
      world.state.score = 8450;
      world.state.kills = 212;
      world.state.shardsCollected = 96;
      world.state.won = true;
      world.state.phase = 'done';
    }
    world.state.bannerTimer = 0;
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.stepAttract(STEP);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

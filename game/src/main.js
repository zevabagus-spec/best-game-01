// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, the
// upgrade choice between waves, paused, game over and victory.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|upgrade|end|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createParticles } from './particles.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_EXPLODE, EVENT_HIT, EVENT_KILL, EVENT_LANTERN_HIT, EVENT_OVER, EVENT_SHARD, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN, createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const particles = createParticles();
const world = createWorld(random, particles);
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas, renderer.toField);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.startWave(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the lantern through 10 waves.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    world.state.bannerTimer = 0;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Dawn breaks. You held the light. Score ${world.state.score}. Best ${best}.`
      : `The light went out. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    const clicks = input.takeClicks();
    if (screen === SCREEN_TITLE) {
      if ((actions & ACTION_CONFIRM) || clicks.length > 0) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      let pick = input.takeUpgradePick();
      if (pick === -1) {
        const rects = renderer.upgradeRects();
        for (const click of clicks) {
          for (let index = 0; index < rects.length; index += 1) {
            const rect = rects[index];
            if (click.x >= rect.x && click.x <= rect.x + rect.width && click.y >= rect.y && click.y <= rect.y + rect.height) {
              pick = index;
              break;
            }
          }
          if (pick !== -1) break;
        }
      }
      if (pick !== -1 && world.chooseUpgrade(pick)) {
        audio.upgrade();
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}.`);
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if ((actions & ACTION_CONFIRM) || clicks.length > 0) startGame();
    }
  }

  function playSounds(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_LANTERN_HIT) audio.lanternHit();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_SHARD) audio.shard();
    if (events & EVENT_EXPLODE) audio.explode();
    if (events & EVENT_WAVE_CLEAR) audio.waveHorn();
    if (events & EVENT_WIN) audio.victory();
    else if (events & EVENT_OVER) audio.gameOver();
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.stepAttract(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input);
    playSounds(events);
    if (events & EVENT_HIT) {
      announce(world.state.player.hp === 1
        ? 'Hit. 1 heart left.'
        : `Hit. ${world.state.player.hp} hearts left.`);
    }
    if (events & EVENT_LANTERN_HIT) announce(`The lantern is hurt. ${world.state.lantern.hp} light left.`);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} cleared. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    audio.music(STEP);
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    particles.update(STEP);
    renderer.draw(world.state, screen, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting creatures feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// The boot and the frame loop: screens, sounds, announcements and the fixed
// step. In shot mode (?shot=start|play|boss|win) it stages one scene, paints
// twice, and raises window.__shotReady for the capture tool. In self-test
// mode (?selftest=1) it plays a whole run with the autopilot and reports the
// result in the page, so a headless check can read it. In play mode it runs
// the game: title, waves, boons, relics, pause, and both endings.

import { STEP } from './config.js';
import { createRandom, randomSeed } from './random.js';
import { readBest, readMuted, readShakeOn, saveBest, saveMuted, saveShakeOn } from './save.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAYING, SCREEN_RELIC, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './screens.js';
import {
  EVENT_BOSS_DOWN, EVENT_DASH, EVENT_EXPLODE, EVENT_HIT, EVENT_KILL, EVENT_LEVELUP, EVENT_NOVA,
  EVENT_OVER, EVENT_PICKUP, EVENT_RELIC, EVENT_ROAR, EVENT_SHARD, EVENT_SHIELD, EVENT_SHOOT,
  EVENT_SPIRE_HIT, EVENT_WAVE_CLEAR, EVENT_WAVE_START, EVENT_WIN, EVENT_ZONE,
} from './events.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '', 10) || randomSeed();
const random = createRandom(seed);
const particles = createParticles();
const world = createWorld(random, particles);
const state = world.state;
const renderer = createRenderer(canvas);
const input = createInput(canvas, renderer.toField);
const audio = createAudio();

let screen = SCREEN_TITLE;
let best = readBest();
let muted = readMuted();
let shakeOn = readShakeOn();
let reason = '';
let announceTimer = 0;
let endShownAtMs = 0;
let aimLocked = false;

audio.setMuted(muted);

function announce(text) {
  statusLine.textContent = text;
}

function saveBestIfBeaten() {
  if (state.score > best) {
    best = state.score;
    saveBest(best);
  }
}

function startRun() {
  world.reset();
  const events = world.startWave(1);
  screen = SCREEN_PLAYING;
  input.flush();
  playEvents(events);
  announce('Playing: guard the Sunspire through 12 waves.');
}

function showTitle() {
  world.reset();
  world.seedAttract();
  screen = SCREEN_TITLE;
  input.flush();
  announce('Sunspire. Press Space or click to begin.');
}

function playEvents(events) {
  if (events & EVENT_SHOOT) audio.shoot();
  if (events & EVENT_HIT) audio.hurt();
  if (events & EVENT_SPIRE_HIT) audio.spireHit();
  if (events & EVENT_KILL) audio.kill();
  if (events & EVENT_SHARD) audio.shard();
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_LEVELUP) audio.levelup();
  if (events & EVENT_WAVE_START) audio.waveHorn();
  if (events & EVENT_WAVE_CLEAR) audio.upgrade();
  if (events & EVENT_ROAR) audio.roar();
  if (events & EVENT_EXPLODE) audio.explode();
  if (events & EVENT_DASH) audio.dash();
  if (events & EVENT_NOVA) audio.nova();
  if (events & EVENT_SHIELD) audio.shieldUp();
  if (events & EVENT_OVER) audio.gameOver();
  if (events & EVENT_WIN) audio.victory();
  if (events & EVENT_RELIC) audio.upgrade();
  if (events & EVENT_BOSS_DOWN) audio.victory();
  if (events & EVENT_ZONE) audio.waveHorn();
}

function musicMood() {
  if (screen === SCREEN_TITLE) return 'calm';
  if (state.boss !== null && state.boss.active) return 'boss';
  if (screen === SCREEN_PLAYING) return 'combat';
  return 'calm';
}

function inside(rect, point) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function handleTitle(actions, clicks) {
  if (actions & ACTION_CONFIRM || clicks.length > 0) {
    audio.unlock();
    audio.click();
    startRun();
  }
}

function handlePlaying(actions) {
  if (actions & ACTION_PAUSE) {
    screen = SCREEN_PAUSED;
    input.flush();
    announce('Paused. Press P to resume.');
  }
}

function handleDraft(clicks, rects, choose) {
  const pick = input.takeUpgradePick();
  if (pick >= 0) {
    choose(pick);
    return;
  }
  for (const click of clicks) {
    for (let index = 0; index < rects.length; index += 1) {
      if (inside(rects[index], click)) {
        choose(index);
        return;
      }
    }
  }
}

function handleUpgrade(clicks) {
  handleDraft(clicks, renderer.upgradeRects(), (index) => {
    if (!world.chooseUpgrade(index)) return;
    audio.upgrade();
    if (state.phase !== 'levelup') {
      screen = SCREEN_PLAYING;
      input.flush();
      announce(`Playing: level ${state.level}.`);
    } else {
      announce(`Level ${state.level}: choose another boon.`);
    }
  });
}

function handleRelic(clicks) {
  handleDraft(clicks, renderer.relicRects(), (index) => {
    if (!world.chooseRelic(index)) return;
    audio.upgrade();
    screen = SCREEN_PLAYING;
    input.flush();
    announce('Playing: the relic is yours.');
  });
}

function handlePaused(actions, clicks) {
  if (actions & ACTION_PAUSE) {
    screen = SCREEN_PLAYING;
    input.flush();
    announce('Playing.');
    return;
  }
  const rects = renderer.pauseRects();
  for (const click of clicks) {
    for (const rect of rects) {
      if (!inside(rect, click)) continue;
      audio.click();
      if (rect.id === 'resume') {
        screen = SCREEN_PLAYING;
        input.flush();
        announce('Playing.');
      } else if (rect.id === 'restart') {
        startRun();
      } else if (rect.id === 'sound') {
        muted = audio.toggleMute();
        saveMuted(muted);
      } else if (rect.id === 'shake') {
        shakeOn = !shakeOn;
        saveShakeOn(shakeOn);
      }
      return;
    }
  }
}

function handleEnd(actions, clicks) {
  // A short guard, so the click that ends a run cannot restart it.
  if (performance.now() - endShownAtMs < 600) return;
  if (actions & ACTION_CONFIRM || clicks.length > 0) {
    audio.unlock();
    audio.click();
    startRun();
  }
}

function drawFrame() {
  if (!aimLocked) {
    const aim = input.aim();
    state.aimX = aim.x;
    state.aimY = aim.y;
  }
  renderer.draw(state, screen, {
    best,
    muted,
    shakeOn,
    remaining: world.remainingFoes(),
    reason,
  });
}

function runShot(name) {
  aimLocked = true;
  try {
    screen = stageShot(name, world);
  } catch (error) {
    document.title = `SHOT-ERROR: ${error.message}`;
    announce(`Shot staging failed: ${error.message}`);
    screen = SCREEN_TITLE;
  }
  if (screen === SCREEN_TITLE) {
    announce('Sunspire. Press Space or click to begin.');
  } else if (screen === SCREEN_WIN) {
    saveBestIfBeaten();
    announce('Victory: dawn breaks.');
  } else {
    announce('Playing: guard the Sunspire through 12 waves.');
  }
  drawFrame();
  drawFrame();
  window.__shotReady = true;
}

function runSelfTest() {
  // Play a whole run with the autopilot, through the shot stager's win path,
  // and leave the verdict in the page for a headless check to read.
  try {
    const staged = stageShot('win', world);
    const ok = staged === SCREEN_WIN && state.won && state.wave >= 12;
    document.title = ok ? 'SELFTEST-PASS' : 'SELFTEST-FAIL';
    announce(`selftest ${ok ? 'PASS' : 'FAIL'}: wave=${state.wave} won=${state.won} score=${state.score} kills=${state.stats.kills} bosses=${state.stats.bossesSlain} level=${state.level}`);
    window.__shotReady = true;
  } catch (error) {
    document.title = `SELFTEST-ERROR: ${error.message}`;
    announce(`selftest ERROR: ${error.message}`);
  }
  drawFrame();
}

function runGame() {
  showTitle();
  let last = performance.now();
  let accumulator = 0;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAYING) {
      screen = SCREEN_PAUSED;
      input.flush();
      announce('Paused. Press P to resume.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const actions = input.takeActions();
    const clicks = input.takeClicks();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      saveMuted(muted);
    }
    if (clicks.length > 0 || actions & ACTION_CONFIRM) audio.unlock();

    if (screen === SCREEN_TITLE) handleTitle(actions, clicks);
    else if (screen === SCREEN_PLAYING) handlePlaying(actions);
    else if (screen === SCREEN_UPGRADE) handleUpgrade(clicks);
    else if (screen === SCREEN_RELIC) handleRelic(clicks);
    else if (screen === SCREEN_PAUSED) handlePaused(actions, clicks);
    else handleEnd(actions, clicks);

    // Hit-stop: the world holds its breath for a fraction of a second.
    if (state.hitStop > 0) {
      state.hitStop -= frameDt;
    } else if (screen === SCREEN_TITLE) {
      accumulator += frameDt;
      while (accumulator >= STEP) {
        world.stepAttract(STEP);
        accumulator -= STEP;
      }
      particles.update(frameDt);
    } else if (screen === SCREEN_PLAYING) {
      accumulator += frameDt;
      let guard = 0;
      while (accumulator >= STEP && guard < 8) {
        const events = world.step(STEP, input);
        playEvents(events);
        accumulator -= STEP;
        guard += 1;
        if (events & EVENT_LEVELUP) {
          screen = SCREEN_UPGRADE;
          input.flush();
          announce(`Level ${state.level}: choose a boon.`);
          break;
        }
        if (events & EVENT_RELIC) {
          screen = SCREEN_RELIC;
          input.flush();
          announce('A relic of the fallen sky: choose one.');
          break;
        }
        if (events & EVENT_OVER) {
          reason = state.spire.hp <= 0 ? 'The spire’s light was snuffed out.' : 'The warden fell beneath the gloom.';
          saveBestIfBeaten();
          screen = SCREEN_OVER;
          endShownAtMs = performance.now();
          input.flush();
          announce(`Game over. Score ${state.score}.`);
          break;
        }
        if (events & EVENT_WIN) {
          saveBestIfBeaten();
          screen = SCREEN_WIN;
          endShownAtMs = performance.now();
          input.flush();
          announce(`Victory! Score ${state.score}.`);
          break;
        }
      }
      particles.update(frameDt);
      announceTimer += frameDt;
      if (announceTimer > 5) {
        announceTimer = 0;
        announce(`Playing: wave ${state.wave} of 12, score ${state.score}, spire ${Math.ceil(state.spire.hp)}.`);
      }
    }

    audio.music(frameDt, musicMood());
    drawFrame();
  }

  requestAnimationFrame(frame);
}

const shot = params.get('shot');
if (params.has('selftest')) {
  runSelfTest();
} else if (shot !== null) {
  runShot(shot);
} else {
  runGame();
}

if (params.has('debug')) {
  window.__game = { world, get screen() { return screen; }, get state() { return state; } };
}

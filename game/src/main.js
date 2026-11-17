// The boot and the frame loop: screens, sounds, announcements and the fixed
// step. In shot mode (?shot=start|play|boss|win) it stages one scene, paints
// twice, and raises window.__shotReady for the capture tool. In play mode it
// runs the game: title, tides, boons, pause, and both endings.

import { STEP } from './config.js';
import { createRandom, randomSeed } from './random.js';
import { readBest, readMuted, readShakeOn, saveBest, saveMuted, saveShakeOn } from './save.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAYING, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './screens.js';
import { EVENT_BEACON_HIT, EVENT_DASH, EVENT_EXPLODE, EVENT_HIT, EVENT_KILL, EVENT_LEVELUP, EVENT_NOVA, EVENT_OVER, EVENT_PICKUP, EVENT_ROAR, EVENT_SHARD, EVENT_SHIELD, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WAVE_START, EVENT_WIN } from './events.js';
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
  announce('Playing: defend the beacon through 12 tides.');
}

function showTitle() {
  world.reset();
  world.seedAttract();
  screen = SCREEN_TITLE;
  input.flush();
  announce('Gloamtide. Press Space or click to dive in.');
}

function playEvents(events) {
  if (events & EVENT_SHOOT) audio.shoot();
  if (events & EVENT_HIT) audio.hurt();
  if (events & EVENT_BEACON_HIT) audio.beaconHit();
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

function handleUpgrade(clicks) {
  const pick = input.takeUpgradePick();
  if (pick >= 0) {
    chooseCard(pick);
    return;
  }
  const rects = renderer.upgradeRects();
  for (const click of clicks) {
    for (let index = 0; index < rects.length; index += 1) {
      if (inside(rects[index], click)) {
        chooseCard(index);
        return;
      }
    }
  }
}

function chooseCard(index) {
  if (!world.chooseUpgrade(index)) return;
  audio.upgrade();
  if (state.phase !== 'levelup') {
    screen = SCREEN_PLAYING;
    input.flush();
    announce(`Playing: level ${state.level}.`);
  } else {
    announce(`Level ${state.level}: choose another boon.`);
  }
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

let endShownAtMs = 0;

function drawFrame() {
  renderer.draw(state, screen, {
    best,
    muted,
    shakeOn,
    remaining: world.remainingFoes(),
    reason,
  });
}

function runShot(name) {
  screen = stageShot(name, world);
  if (screen === SCREEN_TITLE) {
    announce('Gloamtide. Press Space or click to dive in.');
  } else if (screen === SCREEN_WIN) {
    saveBestIfBeaten();
    announce('Victory: the deep is calm.');
  } else {
    announce('Playing: defend the beacon through 12 tides.');
  }
  drawFrame();
  drawFrame();
  window.__shotReady = true;
}

function runGame() {
  showTitle();
  let last = performance.now();
  let accumulator = 0;
  let hitStopLeft = 0;

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
        if (events & EVENT_OVER) {
          reason = state.beacon.hp <= 0 ? 'The beacon\u2019s light was snuffed out.' : 'The keeper fell beneath the tide.';
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
        announce(`Playing: tide ${state.tide} of 12, score ${state.score}, beacon ${Math.ceil(state.beacon.hp)}.`);
      }
    }

    audio.music(frameDt, musicMood());
    drawFrame();
  }

  requestAnimationFrame(frame);
}

const shot = params.get('shot');
if (shot !== null) {
  runShot(shot);
} else {
  runGame();
}

if (params.has('debug')) {
  window.__game = { world, get screen() { return screen; }, get state() { return state; } };
}

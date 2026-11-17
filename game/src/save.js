// The few things that survive between visits: the best score and the
// player's sound and shake toggles. Every read is guarded, so a browser
// without storage (or a blocked one) simply plays fresh each time.

import { BEST_KEY, MUTE_KEY, SHAKE_KEY } from './config.js';

function readStored(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the setting lives for this visit only.
  }
}

/** The best score on record, or 0 when none has been saved. */
export function readBest() {
  const value = Number.parseInt(readStored(BEST_KEY, '0'), 10);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function saveBest(score) {
  writeStored(BEST_KEY, String(score));
}

/** Whether the player muted the sound last time. */
export function readMuted() {
  return readStored(MUTE_KEY, '0') === '1';
}

export function saveMuted(muted) {
  writeStored(MUTE_KEY, muted ? '1' : '0');
}

/** Whether screen shake is on (it is, unless the player turned it off). */
export function readShakeOn() {
  return readStored(SHAKE_KEY, '1') !== '0';
}

export function saveShakeOn(on) {
  writeStored(SHAKE_KEY, on ? '1' : '0');
}

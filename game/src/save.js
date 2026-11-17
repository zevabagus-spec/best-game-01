// The few things kept between visits: the best score and the player's sound
// and shake toggles. Everything is guarded: with storage off (a private
// window, a sandbox) the game simply keeps them for this visit only.
import { BEST_KEY, MUTE_KEY, SHAKE_KEY } from './config.js';

function storageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readNumber(key) {
  if (!storageAvailable()) return 0;
  try {
    return Math.max(0, Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0);
  } catch {
    return 0;
  }
}

function readFlag(key, fallback) {
  if (!storageAvailable()) return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function writeValue(key, value) {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be off: the setting then lasts this visit only.
  }
}

export function readBest() {
  return readNumber(BEST_KEY);
}

export function saveBest(value) {
  writeValue(BEST_KEY, String(value));
}

export function readMuted() {
  return readFlag(MUTE_KEY, false);
}

export function saveMuted(muted) {
  writeValue(MUTE_KEY, muted ? '1' : '0');
}

export function readShakeOn() {
  return readFlag(SHAKE_KEY, true);
}

export function saveShakeOn(enabled) {
  writeValue(SHAKE_KEY, enabled ? '1' : '0');
}

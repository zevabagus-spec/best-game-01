// The screens drawn over the water: the title with its how-to-play, the
// level-up choice of three cards, the pause menu, and the two endings. The
// renderer draws the world first; these draw on top. The rect helpers report
// where the clickable cards and buttons are, in field coordinates.

import { FIELD, FONT, PALETTE } from './config.js';
import { formatTime, shotAccuracy, starCount } from './stats.js';
import { stacksOf } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAYING = 'playing';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD_WIDTH = 280;
const CARD_HEIGHT = 220;
const CARD_GAP = 30;
const CARD_Y = 260;

function dim(context, alpha) {
  context.fillStyle = `rgba(2, 10, 18, ${alpha})`;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
}

function panel(context, x, y, width, height, fill, edge) {
  context.fillStyle = fill ?? PALETTE.panel;
  context.strokeStyle = edge ?? PALETTE.panelEdge;
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(x, y, width, height, 14);
  context.fill();
  context.stroke();
}

function heading(context, text, y, size, color) {
  context.textAlign = 'center';
  context.font = `800 ${size}px ${FONT}`;
  context.fillStyle = color ?? PALETTE.text;
  context.fillText(text, FIELD.width / 2, y);
}

function line(context, text, y, size, color, weight) {
  context.textAlign = 'center';
  context.font = `${weight ?? 400} ${size}px ${FONT}`;
  context.fillStyle = color ?? PALETTE.text;
  context.fillText(text, FIELD.width / 2, y);
}

function star(context, x, y, outer, inner, filled) {
  context.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fillStyle = filled ? PALETTE.gold : 'rgba(255, 209, 102, 0.18)';
  context.fill();
  context.strokeStyle = PALETTE.gold;
  context.lineWidth = 2;
  context.stroke();
}

/** The three upgrade cards' rectangles, in field coordinates. */
export function upgradeRects() {
  const total = CARD_WIDTH * 3 + CARD_GAP * 2;
  const startX = (FIELD.width - total) / 2;
  return [0, 1, 2].map((index) => ({
    x: startX + index * (CARD_WIDTH + CARD_GAP),
    y: CARD_Y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  }));
}

/** The pause menu's buttons: id and rectangle, in field coordinates. */
export function pauseRects() {
  const width = 320;
  const height = 52;
  const x = (FIELD.width - width) / 2;
  return [
    { id: 'resume', x, y: 296, width, height },
    { id: 'restart', x, y: 360, width, height },
    { id: 'sound', x, y: 424, width, height },
    { id: 'shake', x, y: 488, width, height },
  ];
}

function drawButton(context, rect, label, highlighted) {
  panel(context, rect.x, rect.y, rect.width, rect.height, highlighted ? '#14324a' : PALETTE.card, highlighted ? PALETTE.cardPick : PALETTE.cardEdge);
  context.textAlign = 'center';
  context.font = `700 21px ${FONT}`;
  context.fillStyle = PALETTE.text;
  context.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 7);
}

/** The title: the name, the promise, and everything a new keeper needs. */
export function drawTitle(context, best, muted, shakeOn, time) {
  dim(context, 0.55);
  const bob = Math.sin(time * 1.2) * 4;
  heading(context, 'GLOAMTIDE', 138 + bob, 72, PALETTE.beaconGlow);
  line(context, 'KEEPER OF THE DROWNED LIGHT', 178 + bob, 21, PALETTE.gold, 700);

  panel(context, 330, 218, 620, 208, PALETTE.panel, PALETTE.panelEdge);
  context.textAlign = 'left';
  context.font = `700 22px ${FONT}`;
  context.fillStyle = PALETTE.beaconGlow;
  context.fillText('HOW TO PLAY', 360, 254);
  context.font = `400 18px ${FONT}`;
  context.fillStyle = PALETTE.text;
  const rows = [
    ['GOAL', 'Defend the beacon through 12 tides. Slay the Maw of the Deep.'],
    ['MOVE', 'WASD or arrow keys. Aim with the mouse, hold click to fire.'],
    ['DASH', 'Shift or Space — a burst of speed that nothing can touch.'],
    ['GROW', 'Gather lumens to level up and choose a boon after each level.'],
    ['FALL', 'If the beacon\u2019s light or your hearts run out, the deep wins.'],
  ];
  rows.forEach(([label, text], index) => {
    const y = 288 + index * 27;
    context.font = `800 17px ${FONT}`;
    context.fillStyle = PALETTE.gold;
    context.fillText(label, 360, y);
    context.font = `400 17px ${FONT}`;
    context.fillStyle = PALETTE.text;
    context.fillText(text, 430, y);
  });

  if (best > 0) {
    line(context, `BEST SCORE  ${best.toLocaleString()}`, 462, 20, PALETTE.gold, 700);
  }
  const pulse = 0.75 + Math.sin(time * 2.4) * 0.25;
  context.globalAlpha = pulse;
  line(context, 'PRESS SPACE OR CLICK TO DIVE IN', 512, 26, PALETTE.beaconCore, 800);
  context.globalAlpha = 1;
  line(context, `P pause   ·   M mute (${muted ? 'off' : 'on'})   ·   Shake ${shakeOn ? 'on' : 'off'}`, 552, 16, PALETTE.muted);
  line(context, 'A game of light against the deep — no quarter asked, none given.', 690, 15, PALETTE.muted);
}

/** The level-up choice: three boons, one pick. */
export function drawUpgrade(context, state) {
  dim(context, 0.62);
  heading(context, 'THE LIGHT GROWS', 168, 46, PALETTE.beaconGlow);
  line(context, `LEVEL ${state.level} — CHOOSE A BOON`, 206, 21, PALETTE.gold, 700);
  const rects = upgradeRects();
  state.cards.forEach((card, index) => {
    const rect = rects[index];
    const stacks = stacksOf(state.build, card.id);
    panel(context, rect.x, rect.y, rect.width, rect.height, PALETTE.card, PALETTE.cardEdge);
    context.fillStyle = PALETTE.upgradeGlow;
    context.beginPath();
    context.roundRect(rect.x + 6, rect.y + 6, rect.width - 12, rect.height - 12, 10);
    context.fill();
    context.textAlign = 'center';
    context.font = `800 24px ${FONT}`;
    context.fillStyle = PALETTE.beaconGlow;
    context.fillText(card.name, rect.x + rect.width / 2, rect.y + 58);
    context.font = `400 17px ${FONT}`;
    context.fillStyle = PALETTE.text;
    wrapText(context, card.blurb, rect.x + rect.width / 2, rect.y + 96, rect.width - 36, 23);
    context.font = `700 15px ${FONT}`;
    if (stacks > 0) {
      context.fillStyle = PALETTE.gold;
      context.fillText(`Held: ${stacks} / ${card.max === 99 ? '∞' : card.max}`, rect.x + rect.width / 2, rect.y + 158);
    } else {
      context.fillStyle = PALETTE.player;
      context.fillText('NEW', rect.x + rect.width / 2, rect.y + 158);
    }
    context.font = `800 20px ${FONT}`;
    context.fillStyle = PALETTE.cardPick;
    context.fillText(`[${index + 1}]`, rect.x + rect.width / 2, rect.y + rect.height - 20);
  });
  line(context, 'Click a card, or press 1, 2 or 3.', 536, 18, PALETTE.muted);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let current = '';
  let lineY = y;
  for (const word of words) {
    const trial = current === '' ? word : `${current} ${word}`;
    if (context.measureText(trial).width > maxWidth && current !== '') {
      context.fillText(current, x, lineY);
      current = word;
      lineY += lineHeight;
    } else {
      current = trial;
    }
  }
  context.fillText(current, x, lineY);
}

/** The pause menu: resume, restart, and the two toggles. */
export function drawPaused(context, muted, shakeOn) {
  dim(context, 0.66);
  heading(context, 'PAUSED', 210, 52, PALETTE.beaconGlow);
  line(context, 'The tide waits for no keeper — except this once.', 248, 18, PALETTE.muted);
  const rects = pauseRects();
  drawButton(context, rects[0], 'RESUME', true);
  drawButton(context, rects[1], 'RESTART RUN', false);
  drawButton(context, rects[2], muted ? 'SOUND: OFF' : 'SOUND: ON', false);
  drawButton(context, rects[3], shakeOn ? 'SCREEN SHAKE: ON' : 'SCREEN SHAKE: OFF', false);
  line(context, 'P or Esc to resume   ·   M to mute', 580, 16, PALETTE.muted);
}

function statRows(context, state, best, y) {
  const stats = state.stats;
  const rows = [
    ['Score', state.score.toLocaleString()],
    ['Best', Math.max(best, state.score).toLocaleString()],
    ['Time', formatTime(stats.timePlayed)],
    ['Tide reached', `${state.tide} / 12`],
    ['Creatures slain', stats.kills.toLocaleString()],
    ['Level', String(state.level)],
    ['Bolt accuracy', `${shotAccuracy(stats)}%`],
    ['Pickups gathered', String(stats.pickupsTaken)],
  ];
  const leftX = FIELD.width / 2 - 250;
  const rightX = FIELD.width / 2 + 40;
  rows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column === 0 ? leftX : rightX;
    const rowY = y + row * 30;
    context.textAlign = 'left';
    context.font = `400 18px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.fillText(label, x, rowY);
    context.font = `700 18px ${FONT}`;
    context.fillStyle = PALETTE.text;
    context.fillText(value, x + 170, rowY);
  });
}

/** The defeat screen: why the light went out, and the run's scorecard. */
export function drawOver(context, state, best, reason) {
  dim(context, 0.72);
  heading(context, 'THE LIGHT GOES OUT', 150, 50, PALETTE.danger);
  line(context, reason, 190, 20, PALETTE.text);
  panel(context, FIELD.width / 2 - 300, 220, 600, 170, PALETTE.panel, PALETTE.panelEdge);
  statRows(context, state, best, 258);
  const pulse = 0.75 + Math.sin(state.time * 2.4) * 0.25;
  context.globalAlpha = pulse;
  line(context, 'PRESS SPACE OR CLICK TO TRY AGAIN', 460, 25, PALETTE.beaconCore, 800);
  context.globalAlpha = 1;
  line(context, 'The beacon is relit. The deep will rise again.', 690, 15, PALETTE.muted);
}

/** The victory screen: stars, the scorecard, and the calm after. */
export function drawWin(context, state, best) {
  dim(context, 0.6);
  heading(context, 'THE DEEP IS CALM', 132, 52, PALETTE.gold);
  line(context, 'The Maw is gone. The beacon burns on.', 172, 20, PALETTE.text);
  const stars = starCount(state.stats, true, state.beacon.hp, state.beacon.maxHp);
  for (let index = 0; index < 3; index += 1) {
    star(context, FIELD.width / 2 - 70 + index * 70, 226, 30, 13, index < stars);
  }
  panel(context, FIELD.width / 2 - 300, 268, 600, 170, PALETTE.panel, PALETTE.panelEdge);
  statRows(context, state, best, 306);
  const pulse = 0.75 + Math.sin(state.time * 2.4) * 0.25;
  context.globalAlpha = pulse;
  line(context, 'PRESS SPACE OR CLICK TO DIVE AGAIN', 506, 25, PALETTE.beaconCore, 800);
  context.globalAlpha = 1;
  line(context, 'Three stars: win with half the beacon\u2019s light and two hearts to spare.', 690, 15, PALETTE.muted);
}

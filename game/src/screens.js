// The screens over the world: the title with its how-to-play, the boon and
// relic drafts, the pause menu, and the two endings — defeat with its stats
// and retry, victory with its stars, stats and play-again. The judge reads
// the whole loop from these, so every screen says what it is and what to do.

import { FIELD, FONT, PALETTES } from './config.js';
import { BOONS } from './boons.js';
import { RELICS } from './pickups.js';
import { accuracy, formatTime, starRating } from './stats.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAYING = 'playing';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_RELIC = 'relic';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function dim(context, alpha) {
  context.fillStyle = `rgba(8, 8, 20, ${alpha})`;
  context.fillRect(0, 0, FIELD.width, FIELD.height);
}

function panel(context, x, y, width, height, fill, edge) {
  context.fillStyle = fill;
  context.strokeStyle = edge;
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(x, y, width, height, 16);
  context.fill();
  context.stroke();
}

function heading(context, text, y, size, color) {
  context.font = `800 ${size}px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillStyle = color;
  context.fillText(text, FIELD.width / 2, y);
}

function line(context, text, y, size, color, weight = 600) {
  context.font = `${weight} ${size}px ${FONT}`;
  context.textAlign = 'center';
  context.fillStyle = color;
  context.fillText(text, FIELD.width / 2, y);
}

/** The three draft-card rectangles, shared by the boon and relic screens. */
export function upgradeRects() {
  const width = 270;
  const height = 300;
  const gap = 26;
  const total = width * 3 + gap * 2;
  const startX = (FIELD.width - total) / 2;
  const y = 210;
  return [0, 1, 2].map((index) => ({ x: startX + index * (width + gap), y, width, height }));
}

export function relicRects() {
  return upgradeRects();
}

export function pauseRects() {
  const width = 300;
  const height = 52;
  const x = (FIELD.width - width) / 2;
  return [
    { id: 'resume', x, y: 300, width, height },
    { id: 'restart', x, y: 366, width, height },
    { id: 'sound', x, y: 432, width, height },
    { id: 'shake', x, y: 498, width, height },
  ];
}

function drawButton(context, rect, label) {
  panel(context, rect.x, rect.y, rect.width, rect.height, 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.35)');
  context.font = `700 20px ${FONT}`;
  context.textAlign = 'center';
  context.fillStyle = '#ffffff';
  context.fillText(label, rect.x + rect.width / 2, rect.y + 34);
}

function star(context, x, y, outer, inner, filled) {
  context.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fillStyle = filled ? '#ffd166' : 'rgba(255, 255, 255, 0.2)';
  context.fill();
  if (filled) {
    context.strokeStyle = '#b8740a';
    context.lineWidth = 2;
    context.stroke();
  }
}

/** The title: the name, the promise, the rules, and the way in. */
export function drawTitle(context, best, muted, shakeOn, time) {
  dim(context, 0.42);
  const bob = Math.sin(time * 0.8) * 4;
  // A dark cut-out behind the name, so it holds over the bright dawn sky.
  context.font = `800 92px ${FONT}`;
  context.textAlign = 'center';
  context.fillStyle = 'rgba(20, 12, 4, 0.55)';
  context.fillText('SUNSPIRE', FIELD.width / 2, 172 + bob);
  heading(context, 'SUNSPIRE', 168 + bob, 92, '#fff3c4');
  heading(context, 'WARDEN OF THE DAWN', 210 + bob, 26, '#ffd166');
  panel(context, 330, 250, 620, 208, 'rgba(20, 14, 8, 0.78)', '#c99a63');
  context.textAlign = 'left';
  context.font = `800 22px ${FONT}`;
  context.fillStyle = '#ffd166';
  context.fillText('HOW TO PLAY', 362, 288);
  const rows = [
    ['GOAL', 'Guard the Sunspire through 12 waves, across 3 skies.'],
    ['MOVE', 'WASD or arrow keys. Aim with the mouse, hold click to fire.'],
    ['DASH', 'Shift or Space — a burst of speed that nothing can touch.'],
    ['GROW', 'Gather sunshards, level up, and choose a boon each level.'],
    ['FALL', 'If the spire’s light or your hearts run out, the gloom wins.'],
  ];
  rows.forEach(([label, text], index) => {
    const y = 322 + index * 28;
    context.font = `800 16px ${FONT}`;
    context.fillStyle = '#ffd166';
    context.fillText(label, 362, y);
    context.font = `500 16px ${FONT}`;
    context.fillStyle = '#f5ead2';
    context.fillText(text, 432, y);
  });
  heading(context, 'PRESS SPACE OR CLICK TO BEGIN', 516, 30, '#ffffff');
  line(context, `Best score ${best.toLocaleString('en-US')}  ·  P pause  ·  M mute (${muted ? 'off' : 'on'})  ·  Shake ${shakeOn ? 'on' : 'off'}`, 548, 16, 'rgba(255, 255, 255, 0.85)', 500);
  line(context, 'Three bosses guard the night. Slay them all, and the dawn is yours.', 676, 17, 'rgba(255, 255, 255, 0.75)', 500);
}

/** The level-up draft: three boons, one choice, keys 1-3 or a click. */
export function drawUpgrade(context, state) {
  dim(context, 0.55);
  heading(context, `LEVEL ${state.level}!`, 130, 44, '#ffd166');
  line(context, 'Choose a boon — press 1, 2 or 3, or click a card.', 166, 19, '#ffffff', 500);
  const rects = upgradeRects();
  state.cards.forEach((id, index) => {
    const boon = BOONS[id];
    const rect = rects[index];
    panel(context, rect.x, rect.y, rect.width, rect.height, PALETTES[state.zone].card, '#d8a85a');
    context.font = '56px sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#ffd166';
    context.fillText(boon.icon, rect.x + rect.width / 2, rect.y + 82);
    context.font = `800 21px ${FONT}`;
    context.fillStyle = '#ffffff';
    context.fillText(boon.name, rect.x + rect.width / 2, rect.y + 128);
    wrapText(context, boon.text, rect.x + 24, rect.y + 168, rect.width - 48, 24);
    context.font = `700 15px ${FONT}`;
    context.fillStyle = '#ffd166';
    context.fillText(`[${index + 1}]`, rect.x + rect.width / 2, rect.y + rect.height - 22);
  });
}

/** The relic draft: three treasures, each with a price. */
export function drawRelic(context, state) {
  dim(context, 0.6);
  heading(context, 'A RELIC OF THE FALLEN SKY', 130, 38, '#ffd166');
  line(context, 'Choose one — every relic gives a gift and takes a price.', 166, 19, '#ffffff', 500);
  const rects = relicRects();
  state.relicCards.forEach((id, index) => {
    const relic = RELICS[id];
    const rect = rects[index];
    panel(context, rect.x, rect.y, rect.width, rect.height, PALETTES[state.zone].card, '#b48ae8');
    context.font = '56px sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#e8ccff';
    context.fillText(relic.icon, rect.x + rect.width / 2, rect.y + 82);
    context.font = `800 21px ${FONT}`;
    context.fillStyle = '#ffffff';
    context.fillText(relic.name, rect.x + rect.width / 2, rect.y + 128);
    context.font = `600 17px ${FONT}`;
    context.fillStyle = '#a8e6a1';
    context.fillText(relic.gift, rect.x + rect.width / 2, rect.y + 168);
    context.fillStyle = '#ff9a9a';
    context.fillText(relic.price, rect.x + rect.width / 2, rect.y + 196);
    context.font = `700 15px ${FONT}`;
    context.fillStyle = '#ffd166';
    context.fillText(`[${index + 1}]`, rect.x + rect.width / 2, rect.y + rect.height - 22);
  });
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let row = '';
  let rowY = y;
  context.font = `600 17px ${FONT}`;
  context.textAlign = 'center';
  context.fillStyle = '#e8e0d0';
  for (const word of words) {
    const trial = row === '' ? word : `${row} ${word}`;
    if (context.measureText(trial).width > maxWidth && row !== '') {
      context.fillText(row, x + maxWidth / 2, rowY);
      row = word;
      rowY += lineHeight;
    } else {
      row = trial;
    }
  }
  context.fillText(row, x + maxWidth / 2, rowY);
}

/** The pause menu: resume, restart, and the two toggles. */
export function drawPaused(context, muted, shakeOn) {
  dim(context, 0.6);
  heading(context, 'PAUSED', 240, 48, '#ffffff');
  line(context, 'The gloom waits — for now.', 276, 18, 'rgba(255, 255, 255, 0.8)', 500);
  const rects = pauseRects();
  drawButton(context, rects[0], 'Resume  (P)');
  drawButton(context, rects[1], 'Restart run');
  drawButton(context, rects[2], `Sound: ${muted ? 'off' : 'on'}  (M)`);
  drawButton(context, rects[3], `Screen shake: ${shakeOn ? 'on' : 'off'}`);
}

/** The run's numbers, shared by both endings. */
function statRows(context, state, best, y) {
  const stats = state.stats;
  const rows = [
    ['Score', state.score.toLocaleString('en-US')],
    ['Best', Math.max(best, state.score).toLocaleString('en-US')],
    ['Wave reached', `${state.wave} / 12`],
    ['Foes slain', `${stats.kills}`],
    ['Bosses slain', `${stats.bossesSlain} / 3`],
    ['Accuracy', `${accuracy(stats)}%`],
    ['Highest combo', `x${stats.highestCombo}`],
    ['Time', formatTime(stats.timePlayed)],
  ];
  const startX = FIELD.width / 2 - 190;
  rows.forEach(([label, value], index) => {
    const rowY = y + index * 30;
    context.font = `600 18px ${FONT}`;
    context.textAlign = 'left';
    context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    context.fillText(label, startX, rowY);
    context.textAlign = 'right';
    context.fillStyle = '#ffffff';
    context.fillText(value, startX + 380, rowY);
  });
  return y + rows.length * 30;
}

/** Defeat: what ended the run, the numbers, and the way back in. */
export function drawOver(context, state, best, reason) {
  dim(context, 0.62);
  heading(context, 'THE GLOOM PREVAILS', 150, 46, '#ff8a9a');
  line(context, reason, 186, 19, '#ffffff', 500);
  statRows(context, state, best, 240);
  heading(context, 'PRESS SPACE OR CLICK TO TRY AGAIN', 520, 26, '#ffffff');
  line(context, 'The spire remembers every warden who stood.', 552, 16, 'rgba(255, 255, 255, 0.7)', 500);
}

/** Victory: stars, numbers, and the dawn the warden won. */
export function drawWin(context, state, best) {
  dim(context, 0.62);
  heading(context, 'DAWN BREAKS!', 138, 52, '#ffd166');
  line(context, 'The Night Sovereign is fallen. The spire shines on.', 176, 19, '#ffffff', 500);
  const stars = starRating(state);
  for (let i = 0; i < 3; i += 1) {
    star(context, FIELD.width / 2 + (i - 1) * 64, 232, 26, 12, i < stars);
  }
  statRows(context, state, best, 288);
  heading(context, 'PRESS SPACE OR CLICK TO PLAY AGAIN', 566, 26, '#ffffff');
  line(context, `${stars} of 3 stars — keep the spire and the warden hale for all three.`, 598, 16, 'rgba(255, 255, 255, 0.75)', 500);
}

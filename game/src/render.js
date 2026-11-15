// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 garden is scaled to fit the window and centred, the margin filled
// with the night colour. Every sprite is drawn in code — glowing lantern,
// flapping moths, ember trails — no image files, no fonts to fetch. Text that
// holds a number is rebuilt only when the number changes, so a frame allocates
// almost nothing.
import { FIELD, FONT, LANTERN, PALETTE, PLAYER, TOTAL_WAVES } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const CARDS = { width: 320, height: 210, gap: 24, top: 250 };
const HEART = { size: 22, gap: 8 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const bestLabel = cachedLabel('BEST ');
  const finalLabel = cachedLabel('SCORE ');
  const killsLabel = cachedLabel('Creatures banished ');
  const shardsLabel = cachedLabel('Shards gathered ');
  const comboLabel = cachedLabel('COMBO x');

  // The garden's decorations: fixed positions from one seed, so every visit
  // shows the same night garden.
  const decorRandom = createRandom(20261115);
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({ x: decorRandom() * FIELD.width, y: decorRandom() * FIELD.height * 0.5, r: 0.6 + decorRandom() * 1.4, tw: decorRandom() * Math.PI * 2 });
  }
  const tufts = [];
  for (let index = 0; index < 70; index += 1) {
    tufts.push({ x: decorRandom() * FIELD.width, y: 60 + decorRandom() * (FIELD.height - 120), s: 0.7 + decorRandom() * 0.9 });
  }
  const flowers = [];
  for (let index = 0; index < 26; index += 1) {
    const colors = ['#f27bb1', '#b79ced', '#e8e36a', '#9fe870'];
    flowers.push({ x: decorRandom() * FIELD.width, y: 60 + decorRandom() * (FIELD.height - 120), color: colors[index % colors.length] });
  }
  const stones = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    stones.push({ x: LANTERN.x + Math.cos(angle) * 74, y: LANTERN.y + Math.sin(angle) * 74, r: 7 + decorRandom() * 5 });
  }

  let skyGradient = null;
  let glowGradient = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    skyGradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    skyGradient.addColorStop(0, PALETTE.skyTop);
    skyGradient.addColorStop(1, PALETTE.skyBottom);
    glowGradient = context.createRadialGradient(LANTERN.x, LANTERN.y, 8, LANTERN.x, LANTERN.y, 240);
    glowGradient.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    glowGradient.addColorStop(0.5, 'rgba(255, 179, 71, 0.10)');
    glowGradient.addColorStop(1, 'rgba(255, 179, 71, 0)');
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight ? 'bold ' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function drawGarden(state) {
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Stars, twinkling with the clock.
    for (let index = 0; index < stars.length; index += 1) {
      const star = stars[index];
      context.globalAlpha = 0.35 + 0.35 * Math.sin(state.time * 1.4 + star.tw);
      circle(star.x, star.y, star.r, '#dfe6ff');
    }
    context.globalAlpha = 1;
    // Grass: a dark wash, then tufts and flowers.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.grassLight;
    context.lineWidth = 2;
    for (let index = 0; index < tufts.length; index += 1) {
      const tuft = tufts[index];
      context.beginPath();
      context.moveTo(tuft.x - 5 * tuft.s, tuft.y);
      context.lineTo(tuft.x - 2 * tuft.s, tuft.y - 9 * tuft.s);
      context.moveTo(tuft.x, tuft.y);
      context.lineTo(tuft.x, tuft.y - 11 * tuft.s);
      context.moveTo(tuft.x + 5 * tuft.s, tuft.y);
      context.lineTo(tuft.x + 2 * tuft.s, tuft.y - 9 * tuft.s);
      context.stroke();
    }
    for (let index = 0; index < flowers.length; index += 1) {
      const flower = flowers[index];
      circle(flower.x, flower.y, 3.5, flower.color);
      circle(flower.x, flower.y, 1.4, '#fff7d6');
    }
    // The stone ring where the lantern stands.
    for (let index = 0; index < stones.length; index += 1) {
      const stone = stones[index];
      circle(stone.x, stone.y, stone.r, PALETTE.stone);
      circle(stone.x - stone.r * 0.25, stone.y - stone.r * 0.25, stone.r * 0.45, '#4a5470');
    }
    context.fillStyle = '#20263c';
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y, 58, 0, Math.PI * 2);
    context.fill();
  }

  function drawLantern(state) {
    const flicker = 0.9 + 0.1 * Math.sin(state.time * 7) + 0.04 * Math.sin(state.time * 13.7);
    const health = state.lantern.hp / state.lantern.maxHp;
    context.globalAlpha = (0.55 + 0.45 * health) * flicker;
    context.fillStyle = glowGradient;
    context.fillRect(LANTERN.x - 240, LANTERN.y - 240, 480, 480);
    context.globalAlpha = 1;
    // The lantern itself: a post, a warm orb, a little roof.
    context.fillStyle = '#2c3350';
    context.fillRect(LANTERN.x - 4, LANTERN.y + 8, 8, 22);
    context.fillStyle = '#3a4157';
    context.beginPath();
    context.moveTo(LANTERN.x - 20, LANTERN.y - 12);
    context.lineTo(LANTERN.x + 20, LANTERN.y - 12);
    context.lineTo(LANTERN.x + 12, LANTERN.y - 24);
    context.lineTo(LANTERN.x - 12, LANTERN.y - 24);
    context.closePath();
    context.fill();
    const orb = context.createRadialGradient(LANTERN.x, LANTERN.y + 4, 2, LANTERN.x, LANTERN.y + 4, LANTERN.radius);
    orb.addColorStop(0, PALETTE.lanternCore);
    orb.addColorStop(1, PALETTE.lanternGlow);
    context.fillStyle = orb;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y + 4, LANTERN.radius, 0, Math.PI * 2);
    context.fill();
    // Health ring around the lantern: the light itself shows how much is left.
    context.strokeStyle = health > 0.4 ? PALETTE.lanternGlow : PALETTE.danger;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y + 4, LANTERN.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * health);
    context.stroke();
  }

  function drawEnemy(enemy, time) {
    const flash = enemy.flash > 0;
    const flap = Math.sin(time * 14 + enemy.wobble * 5);
    context.save();
    context.translate(enemy.x, enemy.y);
    if (enemy.kind === 'moth') {
      const wing = 1 + flap * 0.35;
      context.fillStyle = PALETTE.mothWing;
      context.beginPath();
      context.ellipse(-enemy.radius * 0.8, -4, enemy.radius * 0.9, enemy.radius * 0.55 * wing, -0.5, 0, Math.PI * 2);
      context.ellipse(enemy.radius * 0.8, -4, enemy.radius * 0.9, enemy.radius * 0.55 * wing, 0.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.moth;
      context.beginPath();
      context.ellipse(0, 0, enemy.radius * 0.45, enemy.radius * 0.9, 0, 0, Math.PI * 2);
      context.fill();
      circle(-3, -enemy.radius * 0.4, 1.6, '#1a1030');
      circle(3, -enemy.radius * 0.4, 1.6, '#1a1030');
    } else if (enemy.kind === 'gnat') {
      context.globalAlpha = 0.9;
      circle(0, 0, enemy.radius, PALETTE.gnat);
      context.globalAlpha = 0.5;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.ellipse(-enemy.radius, -enemy.radius * 0.6, enemy.radius * 0.9, enemy.radius * 0.4 * (1 + flap * 0.4), -0.6, 0, Math.PI * 2);
      context.ellipse(enemy.radius, -enemy.radius * 0.6, enemy.radius * 0.9, enemy.radius * 0.4 * (1 + flap * 0.4), 0.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    } else if (enemy.kind === 'beetle') {
      context.strokeStyle = '#2a0f0c';
      context.lineWidth = 2;
      for (let leg = -1; leg <= 1; leg += 1) {
        context.beginPath();
        context.moveTo(-enemy.radius * 0.6, leg * enemy.radius * 0.5);
        context.lineTo(-enemy.radius * 1.25, leg * enemy.radius * 0.8);
        context.moveTo(enemy.radius * 0.6, leg * enemy.radius * 0.5);
        context.lineTo(enemy.radius * 1.25, leg * enemy.radius * 0.8);
        context.stroke();
      }
      context.fillStyle = PALETTE.beetle;
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.beetleShell;
      context.beginPath();
      context.arc(0, -enemy.radius * 0.25, enemy.radius * 0.62, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.beetleShell;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -enemy.radius);
      context.lineTo(0, enemy.radius);
      context.stroke();
    } else if (enemy.kind === 'bomber') {
      const pulse = 1 + Math.sin(time * 6 + enemy.wobble) * 0.18;
      context.globalAlpha = 0.35;
      circle(0, 0, enemy.radius * 1.9 * pulse, PALETTE.bomber);
      context.globalAlpha = 1;
      circle(0, 0, enemy.radius * pulse, PALETTE.bomber);
      circle(0, 0, enemy.radius * 0.45, PALETTE.bomberCore);
    } else if (enemy.kind === 'thief') {
      context.rotate(Math.sin(time * 9 + enemy.wobble) * 0.3);
      context.fillStyle = PALETTE.thief;
      context.beginPath();
      context.moveTo(0, -enemy.radius * 1.3);
      context.lineTo(enemy.radius, 0);
      context.lineTo(0, enemy.radius * 1.3);
      context.lineTo(-enemy.radius, 0);
      context.closePath();
      context.fill();
      circle(0, 0, enemy.radius * 0.35, '#ffffff');
    } else if (enemy.kind === 'queen') {
      const wing = 1 + flap * 0.25;
      context.fillStyle = PALETTE.queenWing;
      context.beginPath();
      context.ellipse(-enemy.radius * 0.95, -6, enemy.radius * 1.05, enemy.radius * 0.6 * wing, -0.45, 0, Math.PI * 2);
      context.ellipse(enemy.radius * 0.95, -6, enemy.radius * 1.05, enemy.radius * 0.6 * wing, 0.45, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.queen;
      context.beginPath();
      context.ellipse(0, 0, enemy.radius * 0.5, enemy.radius * 0.95, 0, 0, Math.PI * 2);
      context.fill();
      // Crown spikes.
      context.strokeStyle = PALETTE.lanternGlow;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-12, -enemy.radius * 0.8);
      context.lineTo(-8, -enemy.radius * 1.25);
      context.moveTo(0, -enemy.radius * 0.9);
      context.lineTo(0, -enemy.radius * 1.4);
      context.moveTo(12, -enemy.radius * 0.8);
      context.lineTo(8, -enemy.radius * 1.25);
      context.stroke();
      circle(-5, -enemy.radius * 0.35, 2.5, '#1a1030');
      circle(5, -enemy.radius * 0.35, 2.5, '#1a1030');
      // Health bar over the queen.
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fillRect(-34, -enemy.radius - 18, 68, 7);
      context.fillStyle = PALETTE.queen;
      context.fillRect(-34, -enemy.radius - 18, 68 * (enemy.hp / enemy.maxHp), 7);
    }
    if (flash) {
      context.globalAlpha = 0.65;
      circle(0, 0, enemy.radius, '#ffffff');
      context.globalAlpha = 1;
    }
    context.restore();
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
      const bob = Math.sin(time * 3) * 3;
      const glow = context.createRadialGradient(player.x, player.y + bob, 2, player.x, player.y + bob, 44);
      glow.addColorStop(0, 'rgba(142, 246, 255, 0.5)');
      glow.addColorStop(1, 'rgba(142, 246, 255, 0)');
      context.fillStyle = glow;
      context.fillRect(player.x - 44, player.y + bob - 44, 88, 88);
      // The keeper: a little hooded wisp with a warm ember heart.
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.moveTo(player.x, player.y + bob - PLAYER.radius - 6);
      context.quadraticCurveTo(player.x + PLAYER.radius + 2, player.y + bob - 4, player.x + PLAYER.radius * 0.7, player.y + bob + PLAYER.radius * 0.8);
      context.quadraticCurveTo(player.x, player.y + bob + PLAYER.radius * 0.4, player.x - PLAYER.radius * 0.7, player.y + bob + PLAYER.radius * 0.8);
      context.quadraticCurveTo(player.x - PLAYER.radius - 2, player.y + bob - 4, player.x, player.y + bob - PLAYER.radius - 6);
      context.fill();
      circle(player.x, player.y + bob - 2, 4, PALETTE.emberCore);
      circle(player.x - 5, player.y + bob - 8, 1.8, '#0a2030');
      circle(player.x + 5, player.y + bob - 8, 1.8, '#0a2030');
      // Aim tick: a short line toward the mouse.
      const aimDx = player.aimX - player.x;
      const aimDy = player.aimY - player.y;
      const aimLen = Math.hypot(aimDx, aimDy) || 1;
      context.strokeStyle = 'rgba(142, 246, 255, 0.55)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(player.x + (aimDx / aimLen) * (PLAYER.radius + 4), player.y + (aimDy / aimLen) * (PLAYER.radius + 4));
      context.lineTo(player.x + (aimDx / aimLen) * (PLAYER.radius + 14), player.y + (aimDy / aimLen) * (PLAYER.radius + 14));
      context.stroke();
    }
  }

  function drawHud(state, best, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 28, PALETTE.text, 'left', true);
    if (state.multiplier > 1) {
      text(comboLabel(state.multiplier), 24, 52, 20, PALETTE.cardPick, 'left', true);
    }
    text(`${waveLabel(state.wave)} / ${TOTAL_WAVES}`, FIELD.width / 2, 18, 28, PALETTE.text, 'center', true);
    text(bestLabel(best), FIELD.width - 24, 18, 24, PALETTE.muted, 'right');
    // Hearts, top right under the best score.
    const firstHeart = FIELD.width - 24 - state.player.maxHp * (HEART.size + HEART.gap) + HEART.gap;
    for (let heart = 0; heart < state.player.maxHp; heart += 1) {
      const x = firstHeart + heart * (HEART.size + HEART.gap);
      const y = 52;
      context.fillStyle = heart < state.player.hp ? '#ff6b81' : 'rgba(255, 255, 255, 0.15)';
      context.beginPath();
      context.moveTo(x + HEART.size / 2, y + HEART.size * 0.9);
      context.bezierCurveTo(x, y + HEART.size * 0.45, x + HEART.size * 0.15, y, x + HEART.size / 2, y + HEART.size * 0.3);
      context.bezierCurveTo(x + HEART.size * 0.85, y, x + HEART.size, y + HEART.size * 0.45, x + HEART.size / 2, y + HEART.size * 0.9);
      context.fill();
    }
    // Lantern light bar, top right under the hearts.
    const barWidth = 190;
    const barX = FIELD.width - 24 - barWidth;
    const barY = 86;
    const health = state.lantern.hp / state.lantern.maxHp;
    context.fillStyle = 'rgba(0, 0, 0, 0.45)';
    context.fillRect(barX, barY, barWidth, 12);
    context.fillStyle = health > 0.4 ? PALETTE.lanternGlow : PALETTE.danger;
    context.fillRect(barX, barY, barWidth * health, 12);
    text('LANTERN', barX, barY - 20, 13, PALETTE.muted, 'left');
    if (muted) text('M — sound off', FIELD.width - 24, FIELD.height - 30, 15, PALETTE.muted, 'right');
  }

  function drawBanner(state) {
    if (state.bannerTimer <= 0 || !state.banner) return;
    const alpha = Math.min(1, state.bannerTimer);
    context.globalAlpha = alpha;
    context.textBaseline = 'alphabetic';
    text(state.banner, FIELD.width / 2, 190, 52, PALETTE.text, 'center', true);
    if (state.bannerSub) text(state.bannerSub, FIELD.width / 2, 228, 22, PALETTE.muted, 'center');
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, PALETTE.text, 'center', true);
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 24, PALETTE.cardPick, 'center');
  }

  const TITLE_LINES = [
    'The moths come for the last lantern.',
    'Hold the light through 10 waves.',
    'Move with WASD or arrows. Aim with the mouse.',
    'Hold click to throw embers. Pick an upgrade',
    'between waves — then face the Moth Queen.',
    '',
  ];
  const PAUSED_LINES = ['The night waits for you.'];
  const OVER_LINES = ['', '', '', ''];
  const WIN_LINES = ['', '', '', ''];

  /** The three upgrade cards, in field coordinates, for click hit-testing. */
  function upgradeRects() {
    const total = 3 * CARDS.width + 2 * CARDS.gap;
    const startX = (FIELD.width - total) / 2;
    const rects = [];
    for (let index = 0; index < 3; index += 1) {
      rects.push({
        x: startX + index * (CARDS.width + CARDS.gap),
        y: CARDS.top,
        width: CARDS.width,
        height: CARDS.height,
      });
    }
    return rects;
  }

  function drawUpgrade(state, best) {
    context.textBaseline = 'alphabetic';
    text(`Wave ${state.wave} cleared!`, FIELD.width / 2, 150, 44, PALETTE.text, 'center', true);
    text('Choose an upgrade — click a card, or press 1, 2 or 3.', FIELD.width / 2, 196, 22, PALETTE.muted, 'center');
    const rects = upgradeRects();
    for (let index = 0; index < 3; index += 1) {
      const upgrade = state.offered[index];
      const rect = rects[index];
      if (!upgrade) continue;
      context.fillStyle = PALETTE.card;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeStyle = PALETTE.cardEdge;
      context.lineWidth = 2;
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      text(`${index + 1}`, rect.x + 18, rect.y + 16, 20, PALETTE.muted, 'left', true);
      text(upgrade.name, rect.x + rect.width / 2, rect.y + 66, 26, PALETTE.text, 'center', true);
      // Word-wrap the blurb across the card.
      context.font = `19px ${FONT}`;
      const words = upgrade.blurb.split(' ');
      let line = '';
      let lineY = rect.y + 116;
      for (let word = 0; word < words.length; word += 1) {
        const test = line === '' ? words[word] : `${line} ${words[word]}`;
        if (context.measureText(test).width > rect.width - 48 && line !== '') {
          text(line, rect.x + rect.width / 2, lineY, 19, PALETTE.muted, 'center');
          line = words[word];
          lineY += 26;
        } else {
          line = test;
        }
      }
      if (line !== '') text(line, rect.x + rect.width / 2, lineY, 19, PALETTE.muted, 'center');
      const taken = state.taken[upgrade.id] ?? 0;
      if (taken > 0) text(`Owned x${taken}`, rect.x + rect.width / 2, rect.y + rect.height - 30, 16, PALETTE.cardPick, 'center');
    }
  }

  /** Paint one frame: the garden, the creatures, the HUD, then the screen's panel. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.skyTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 18 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 18 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawGarden(state);
    drawLantern(state);
    // Shards under the creatures.
    for (let index = 0; index < state.shards.length; index += 1) {
      const shard = state.shards[index];
      if (!shard.active) continue;
      context.save();
      context.translate(shard.x, shard.y);
      context.rotate(state.time * 3 + index);
      context.fillStyle = PALETTE.shard;
      context.fillRect(-4, -4, 8, 8);
      context.restore();
    }
    for (let index = 0; index < state.enemies.length; index += 1) {
      const enemy = state.enemies[index];
      if (enemy.active) drawEnemy(enemy, state.time);
    }
    if (screen !== SCREEN_TITLE) drawPlayer(state, state.time);
    for (let index = 0; index < state.projectiles.length; index += 1) {
      const shot = state.projectiles[index];
      if (!shot.active) continue;
      const glow = context.createRadialGradient(shot.x, shot.y, 1, shot.x, shot.y, 14);
      glow.addColorStop(0, 'rgba(255, 209, 102, 0.9)');
      glow.addColorStop(1, 'rgba(255, 122, 60, 0)');
      context.fillStyle = glow;
      context.fillRect(shot.x - 14, shot.y - 14, 28, 28);
      circle(shot.x, shot.y, PLAYER.emberRadius, PALETTE.ember);
      circle(shot.x, shot.y, 2.5, PALETTE.emberCore);
    }
    // Particles.
    for (let index = 0; index < state.particles.parts.length; index += 1) {
      const part = state.particles.parts[index];
      if (!part.active) continue;
      context.globalAlpha = Math.max(0, part.life / part.maxLife);
      circle(part.x, part.y, part.size, part.color);
    }
    context.globalAlpha = 1;
    // Floating texts.
    context.textBaseline = 'alphabetic';
    for (let index = 0; index < state.particles.texts.length; index += 1) {
      const floatText = state.particles.texts[index];
      if (!floatText.active) continue;
      context.globalAlpha = Math.min(1, floatText.life / 0.6);
      text(floatText.value, floatText.x, floatText.y, floatText.size, floatText.color, 'center', true);
    }
    context.globalAlpha = 1;

    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = best > 0 ? bestLabel(best) : 'No keeper has held the light yet.';
      drawPanel('EMBERFALL', TITLE_LINES, 'Click or press Space to begin');
      return;
    }
    drawHud(state, best, muted);
    drawBanner(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to keep playing');
    } else if (screen === SCREEN_UPGRADE) {
      drawUpgrade(state, best);
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      OVER_LINES[2] = `${killsLabel(state.kills)}  ·  ${shardsLabel(state.shardsCollected)}`;
      OVER_LINES[3] = `Waves survived ${Math.max(0, state.wave - 1)} of ${TOTAL_WAVES}`;
      drawPanel(state.lantern.hp <= 0 ? 'The light went out' : 'The keeper has fallen', OVER_LINES, 'Click or press Space to try again');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      WIN_LINES[2] = `${killsLabel(state.kills)}  ·  ${shardsLabel(state.shardsCollected)}`;
      WIN_LINES[3] = `All ${TOTAL_WAVES} waves held — dawn breaks`;
      drawPanel('Dawn breaks!', WIN_LINES, 'Click or press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    upgradeRects,
    /** Convert a point inside the canvas element to field coordinates. */
    toField(clientX, clientY, rectWidth, rectHeight) {
      const scale = Math.min(rectWidth / FIELD.width, rectHeight / FIELD.height);
      const offsetX = (rectWidth - FIELD.width * scale) / 2;
      const offsetY = (rectHeight - FIELD.height * scale) / 2;
      return { x: (clientX - offsetX) / scale, y: (clientY - offsetY) / scale };
    },
  };
}

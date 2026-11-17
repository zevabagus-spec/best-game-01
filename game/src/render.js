// Everything the eye sees: the three skies, the floating island, the spire,
// every creature and bolt, and the HUD. The field is a fixed 1280x720; the
// canvas is scaled by CSS, and mouse positions are mapped back through the
// same transform. Decorations are seeded once, so the island never shifts
// under the player's feet.

import { COLORS, DASH, FIELD, FONT, PALETTES, PLAYER, SPIRE, ZONES } from './config.js';
import { createRandom } from './random.js';
import { orbitalPosition } from './weapons.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_RELIC, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN,
  drawOver, drawPaused, drawRelic, drawTitle, drawUpgrade, drawWin, pauseRects, relicRects, upgradeRects,
} from './screens.js';

/** The island's dressing, fixed at boot from a seed. */
function makeDecorations() {
  const random = createRandom(20261117);
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    clouds.push({ x: random.range(0, FIELD.width), y: random.range(20, 190), scale: random.range(0.7, 1.6), speed: random.range(4, 11), puffs: Math.floor(random.range(3, 6)) });
  }
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: random.range(0, FIELD.width), y: random.range(0, 320), size: random.range(0.8, 2.2), twinkle: random.range(0, Math.PI * 2) });
  }
  const tufts = [];
  for (let i = 0; i < 52; i += 1) {
    tufts.push({ x: random.range(20, FIELD.width - 20), y: random.range(230, 660), blades: Math.floor(random.range(3, 6)), lean: random.range(-0.3, 0.3), flower: random.chance(0.3) });
  }
  const stones = [];
  for (let i = 0; i < 16; i += 1) {
    stones.push({ x: random.range(30, FIELD.width - 30), y: random.range(240, 660), rx: random.range(10, 26), ry: random.range(6, 13) });
  }
  // Islets drift at the sides, clear of the title and the HUD.
  const islets = [];
  for (let i = 0; i < 5; i += 1) {
    const side = i % 2 === 0;
    islets.push({ x: side ? random.range(70, 330) : random.range(950, 1210), y: random.range(90, 230), rx: random.range(26, 56), ry: random.range(10, 18), bob: random.range(0, Math.PI * 2) });
  }
  return { clouds, stars, tufts, stones, islets };
}

function circle(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
}

function ellipse(context, x, y, rx, ry) {
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function polygon(context, x, y, radius, points, rotation) {
  context.beginPath();
  for (let i = 0; i < points; i += 1) {
    const angle = rotation + (i / points) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

function starShape(context, x, y, outer, inner, points) {
  context.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

export function createRenderer(canvas) {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const context = canvas.getContext('2d');
  const decorations = makeDecorations();

  /** A client-space mouse position, mapped onto the field. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  function drawSky(state, time) {
    const palette = PALETTES[state.zone];
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(0.55, palette.skyMid);
    gradient.addColorStop(1, palette.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // The celestial body: the rising sun, the dusk moon, the midnight star.
    const glowX = state.zone === 2 ? 1080 : 1060;
    const glowY = state.zone === 0 ? 110 : state.zone === 1 ? 150 : 100;
    const glow = context.createRadialGradient(glowX, glowY, 10, glowX, glowY, 190);
    glow.addColorStop(0, palette.sunGlow);
    glow.addColorStop(0.25, palette.sunGlow);
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.globalAlpha = state.zone === 2 ? 0.55 : 0.85;
    context.fillStyle = glow;
    context.fillRect(glowX - 190, glowY - 190, 380, 380);
    context.globalAlpha = 1;
    context.fillStyle = palette.sunGlow;
    circle(context, glowX, glowY, state.zone === 2 ? 26 : 44);
    context.fill();
    if (state.zone === 1) {
      context.fillStyle = palette.skyMid;
      circle(context, glowX + 16, glowY - 8, 38);
      context.fill();
    }

    if (state.zone === 2) {
      for (const star of decorations.stars) {
        context.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.8 + star.twinkle));
        context.fillStyle = '#dfeaff';
        context.fillRect(star.x, star.y, star.size, star.size);
      }
      context.globalAlpha = 1;
    }

    // God rays, turning almost too slowly to notice.
    context.save();
    context.translate(glowX, glowY);
    context.rotate(Math.sin(time * 0.05) * 0.08);
    context.fillStyle = palette.ray;
    for (let i = 0; i < 4; i += 1) {
      const angle = 0.35 + i * 0.28;
      context.save();
      context.rotate(angle);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(900, -46);
      context.lineTo(900, 46);
      context.closePath();
      context.fill();
      context.restore();
    }
    context.restore();
  }

  function drawClouds(state, time) {
    const palette = PALETTES[state.zone];
    for (const cloud of decorations.clouds) {
      const x = ((cloud.x + time * cloud.speed) % (FIELD.width + 260)) - 130;
      context.fillStyle = palette.cloud;
      for (let i = 0; i < cloud.puffs; i += 1) {
        const px = x + (i - cloud.puffs / 2) * 30 * cloud.scale;
        const py = cloud.y + Math.sin(i * 2.1) * 6 * cloud.scale;
        circle(context, px, py, 20 * cloud.scale);
        context.fill();
      }
      context.globalAlpha = 0.35;
      context.fillStyle = palette.cloudShade;
      ellipse(context, x, cloud.y + 12 * cloud.scale, 46 * cloud.scale, 8 * cloud.scale);
      context.fill();
      context.globalAlpha = 1;
    }
    for (const islet of decorations.islets) {
      const y = islet.y + Math.sin(time * 0.5 + islet.bob) * 7;
      context.fillStyle = palette.island;
      ellipse(context, islet.x, y, islet.rx, islet.ry);
      context.fill();
      context.fillStyle = palette.grass;
      ellipse(context, islet.x, y - islet.ry * 0.3, islet.rx * 0.92, islet.ry * 0.72);
      context.fill();
    }
  }

  function drawIsland(state) {
    const palette = PALETTES[state.zone];
    // The main island: a broad grassy disc floating over the sky, filling
    // most of the field so the fight happens on solid ground, not in the air.
    context.fillStyle = palette.island;
    ellipse(context, FIELD.width / 2, 440, 680, 250);
    context.fill();
    context.fillStyle = palette.grass;
    ellipse(context, FIELD.width / 2, 420, 680, 232);
    context.fill();
    context.fillStyle = palette.grassLight;
    ellipse(context, FIELD.width / 2, 408, 570, 192);
    context.fill();
    context.strokeStyle = palette.groundLine;
    context.lineWidth = 2;
    ellipse(context, FIELD.width / 2, 420, 680, 232);
    context.stroke();
    for (const stone of decorations.stones) {
      context.fillStyle = palette.islandEdge;
      ellipse(context, stone.x, stone.y, stone.rx, stone.ry);
      context.fill();
    }
    for (const tuft of decorations.tufts) {
      context.strokeStyle = palette.grass;
      context.lineWidth = 3;
      for (let i = 0; i < tuft.blades; i += 1) {
        const lean = tuft.lean + (i - tuft.blades / 2) * 0.22;
        context.beginPath();
        context.moveTo(tuft.x, tuft.y);
        context.quadraticCurveTo(tuft.x + lean * 14, tuft.y - 12, tuft.x + lean * 20, tuft.y - 22);
        context.stroke();
      }
      if (tuft.flower) {
        context.fillStyle = state.zone === 0 ? '#ff8a9a' : state.zone === 1 ? '#e08ae8' : '#a8c8ff';
        circle(context, tuft.x, tuft.y - 24, 4);
        context.fill();
      }
    }
  }

  function drawSpire(state, time) {
    const palette = PALETTES[state.zone];
    const spire = state.spire;
    const fraction = Math.max(0, spire.hp / spire.maxHp);
    const flicker = fraction < 0.25 ? 0.6 + 0.4 * Math.sin(time * 9) : 1;
    // The beam of light rising from the crystal.
    context.fillStyle = palette.beam;
    context.beginPath();
    context.moveTo(SPIRE.x - 26, SPIRE.y - 60);
    context.lineTo(SPIRE.x + 26, SPIRE.y - 60);
    context.lineTo(SPIRE.x + 10, -20);
    context.lineTo(SPIRE.x - 10, -20);
    context.closePath();
    context.fill();
    // The glow pool under the spire.
    const glow = context.createRadialGradient(SPIRE.x, SPIRE.y, 8, SPIRE.x, SPIRE.y, 120);
    glow.addColorStop(0, palette.spireGlow);
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.globalAlpha = 0.35 * flicker;
    context.fillStyle = glow;
    context.fillRect(SPIRE.x - 120, SPIRE.y - 120, 240, 240);
    context.globalAlpha = 1;
    // The crystal: layered shards, brightest at the core.
    context.save();
    context.translate(SPIRE.x, SPIRE.y);
    context.rotate(Math.sin(time * 0.6) * 0.03);
    context.fillStyle = palette.spireGlow;
    context.beginPath();
    context.moveTo(0, -64);
    context.lineTo(20, -8);
    context.lineTo(12, 22);
    context.lineTo(-12, 22);
    context.lineTo(-20, -8);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(90, 60, 20, 0.4)';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = palette.spireCore;
    context.beginPath();
    context.moveTo(0, -52);
    context.lineTo(10, -8);
    context.lineTo(6, 18);
    context.lineTo(-6, 18);
    context.lineTo(-10, -8);
    context.closePath();
    context.fill();
    context.restore();
    // The rotating ward rings.
    context.strokeStyle = palette.spireGlow;
    context.globalAlpha = 0.7 * flicker;
    context.lineWidth = 2;
    context.setLineDash([10, 8]);
    context.lineDashOffset = -time * 22;
    circle(context, SPIRE.x, SPIRE.y, SPIRE.radius + 12);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    // The light ring: how much of the spire's light is left.
    context.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    context.lineWidth = 5;
    circle(context, SPIRE.x, SPIRE.y, SPIRE.radius + 22);
    context.stroke();
    context.strokeStyle = fraction > 0.5 ? palette.spireGlow : fraction > 0.25 ? '#ffb347' : '#ff5a5a';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(SPIRE.x, SPIRE.y, SPIRE.radius + 22, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
    context.stroke();
  }

  function drawEnemy(enemy, time) {
    const scale = enemy.spawnT > 0 ? 1 - enemy.spawnT / 0.45 * 0.6 : 1;
    const radius = enemy.radius * scale;
    const kind = enemy.kind;
    const flash = enemy.flash > 0;
    context.save();
    context.translate(enemy.x, enemy.y);
    if (kind === 'wraith' && enemy.phased) context.globalAlpha = 0.35;
    // Shadow under every creature, so it sits on the island.
    context.globalAlpha *= 1;
    context.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ellipse(context, 0, radius * 0.85, radius * 0.9, radius * 0.3);
    context.fill();
    if (kind === 'wisp') {
      context.fillStyle = flash ? '#ffffff' : COLORS.wisp;
      circle(context, 0, 0, radius);
      context.fill();
      context.fillStyle = flash ? '#ffffff' : COLORS.wispCore;
      circle(context, -radius * 0.25, -radius * 0.2, radius * 0.45);
      context.fill();
      context.fillStyle = '#2a2140';
      circle(context, radius * 0.3, -radius * 0.1, radius * 0.16);
      context.fill();
      circle(context, radius * 0.3, radius * 0.28, radius * 0.12);
      context.fill();
    } else if (kind === 'dart') {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      context.rotate(angle);
      context.fillStyle = flash ? '#ffffff' : COLORS.dart;
      context.beginPath();
      context.moveTo(radius * 1.4, 0);
      context.lineTo(-radius, -radius * 0.8);
      context.lineTo(-radius * 0.5, 0);
      context.lineTo(-radius, radius * 0.8);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff';
      circle(context, radius * 0.4, 0, radius * 0.28);
      context.fill();
    } else if (kind === 'spitter') {
      context.fillStyle = flash ? '#ffffff' : COLORS.spitter;
      circle(context, 0, 0, radius);
      context.fill();
      context.fillStyle = flash ? '#ffffff' : COLORS.spitterCore;
      circle(context, 0, radius * 0.35, radius * 0.5);
      context.fill();
      context.fillStyle = '#7a3a10';
      circle(context, -radius * 0.3, -radius * 0.25, radius * 0.14);
      context.fill();
      circle(context, radius * 0.3, -radius * 0.25, radius * 0.14);
      context.fill();
    } else if (kind === 'brute') {
      context.fillStyle = flash ? '#ffffff' : COLORS.bruteShell;
      circle(context, 0, 0, radius);
      context.fill();
      context.fillStyle = flash ? '#ffffff' : COLORS.brute;
      circle(context, 0, -radius * 0.1, radius * 0.72);
      context.fill();
      context.fillStyle = '#ffe8ec';
      circle(context, -radius * 0.3, -radius * 0.2, radius * 0.13);
      context.fill();
      circle(context, radius * 0.3, -radius * 0.2, radius * 0.13);
      context.fill();
      context.strokeStyle = '#7a2438';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-radius * 0.4, radius * 0.35);
      context.lineTo(radius * 0.4, radius * 0.35);
      context.stroke();
    } else if (kind === 'splitter') {
      context.fillStyle = flash ? '#ffffff' : COLORS.splitter;
      circle(context, 0, 0, radius);
      context.fill();
      context.fillStyle = COLORS.splitterCore;
      circle(context, -radius * 0.35, -radius * 0.2, radius * 0.3);
      context.fill();
      circle(context, radius * 0.35, -radius * 0.1, radius * 0.3);
      context.fill();
      circle(context, 0, radius * 0.4, radius * 0.3);
      context.fill();
    } else if (kind === 'mote') {
      context.fillStyle = flash ? '#ffffff' : COLORS.mote;
      starShape(context, 0, 0, radius * 1.5, radius * 0.6, 5);
      context.fill();
    } else if (kind === 'stalker') {
      context.rotate(Math.PI / 4 + Math.sin(time * 3 + enemy.seed) * 0.15);
      context.fillStyle = flash ? '#ffffff' : COLORS.stalker;
      context.fillRect(-radius * 0.8, -radius * 0.8, radius * 1.6, radius * 1.6);
      context.fillStyle = '#fff';
      circle(context, 0, 0, radius * 0.35);
      context.fill();
      context.fillStyle = '#4a1040';
      circle(context, 0, 0, radius * 0.18);
      context.fill();
    } else if (kind === 'wraith') {
      context.fillStyle = flash ? '#ffffff' : COLORS.wraith;
      context.beginPath();
      context.arc(0, -radius * 0.2, radius * 0.85, Math.PI, 0);
      context.lineTo(radius * 0.85, radius * 0.7);
      for (let i = 0; i < 3; i += 1) {
        context.lineTo(radius * 0.85 - (i + 0.5) * (radius * 1.7 / 3), radius * 0.35);
        context.lineTo(radius * 0.85 - (i + 1) * (radius * 1.7 / 3), radius * 0.7);
      }
      context.closePath();
      context.fill();
      context.fillStyle = COLORS.wraithCore;
      circle(context, -radius * 0.3, -radius * 0.3, radius * 0.16);
      context.fill();
      circle(context, radius * 0.3, -radius * 0.3, radius * 0.16);
      context.fill();
    } else if (kind === 'bulwark') {
      context.fillStyle = flash ? '#ffffff' : COLORS.bulwarkShell;
      polygon(context, 0, 0, radius, 6, Math.PI / 6);
      context.fill();
      context.fillStyle = flash ? '#ffffff' : COLORS.bulwark;
      polygon(context, 0, 0, radius * 0.7, 6, Math.PI / 6);
      context.fill();
      context.fillStyle = '#ffd166';
      circle(context, 0, 0, radius * 0.25);
      context.fill();
    } else if (kind === 'weaver') {
      context.fillStyle = flash ? '#ffffff' : COLORS.weaver;
      circle(context, 0, 0, radius);
      context.fill();
      context.strokeStyle = COLORS.weaverCore;
      context.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const angle = time * 1.5 + (i / 3) * Math.PI * 2;
        context.beginPath();
        context.arc(0, 0, radius * 1.25, angle, angle + 1.1);
        context.stroke();
      }
      context.fillStyle = COLORS.weaverCore;
      circle(context, 0, 0, radius * 0.4);
      context.fill();
    }
    if (enemy.elite) {
      context.strokeStyle = '#ffd166';
      context.lineWidth = 3;
      circle(context, 0, 0, radius + 5);
      context.stroke();
      context.fillStyle = '#ffd166';
      starShape(context, 0, -radius - 8, 8, 4, 5);
      context.fill();
    }
    context.restore();
    // A health micro-bar for the tough kinds and every elite.
    if ((enemy.elite || kind === 'brute' || kind === 'bulwark') && enemy.hp < enemy.maxHp) {
      const width = radius * 2;
      context.fillStyle = 'rgba(0, 0, 0, 0.45)';
      context.fillRect(enemy.x - width / 2, enemy.y - radius - 12, width, 5);
      context.fillStyle = enemy.elite ? '#ffd166' : '#ff8a9a';
      context.fillRect(enemy.x - width / 2, enemy.y - radius - 12, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawBoss(boss, time) {
    const radius = boss.radius;
    const flash = boss.flash > 0;
    context.save();
    context.translate(boss.x, boss.y);
    context.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ellipse(context, 0, radius * 0.9, radius, radius * 0.3);
    context.fill();
    if (boss.kind === 'herald') {
      context.fillStyle = flash ? '#ffffff' : COLORS.herald;
      circle(context, 0, 0, radius);
      context.fill();
      // Horns.
      context.fillStyle = flash ? '#ffffff' : '#5a3a9e';
      context.beginPath();
      context.moveTo(-radius * 0.7, -radius * 0.6);
      context.lineTo(-radius * 1.2, -radius * 1.3);
      context.lineTo(-radius * 0.35, -radius * 0.85);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(radius * 0.7, -radius * 0.6);
      context.lineTo(radius * 1.2, -radius * 1.3);
      context.lineTo(radius * 0.35, -radius * 0.85);
      context.closePath();
      context.fill();
      context.fillStyle = COLORS.heraldCore;
      circle(context, 0, -radius * 0.1, radius * 0.45);
      context.fill();
      context.fillStyle = '#2a1a4a';
      circle(context, 0, -radius * 0.1, radius * 0.2);
      context.fill();
    } else if (boss.kind === 'reaper') {
      // The hood.
      context.fillStyle = flash ? '#ffffff' : COLORS.reaper;
      context.beginPath();
      context.arc(0, -radius * 0.15, radius * 0.9, Math.PI, 0);
      context.lineTo(radius * 0.9, radius * 0.8);
      context.lineTo(-radius * 0.9, radius * 0.8);
      context.closePath();
      context.fill();
      context.fillStyle = '#2a0a1a';
      circle(context, 0, -radius * 0.1, radius * 0.5);
      context.fill();
      context.fillStyle = COLORS.reaperCore;
      circle(context, -radius * 0.2, -radius * 0.15, radius * 0.1);
      context.fill();
      circle(context, radius * 0.2, -radius * 0.15, radius * 0.1);
      context.fill();
      // The scythe, sweeping slowly.
      context.save();
      context.rotate(Math.sin(time * 1.2) * 0.3 - 0.5);
      context.strokeStyle = '#8a6a4a';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(radius * 0.5, radius * 0.6);
      context.lineTo(radius * 1.4, -radius * 0.6);
      context.stroke();
      context.strokeStyle = '#e8ecf4';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(radius * 1.4, -radius * 0.6, radius * 0.45, -0.4, Math.PI * 0.6);
      context.stroke();
      context.restore();
    } else {
      // The Sovereign: a crowned dark star with orbiting shards.
      context.fillStyle = flash ? '#ffffff' : COLORS.sovereign;
      circle(context, 0, 0, radius);
      context.fill();
      for (let i = 0; i < 6; i += 1) {
        const angle = time * 0.8 + (i / 6) * Math.PI * 2;
        context.save();
        context.translate(Math.cos(angle) * (radius + 16), Math.sin(angle) * (radius + 16));
        context.rotate(angle);
        context.fillStyle = COLORS.sovereignCore;
        polygon(context, 0, 0, 10, 4, 0);
        context.fill();
        context.restore();
      }
      context.fillStyle = '#ffd166';
      for (let i = -1; i <= 1; i += 1) {
        context.beginPath();
        context.moveTo(i * 18 - 9, -radius + 4);
        context.lineTo(i * 18, -radius - 18);
        context.lineTo(i * 18 + 9, -radius + 4);
        context.closePath();
        context.fill();
      }
      context.fillStyle = COLORS.sovereignCore;
      circle(context, 0, 0, radius * 0.4);
      context.fill();
      context.fillStyle = '#1a1040';
      circle(context, 0, 0, radius * 0.18);
      context.fill();
    }
    context.restore();
  }

  function drawPlayer(state, time) {
    const player = state.player;
    // The dash trail, fading behind the warden.
    for (const ghost of player.trail) {
      context.globalAlpha = ghost.life * 1.6;
      context.fillStyle = '#ffd166';
      circle(context, ghost.x, ghost.y, PLAYER.radius * 0.55);
      context.fill();
    }
    context.globalAlpha = 1;
    if (player.invuln > 0 && Math.floor(time * 14) % 2 === 0) context.globalAlpha = 0.45;
    // A halo of light, so the warden is never lost in the fray.
    const halo = context.createRadialGradient(player.x, player.y, 4, player.x, player.y, 40);
    halo.addColorStop(0, 'rgba(255, 243, 196, 0.55)');
    halo.addColorStop(1, 'rgba(255, 243, 196, 0)');
    context.fillStyle = halo;
    context.fillRect(player.x - 40, player.y - 40, 80, 80);
    context.save();
    context.translate(player.x, player.y);
    context.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ellipse(context, 0, PLAYER.radius * 0.9, PLAYER.radius, PLAYER.radius * 0.35);
    context.fill();
    // The cloak.
    context.fillStyle = COLORS.playerCloak;
    context.beginPath();
    context.moveTo(0, -PLAYER.radius - 4);
    context.quadraticCurveTo(PLAYER.radius + 4, 2, PLAYER.radius * 0.7, PLAYER.radius + 2);
    context.lineTo(-PLAYER.radius * 0.7, PLAYER.radius + 2);
    context.quadraticCurveTo(-PLAYER.radius - 4, 2, 0, -PLAYER.radius - 4);
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    context.lineWidth = 2;
    context.stroke();
    // The hood and face.
    context.fillStyle = COLORS.player;
    circle(context, 0, -4, PLAYER.radius * 0.62);
    context.fill();
    context.fillStyle = '#3a2a1a';
    circle(context, -3, -5, 1.8);
    context.fill();
    circle(context, 3, -5, 1.8);
    context.fill();
    // The staff, pointing at the aim.
    const aimAngle = Math.atan2(state.aimY - player.y, state.aimX - player.x);
    context.save();
    context.rotate(aimAngle);
    context.strokeStyle = '#8a6a4a';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(4, 6);
    context.lineTo(24, 6);
    context.stroke();
    context.fillStyle = '#ffd166';
    circle(context, 26, 6, 5);
    context.fill();
    context.fillStyle = '#fffbe8';
    circle(context, 26, 6, 2.5);
    context.fill();
    context.restore();
    context.restore();
    context.globalAlpha = 1;
    if (player.shield) {
      context.strokeStyle = 'rgba(125, 184, 255, 0.9)';
      context.lineWidth = 2.5;
      circle(context, player.x, player.y, PLAYER.radius + 7 + Math.sin(time * 4) * 1.5);
      context.stroke();
    }
  }

  function drawHud(state, ui) {
    const palette = PALETTES[state.zone];
    const dark = state.zone === 0;
    const ink = dark ? '#3a2a1a' : palette.text;
    const soft = dark ? 'rgba(58, 42, 26, 0.7)' : palette.muted;
    // Score, top-left.
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.font = `800 34px ${FONT}`;
    context.fillStyle = ink;
    context.fillText(state.score.toLocaleString('en-US'), 24, 44);
    context.font = `600 14px ${FONT}`;
    context.fillStyle = soft;
    context.fillText(`BEST ${Math.max(ui.best, state.score).toLocaleString('en-US')}`, 24, 66);
    if (state.combo.mult > 1) {
      context.font = `800 18px ${FONT}`;
      context.fillStyle = '#b8740a';
      context.fillText(`COMBO x${state.combo.mult}`, 24, 92);
    }
    // Wave and foes, top-centre.
    context.textAlign = 'center';
    context.font = `800 24px ${FONT}`;
    context.fillStyle = ink;
    context.fillText(`WAVE ${state.wave} / 12 · ${ZONES[state.zone].name}`, FIELD.width / 2, 38);
    context.font = `600 15px ${FONT}`;
    context.fillStyle = soft;
    context.fillText(`${ui.remaining} foes remain`, FIELD.width / 2, 60);
    // The spire's light bar.
    const barWidth = 300;
    const barX = FIELD.width / 2 - barWidth / 2;
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(barX, 70, barWidth, 12);
    const fraction = Math.max(0, state.spire.hp / state.spire.maxHp);
    context.fillStyle = fraction > 0.5 ? '#ffd166' : fraction > 0.25 ? '#ff9a3d' : '#ff5a5a';
    context.fillRect(barX, 70, barWidth * fraction, 12);
    context.font = `700 13px ${FONT}`;
    context.fillStyle = dark ? '#3a2a1a' : '#ffffff';
    context.fillText(`SPIRE LIGHT ${Math.ceil(state.spire.hp)} / ${state.spire.maxHp}`, FIELD.width / 2, 92);
    // The boss bar, when a boss is up.
    const boss = state.boss;
    if (boss !== null && boss.active) {
      const bossWidth = 460;
      const bossX = FIELD.width / 2 - bossWidth / 2;
      context.fillStyle = 'rgba(0, 0, 0, 0.5)';
      context.fillRect(bossX, 104, bossWidth, 12);
      context.fillStyle = boss.kind === 'sovereign' ? '#a89af0' : boss.kind === 'reaper' ? '#ff6b81' : '#b48ae8';
      context.fillRect(bossX, 104, bossWidth * Math.max(0, boss.hp / boss.maxHp), 12);
      context.font = `800 15px ${FONT}`;
      context.fillStyle = '#ffffff';
      context.fillText(boss.name, FIELD.width / 2, 132);
    }
    // Relics held, top-right.
    const relicIcons = { sunbrand: '☀', swiftwing: '➤', greed: '◆', thornmantle: '✦', seconddawn: '✚', gloompact: '☾' };
    context.textAlign = 'right';
    context.font = `700 20px ${FONT}`;
    state.relics.forEach((id, index) => {
      context.fillStyle = '#ffd166';
      context.fillText(relicIcons[id] ?? '?', FIELD.width - 30 - index * 30, 40);
    });
    context.font = `600 13px ${FONT}`;
    context.fillStyle = soft;
    context.fillText('P pause · M mute', FIELD.width - 24, 66);
    // Hearts, bottom-left.
    context.textAlign = 'left';
    for (let i = 0; i < state.player.maxHp; i += 1) {
      context.font = '24px sans-serif';
      context.fillStyle = i < state.player.hp ? COLORS.heart : 'rgba(0, 0, 0, 0.25)';
      context.fillText('♥', 22 + i * 28, FIELD.height - 22);
    }
    // Dash, bottom-centre: the bar fills over the real cooldown, which the
    // Swift Dash boon shortens.
    const dashMax = DASH.cooldown * Math.pow(0.8, state.build.dash);
    const dashFraction = state.player.dashCd <= 0 ? 1 : 1 - state.player.dashCd / dashMax;
    const dashWidth = 150;
    const dashX = FIELD.width / 2 - dashWidth / 2;
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(dashX, FIELD.height - 26, dashWidth, 10);
    context.fillStyle = dashFraction >= 1 ? '#7de8ff' : '#5a8aa8';
    context.fillRect(dashX, FIELD.height - 26, dashWidth * dashFraction, 10);
    context.textAlign = 'center';
    context.font = `700 13px ${FONT}`;
    context.fillStyle = ink;
    context.fillText('DASH [SHIFT]', FIELD.width / 2, FIELD.height - 34);
    // Level and shards, bottom-right.
    context.textAlign = 'right';
    context.font = `800 20px ${FONT}`;
    context.fillStyle = ink;
    context.fillText(`LEVEL ${state.level}`, FIELD.width - 24, FIELD.height - 46);
    const xpWidth = 190;
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.fillRect(FIELD.width - 24 - xpWidth, FIELD.height - 38, xpWidth, 10);
    context.fillStyle = COLORS.xpBar;
    context.fillRect(FIELD.width - 24 - xpWidth, FIELD.height - 38, xpWidth * Math.min(1, state.xp / state.xpNeed), 10);
    context.font = `600 13px ${FONT}`;
    context.fillStyle = soft;
    context.fillText(`${Math.floor(state.xp)} / ${state.xpNeed} shards`, FIELD.width - 24, FIELD.height - 12);
  }

  function drawBanner(state) {
    if (state.banner === null) return;
    const alpha = Math.min(1, state.banner.timer);
    context.globalAlpha = alpha;
    context.textAlign = 'center';
    context.font = `800 40px ${FONT}`;
    context.fillStyle = state.zone === 0 ? '#3a2a1a' : '#ffffff';
    context.fillText(state.banner.text, FIELD.width / 2, 190);
    if (state.banner.sub !== '') {
      context.font = `600 18px ${FONT}`;
      context.fillStyle = state.zone === 0 ? 'rgba(58, 42, 26, 0.8)' : 'rgba(255, 255, 255, 0.85)';
      context.fillText(state.banner.sub, FIELD.width / 2, 218);
    }
    context.globalAlpha = 1;
  }

  function drawZoneCard(state) {
    if (state.zoneCard === null) return;
    const alpha = Math.min(1, state.zoneCard.timer / 1.2, (3.2 - state.zoneCard.timer) / 0.6);
    context.globalAlpha = Math.max(0, alpha);
    context.textAlign = 'center';
    context.font = `800 54px ${FONT}`;
    context.fillStyle = state.zone === 0 ? '#3a2a1a' : '#ffffff';
    context.fillText(state.zoneCard.title, FIELD.width / 2, FIELD.height / 2 - 40);
    context.font = `600 18px ${FONT}`;
    context.fillText('— the sky changes —', FIELD.width / 2, FIELD.height / 2 - 8);
    context.globalAlpha = 1;
  }

  function drawFog(state) {
    if (state.skyEvent === null || state.skyEvent.kind !== 'fog') return;
    const player = state.player;
    const gradient = context.createRadialGradient(player.x, player.y, 120, player.x, player.y, 520);
    gradient.addColorStop(0, 'rgba(8, 6, 18, 0)');
    gradient.addColorStop(1, 'rgba(8, 6, 18, 0.62)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawVignette(state) {
    const lowHp = state.player.hp <= 1;
    const lowSpire = state.spire.hp < state.spire.maxHp * 0.25;
    if (!lowHp && !lowSpire) return;
    const pulse = 0.22 + 0.1 * Math.sin(state.time * 5);
    const gradient = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 280, FIELD.width / 2, FIELD.height / 2, 640);
    gradient.addColorStop(0, 'rgba(255, 40, 40, 0)');
    gradient.addColorStop(1, `rgba(255, 40, 40, ${pulse})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  /** Paint one frame: the world, the HUD, and the screen over it. */
  function draw(state, screen, ui) {
    const time = state.time;
    context.save();
    if (ui.shakeOn && state.shake > 0.2) {
      context.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    drawSky(state, time);
    drawClouds(state, time);
    drawIsland(state);
    drawSpire(state, time);
    // Shards.
    for (const shard of state.shards) {
      if (!shard.active) continue;
      const twinkle = 0.7 + 0.3 * Math.sin(time * 6 + shard.seed);
      context.globalAlpha = Math.min(1, shard.life / 3) * twinkle;
      context.fillStyle = COLORS.shard;
      starShape(context, shard.x, shard.y, 9, 4, 4);
      context.fill();
    }
    context.globalAlpha = 1;
    // Mines.
    for (const mine of state.mines) {
      if (!mine.active) continue;
      const armed = mine.armT <= 0;
      context.fillStyle = armed ? COLORS.mine : '#8a6a7a';
      circle(context, mine.x, mine.y, 9);
      context.fill();
      context.fillStyle = '#fff';
      circle(context, mine.x, mine.y, 3.5);
      context.fill();
      if (armed && Math.floor(time * 3) % 2 === 0) {
        context.strokeStyle = COLORS.mine;
        context.lineWidth = 2;
        circle(context, mine.x, mine.y, 13);
        context.stroke();
      }
    }
    // Pickups.
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      const bob = Math.sin(time * 3 + pickup.seed) * 3;
      const y = pickup.y + bob;
      const blink = pickup.life < 3 ? Math.floor(time * 6) % 2 === 0 : true;
      if (!blink) continue;
      context.fillStyle = 'rgba(255, 255, 255, 0.85)';
      circle(context, pickup.x, y, 15);
      context.fill();
      context.font = '18px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      if (pickup.kind === 'heart') {
        context.fillStyle = COLORS.heart;
        context.fillText('♥', pickup.x, y + 1);
      } else if (pickup.kind === 'magnet') {
        context.fillStyle = '#b8740a';
        context.fillText('◆', pickup.x, y + 1);
      } else if (pickup.kind === 'shield') {
        context.fillStyle = COLORS.shield;
        context.fillText('⬢', pickup.x, y + 1);
      } else {
        context.fillStyle = COLORS.bomb;
        context.fillText('✸', pickup.x, y + 1);
      }
      context.textBaseline = 'alphabetic';
    }
    // Enemies, then the boss.
    for (const enemy of state.enemies) {
      if (enemy.active) drawEnemy(enemy, time);
    }
    if (state.boss !== null && state.boss.active) drawBoss(state.boss, time);
    // Bolts.
    for (const bolt of state.bolts) {
      if (!bolt.active) continue;
      context.strokeStyle = COLORS.bolt;
      context.lineWidth = bolt.radius * 2;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(bolt.x - bolt.vx * 0.024, bolt.y - bolt.vy * 0.024);
      context.lineTo(bolt.x, bolt.y);
      context.stroke();
      context.fillStyle = COLORS.boltCore;
      circle(context, bolt.x, bolt.y, bolt.radius * 0.6);
      context.fill();
    }
    // Seeking wisps.
    for (const wisp of state.wisps) {
      if (!wisp.active) continue;
      context.fillStyle = COLORS.wispBolt;
      circle(context, wisp.x, wisp.y, wisp.radius);
      context.fill();
      context.fillStyle = '#fff';
      circle(context, wisp.x, wisp.y, wisp.radius * 0.45);
      context.fill();
    }
    // Orbiting embers, drawn where the collision tests them.
    const orbitals = state.build.orbitals;
    for (let i = 0; i < orbitals; i += 1) {
      const { x, y } = orbitalPosition(state, i, orbitals);
      context.fillStyle = '#ffd166';
      circle(context, x, y, 10);
      context.fill();
      context.fillStyle = '#fffbe8';
      circle(context, x, y, 5);
      context.fill();
    }
    // Enemy shots.
    for (const shot of state.enemyShots) {
      if (!shot.active) continue;
      context.fillStyle = COLORS.shot;
      circle(context, shot.x, shot.y, shot.radius);
      context.fill();
      context.fillStyle = COLORS.shotCore;
      circle(context, shot.x, shot.y, shot.radius * 0.5);
      context.fill();
    }
    // Meteor telegraphs.
    for (const boom of state.pendingBooms) {
      context.strokeStyle = 'rgba(255, 122, 61, 0.9)';
      context.lineWidth = 2;
      circle(context, boom.x, boom.y, 60 * (boom.timer / 0.4) + 8);
      context.stroke();
      context.fillStyle = 'rgba(255, 122, 61, 0.25)';
      circle(context, boom.x, boom.y, 60);
      context.fill();
    }
    drawPlayer(state, time);
    state.particles.draw(context);
    drawFog(state);
    drawVignette(state);
    context.restore();

    if (screen !== SCREEN_TITLE) drawHud(state, ui);
    drawBanner(state);
    drawZoneCard(state);

    if (screen === SCREEN_TITLE) {
      drawTitle(context, ui.best, ui.muted, ui.shakeOn, time);
    } else if (screen === SCREEN_UPGRADE) {
      drawUpgrade(context, state);
    } else if (screen === SCREEN_RELIC) {
      drawRelic(context, state);
    } else if (screen === SCREEN_PAUSED) {
      drawPaused(context, ui.muted, ui.shakeOn);
    } else if (screen === SCREEN_OVER) {
      drawOver(context, state, ui.best, ui.reason);
    } else if (screen === SCREEN_WIN) {
      drawWin(context, state, ui.best);
    }
  }

  return {
    draw,
    toField,
    upgradeRects,
    pauseRects,
    relicRects,
  };
}

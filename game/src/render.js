// Everything the eye sees: the abyss, the reef, the beacon, every creature,
// the keeper, the projectiles, the HUD, and the screens on top. The field is
// a fixed 1280x720; the renderer letterboxes it into the window at the
// display's pixel ratio, so the game looks the same on any screen.

import { BEACON, FIELD, FONT, PALETTE, PLAYER } from './config.js';
import { TOTAL_TIDES as TIDE_COUNT } from './waves.js';
import { drawOver, drawPaused, drawTitle, drawUpgrade, drawWin, pauseRects, SCREEN_OVER, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN, upgradeRects } from './screens.js';
import { createRandom } from './random.js';
import { comboMultiplier, orbitalPositions } from './weapons.js';

const DECOR_SEED = 4242;
const XP_SHARD_SIZE = 9;

function buildDecor() {
  const random = createRandom(DECOR_SEED);
  const rocks = [];
  const corals = [];
  const kelp = [];
  const bubbles = [];
  for (let index = 0; index < 14; index += 1) {
    let x = random.range(40, FIELD.width - 40);
    let y = random.range(560, FIELD.height - 30);
    if (Math.hypot(x - BEACON.x, y - BEACON.y) < 150) x = x < BEACON.x ? x - 160 : x + 160;
    rocks.push({ x, y, radius: random.range(14, 34), seed: random.range(0, 6) });
  }
  const coralColors = ['#f472b6', '#fb923c', '#a3e635', '#c792ff', '#fda4af'];
  for (let index = 0; index < 10; index += 1) {
    corals.push({ x: random.range(50, FIELD.width - 50), y: random.range(600, FIELD.height - 16), height: random.range(18, 44), color: coralColors[index % coralColors.length], seed: random.range(0, 6) });
  }
  for (let index = 0; index < 18; index += 1) {
    kelp.push({ x: random.range(20, FIELD.width - 20), height: random.range(40, 110), sway: random.range(0, Math.PI * 2), width: random.range(6, 11) });
  }
  for (let index = 0; index < 26; index += 1) {
    bubbles.push({ x: random.range(0, FIELD.width), offset: random.range(0, 1), speed: random.range(14, 34), size: random.range(2, 6) });
  }
  return { rocks, corals, kelp, bubbles };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const decor = buildDecor();
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let deviceScale = 1;

  function resize() {
    deviceScale = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * deviceScale);
    canvas.height = Math.floor(height * deviceScale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
  }

  function toField(x, y) {
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  }

  function drawBackground(time) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.abyssTop);
    gradient.addColorStop(1, PALETTE.abyssBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // God rays from the surface, slowly swaying.
    context.save();
    context.globalAlpha = 0.5;
    for (let index = 0; index < 4; index += 1) {
      const sway = Math.sin(time * 0.12 + index * 1.7) * 40;
      const x = 180 + index * 300 + sway;
      const ray = context.createLinearGradient(x, 0, x + 90, FIELD.height);
      ray.addColorStop(0, 'rgba(125, 232, 255, 0.10)');
      ray.addColorStop(1, 'rgba(125, 232, 255, 0)');
      context.fillStyle = ray;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 60, 0);
      context.lineTo(x + 170, FIELD.height);
      context.lineTo(x + 60, FIELD.height);
      context.closePath();
      context.fill();
    }
    context.restore();

    // The reef floor.
    context.fillStyle = PALETTE.reef;
    context.beginPath();
    context.moveTo(0, FIELD.height - 60);
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.lineTo(x, FIELD.height - 60 + Math.sin(x * 0.008 + 1.3) * 12);
    }
    context.lineTo(FIELD.width, FIELD.height);
    context.lineTo(0, FIELD.height);
    context.closePath();
    context.fill();

    for (const rock of decor.rocks) {
      context.fillStyle = PALETTE.rock;
      context.strokeStyle = PALETTE.rockEdge;
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(rock.x, rock.y, rock.radius, rock.radius * 0.62, rock.seed, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    for (const coral of decor.corals) {
      context.strokeStyle = coral.color;
      context.lineWidth = 4;
      context.lineCap = 'round';
      for (const branch of [-1, 0, 1]) {
        context.beginPath();
        context.moveTo(coral.x, coral.y);
        context.quadraticCurveTo(coral.x + branch * 8, coral.y - coral.height * 0.6, coral.x + branch * 14, coral.y - coral.height);
        context.stroke();
      }
      context.fillStyle = coral.color;
      context.beginPath();
      context.arc(coral.x, coral.y - coral.height, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const strand of decor.kelp) {
      const sway = Math.sin(time * 0.8 + strand.sway) * 10;
      context.strokeStyle = PALETTE.reefLight;
      context.lineWidth = strand.width;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(strand.x, FIELD.height - 8);
      context.quadraticCurveTo(strand.x + sway * 0.4, FIELD.height - strand.height * 0.6, strand.x + sway, FIELD.height - strand.height);
      context.stroke();
    }
    context.fillStyle = 'rgba(186, 230, 253, 0.35)';
    for (const bubble of decor.bubbles) {
      const y = FIELD.height - ((time * bubble.speed + bubble.offset * FIELD.height) % (FIELD.height + 20));
      context.beginPath();
      context.arc(bubble.x + Math.sin(time + bubble.offset * 9) * 6, y, bubble.size, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBeacon(state, time) {
    const { x, y } = BEACON;
    const hpFraction = Math.max(0, state.beacon.hp / state.beacon.maxHp);
    const pulse = 0.85 + Math.sin(time * 2) * 0.15;

    // The glow that fills the reef.
    const glow = context.createRadialGradient(x, y, 10, x, y, 220 * pulse);
    glow.addColorStop(0, `rgba(125, 232, 255, ${0.34 * hpFraction + 0.06})`);
    glow.addColorStop(1, 'rgba(125, 232, 255, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 220 * pulse, 0, Math.PI * 2);
    context.fill();

    // The rotating beam.
    const beamAngle = time * 0.5;
    context.save();
    context.translate(x, y - 46);
    context.rotate(beamAngle);
    const beam = context.createLinearGradient(0, 0, 420, 0);
    beam.addColorStop(0, PALETTE.beam);
    beam.addColorStop(1, 'rgba(125, 232, 255, 0)');
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(0, -10);
    context.lineTo(420, -64);
    context.lineTo(420, 64);
    context.lineTo(0, 10);
    context.closePath();
    context.fill();
    context.restore();

    // Rock, tower, lamp room and light.
    context.fillStyle = PALETTE.rock;
    context.strokeStyle = PALETTE.rockEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(x, y + 22, 46, 18, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#e2e8f0';
    context.beginPath();
    context.moveTo(x - 13, y + 16);
    context.lineTo(x - 9, y - 34);
    context.lineTo(x + 9, y - 34);
    context.lineTo(x + 13, y + 16);
    context.closePath();
    context.fill();
    context.fillStyle = '#0e7490';
    context.fillRect(x - 10, y - 14, 20, 8);
    context.fillStyle = PALETTE.beaconCore;
    context.beginPath();
    context.arc(x, y - 42, 11 * pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#155e75';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y - 42, 13, 0, Math.PI * 2);
    context.stroke();

    // The light's remaining strength, as a ring.
    context.strokeStyle = 'rgba(125, 232, 255, 0.25)';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(x, y, BEACON.radius + 14, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = hpFraction > 0.5 ? PALETTE.beaconGlow : hpFraction > 0.25 ? PALETTE.gold : PALETTE.danger;
    context.beginPath();
    context.arc(x, y, BEACON.radius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFraction);
    context.stroke();
  }

  function drawShards(state, time) {
    for (const shard of state.shards) {
      if (!shard.active) continue;
      const blink = shard.life < 4 ? (Math.sin(time * 12) > 0 ? 1 : 0.3) : 1;
      const size = XP_SHARD_SIZE * (1 + Math.sin(time * 4 + shard.x) * 0.15);
      context.save();
      context.globalAlpha = blink;
      context.translate(shard.x, shard.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.shard;
      context.fillRect(-size / 2, -size / 2, size, size);
      context.fillStyle = '#ecfeff';
      context.fillRect(-size / 4, -size / 4, size / 2, size / 2);
      context.restore();
    }
  }

  function drawHeartShape(x, y, size, color) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y + size * 0.9);
    context.bezierCurveTo(x - size * 1.3, y, x - size * 0.7, y - size, x, y - size * 0.35);
    context.bezierCurveTo(x + size * 0.7, y - size, x + size * 1.3, y, x, y + size * 0.9);
    context.closePath();
    context.fill();
  }

  function drawPickups(state, time) {
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      const bob = Math.sin(pickup.bob) * 4;
      const x = pickup.x;
      const y = pickup.y + bob;
      const blink = pickup.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.35) : 1;
      context.save();
      context.globalAlpha = blink;
      const glowColor = pickup.kind === 'heart' ? PALETTE.heart : pickup.kind === 'magnet' ? PALETTE.magnet : pickup.kind === 'shield' ? PALETTE.shield : PALETTE.bomb;
      const glow = context.createRadialGradient(x, y, 2, x, y, 26);
      glow.addColorStop(0, glowColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalAlpha = blink * 0.35;
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, 26, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = blink;
      if (pickup.kind === 'heart') {
        drawHeartShape(x, y - 2, 11, PALETTE.heart);
      } else if (pickup.kind === 'magnet') {
        context.strokeStyle = PALETTE.magnet;
        context.lineWidth = 6;
        context.beginPath();
        context.arc(x, y - 2, 10, Math.PI, 0, false);
        context.stroke();
        context.beginPath();
        context.moveTo(x - 10, y - 2);
        context.lineTo(x - 10, y + 9);
        context.moveTo(x + 10, y - 2);
        context.lineTo(x + 10, y + 9);
        context.stroke();
      } else if (pickup.kind === 'shield') {
        context.fillStyle = PALETTE.shield;
        context.beginPath();
        context.moveTo(x, y - 13);
        context.lineTo(x + 11, y - 6);
        context.lineTo(x + 8, y + 9);
        context.lineTo(x, y + 14);
        context.lineTo(x - 8, y + 9);
        context.lineTo(x - 11, y - 6);
        context.closePath();
        context.fill();
        context.fillStyle = '#eff6ff';
        context.beginPath();
        context.arc(x, y - 1, 4, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = '#1f2937';
        context.beginPath();
        context.arc(x, y + 2, 11, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#fca5a5';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 6, y - 7);
        context.quadraticCurveTo(x + 12, y - 14, x + 16, y - 11);
        context.stroke();
        context.fillStyle = PALETTE.bomb;
        context.beginPath();
        context.arc(x + 16, y - 11, 3.5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  function drawMines(state, time) {
    for (const mine of state.mines) {
      if (!mine.active) continue;
      const armed = mine.armTimer <= 0;
      const blink = armed && Math.sin(time * 6) > 0.4;
      context.fillStyle = blink ? '#fbcfe8' : '#3b0764';
      context.beginPath();
      context.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.mine;
      context.lineWidth = 2;
      for (let spike = 0; spike < 8; spike += 1) {
        const angle = (spike / 8) * Math.PI * 2;
        context.beginPath();
        context.moveTo(mine.x + Math.cos(angle) * mine.radius, mine.y + Math.sin(angle) * mine.radius);
        context.lineTo(mine.x + Math.cos(angle) * (mine.radius + 6), mine.y + Math.sin(angle) * (mine.radius + 6));
        context.stroke();
      }
      context.fillStyle = PALETTE.mine;
      context.beginPath();
      context.arc(mine.x, mine.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawEnemyHp(enemy) {
    if (enemy.hp >= enemy.maxHp) return;
    const width = enemy.radius * 2;
    const x = enemy.x - enemy.radius;
    const y = enemy.y - enemy.radius - 12;
    context.fillStyle = 'rgba(0, 0, 0, 0.55)';
    context.fillRect(x, y, width, 4);
    context.fillStyle = enemy.hp / enemy.maxHp > 0.4 ? '#4ade80' : PALETTE.danger;
    context.fillRect(x, y, width * Math.max(0, enemy.hp / enemy.maxHp), 4);
  }

  function drawEnemy(enemy, time) {
    const flash = enemy.flash > 0;
    context.save();
    if (enemy.phased) context.globalAlpha = 0.35;
    const pulse = 1 + Math.sin(time * 3 + enemy.wobble) * 0.08;
    context.translate(enemy.x, enemy.y);
    context.scale(pulse, pulse);
    const body = flash ? '#ffffff' : null;
    if (enemy.kind === 'drifter') {
      context.fillStyle = body ?? PALETTE.drifterBell;
      context.beginPath();
      context.arc(0, -2, enemy.radius, Math.PI, 0);
      context.quadraticCurveTo(enemy.radius, enemy.radius * 0.4, 0, enemy.radius * 0.3);
      context.quadraticCurveTo(-enemy.radius, enemy.radius * 0.4, -enemy.radius, -2);
      context.closePath();
      context.fill();
      context.strokeStyle = body ?? PALETTE.drifter;
      context.lineWidth = 2;
      for (let tentacle = -2; tentacle <= 2; tentacle += 1) {
        const wave = Math.sin(time * 4 + enemy.wobble + tentacle) * 4;
        context.beginPath();
        context.moveTo(tentacle * 5, enemy.radius * 0.3);
        context.quadraticCurveTo(tentacle * 5 + wave, enemy.radius * 0.8, tentacle * 5 - wave, enemy.radius * 1.3);
        context.stroke();
      }
    } else if (enemy.kind === 'dart') {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      context.rotate(angle);
      context.fillStyle = body ?? PALETTE.dart;
      context.beginPath();
      context.moveTo(enemy.radius + 4, 0);
      context.lineTo(-enemy.radius * 0.6, -enemy.radius * 0.7);
      context.lineTo(-enemy.radius * 0.2, 0);
      context.lineTo(-enemy.radius * 0.6, enemy.radius * 0.7);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff1f2';
      context.beginPath();
      context.arc(enemy.radius * 0.4, -2, 2.5, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'spitter') {
      context.fillStyle = body ?? PALETTE.spitter;
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = body ?? PALETTE.spitterCore;
      context.lineWidth = 2;
      for (let spike = 0; spike < 8; spike += 1) {
        const angle = (spike / 8) * Math.PI * 2 + time;
        context.beginPath();
        context.moveTo(Math.cos(angle) * enemy.radius * 0.7, Math.sin(angle) * enemy.radius * 0.7);
        context.lineTo(Math.cos(angle) * (enemy.radius + 5), Math.sin(angle) * (enemy.radius + 5));
        context.stroke();
      }
      context.fillStyle = '#451a03';
      context.beginPath();
      context.arc(0, 0, 5, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'brute') {
      context.fillStyle = body ?? PALETTE.bruteShell;
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = body ?? PALETTE.brute;
      context.beginPath();
      context.arc(0, -3, enemy.radius * 0.7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fecdd3';
      context.beginPath();
      context.arc(-6, -6, 3, 0, Math.PI * 2);
      context.arc(6, -6, 3, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = body ?? PALETTE.brute;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-enemy.radius, 4);
      context.lineTo(-enemy.radius - 8, 10);
      context.moveTo(enemy.radius, 4);
      context.lineTo(enemy.radius + 8, 10);
      context.stroke();
    } else if (enemy.kind === 'splitter') {
      const wobble = 1 + Math.sin(time * 5 + enemy.wobble) * 0.12;
      context.scale(wobble, 1 / wobble);
      context.fillStyle = body ?? PALETTE.splitter;
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = body ?? PALETTE.splitterCore;
      context.beginPath();
      context.arc(-4, -4, enemy.radius * 0.35, 0, Math.PI * 2);
      context.arc(5, 5, enemy.radius * 0.28, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'mote') {
      context.fillStyle = body ?? PALETTE.mote;
      context.beginPath();
      context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fefce8';
      context.beginPath();
      context.arc(0, 0, enemy.radius * 0.45, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'stalker') {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      context.rotate(angle);
      context.fillStyle = body ?? PALETTE.stalker;
      for (let segment = 0; segment < 3; segment += 1) {
        const sway = Math.sin(time * 6 + enemy.wobble - segment) * 3;
        context.beginPath();
        context.ellipse(-segment * 9, sway, 9, 6, 0, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = '#fdf4ff';
      context.beginPath();
      context.arc(5, -2, 2.5, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.kind === 'wraith') {
      context.fillStyle = body ?? PALETTE.wraith;
      context.beginPath();
      context.moveTo(0, -enemy.radius);
      context.arc(0, -2, enemy.radius * 0.85, -Math.PI / 2 - 0.6, -Math.PI / 2 + Math.PI + 0.6);
      context.lineTo(-enemy.radius * 0.8, enemy.radius);
      context.lineTo(-enemy.radius * 0.4, enemy.radius * 0.6);
      context.lineTo(0, enemy.radius);
      context.lineTo(enemy.radius * 0.4, enemy.radius * 0.6);
      context.lineTo(enemy.radius * 0.8, enemy.radius);
      context.closePath();
      context.fill();
      context.fillStyle = '#1e1b4b';
      context.beginPath();
      context.arc(-4, -4, 2.5, 0, Math.PI * 2);
      context.arc(4, -4, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (enemy.elite) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.setLineDash([6, 5]);
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius + 6, time * 1.5, time * 1.5 + Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    drawEnemyHp(enemy);
  }

  function drawBoss(state, time) {
    const boss = state.boss;
    if (boss === null || !boss.active) return;
    if (boss.chargeState === 'telegraph') {
      context.strokeStyle = 'rgba(225, 29, 72, 0.5)';
      context.lineWidth = boss.radius * 1.4;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(boss.x, boss.y);
      context.lineTo(boss.chargeX, boss.chargeY);
      context.stroke();
      context.lineCap = 'butt';
    }
    const flash = boss.flash > 0;
    const breathe = 1 + Math.sin(time * 1.8) * 0.04;
    context.save();
    context.translate(boss.x, boss.y);
    context.scale(breathe, breathe);
    const jawOpen = boss.phase === 3 ? 0.5 : boss.phase === 2 ? 0.38 : 0.28;
    context.fillStyle = PALETTE.maw;
    context.beginPath();
    context.arc(0, 0, boss.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.mawBelly;
    context.beginPath();
    context.ellipse(0, boss.radius * 0.35, boss.radius * 0.7, boss.radius * 0.45, 0, 0, Math.PI * 2);
    context.fill();
    // Jaws: two crescents opening toward the beacon below.
    context.fillStyle = '#450a0a';
    context.beginPath();
    context.moveTo(-boss.radius * 0.7, boss.radius * 0.1);
    context.quadraticCurveTo(0, boss.radius * (0.1 + jawOpen), boss.radius * 0.7, boss.radius * 0.1);
    context.quadraticCurveTo(0, boss.radius * 0.75, -boss.radius * 0.7, boss.radius * 0.1);
    context.closePath();
    context.fill();
    context.fillStyle = '#fef2f2';
    for (let tooth = -2; tooth <= 2; tooth += 1) {
      context.beginPath();
      context.moveTo(tooth * 13 - 5, boss.radius * 0.12);
      context.lineTo(tooth * 13 + 5, boss.radius * 0.12);
      context.lineTo(tooth * 13, boss.radius * 0.34);
      context.closePath();
      context.fill();
    }
    // Eyes: three, watching.
    for (const eyeX of [-20, 0, 20]) {
      context.fillStyle = PALETTE.mawEye;
      context.beginPath();
      context.arc(eyeX, -boss.radius * 0.42, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#111827';
      context.beginPath();
      context.arc(eyeX, -boss.radius * 0.42, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    // Spikes around the crown.
    context.fillStyle = PALETTE.mawBelly;
    for (let spike = 0; spike < 7; spike += 1) {
      const angle = Math.PI + (spike / 6) * Math.PI;
      const sx = boss.x + Math.cos(angle) * boss.radius;
      const sy = boss.y + Math.sin(angle) * boss.radius;
      context.beginPath();
      context.moveTo(sx - 6, sy);
      context.lineTo(sx + 6, sy);
      context.lineTo(sx + Math.cos(angle) * 14, sy + Math.sin(angle) * 14);
      context.closePath();
      context.fill();
    }
    // A hit lands as a pale shimmer over the Maw, never a white-out.
    if (flash) {
      context.globalAlpha = Math.min(0.4, boss.flash / 0.09 * 0.4);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.sin(time * 30) > 0) context.globalAlpha = 0.45;
    const aimAngle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
    context.save();
    context.translate(player.x, player.y);

    // Aim guide: three fading dots toward the pointer.
    context.fillStyle = 'rgba(158, 243, 255, 0.5)';
    for (let dot = 1; dot <= 3; dot += 1) {
      context.beginPath();
      context.arc(Math.cos(aimAngle) * (22 + dot * 12), Math.sin(aimAngle) * (22 + dot * 12), 2.5 - dot * 0.5, 0, Math.PI * 2);
      context.fill();
    }

    // The keeper: a glowing diver with a lamp-staff.
    const glow = context.createRadialGradient(0, 0, 4, 0, 0, 34);
    glow.addColorStop(0, 'rgba(94, 234, 212, 0.35)');
    glow.addColorStop(1, 'rgba(94, 234, 212, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(0, 0, 34, 0, Math.PI * 2);
    context.fill();
    context.rotate(aimAngle);
    context.fillStyle = PALETTE.playerSuit;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius - 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(4, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#134e4a';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(6, 4);
    context.lineTo(20, 8);
    context.stroke();
    context.fillStyle = PALETTE.beaconCore;
    context.beginPath();
    context.arc(22, 9, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.globalAlpha = 1;

    if (player.shield > 0) {
      const shimmer = 0.5 + Math.sin(time * 5) * 0.2;
      context.strokeStyle = `rgba(147, 197, 253, ${shimmer})`;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius + 10, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawProjectiles(state) {
    for (const bolt of state.bolts) {
      if (!bolt.active) continue;
      const angle = Math.atan2(bolt.vy, bolt.vx);
      // A short trail, so a volley reads even in a still frame.
      context.strokeStyle = bolt.crit ? PALETTE.gold : PALETTE.bolt;
      context.globalAlpha = 0.45;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(bolt.x - bolt.vx * 0.035, bolt.y - bolt.vy * 0.035);
      context.lineTo(bolt.x, bolt.y);
      context.stroke();
      context.globalAlpha = 1;
      context.save();
      context.translate(bolt.x, bolt.y);
      context.rotate(angle);
      context.fillStyle = bolt.crit ? PALETTE.gold : PALETTE.bolt;
      context.beginPath();
      context.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.boltCore;
      context.beginPath();
      context.ellipse(2, 0, 7, 2.5, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    for (const wisp of state.wisps) {
      if (!wisp.active) continue;
      const glow = context.createRadialGradient(wisp.x, wisp.y, 1, wisp.x, wisp.y, 16);
      glow.addColorStop(0, 'rgba(199, 146, 255, 0.8)');
      glow.addColorStop(1, 'rgba(199, 146, 255, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(wisp.x, wisp.y, 16, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.wisp;
      context.beginPath();
      context.arc(wisp.x, wisp.y, wisp.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#faf5ff';
      context.beginPath();
      context.arc(wisp.x, wisp.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const glob of state.enemyShots) {
      if (!glob.active) continue;
      context.fillStyle = PALETTE.glob;
      context.beginPath();
      context.arc(glob.x, glob.y, glob.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.globCore;
      context.beginPath();
      context.arc(glob.x - 2, glob.y - 2, glob.radius * 0.45, 0, Math.PI * 2);
      context.fill();
    }
    for (const orb of orbitalPositions(state)) {
      const glow = context.createRadialGradient(orb.x, orb.y, 1, orb.x, orb.y, 22);
      glow.addColorStop(0, 'rgba(125, 232, 255, 0.7)');
      glow.addColorStop(1, 'rgba(125, 232, 255, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(orb.x, orb.y, 22, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.beaconGlow;
      context.beginPath();
      context.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.beaconCore;
      context.beginPath();
      context.arc(orb.x, orb.y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawHud(state, screen, best, remaining) {
    const time = state.time;
    context.textAlign = 'left';
    context.font = `800 26px ${FONT}`;
    context.fillStyle = PALETTE.text;
    context.fillText(state.score.toLocaleString(), 24, 38);
    context.font = `400 14px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.fillText(`BEST ${Math.max(best, state.score).toLocaleString()}`, 24, 58);
    const multiplier = comboMultiplier(state.combo.kills);
    if (multiplier > 1 && state.combo.timer > 0) {
      context.font = `800 20px ${FONT}`;
      context.fillStyle = PALETTE.gold;
      context.fillText(`COMBO x${multiplier}`, 24, 86);
    }

    // Tide, foes and the beacon's light, centred at the top.
    context.textAlign = 'center';
    context.font = `800 20px ${FONT}`;
    context.fillStyle = PALETTE.text;
    const tideLabel = state.tide === 0 ? 'THE REEF' : state.tide === TIDE_COUNT ? 'THE MAW' : `TIDE ${state.tide} / ${TIDE_COUNT}`;
    context.fillText(tideLabel, FIELD.width / 2, 32);
    context.font = `400 14px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    const foesLine = state.phase === 'done' ? '' : state.phase === 'breather' ? 'the water calms…' : `${remaining} foes remain`;
    context.fillText(foesLine, FIELD.width / 2, 52);
    const barWidth = 260;
    const barX = FIELD.width / 2 - barWidth / 2;
    const hpFraction = Math.max(0, state.beacon.hp / state.beacon.maxHp);
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(barX, 62, barWidth, 10);
    context.fillStyle = hpFraction > 0.5 ? PALETTE.beaconGlow : hpFraction > 0.25 ? PALETTE.gold : PALETTE.danger;
    context.fillRect(barX, 62, barWidth * hpFraction, 10);
    context.font = `700 12px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.fillText(`BEACON ${Math.ceil(state.beacon.hp)} / ${state.beacon.maxHp}`, FIELD.width / 2, 88);

    // The Maw's bar, under the beacon's.
    const boss = state.boss;
    if (boss !== null && boss.active) {
      const bossWidth = 420;
      const bossX = FIELD.width / 2 - bossWidth / 2;
      const bossFraction = Math.max(0, boss.hp / boss.maxHp);
      context.fillStyle = 'rgba(0, 0, 0, 0.55)';
      context.fillRect(bossX, 100, bossWidth, 12);
      context.fillStyle = PALETTE.maw;
      context.fillRect(bossX, 100, bossWidth * bossFraction, 12);
      context.font = `800 13px ${FONT}`;
      context.fillStyle = '#fecdd3';
      context.fillText('THE MAW OF THE DEEP', FIELD.width / 2, 128);
    }

    // Hearts and ward, bottom left.
    for (let index = 0; index < state.player.maxHp; index += 1) {
      const x = 34 + index * 30;
      const y = FIELD.height - 40;
      if (index < state.player.hp) {
        drawHeartShape(x, y, 11, PALETTE.heart);
      } else {
        context.globalAlpha = 0.25;
        drawHeartShape(x, y, 11, PALETTE.heart);
        context.globalAlpha = 1;
      }
    }
    if (state.player.shield > 0) {
      context.font = `700 15px ${FONT}`;
      context.fillStyle = PALETTE.shield;
      context.textAlign = 'left';
      context.fillText(`WARD ${state.player.shield}`, 34 + state.player.maxHp * 30 + 8, FIELD.height - 32);
    }

    // Dash, bottom centre.
    const dashReady = state.player.dashCd <= 0;
    const dashFraction = dashReady ? 1 : 1 - state.player.dashCd / state.build.dashCooldown;
    context.textAlign = 'center';
    context.font = `700 13px ${FONT}`;
    context.fillStyle = dashReady ? PALETTE.player : PALETTE.muted;
    context.fillText('DASH [SHIFT]', FIELD.width / 2, FIELD.height - 48);
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(FIELD.width / 2 - 60, FIELD.height - 40, 120, 8);
    context.fillStyle = PALETTE.player;
    context.fillRect(FIELD.width / 2 - 60, FIELD.height - 40, 120 * dashFraction, 8);

    // Level and experience, bottom right.
    const xpFraction = Math.min(1, state.xp / state.xpNext);
    context.textAlign = 'right';
    context.font = `800 18px ${FONT}`;
    context.fillStyle = PALETTE.text;
    context.fillText(`LEVEL ${state.level}`, FIELD.width - 24, FIELD.height - 48);
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(FIELD.width - 224, FIELD.height - 40, 200, 8);
    context.fillStyle = PALETTE.xpBar;
    context.fillRect(FIELD.width - 224, FIELD.height - 40, 200 * xpFraction, 8);
    context.font = `400 12px ${FONT}`;
    context.fillStyle = PALETTE.muted;
    context.fillText(`${Math.floor(state.xp)} / ${state.xpNext} lumens`, FIELD.width - 24, FIELD.height - 22);

    // The tide banner, fading in the middle of the water.
    if (state.banner.timer > 0 && screen === 'playing') {
      const alpha = Math.min(1, state.banner.timer / 0.6);
      context.globalAlpha = alpha;
      context.textAlign = 'center';
      context.font = `800 44px ${FONT}`;
      context.fillStyle = PALETTE.beaconGlow;
      context.fillText(state.banner.text, FIELD.width / 2, 190);
      context.font = `400 19px ${FONT}`;
      context.fillStyle = PALETTE.text;
      context.fillText(state.banner.sub, FIELD.width / 2, 222);
      context.globalAlpha = 1;
    }

    // Danger vignette when the keeper or the beacon is nearly spent.
    const danger = state.player.hp <= 1 || state.beacon.hp < 25;
    if (danger && screen === 'playing') {
      const pulse = 0.22 + Math.sin(time * 4) * 0.1;
      const vignette = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.32, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.72);
      vignette.addColorStop(0, 'rgba(225, 29, 72, 0)');
      vignette.addColorStop(1, `rgba(225, 29, 72, ${pulse})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  /** Draw one frame: the world, the HUD, then whichever screen is showing. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#020a12';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(deviceScale * scale, 0, 0, deviceScale * scale, deviceScale * offsetX, deviceScale * offsetY);

    const shake = ui.shakeOn ? state.particles.offset() : { x: 0, y: 0 };
    context.save();
    context.translate(shake.x, shake.y);
    drawBackground(state.time);
    drawBeacon(state, state.time);
    drawShards(state, state.time);
    drawPickups(state, state.time);
    drawMines(state, state.time);
    for (const enemy of state.enemies) {
      if (enemy.active) drawEnemy(enemy, state.time);
    }
    drawBoss(state, state.time);
    drawPlayer(state, state.time);
    drawProjectiles(state);
    state.particles.draw(context);
    state.particles.drawTexts(context, FONT);
    context.restore();

    if (screen !== SCREEN_TITLE) {
      drawHud(state, screen, ui.best, ui.remaining);
    }
    if (screen === SCREEN_TITLE) drawTitle(context, ui.best, ui.muted, ui.shakeOn, state.time);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(context, state);
    else if (screen === SCREEN_PAUSED) drawPaused(context, ui.muted, ui.shakeOn);
    else if (screen === SCREEN_OVER) drawOver(context, state, ui.best, ui.reason);
    else if (screen === SCREEN_WIN) drawWin(context, state, ui.best);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, toField, upgradeRects, pauseRects };
}

// Juice: sparks, embers, rings and floating numbers. Particles are pooled
// and updated in place; floating texts rise and fade. Everything here is
// cosmetic — the simulation never reads it back.

import { FONT } from './config.js';

const MAX_PARTICLES = 900;
const MAX_FLOATERS = 60;

/** One pooled particle: position, velocity, life, size, colour, drag, gravity. */
function makeParticle() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0, gravity: 0, ring: false, glow: false };
}

function makeFloater() {
  return { active: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 16 };
}

export function createParticles() {
  const pool = Array.from({ length: MAX_PARTICLES }, makeParticle);
  const floaters = Array.from({ length: MAX_FLOATERS }, makeFloater);
  let cursor = 0;
  let floaterCursor = 0;

  function spawn(x, y, vx, vy, life, size, color, options = {}) {
    const particle = pool[cursor];
    cursor = (cursor + 1) % pool.length;
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.maxLife = life;
    particle.size = size;
    particle.color = color;
    particle.drag = options.drag ?? 2.2;
    particle.gravity = options.gravity ?? 0;
    particle.ring = options.ring ?? false;
    particle.glow = options.glow ?? false;
  }

  return {
    /** A burst of sparks flying outward from a point. */
    burst(x, y, count, color, speed = 220, life = 0.5, size = 3) {
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = speed * (0.3 + Math.random() * 0.7);
        spawn(x, y, Math.cos(angle) * velocity, Math.sin(angle) * velocity, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color);
      }
    },
    /** A soft glowing mote that drifts upward, for ambient magic. */
    ember(x, y, color, size = 2.5) {
      spawn(x, y, (Math.random() - 0.5) * 24, -20 - Math.random() * 30, 1.2 + Math.random(), size, color, { drag: 0.4, glow: true });
    },
    /** An expanding ring, for novas, explosions and level-ups. */
    ring(x, y, color, maxRadius = 90, life = 0.45) {
      spawn(x, y, 0, 0, life, maxRadius, color, { drag: 0, ring: true });
    },
    /** Floating combat text: damage, pickups, combo calls. */
    float(x, y, text, color, size = 16) {
      const floater = floaters[floaterCursor];
      floaterCursor = (floaterCursor + 1) % floaters.length;
      floater.active = true;
      floater.x = x;
      floater.y = y;
      floater.life = 0.9;
      floater.maxLife = 0.9;
      floater.text = text;
      floater.color = color;
      floater.size = size;
    },
    update(dt) {
      for (const particle of pool) {
        if (!particle.active) continue;
        particle.life -= dt;
        if (particle.life <= 0) {
          particle.active = false;
          continue;
        }
        const drag = Math.max(0, 1 - particle.drag * dt);
        particle.vx *= drag;
        particle.vy = particle.vy * drag + particle.gravity * dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
      for (const floater of floaters) {
        if (!floater.active) continue;
        floater.life -= dt;
        floater.y -= 42 * dt;
        if (floater.life <= 0) floater.active = false;
      }
    },
    /** Draw every live particle and floater. Rings expand as they age. */
    draw(context) {
      for (const particle of pool) {
        if (!particle.active) continue;
        const age = 1 - particle.life / particle.maxLife;
        context.globalAlpha = Math.max(0, 1 - age);
        if (particle.ring) {
          context.strokeStyle = particle.color;
          context.lineWidth = 3 * (1 - age) + 1;
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * (0.25 + age * 0.75), 0, Math.PI * 2);
          context.stroke();
        } else if (particle.glow) {
          context.fillStyle = particle.color;
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * (1 - age * 0.5), 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillStyle = particle.color;
          context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
        }
      }
      context.globalAlpha = 1;
      for (const floater of floaters) {
        if (!floater.active) continue;
        const age = 1 - floater.life / floater.maxLife;
        context.globalAlpha = Math.max(0, 1 - age * age);
        context.font = `700 ${floater.size}px ${FONT}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = floater.color;
        context.fillText(floater.text, floater.x, floater.y);
      }
      context.globalAlpha = 1;
    },
    clear() {
      for (const particle of pool) particle.active = false;
      for (const floater of floaters) floater.active = false;
    },
  };
}

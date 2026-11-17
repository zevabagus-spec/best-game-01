// Particles, floating score text and screen shake, all from fixed pools:
// nothing is allocated while the game runs. The world spawns effects; the
// renderer asks for the shake offset and calls draw() at the right layer.

const MAX_PARTICLES = 512;
const MAX_TEXTS = 40;

export function createParticles() {
  const pool = [];
  for (let index = 0; index < MAX_PARTICLES; index += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0, glow: false, ring: false });
  }
  const texts = [];
  for (let index = 0; index < MAX_TEXTS; index += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 16 });
  }
  let cursor = 0;
  let textCursor = 0;
  let trauma = 0;
  let shakeX = 0;
  let shakeY = 0;

  function spawn(x, y, vx, vy, life, size, color, drag, glow, ring) {
    const particle = pool[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.maxLife = life;
    particle.size = size;
    particle.color = color;
    particle.drag = drag;
    particle.glow = glow;
    particle.ring = ring;
  }

  return {
    /** A burst of sparks flying out from a point. */
    burst(x, y, color, count, speed, life, size) {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const power = speed * (0.3 + Math.random() * 0.7);
        spawn(x, y, Math.cos(angle) * power, Math.sin(angle) * power, life * (0.6 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), color, 3.2, true, false);
      }
    },
    /** An expanding ring, for novas, explosions and level-ups. */
    ring(x, y, color, size, life) {
      spawn(x, y, 0, 0, life, size, color, 0, true, true);
    },
    /** A short-lived mote that drifts upward, for trails and bubbles. */
    mote(x, y, color, size, life, rise) {
      spawn(x, y, (Math.random() - 0.5) * 24, -(rise ?? 30), life, size, color, 0.4, true, false);
    },
    /** Floating text that rises and fades: damage, score, pickups. */
    addText(x, y, text, color, size) {
      const slot = texts[textCursor];
      textCursor = (textCursor + 1) % MAX_TEXTS;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.life = 0.9;
      slot.maxLife = 0.9;
      slot.text = text;
      slot.color = color;
      slot.size = size;
    },
    /** Add trauma (0..1); the shake offset follows its square. */
    addShake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    /** The current shake offset in field pixels; the renderer translates by it. */
    offset() {
      return { x: shakeX, y: shakeY };
    },
    update(dt) {
      trauma = Math.max(0, trauma - dt * 1.6);
      const magnitude = trauma * trauma * 14;
      shakeX = (Math.random() * 2 - 1) * magnitude;
      shakeY = (Math.random() * 2 - 1) * magnitude;
      for (let index = 0; index < MAX_PARTICLES; index += 1) {
        const particle = pool[index];
        if (!particle.active) continue;
        particle.life -= dt;
        if (particle.life <= 0) {
          particle.active = false;
          continue;
        }
        const dragFactor = Math.max(0, 1 - particle.drag * dt);
        particle.vx *= dragFactor;
        particle.vy *= dragFactor;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
      for (let index = 0; index < MAX_TEXTS; index += 1) {
        const slot = texts[index];
        if (!slot.active) continue;
        slot.life -= dt;
        slot.y -= 42 * dt;
        if (slot.life <= 0) slot.active = false;
      }
    },
    draw(context) {
      for (let index = 0; index < MAX_PARTICLES; index += 1) {
        const particle = pool[index];
        if (!particle.active) continue;
        const fade = particle.life / particle.maxLife;
        context.globalAlpha = fade;
        context.fillStyle = particle.color;
        if (particle.ring) {
          const grown = particle.size * (0.55 + (1 - fade) * 0.6);
          context.globalAlpha = fade * 0.8;
          context.beginPath();
          context.arc(particle.x, particle.y, grown, 0, Math.PI * 2);
          context.lineWidth = 3 + 3 * fade;
          context.strokeStyle = particle.color;
          context.stroke();
        } else {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * (0.5 + fade * 0.5), 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    },
    drawTexts(context, font) {
      context.textAlign = 'center';
      for (let index = 0; index < MAX_TEXTS; index += 1) {
        const slot = texts[index];
        if (!slot.active) continue;
        const fade = Math.min(1, slot.life / slot.maxLife * 1.6);
        context.globalAlpha = fade;
        context.font = `700 ${slot.size}px ${font}`;
        context.fillStyle = slot.color;
        context.fillText(slot.text, slot.x, slot.y);
      }
      context.globalAlpha = 1;
    },
    /** How many particles are alive, for tests and tuning. */
    aliveCount() {
      let count = 0;
      for (let index = 0; index < MAX_PARTICLES; index += 1) {
        if (pool[index].active) count += 1;
      }
      return count;
    },
    /** Silence every particle and text: used when a scene is re-staged. */
    clear() {
      for (let index = 0; index < MAX_PARTICLES; index += 1) pool[index].active = false;
      for (let index = 0; index < MAX_TEXTS; index += 1) texts[index].active = false;
      trauma = 0;
      shakeX = 0;
      shakeY = 0;
    },
  };
}

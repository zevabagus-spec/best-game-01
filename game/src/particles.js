// Particles and floating text, drawn over the field. One fixed pool of
// particles, allocated at boot; floating texts are a small ring buffer. Nothing
// here allocates while the game runs.

export function createParticles() {
  const MAX = 320;
  const parts = [];
  for (let index = 0; index < MAX; index += 1) {
    parts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', drag: 0, gravity: 0 });
  }
  const texts = [];
  for (let index = 0; index < 24; index += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, maxLife: 1, value: '', color: '#ffffff', size: 18 });
  }
  let textCursor = 0;

  function freePart() {
    for (let index = 0; index < parts.length; index += 1) {
      if (!parts[index].active) return parts[index];
    }
    return null;
  }

  /** A burst of sparks: `count` particles flying out of (x, y). */
  function burst(x, y, count, color, speed, size, life) {
    for (let index = 0; index < count; index += 1) {
      const part = freePart();
      if (part === null) return;
      const angle = Math.random() * Math.PI * 2;
      const power = speed * (0.35 + Math.random() * 0.65);
      part.active = true;
      part.x = x;
      part.y = y;
      part.vx = Math.cos(angle) * power;
      part.vy = Math.sin(angle) * power;
      part.maxLife = life * (0.6 + Math.random() * 0.6);
      part.life = part.maxLife;
      part.size = size * (0.6 + Math.random() * 0.8);
      part.color = color;
      part.drag = 2.2;
      part.gravity = 0;
    }
  }

  /** A slow ember trail, the kind a projectile leaves behind it. */
  function trail(x, y, color) {
    const part = freePart();
    if (part === null) return;
    part.active = true;
    part.x = x;
    part.y = y;
    part.vx = (Math.random() - 0.5) * 24;
    part.vy = -18 - Math.random() * 20;
    part.maxLife = 0.35;
    part.life = 0.35;
    part.size = 3;
    part.color = color;
    part.drag = 0;
    part.gravity = -30;
  }

  /** A rising score or message that fades as it floats up. */
  function floatText(x, y, value, color, size) {
    const text = texts[textCursor];
    textCursor = (textCursor + 1) % texts.length;
    text.active = true;
    text.x = x;
    text.y = y;
    text.maxLife = 1.1;
    text.life = 1.1;
    text.value = value;
    text.color = color;
    text.size = size || 18;
  }

  function update(dt) {
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      if (!part.active) continue;
      part.life -= dt;
      if (part.life <= 0) {
        part.active = false;
        continue;
      }
      const drag = 1 - Math.min(0.9, part.drag * dt);
      part.vx *= drag;
      part.vy *= drag;
      part.vy += part.gravity * dt;
      part.x += part.vx * dt;
      part.y += part.vy * dt;
    }
    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index];
      if (!text.active) continue;
      text.life -= dt;
      text.y -= 34 * dt;
      if (text.life <= 0) text.active = false;
    }
  }

  return { parts, texts, burst, trail, floatText, update };
}

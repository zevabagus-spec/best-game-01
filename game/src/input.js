// Keyboard and mouse, read as one input: a movement vector, an aim point in
// field coordinates, whether the trigger is held, and the edge-triggered
// actions (confirm, pause, mute, dash) and clicks the screens consume. Keys
// the game uses never scroll the page. Pointer events cover mouse and touch
// alike; the game itself is tuned for keyboard and mouse.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas, toField) {
  const pressed = new Set();
  const clicks = [];
  const upgradePicks = [];
  let actions = 0;
  let dashQueued = false;
  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;

  function fieldPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return toField(event.clientX - rect.left, event.clientY - rect.top);
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    if (MOVE_KEYS[event.code] !== undefined) {
      pressed.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      dashQueued = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      dashQueued = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
      return;
    }
    if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
      upgradePicks.push(Number(event.code.slice(-1)) - 1);
    }
  }

  function onKeyUp(event) {
    pressed.delete(event.code);
  }

  function onPointerDown(event) {
    const point = fieldPoint(event);
    pointerX = point.x;
    pointerY = point.y;
    pointerDown = true;
    clicks.push({ x: point.x, y: point.y });
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture can fail for a pointer that is already gone; the game plays on.
    }
  }

  function onPointerMove(event) {
    const point = fieldPoint(event);
    pointerX = point.x;
    pointerY = point.y;
  }

  function onPointerUp() {
    pointerDown = false;
  }

  function onBlur() {
    pressed.clear();
    pointerDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The movement vector from the held keys, normalised, or zero. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of pressed) {
        const step = MOVE_KEYS[code];
        if (step !== undefined) {
          x += step[0];
          y += step[1];
        }
      }
      const length = Math.hypot(x, y);
      if (length === 0) return { x: 0, y: 0 };
      return { x: x / length, y: y / length };
    },
    /** The aim point in field coordinates: where the pointer is. */
    aim() {
      return { x: pointerX, y: pointerY };
    },
    get firing() {
      return pointerDown;
    },
    /** Actions raised since the last read, as a bit mask (then cleared). */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Clicks since the last read, in field coordinates (then cleared). */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    /** The oldest upgrade pick (0, 1 or 2), or -1 when none was pressed. */
    takeUpgradePick() {
      return upgradePicks.length > 0 ? upgradePicks.shift() : -1;
    },
    /** True once when the dash key was pressed since the last read. */
    takeDash() {
      const taken = dashQueued;
      dashQueued = false;
      return taken;
    },
    /** Forget held keys and clicks (used when the screen changes). */
    flush() {
      actions = 0;
      dashQueued = false;
      clicks.length = 0;
      upgradePicks.length = 0;
    },
  };
}

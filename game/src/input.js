// Keyboard and mouse, reduced to the game's own questions: which way to
// move, where to aim, whether to fire or dash, and the one-shot actions
// (confirm, pause, mute, card picks). The autopilot speaks this same
// interface, so screenshot scenes play through the real input path.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;

/** Keys that move the warden, in field space. */
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

/**
 * @param {HTMLCanvasElement} canvas the game canvas, for mouse coordinates
 * @param {(clientX: number, clientY: number) => {x: number, y: number}} toField
 *   converts a mouse position to field coordinates
 */
export function createInput(canvas, toField) {
  const held = new Set();
  let actions = 0;
  let clicks = [];
  let upgradePick = -1;
  let mouse = { x: 640, y: 200 };
  let firing = false;
  let dashQueued = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    if (MOVE_KEYS[event.code] !== undefined) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      dashQueued = true;
      event.preventDefault();
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      dashQueued = true;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
      upgradePick = Number(event.code.slice(-1)) - 1;
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    mouse = toField(event.clientX, event.clientY);
  }

  function onMouseDown(event) {
    mouse = toField(event.clientX, event.clientY);
    if (event.button === 0) {
      firing = true;
      clicks.push({ ...mouse });
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) firing = false;
  }

  function onBlur() {
    // Losing the window drops everything queued, so a click or dash from
    // before the blur can never fire on the way back in.
    held.clear();
    firing = false;
    actions = 0;
    clicks = [];
    upgradePick = -1;
    dashQueued = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The normalised move direction from the held keys. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const dir = MOVE_KEYS[code];
        if (dir !== undefined) {
          x += dir[0];
          y += dir[1];
        }
      }
      const length = Math.hypot(x, y);
      if (length === 0) return { x: 0, y: 0 };
      return { x: x / length, y: y / length };
    },
    /** The aim point, in field coordinates. */
    aim() {
      return { ...mouse };
    },
    get firing() {
      return firing;
    },
    /** Whether a dash was requested since the last step; consumed on read. */
    takeDash() {
      const queued = dashQueued;
      dashQueued = false;
      return queued;
    },
    /** One-shot actions since the last read; consumed on read. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Clicks since the last read, in field coordinates; consumed on read. */
    takeClicks() {
      const taken = clicks;
      clicks = [];
      return taken;
    },
    /** A 1/2/3 card pick since the last read, or -1; consumed on read. */
    takeUpgradePick() {
      const taken = upgradePick;
      upgradePick = -1;
      return taken;
    },
    /** Drop every queued action, click and dash (used on screen changes). */
    flush() {
      actions = 0;
      clicks = [];
      upgradePick = -1;
      dashQueued = false;
    },
  };
}

// Keyboard and mouse input. Held keys give a movement direction; one-shot
// presses (start, pause, mute, upgrade picks) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never
// counted twice. Mouse position is kept in field coordinates, and clicks are
// queued with their position for the screens that need them (title, upgrades).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas, toField) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let actions = 0;
  let upgradePick = -1;
  let mouseX = 640;
  let mouseY = 360;
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'Digit1' || event.code === 'Numpad1') upgradePick = 0;
    else if (event.code === 'Digit2' || event.code === 'Numpad2') upgradePick = 1;
    else if (event.code === 'Digit3' || event.code === 'Numpad3') upgradePick = 2;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    firing = false;
  });

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const point = toField(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    mouseX = point.x;
    mouseY = point.y;
  }
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    firing = true;
    clicks.push({ x: mouseX, y: mouseY });
  });
  window.addEventListener('pointerup', () => {
    firing = false;
  });
  // Space also fires while held: the keeper throws embers with the keyboard too.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') firing = true;
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') firing = false;
  });

  return {
    /** Movement direction, each axis -1, 0 or 1, diagonals unnormalized. */
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** Where the mouse aims, in field coordinates. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    get firing() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The upgrade card index picked with 1/2/3 since the last call, or -1. */
    takeUpgradePick() {
      const pick = upgradePick;
      upgradePick = -1;
      return pick;
    },
    /** The clicks since the last call, each {x, y} in field coordinates. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}

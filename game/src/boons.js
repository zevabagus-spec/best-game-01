// The boons: fifteen upgrades, offered three at a time whenever the warden
// levels up. Each has a cap, a plain-language promise, and an icon the draft
// screen draws. The offer is drawn from what the build can still take, so a
// maxed boon never wastes a card.

export const BOONS = {
  damage: { name: 'Sunforged Bolts', text: '+1 bolt damage', icon: '☀', max: 5 },
  split: { name: 'Triple Dawn', text: '+1 pair of side bolts', icon: '✦', max: 3 },
  pierce: { name: 'Piercing Light', text: 'Bolts pass through +1 foe', icon: '➤', max: 3 },
  rapid: { name: 'Quickening', text: 'Fire 12% faster', icon: '≫', max: 4 },
  orbitals: { name: 'Ember Orbit', text: '+1 orbiting ember', icon: '◎', max: 3 },
  seekers: { name: 'Seeking Wisps', text: '+1 homing wisp', icon: '✧', max: 3 },
  nova: { name: 'Dawn Nova', text: 'Shockwave, faster and wider', icon: '◉', max: 3 },
  mines: { name: 'Sky Mines', text: 'Drop explosive mines', icon: '✚', max: 3 },
  crit: { name: 'Lucky Star', text: '+8% critical chance', icon: '★', max: 4 },
  speed: { name: 'Windrunner', text: '+10% move speed', icon: '➢', max: 3 },
  magnet: { name: 'Shard Lure', text: '+40% shard pull', icon: '◆', max: 3 },
  dash: { name: 'Swift Dash', text: 'Dash recharges 20% faster', icon: '⇢', max: 3 },
  greed: { name: 'Gilded Hunt', text: '+20% score from kills', icon: '●', max: 3 },
  heart: { name: 'Stout Heart', text: '+1 max heart, heal 1', icon: '♥', max: 3 },
  mend: { name: 'Mend the Spire', text: 'Restore 40 spire light', icon: '✚', max: 99 },
};

/** The boon definition for an id, or null for an unknown id. */
export function boonById(id) {
  return BOONS[id] ?? null;
}

/** Whether the build can still take this boon. */
function available(state, id) {
  const boon = BOONS[id];
  if (id === 'heart') return state.player.maxHp < 8;
  if (id === 'mend') return state.spire.hp < state.spire.maxHp;
  return state.build[id] < boon.max;
}

/**
 * Draw three offers from the boons the build can still take. Late in a run,
 * when almost everything is maxed, the offer cycles the few that remain
 * rather than showing the same card twice — except when only one boon is
 * left at all, in which case the choice is honestly that boon, three times.
 */
export function drawBoons(state) {
  const ids = Object.keys(BOONS).filter((id) => available(state, id));
  if (ids.length === 0) return ['mend', 'mend', 'mend'];
  const shuffled = state.random.shuffle(ids);
  const offers = [];
  for (let i = 0; i < 3; i += 1) offers.push(shuffled[i % shuffled.length]);
  return offers;
}

/** Apply a boon's level to the build, and its immediate effects. */
export function takeBoon(state, id) {
  const player = state.player;
  if (id === 'heart') {
    player.maxHp += 1;
    player.hp = Math.min(player.maxHp, player.hp + 1);
    return;
  }
  if (id === 'mend') {
    state.spire.hp = Math.min(state.spire.maxHp, state.spire.hp + 40);
    return;
  }
  state.build[id] += 1;
}

/**
 * The score bonus from the Gilded Hunt boon, read at scoring time — by the
 * kill and boss scoring in the enemy modules, and by the wave-clear bonus.
 */
export function greedBonus(state) {
  return 1 + state.build.greed * 0.2;
}

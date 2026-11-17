// The run's scorecard: everything the victory and defeat screens report,
// and everything the star rating weighs. Kept apart from the world so the
// numbers stay honest no matter how the run ends.

/** A fresh, empty scorecard. */
export function createStats() {
  return {
    kills: 0,
    elitesSlain: 0,
    bossesSlain: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageDealt: 0,
    pickupsTaken: 0,
    dashesUsed: 0,
    levelsGained: 0,
    relicsTaken: 0,
    shardsGathered: 0,
    highestCombo: 1,
    lowestWardenHp: 5,
    lowestSpireHp: 150,
    timePlayed: 0,
  };
}

/** Accuracy as a whole percent, safe when nothing was fired. */
export function accuracy(stats) {
  if (stats.shotsFired === 0) return 0;
  return Math.round((100 * stats.shotsHit) / stats.shotsFired);
}

/** A run time as M:SS, for the end screens. */
export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

/**
 * The victory star rating, 1 to 3: one star for finishing, one for keeping
 * the spire above half, one for keeping the warden above half. A flawless
 * run earns all three.
 */
export function starRating(state) {
  let stars = 1;
  if (state.stats.lowestSpireHp >= state.spire.maxHp * 0.5) stars += 1;
  if (state.stats.lowestWardenHp >= Math.ceil(state.player.maxHp / 2)) stars += 1;
  return stars;
}

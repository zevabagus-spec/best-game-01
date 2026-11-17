// The run's own scorecard: everything the end screens report, and the stars a
// victory earns. Stars are about how cleanly the light was kept, not about
// speed: one for winning, one for keeping half the beacon's light, one for
// never letting the keeper fall below two hearts.

export function createRunStats() {
  return {
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    damageDealt: 0,
    pickupsTaken: 0,
    dashesUsed: 0,
    levelsGained: 0,
    elitesSlain: 0,
    lowestKeeperHp: 99,
    lowestBeaconHp: 99,
    timePlayed: 0,
  };
}

/** Whole-percent accuracy of the keeper's bolts (0 when nothing was fired). */
export function shotAccuracy(stats) {
  if (stats.shotsFired <= 0) return 0;
  return Math.round((stats.shotsHit / stats.shotsFired) * 100);
}

/** Stars for a finished run: 0 without a victory, otherwise 1 to 3. */
export function starCount(stats, won, beaconHp, beaconMaxHp) {
  if (!won) return 0;
  let stars = 1;
  if (beaconHp >= beaconMaxHp / 2) stars += 1;
  if (stats.lowestKeeperHp >= 2) stars += 1;
  return stars;
}

/** A run's length as M:SS, or H:MM:SS for the rare hour-long night. */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  const paddedRest = rest < 10 ? `0${rest}` : `${rest}`;
  if (minutes < 60) return `${minutes}:${paddedRest}`;
  const hours = Math.floor(minutes / 60);
  const paddedMinutes = minutes % 60 < 10 ? `0${minutes % 60}` : `${minutes % 60}`;
  return `${hours}:${paddedMinutes}:${paddedRest}`;
}

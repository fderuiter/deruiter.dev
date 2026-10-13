/** A cell on the maze grid. */
interface GridCell {
  readonly x: number;
  readonly y: number;
}

/** The part of an enemy the threat check reads. */
interface ThreatEnemy extends GridCell {
  readonly state: string;
}

/**
 * How close a live patrol is to the player: red when its next step can trace
 * them, amber when it can reach them in two, none otherwise.
 */
export type ThreatLevel = "red" | "amber" | "none";

/**
 * Rates the patrol threat to the player. Distance is counted in orthogonal
 * steps ignoring walls, so the check is conservative: it may warn about a patrol
 * a wall would keep out, never miss one that can reach. Stunned and frozen
 * patrols cannot step, so they never count.
 *
 * @param player - The player's grid cell.
 * @param enemies - The room's enemies.
 * @returns The closest live patrol's threat level.
 */
export function patrolThreat(
  player: GridCell,
  enemies: ReadonlyArray<ThreatEnemy>
): ThreatLevel {
  let closest = Infinity;
  for (const enemy of enemies) {
    if (enemy.state === "stunned" || enemy.state === "frozen") continue;
    const steps = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
    if (steps < closest) closest = steps;
  }
  if (closest <= 1) return "red";
  if (closest === 2) return "amber";
  return "none";
}

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
 * Whether an active patrol is one step from the player, so its next step can
 * trace them. Stunned and frozen patrols cannot step, so they never count.
 *
 * @param player - The player's grid cell.
 * @param enemies - The room's enemies.
 * @returns True when a live patrol is orthogonally adjacent to the player.
 */
export function isPatrolThreat(
  player: GridCell,
  enemies: ReadonlyArray<ThreatEnemy>
): boolean {
  return enemies.some(
    (enemy) =>
      enemy.state !== "stunned" &&
      enemy.state !== "frozen" &&
      Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y) === 1
  );
}

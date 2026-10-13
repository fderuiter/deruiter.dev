/** A route node the player can visit. */
interface VisitableNode {
  readonly x: number;
  readonly y: number;
  readonly visited: boolean;
}

/**
 * Marks the route node on a cell as visited, if there is one that is not yet.
 * Every move (keyboard, d-pad tap, hold repeat or swipe) lands here through the
 * same step, so each one collects a node the same way.
 *
 * @param nodes - The room's route nodes.
 * @param x - The cell the player stepped onto.
 * @param y - The cell the player stepped onto.
 * @returns The next node list, and whether a node was newly collected.
 */
export function markNodeVisited<T extends VisitableNode>(
  nodes: ReadonlyArray<T>,
  x: number,
  y: number
): { nodes: T[]; collected: boolean } {
  const index = nodes.findIndex((n) => !n.visited && n.x === x && n.y === y);
  if (index === -1) return { nodes: [...nodes], collected: false };
  const next = [...nodes];
  next[index] = { ...nodes[index], visited: true };
  return { nodes: next, collected: true };
}

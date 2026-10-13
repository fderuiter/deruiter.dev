/** A route node as the room data exposes it. */
interface RouteNodeData {
  readonly x: number;
  readonly y: number;
  readonly visited: boolean;
}

/**
 * The maze as one string per row: "#" for a wall (static or moving), "." for
 * floor. Rows are joined with "|". Tests and the e2e walker read this to plan.
 *
 * @param grid - The current maze, with moving walls already stamped in.
 * @returns The serialized grid.
 */
export function serializeGrid(
  grid: ReadonlyArray<ReadonlyArray<string>>
): string {
  return grid
    .map((row) =>
      row.map((cell) => (cell === "#" || cell === "W" ? "#" : ".")).join("")
    )
    .join("|");
}

/**
 * The route nodes as "x,y:visited" entries, where visited is 1 or 0.
 *
 * @param nodes - The room's route nodes.
 * @returns The serialized nodes, joined with ";".
 */
export function serializeNodes(nodes: ReadonlyArray<RouteNodeData>): string {
  return nodes.map((n) => `${n.x},${n.y}:${n.visited ? 1 : 0}`).join(";");
}

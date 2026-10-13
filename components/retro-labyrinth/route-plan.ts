/**
 * The route planner the Retro Labyrinth walk uses (#2032): a shortest path over
 * open cells on the grid. Pure, so it is unit tested on its own.
 */

export type Cell = { x: number; y: number };

/** Each d-pad button, with the grid step it takes. Y grows downwards. */
export const STEPS: ReadonlyArray<{ button: string; dx: number; dy: number }> =
  [
    { button: "Move Up", dx: 0, dy: -1 },
    { button: "Move Down", dx: 0, dy: 1 },
    { button: "Move Left", dx: -1, dy: 0 },
    { button: "Move Right", dx: 1, dy: 0 },
  ];

/** The shortest route over open cells, excluding the start. Null if none. */
export function planRoute(
  open: boolean[][],
  from: Cell,
  to: Cell
): Cell[] | null {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const cameFrom = new Map<string, Cell>();
  const seen = new Set<string>([key(from)]);
  const queue: Cell[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current.x === to.x && current.y === to.y) {
      const route: Cell[] = [];
      let at: Cell | undefined = current;
      while (at && key(at) !== key(from)) {
        route.unshift(at);
        at = cameFrom.get(key(at));
      }
      return route;
    }
    for (const step of STEPS) {
      const next = { x: current.x + step.dx, y: current.y + step.dy };
      if (!open[next.y]?.[next.x] || seen.has(key(next))) continue;
      seen.add(key(next));
      cameFrom.set(key(next), current);
      queue.push(next);
    }
  }
  return null;
}

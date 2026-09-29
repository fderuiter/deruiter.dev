/**
 * Raycasting Field-of-View (FOV) and Fog-of-War Engine
 */

export interface FOVResult {
  visible: boolean[][];
  explored: boolean[][];
}

/* jscpd:ignore-start */
function isCompleteStringGrid(value: unknown): value is string[][] {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (!Object.prototype.hasOwnProperty.call(value, 0)) return false;

  const firstRow: unknown = value[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) return false;
  const width = firstRow.length;

  for (let y = 0; y < value.length; y++) {
    if (!Object.prototype.hasOwnProperty.call(value, y)) return false;

    const row: unknown = value[y];
    if (!Array.isArray(row) || row.length !== width) return false;

    for (let x = 0; x < width; x++) {
      if (
        !Object.prototype.hasOwnProperty.call(row, x) ||
        typeof row[x] !== "string"
      ) {
        return false;
      }
/* jscpd:ignore-end */
    }
  }

  return true;
}

/* jscpd:ignore-start */
function isCompleteBooleanMatrix(
  value: unknown,
  height: number,
  width: number
): value is boolean[][] {
  if (!Array.isArray(value) || value.length !== height) return false;

  for (let y = 0; y < height; y++) {
    if (!Object.prototype.hasOwnProperty.call(value, y)) return false;

    const row: unknown = value[y];
    if (!Array.isArray(row) || row.length !== width) return false;

    for (let x = 0; x < width; x++) {
      if (
        !Object.prototype.hasOwnProperty.call(row, x) ||
        typeof row[x] !== "boolean"
      ) {
        return false;
      }
/* jscpd:ignore-end */
    }
  }

  return true;
}

/**
 * Creates a clean, unexplored (all-false) fog-of-war matrix for given map dimensions.
 */
export function resetFogOfWar(height: number, width: number): boolean[][] {
  if (height <= 0 || width <= 0) return [];
  return Array.from({ length: height }, () => Array(width).fill(false));
}

/**
 * Calculates field of view using raycasting algorithm from a player origin (px, py).
 * Updates explored matrix permanently and visible matrix for current frame.
 */
export function calculateFOV(
  grid: string[][],
  px: number,
  py: number,
  radius: number = 6,
  existingExplored?: boolean[][]
): FOVResult {
  if (!isCompleteStringGrid(grid)) {
    return { visible: [], explored: [] };
  }

  const height = grid.length;
  const width = grid[0].length;

  const visible: boolean[][] = Array.from({ length: height }, () =>
    Array(width).fill(false)
  );

  const isMatchingDimensions = isCompleteBooleanMatrix(
    existingExplored,
    height,
    width
  );

  const explored: boolean[][] = isMatchingDimensions
    ? existingExplored.map((row) => [...row])
    : resetFogOfWar(height, width);

  // Player position is always visible & explored (if within bounds)
  if (py >= 0 && py < height && px >= 0 && px < width) {
    visible[py][px] = true;
    explored[py][px] = true;
  }

  // Cast rays in 360 degrees (using fine step)
  const numRays = 120;
  for (let i = 0; i < numRays; i++) {
    const angle = (i * 2 * Math.PI) / numRays;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);

    for (let r = 1; r <= radius; r += 0.5) {
      const targetX = Math.round(px + cos * r);
      const targetY = Math.round(py + sin * r);

      if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
        break;
      }

      visible[targetY][targetX] = true;
      explored[targetY][targetX] = true;

      // Walls block ray propagation
      if (grid[targetY][targetX] === "#" || grid[targetY][targetX] === "W") {
        break;
      }
    }
  }

  return { visible, explored };
}

/**
 * Checks if a direct unobstructed line of sight exists between two coordinates.
 */
export function hasLineOfSight(
  grid: string[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  if (!isCompleteStringGrid(grid)) {
    return false;
  }

  const height = grid.length;
  const width = grid[0].length;
  const isInBounds = (x: number, y: number): boolean =>
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < width &&
    y >= 0 &&
    y < height;

  if (!isInBounds(x0, y0) || !isInBounds(x1, y1)) return false;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    if (cx === x1 && cy === y1) return true;

    if (cy >= 0 && cy < height && cx >= 0 && cx < width) {
      if (
        (cx !== x0 || cy !== y0) &&
        (grid[cy][cx] === "#" || grid[cy][cx] === "W")
      ) {
        return false;
      }
    } else if (cx !== x0 || cy !== y0) {
      return false;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

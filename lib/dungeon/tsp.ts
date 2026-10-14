/**
 * TSP (Traveling Salesman Problem) Moving Wall & Path Recalculation Engine
 */

import { clamp } from "../game-utils";
import { TSPNode, TSPMovingWall } from "./types";

/**
 * Calculates Euclidean distance between two points.
 */
export function euclideanDist(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Recalculates the shortest TSP route through remaining unvisited landmark nodes
 * using nearest-neighbor heuristic starting from player position.
 */
export function computeShortestTour(
  startX: number,
  startY: number,
  nodes: TSPNode[],
  exitX: number,
  exitY: number
): { tour: Array<{ x: number; y: number }>; totalDistance: number } {
  const unvisited = nodes.filter((n) => !n.visited);
  if (unvisited.length === 0) {
    const d = euclideanDist(startX, startY, exitX, exitY);
    return {
      tour: [
        { x: startX, y: startY },
        { x: exitX, y: exitY },
      ],
      totalDistance: d,
    };
  }

  const tour: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  let currentPos = { x: startX, y: startY };
  let totalDistance = 0;
  const remaining = [...unvisited];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const d = euclideanDist(
        currentPos.x,
        currentPos.y,
        remaining[i].x,
        remaining[i].y
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    const nextNode = remaining.splice(bestIdx, 1)[0];
    tour.push({ x: nextNode.x, y: nextNode.y });
    totalDistance += bestDist;
    currentPos = { x: nextNode.x, y: nextNode.y };
  }

  // Connect to exit
  const exitDist = euclideanDist(currentPos.x, currentPos.y, exitX, exitY);
  tour.push({ x: exitX, y: exitY });
  totalDistance += exitDist;

  return { tour, totalDistance };
}

/**
 * Updates dynamic moving walls for the TSP room.
 * Shifting barriers cycle on player movement count or step parity.
 */
export function updateTSPMovingWalls(
  grid: string[][],
  walls: TSPMovingWall[],
  moveCount: number
): { updatedGrid: string[][]; updatedWalls: TSPMovingWall[] } {
  const newGrid = grid.map((row) => [...row]);
  const newWalls = walls.map((w, index) => {
    // Clear old wall from grid if it was a moving wall
    if (newGrid[w.y][w.x] === "W") {
      newGrid[w.y][w.x] = " ";
    }

    // Toggle wall position based on move count and index
    const shift = (moveCount + index) % 4 < 2;
    const nextY = shift ? w.baseY : clamp(w.baseY + 1, 1, newGrid.length - 2);
    const nextX = w.baseX;

    return {
      ...w,
      x: nextX,
      y: nextY,
      active: true,
    };
  });

  // Stamp updated moving walls onto grid
  newWalls.forEach((w) => {
    if (newGrid[w.y][w.x] === " ") {
      newGrid[w.y][w.x] = "W";
    }
  });

  return { updatedGrid: newGrid, updatedWalls: newWalls };
}

/** Where the airgap walls stand on a grid: every "W" cell. */
function airgapCells(grid: string[][]): string[] {
  const cells: string[] = [];
  grid.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell === "W") cells.push(`${x},${y}`);
    })
  );
  return cells;
}

/** What the walls do next, so the player can plan a route around them. */
export interface TspWallTelegraph {
  /**
   * Moves until the next shift that adds a wall cell (1 to 4, since the walls
   * repeat every four moves), or null when no shift adds one.
   */
  stepsUntilAppear: number | null;
  /** Cells that become walls on that shift ("x,y"). */
  appearing: string[];
  /** Walls standing now that the very next move takes away ("x,y"). */
  vanishing: string[];
}

/**
 * The telegraph for the walls of a TSP room grid. It runs the same
 * updateTSPMovingWalls rule the game runs on each move, so the drawing and the
 * countdown always agree with what the next moves will do.
 */
export function tspWallTelegraph(
  grid: string[][],
  walls: TSPMovingWall[],
  moveCount: number
): TspWallTelegraph {
  const now = airgapCells(grid);
  const nowSet = new Set(now);
  const after = (count: number) =>
    new Set(airgapCells(updateTSPMovingWalls(grid, walls, count).updatedGrid));
  const nextSet = after(moveCount + 1);
  const vanishing = now.filter((cell) => !nextSet.has(cell));
  for (let steps = 1; steps <= 4; steps++) {
    const appearing = [...after(moveCount + steps)].filter(
      (cell) => !nowSet.has(cell)
    );
    if (appearing.length > 0) {
      return { stepsUntilAppear: steps, appearing, vanishing };
    }
  }
  return { stepsUntilAppear: null, appearing: [], vanishing };
}

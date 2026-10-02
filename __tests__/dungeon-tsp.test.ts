// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  euclideanDist,
  computeShortestTour,
  updateTSPMovingWalls,
  TSPNode,
  TSPMovingWall,
} from "@/lib/dungeon";

describe("Dungeon TSP Pathfinding Engine", () => {
  describe("euclideanDist", () => {
    it("should return 0 for identical points", () => {
      expect(euclideanDist(5, 5, 5, 5)).toBe(0);
    });

    it("should calculate horizontal distance correctly", () => {
      expect(euclideanDist(2, 4, 10, 4)).toBe(8);
    });

    it("should calculate vertical distance correctly", () => {
      expect(euclideanDist(3, 1, 3, 7)).toBe(6);
    });

    it("should calculate diagonal distance (3-4-5 right triangle)", () => {
      expect(euclideanDist(0, 0, 3, 4)).toBe(5);
    });

    it("should calculate distance correctly with negative coordinates", () => {
      expect(euclideanDist(-2, -3, 1, 1)).toBe(5);
    });

    it("should calculate distance correctly with decimal coordinates", () => {
      expect(euclideanDist(1.5, 2.5, 4.5, 6.5)).toBe(5);
    });
  });

  describe("computeShortestTour", () => {
    it("should return start to exit route when nodes list is empty", () => {
      const result = computeShortestTour(1, 1, [], 10, 10);
      expect(result.tour).toEqual([
        { x: 1, y: 1 },
        { x: 10, y: 10 },
      ]);
      expect(result.totalDistance).toBeCloseTo(euclideanDist(1, 1, 10, 10));
    });

    it("should return start to exit route when all nodes are visited", () => {
      const nodes: TSPNode[] = [
        { id: 1, x: 3, y: 3, visited: true },
        { id: 2, x: 6, y: 6, visited: true },
      ];
      const result = computeShortestTour(0, 0, nodes, 5, 5);
      expect(result.tour).toEqual([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ]);
      expect(result.totalDistance).toBeCloseTo(euclideanDist(0, 0, 5, 5));
    });

    it("should calculate tour through a single unvisited node", () => {
      const nodes: TSPNode[] = [{ id: 1, x: 3, y: 0, visited: false }];
      const result = computeShortestTour(0, 0, nodes, 3, 4);

      expect(result.tour).toEqual([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]);
      expect(result.totalDistance).toBe(7); // 3 + 4
    });

    it("should calculate optimal tour through unvisited nodes using nearest neighbor heuristic", () => {
      // Start: (0,0), Exit: (10,0)
      // Node 1: (10,0) - dist 10 from start
      // Node 2: (2,0) - dist 2 from start (closest first)
      // Node 3: (5,0) - dist 5 from start, dist 3 from Node 2 (closest second)
      const nodes: TSPNode[] = [
        { id: 1, x: 10, y: 0, visited: false },
        { id: 2, x: 2, y: 0, visited: false },
        { id: 3, x: 5, y: 0, visited: false },
      ];

      const result = computeShortestTour(0, 0, nodes, 10, 0);

      expect(result.tour).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
      ]);
      expect(result.totalDistance).toBe(10); // 2 + 3 + 5 + 0
    });

    it("should compare remaining nodes where subsequent node distance is larger (d < bestDist false branch)", () => {
      // From (0,0):
      // First remaining node: (2, 0) -> dist 2 (bestDist becomes 2)
      // Second remaining node: (8, 0) -> dist 8 (d < bestDist is false)
      const nodes: TSPNode[] = [
        { id: 1, x: 2, y: 0, visited: false },
        { id: 2, x: 8, y: 0, visited: false },
      ];

      const result = computeShortestTour(0, 0, nodes, 10, 0);

      expect(result.tour).toEqual([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 8, y: 0 },
        { x: 10, y: 0 },
      ]);
      expect(result.totalDistance).toBe(10); // 2 + 6 + 2
    });

    it("should filter out visited nodes while routing through unvisited nodes", () => {
      const nodes: TSPNode[] = [
        { id: 1, x: 1, y: 0, visited: true },
        { id: 2, x: 4, y: 0, visited: false },
        { id: 3, x: 2, y: 0, visited: true },
      ];

      const result = computeShortestTour(0, 0, nodes, 4, 3);

      expect(result.tour).toEqual([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
      ]);
      expect(result.totalDistance).toBe(7); // 4 + 3
    });
  });

  describe("updateTSPMovingWalls", () => {
    function createInitialGrid(width = 5, height = 5): string[][] {
      const grid: string[][] = [];
      for (let y = 0; y < height; y++) {
        const row: string[] = [];
        for (let x = 0; x < width; x++) {
          if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
            row.push("#");
          } else {
            row.push(" ");
          }
        }
        grid.push(row);
      }
      return grid;
    }

    it("should clear old wall positions if tile was 'W' and set new positions", () => {
      const grid = createInitialGrid(5, 5);
      // Place "W" at old wall position (1, 1)
      grid[1][1] = "W";

      const walls: TSPMovingWall[] = [
        { x: 1, y: 1, baseX: 1, baseY: 1, active: true },
      ];

      // moveCount = 2, wallIndex = 0 => (2 + 0) % 4 = 2 >= 2 => shift is false => nextY = clamp(1 + 1, 1, 3) = 2
      const { updatedGrid, updatedWalls } = updateTSPMovingWalls(
        grid,
        walls,
        2
      );

      expect(updatedWalls[0]).toEqual({
        x: 1,
        y: 2,
        baseX: 1,
        baseY: 1,
        active: true,
      });
      expect(updatedGrid[1][1]).toBe(" ");
      expect(updatedGrid[2][1]).toBe("W");
    });

    it("should handle old wall clearing when tile is NOT 'W' (false branch for clearing)", () => {
      const grid = createInitialGrid(5, 5);
      // Tile at old wall position is empty ' ' instead of 'W'
      grid[1][1] = " ";

      const walls: TSPMovingWall[] = [
        { x: 1, y: 1, baseX: 1, baseY: 1, active: true },
      ];

      const { updatedGrid, updatedWalls } = updateTSPMovingWalls(
        grid,
        walls,
        0
      );

      expect(updatedWalls[0].y).toBe(1);
      expect(updatedGrid[1][1]).toBe("W");
    });

    it("should toggle wall position down when moveCount shift is false ((moveCount + index) % 4 >= 2)", () => {
      const grid = createInitialGrid(6, 6);
      const walls: TSPMovingWall[] = [
        { x: 2, y: 2, baseX: 2, baseY: 2, active: true }, // index 0
        { x: 3, y: 2, baseX: 3, baseY: 2, active: true }, // index 1
      ];

      // moveCount = 2:
      // index 0: (2 + 0) % 4 = 2 >= 2 => shift false => nextY = clamp(2 + 1, 1, 4) = 3
      // index 1: (2 + 1) % 4 = 3 >= 2 => shift false => nextY = clamp(2 + 1, 1, 4) = 3
      const { updatedGrid, updatedWalls } = updateTSPMovingWalls(
        grid,
        walls,
        2
      );

      expect(updatedWalls[0].y).toBe(3);
      expect(updatedWalls[1].y).toBe(3);
      expect(updatedGrid[3][2]).toBe("W");
      expect(updatedGrid[3][3]).toBe("W");
    });

    it("should alternate wall movement phase based on wall index offset", () => {
      const grid = createInitialGrid(6, 6);
      const walls: TSPMovingWall[] = [
        { x: 2, y: 2, baseX: 2, baseY: 2, active: true }, // index 0
        { x: 3, y: 2, baseX: 3, baseY: 2, active: true }, // index 1
      ];

      // moveCount = 1:
      // index 0: (1 + 0) % 4 = 1 < 2 => shift true => nextY = baseY = 2
      // index 1: (1 + 1) % 4 = 2 >= 2 => shift false => nextY = clamp(2 + 1, 1, 4) = 3
      const { updatedWalls } = updateTSPMovingWalls(grid, walls, 1);

      expect(updatedWalls[0].y).toBe(2);
      expect(updatedWalls[1].y).toBe(3);
    });

    it("should clamp nextY to grid boundary when shifted down at grid edge", () => {
      // Small grid: height = 4. Indices 0..3.
      // Max clamp bound = grid.length - 2 = 2.
      const grid = createInitialGrid(4, 4);
      const walls: TSPMovingWall[] = [
        { x: 1, y: 2, baseX: 1, baseY: 2, active: true }, // baseY = 2
      ];

      // moveCount = 2 => shift false => nextY = clamp(2 + 1 = 3, 1, 2) = 2
      const { updatedWalls } = updateTSPMovingWalls(grid, walls, 2);

      expect(updatedWalls[0].y).toBe(2);
    });

    it("should not stamp 'W' if target cell is not empty space ' ' (false branch for stamping)", () => {
      const grid = createInitialGrid(5, 5);
      // Put a solid boundary or player tile '#' at (2, 2)
      grid[2][2] = "#";

      const walls: TSPMovingWall[] = [
        { x: 2, y: 2, baseX: 2, baseY: 2, active: true },
      ];

      // moveCount = 0 => shift true => nextY = 2, nextX = 2
      const { updatedGrid } = updateTSPMovingWalls(grid, walls, 0);

      // Should not overwrite '#' with 'W'
      expect(updatedGrid[2][2]).toBe("#");
    });

    it("should leave the original grid array unmutated", () => {
      const grid = createInitialGrid(5, 5);
      const originalGridSnapshot = JSON.stringify(grid);

      const walls: TSPMovingWall[] = [
        { x: 2, y: 2, baseX: 2, baseY: 2, active: true },
      ];

      updateTSPMovingWalls(grid, walls, 1);

      expect(JSON.stringify(grid)).toBe(originalGridSnapshot);
    });
  });
});

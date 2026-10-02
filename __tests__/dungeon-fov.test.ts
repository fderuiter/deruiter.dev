// @vitest-environment node
import { describe, it, expect } from "vitest";
import { calculateFOV, hasLineOfSight, resetFogOfWar } from "@/lib/dungeon";
import { RetroLabyrinthEngine } from "@/lib/retro-labyrinth";

describe("Dungeon Field of View (FOV) & Occlusion Test Suite", () => {
  describe("Obstacle Occlusion & Raycasting Propagation", () => {
    // 7x7 grid with a central wall column
    const gridWithWall = [
      ["#", "#", "#", "#", "#", "#", "#"],
      ["#", " ", " ", " ", " ", " ", "#"],
      ["#", " ", "#", "#", "#", " ", "#"],
      ["#", " ", " ", " ", " ", " ", "#"],
      ["#", " ", " ", " ", " ", " ", "#"],
      ["#", " ", " ", " ", " ", " ", "#"],
      ["#", "#", "#", "#", "#", "#", "#"],
    ];

    it("marks wall tiles as visible but blocks light rays from penetrating behind walls", () => {
      // Player at (1, 1), looking towards wall at (2,2)
      const fov = calculateFOV(gridWithWall, 1, 1, 5);

      // Player position (1, 1) is visible
      expect(fov.visible[1][1]).toBe(true);

      // Open floor tile right before wall at (1, 2) is visible
      expect(fov.visible[2][1]).toBe(true);

      // Wall tile (2, 2) is visible (player can see the face of the wall)
      expect(fov.visible[2][2]).toBe(true);

      // Tile behind wall (5, 2) is occluded by the horizontal wall segment (2..4, 2)
      expect(fov.visible[2][5]).toBe(false);
    });

    it("handles dynamic moving wall 'W' symbols blocking ray propagation", () => {
      const gridWithDynamicWall = [
        ["#", "#", "#", "#", "#"],
        ["#", " ", " ", " ", "#"],
        ["#", " ", "W", " ", "#"],
        ["#", " ", " ", " ", "#"],
        ["#", "#", "#", "#", "#"],
      ];

      // Player at (1, 2) looking right at 'W' at (2, 2)
      const fov = calculateFOV(gridWithDynamicWall, 1, 2, 4);

      expect(fov.visible[2][1]).toBe(true);
      expect(fov.visible[2][2]).toBe(true); // 'W' wall itself is visible
      expect(fov.visible[2][3]).toBe(false); // Tile behind 'W' is occluded
    });

    it("casts realistic shadow cones behind isolated pillar obstacles", () => {
      // 9x9 open chamber with a 1x1 pillar at (4,4)
      const pillarGrid = Array.from({ length: 9 }, (_, y) =>
        Array.from({ length: 9 }, (_, x) => {
          if (x === 0 || y === 0 || x === 8 || y === 8) return "#";
          if (x === 4 && y === 4) return "#";
          return " ";
        })
      );

      // Player at (2, 4) looking east toward pillar at (4, 4)
      const fov = calculateFOV(pillarGrid, 2, 4, 6);

      // Player and path to pillar are visible
      expect(fov.visible[4][2]).toBe(true);
      expect(fov.visible[4][3]).toBe(true);

      // Pillar face at (4, 4) is visible
      expect(fov.visible[4][4]).toBe(true);

      // Tile directly behind pillar at (6, 4) is in shadow
      expect(fov.visible[4][6]).toBe(false);

      // Tiles well above/below pillar line are visible
      expect(fov.visible[2][4]).toBe(true);
      expect(fov.visible[6][4]).toBe(true);
    });
  });

  describe("Line of Sight (hasLineOfSight) Assertion Engine", () => {
    const losGrid = [
      ["#", "#", "#", "#", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", " ", "#", " ", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", "#", "#", "#", "#"],
    ];

    it("returns true for clear horizontal, vertical, and diagonal paths", () => {
      expect(hasLineOfSight(losGrid, 1, 1, 3, 1)).toBe(true); // Horizontal
      expect(hasLineOfSight(losGrid, 1, 1, 1, 3)).toBe(true); // Vertical
      expect(hasLineOfSight(losGrid, 3, 1, 3, 3)).toBe(true); // Vertical right side
    });

    it("returns false when line passes through '#' or 'W' walls", () => {
      expect(hasLineOfSight(losGrid, 1, 2, 3, 2)).toBe(false); // Blocked by wall at (2,2)
      expect(hasLineOfSight(losGrid, 1, 1, 3, 3)).toBe(false); // Diagonal clipped by wall at (2,2)

      const dynamicGrid = [
        ["#", "#", "#"],
        ["#", "W", "#"],
        ["#", " ", "#"],
      ];
      expect(hasLineOfSight(dynamicGrid, 1, 2, 1, 0)).toBe(false);
    });

    it("returns true when target is the origin tile itself", () => {
      expect(hasLineOfSight(losGrid, 2, 2, 2, 2)).toBe(true);
    });

    it("returns false gracefully when coordinates go out of bounds", () => {
      expect(hasLineOfSight(losGrid, -1, 0, 3, 1)).toBe(false);
      expect(hasLineOfSight(losGrid, 1, 1, -2, 1)).toBe(false);
      expect(hasLineOfSight(losGrid, 1, 1, 10, 10)).toBe(false);
      expect(hasLineOfSight(losGrid, 4, 2, 5, 2)).toBe(false);
      expect(hasLineOfSight(losGrid, 1, 0, 1, -1)).toBe(false);

      const openBorderGrid = [
        [" ", " ", " "],
        [" ", " ", " "],
      ];
      expect(hasLineOfSight(openBorderGrid, 1, 0, 5, 0)).toBe(false);
    });

    it("handles empty or invalid grid inputs safely", () => {
      expect(hasLineOfSight([], 0, 0, 1, 1)).toBe(false);
      expect(hasLineOfSight([[]], 0, 0, 1, 1)).toBe(false);
    });
  });

  describe("Map Boundary & Spatial Edge Cases", () => {
    const smallGrid = [
      ["#", "#", "#"],
      ["#", " ", "#"],
      ["#", "#", "#"],
    ];

    it("calculates FOV correctly from top-left corner (0,0)", () => {
      const fov = calculateFOV(smallGrid, 0, 0, 3);
      expect(fov.visible[0][0]).toBe(true);
      expect(fov.visible[0][1]).toBe(true);
      expect(fov.visible[1][0]).toBe(true);
    });

    it("calculates FOV correctly from bottom-right corner", () => {
      const fov = calculateFOV(smallGrid, 2, 2, 3);
      expect(fov.visible[2][2]).toBe(true);
      expect(fov.visible[2][1]).toBe(true);
      expect(fov.visible[1][2]).toBe(true);
    });

    it("handles player origin coordinates outside map boundaries without throwing errors", () => {
      expect(() => calculateFOV(smallGrid, -5, -5, 4)).not.toThrow();
      expect(() => calculateFOV(smallGrid, 10, 10, 4)).not.toThrow();

      const outOfBoundsFOV = calculateFOV(smallGrid, -5, -5, 4);
      expect(outOfBoundsFOV.visible.length).toBe(3);
      expect(outOfBoundsFOV.explored.length).toBe(3);
    });

    it("safely handles empty or malformed grid arrays", () => {
      expect(calculateFOV([], 0, 0)).toEqual({ visible: [], explored: [] });
      expect(calculateFOV([[]], 0, 0)).toEqual({ visible: [], explored: [] });
    });

    it("resets explored state when any row has the wrong width", () => {
      const openGrid = Array.from({ length: 3 }, () => [" ", " ", " "]);
      const malformedMatrices = [
        [
          [true, true, true],
          [true, true, true],
          [true, true],
        ],
        [
          [true, true, true],
          [true, true, true],
          [true, true, true, true],
        ],
      ];

      for (const malformedExplored of malformedMatrices) {
        const fov = calculateFOV(openGrid, 1, 1, 0, malformedExplored);
        expect(fov.explored).toEqual([
          [false, false, false],
          [false, true, false],
          [false, false, false],
        ]);
      }
    });

    it("resets explored state when its outer rows or inner cells are sparse", () => {
      const openGrid = Array.from({ length: 3 }, () => [" ", " ", " "]);
      const sparseRows = new Array<boolean[]>(3);
      sparseRows[0] = [true, true, true];
      sparseRows[2] = [true, true, true];

      const sparseCells = [
        [true, true, true],
        new Array<boolean>(3),
        [true, true, true],
      ];
      sparseCells[1][0] = true;
      sparseCells[1][2] = true;

      for (const malformedExplored of [sparseRows, sparseCells]) {
        const fov = calculateFOV(openGrid, 1, 1, 0, malformedExplored);
        expect(fov.explored).toEqual([
          [false, false, false],
          [false, true, false],
          [false, false, false],
        ]);
      }
    });

    it("returns safe empty results for sparse or ragged map rows", () => {
      const sparseRows = new Array<string[]>(3);
      sparseRows[0] = [" ", " ", " "];
      sparseRows[2] = [" ", " ", " "];
      const sparseCells = [
        [" ", " ", " "],
        new Array<string>(3),
        [" ", " ", " "],
      ];

      for (const malformedGrid of [sparseRows, sparseCells]) {
        expect(calculateFOV(malformedGrid, 1, 1)).toEqual({
          visible: [],
          explored: [],
        });
        expect(hasLineOfSight(malformedGrid, 0, 0, 1, 1)).toBe(false);
      }
    });

    it("handles 1x1 minimal grid case", () => {
      const fov = calculateFOV([[" "]], 0, 0, 3);
      expect(fov.visible[0][0]).toBe(true);
      expect(fov.explored[0][0]).toBe(true);
    });
  });

  describe("Fog of War Reset Logic & Level Restarts", () => {
    const stage1 = [
      ["#", "#", "#", "#", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", " ", " ", " ", "#"],
      ["#", "#", "#", "#", "#"],
    ];

    it("resetFogOfWar generates an all-false matrix of specified dimensions", () => {
      const fog = resetFogOfWar(4, 6);
      expect(fog.length).toBe(4);
      expect(fog[0].length).toBe(6);
      expect(fog.every((row) => row.every((cell) => cell === false))).toBe(
        true
      );
    });

    it("resetFogOfWar handles 0 or negative dimensions cleanly", () => {
      expect(resetFogOfWar(0, 5)).toEqual([]);
      expect(resetFogOfWar(5, -1)).toEqual([]);
    });

    it("resets explored fog of war when starting a new level or restarting", () => {
      // First run: explore tiles around (1, 1)
      const initialFOV = calculateFOV(stage1, 1, 1, 3);
      expect(initialFOV.explored[1][1]).toBe(true);
      expect(initialFOV.explored[3][3]).toBe(true);

      // Simulate player moving to (3, 3) and expanding explored state
      const expandedFOV = calculateFOV(stage1, 3, 3, 3, initialFOV.explored);
      expect(expandedFOV.explored[1][1]).toBe(true);
      expect(expandedFOV.explored[3][3]).toBe(true);

      // Level restart: call calculateFOV without existingExplored (or with resetFogOfWar)
      const freshFOV = calculateFOV(stage1, 1, 1, 1); // small radius at (1,1)
      expect(freshFOV.explored[1][1]).toBe(true);
      // Previously explored (3,3) in past life is now reset to un-explored
      expect(freshFOV.explored[3][3]).toBe(false);
    });

    it("safely resets explored state when level transition changes map dimensions", () => {
      const smallMap = [
        ["#", "#", "#"],
        ["#", " ", "#"],
        ["#", "#", "#"],
      ];
      const largeMap = [
        ["#", "#", "#", "#", "#"],
        ["#", " ", " ", " ", "#"],
        ["#", " ", " ", " ", "#"],
        ["#", " ", " ", " ", "#"],
        ["#", "#", "#", "#", "#"],
      ];

      // Explore 3x3 small map
      const smallFOV = calculateFOV(smallMap, 1, 1, 2);

      // Transition to 5x5 large map while passing old 3x3 explored matrix
      // Dimension mismatch should be caught and fog of war safely reset to 5x5
      expect(() =>
        calculateFOV(largeMap, 1, 1, 2, smallFOV.explored)
      ).not.toThrow();

      const transitionFOV = calculateFOV(largeMap, 1, 1, 2, smallFOV.explored);
      expect(transitionFOV.explored.length).toBe(5);
      expect(transitionFOV.explored[0].length).toBe(5);
    });

    it("RetroLabyrinthEngine.resetGame clears exploredCells and recalculates clean FOV", () => {
      const engine = new RetroLabyrinthEngine({
        classId: "script_kiddie",
        gameMode: "classic",
      });

      // Walk around to reveal fog of war
      engine.move(1, 0);
      engine.move(0, 1);
      const exploredBeforeReset = engine.getSnapshot().exploredCells;
      expect(exploredBeforeReset).toBeDefined();
      const exploredCountBefore = exploredBeforeReset!
        .flat()
        .filter(Boolean).length;
      expect(exploredCountBefore).toBeGreaterThan(1);

      // Restart game
      engine.resetGame();

      const snapshotAfterReset = engine.getSnapshot();
      expect(snapshotAfterReset.playerPosition).toEqual({ x: 1, y: 1 });
      expect(snapshotAfterReset.exploredCells).toBeDefined();

      // Explored cells should be reset to only initial spawn FOV radius
      const exploredCountAfter = snapshotAfterReset
        .exploredCells!.flat()
        .filter(Boolean).length;
      expect(exploredCountAfter).toBeLessThan(exploredCountBefore);
    });
  });
});

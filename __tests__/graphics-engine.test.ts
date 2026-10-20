// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  resolveFontFamily,
  isBrowser,
  calculateColumnCount,
  calculateColumnWidth,
  distributeItemsGreedily,
  mapDataToCoordinates,
  generateCubicSplinePath,
  generateHermiteSplinePath,
  checkBeamContainerCollision,
  calculateCollisionPoint,
  generateExplosionTrajectories,
  LRUCache,
} from "@/lib/graphics-engine";

describe("Centralized Graphics and Layout Engine", () => {
  describe("A. Environment & Text Resolution", () => {
    it("detects browser environment appropriately", () => {
      // In typical Vitest node environment, window should be undefined/mocked depending on setup
      expect(isBrowser()).toBe(typeof window !== "undefined");
    });

    it("resolves default fallback font in SSR", () => {
      const resolved = resolveFontFamily("--font-inter");
      expect(resolved).toBeDefined();
      expect(typeof resolved).toBe("string");
    });
  });

  describe("B. Masonry Layout Math", () => {
    const config = {
      BREAKPOINTS: { MD: 768, LG: 1024 },
      COLS: { SM: 1, MD: 2, LG: 3 },
    };

    it("calculates correct responsive column counts", () => {
      expect(calculateColumnCount(1200, config.BREAKPOINTS, config.COLS)).toBe(
        3
      );
      expect(calculateColumnCount(800, config.BREAKPOINTS, config.COLS)).toBe(
        2
      );
      expect(calculateColumnCount(500, config.BREAKPOINTS, config.COLS)).toBe(
        1
      );
    });

    it("calculates exact column widths based on gap and container width", () => {
      // (1000 - 10 * (2 - 1)) / 2 = 990 / 2 = 495
      expect(calculateColumnWidth(1000, 2, 10)).toBe(495);
      // (1000 - 15 * (3 - 1)) / 3 = 970 / 3 = 323.333
      expect(calculateColumnWidth(1000, 3, 15)).toBeCloseTo(323.333, 2);
    });

    it("distributes items greedily into shortest columns", () => {
      const items = [
        { id: "1", height: 100 },
        { id: "2", height: 150 },
        { id: "3", height: 80 },
        { id: "4", height: 120 },
      ];

      const { columns, columnHeights } = distributeItemsGreedily(items, 2, 10);
      expect(columns).toHaveLength(2);

      // Greedy distribution trace:
      // Item 1 (h=100) -> Col 0 (heights: 100 + 10 = 110, 0)
      // Item 2 (h=150) -> Col 1 (heights: 110, 150 + 10 = 160)
      // Item 3 (h=80) -> Col 0 (heights: 110 + 80 + 10 = 200, 160)
      // Item 4 (h=120) -> Col 1 (heights: 200, 160 + 120 + 10 = 290)
      expect(columns[0]).toHaveLength(2);
      expect(columns[0][0].id).toBe("1");
      expect(columns[0][1].id).toBe("3");

      expect(columns[1]).toHaveLength(2);
      expect(columns[1][0].id).toBe("2");
      expect(columns[1][1].id).toBe("4");

      expect(columnHeights[0]).toBe(200);
      expect(columnHeights[1]).toBe(290);
    });
  });

  describe("C. SVG Spline & Coordinate Math", () => {
    it("maps 1D data sequence to Cartesian bounds properly", () => {
      const data = [10, 20, 30];
      const width = 100;
      const height = 50;
      const padding = 5;

      const coordinates = mapDataToCoordinates(
        data,
        width,
        height,
        padding,
        10,
        30
      );
      expect(coordinates).toHaveLength(3);

      // x mapping: 0, 50, 100
      expect(coordinates[0].x).toBe(0);
      expect(coordinates[1].x).toBe(50);
      expect(coordinates[2].x).toBe(100);

      // y mapping (inverse coordinate space):
      // val 10 (min) -> percentage 0 -> height - padding - 0 * usableHeight = 45
      // val 30 (max) -> percentage 1 -> height - padding - 1 * usableHeight = 5
      expect(coordinates[0].y).toBe(45);
      expect(coordinates[2].y).toBe(5);
    });

    it("generates correct cubic Bezier spline path strings", () => {
      const points = [
        { x: 0, y: 50 },
        { x: 50, y: 100 },
      ];
      const paths = generateCubicSplinePath(points, 200);

      expect(paths.pathD).toBe("M 0 50 C 25 50, 25 100, 50 100");
      expect(paths.areaD).toBe(
        "M 0 50 C 25 50, 25 100, 50 100 L 50 200 L 0 200 Z"
      );
    });

    it("generates correct cubic Hermite spline path strings", () => {
      const points = [
        { x: 0, y: 50 },
        { x: 50, y: 100 },
        { x: 100, y: 120 },
      ];
      const paths = generateHermiteSplinePath(points, 200);

      expect(paths.pathD).toContain("M 0 50");
      expect(paths.areaD).toContain("L 100 200");
    });
  });

  describe("D. 2D Physics and Collision math", () => {
    it("detects beam container collision correctly", () => {
      const beamRect = {
        top: 0,
        bottom: 205,
        left: 100,
        right: 101,
        width: 1,
        height: 205,
      };
      const containerRect = {
        top: 200,
        bottom: 400,
        left: 0,
        right: 1000,
        width: 1000,
        height: 200,
      };

      expect(checkBeamContainerCollision(beamRect, containerRect)).toBe(true);

      const standardRectNoCollide = {
        top: 0,
        bottom: 190,
        left: 100,
        right: 101,
        width: 1,
        height: 190,
      };
      expect(
        checkBeamContainerCollision(standardRectNoCollide, containerRect)
      ).toBe(false);
    });

    it("calculates relative collision point correctly", () => {
      const beamRect = {
        top: 0,
        bottom: 205,
        left: 100,
        right: 101,
        width: 1,
        height: 205,
      };
      const parentRect = {
        top: 50,
        bottom: 600,
        left: 20,
        right: 1200,
        width: 1180,
        height: 550,
      };

      const pt = calculateCollisionPoint(beamRect, parentRect);
      // relativeX = 100 - 20 + 0.5 = 80.5
      expect(pt.x).toBe(80.5);
      // relativeY = 205 - 50 = 155
      expect(pt.y).toBe(155);
    });

    it("generates correctly structured randomized trajectories", () => {
      const count = 10;
      const trajectories = generateExplosionTrajectories(count);
      expect(trajectories).toHaveLength(count);

      trajectories.forEach((t, i) => {
        expect(t.id).toBe(i);
        expect(t.initialX).toBe(0);
        expect(t.initialY).toBe(0);
        expect(t.directionX).toBeGreaterThanOrEqual(-40);
        expect(t.directionX).toBeLessThanOrEqual(40);
        expect(t.directionY).toBeGreaterThanOrEqual(-60);
        expect(t.directionY).toBeLessThanOrEqual(-10);
        expect(t.duration).toBeGreaterThanOrEqual(0.4);
        expect(t.duration).toBeLessThanOrEqual(1.6);
      });
    });
  });

  describe("E. LRUCache Clear Support", () => {
    it("clears cached values when clear() is called", () => {
      const cache = new LRUCache<string, string>(10);
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      expect(cache.get("key1")).toBe("value1");

      cache.clear();
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
    });
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  clamp,
  lerp,
  boundingBoxOverlap,
  rectanglesOverlap,
  createSeededRandom,
  calculateScoreMultiplier,
  scaleScoreWithMultiplier,
} from "../lib/arcade";

describe("Arcade Game Utilities (lib/arcade/utils.ts)", () => {
  describe("1. Clamping Utility (clamp)", () => {
    it("returns value unchanged when within minimum and maximum bounds", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0, -5, 5)).toBe(0);
      expect(clamp(2.5, 1.0, 3.0)).toBe(2.5);
    });

    it("clamps value to minimum when below lower bound", () => {
      expect(clamp(-10, 0, 10)).toBe(0);
      expect(clamp(-100, -50, 50)).toBe(-50);
    });

    it("clamps value to maximum when above upper bound", () => {
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(100, -50, 50)).toBe(50);
    });

    it("handles boundary exact matches", () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it("defensively swap handles inverted bounds (minimum > maximum)", () => {
      expect(clamp(5, 10, 0)).toBe(5);
      expect(clamp(-5, 10, 0)).toBe(0);
      expect(clamp(15, 10, 0)).toBe(10);
    });

    it("handles NaN inputs safely", () => {
      expect(clamp(NaN, 5, 10)).toBe(5);
      expect(clamp(NaN, NaN, 10)).toBe(0);
    });

    it("handles extreme numbers and special numeric representations", () => {
      expect(clamp(Infinity, 0, 100)).toBe(100);
      expect(clamp(-Infinity, -100, 0)).toBe(-100);
      expect(clamp(-0, -10, 10)).toBe(-0);
      expect(clamp(Number.MAX_SAFE_INTEGER, 0, 1000)).toBe(1000);
      expect(clamp(Number.MIN_SAFE_INTEGER, -1000, 0)).toBe(-1000);
    });
  });

  describe("2. Linear Interpolation Utility (lerp)", () => {
    it("interpolates correctly across normalized progress values", () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(0, 100, 1)).toBe(100);
      expect(lerp(10, 20, 0.25)).toBe(12.5);
    });

    it("clamps progress below 0 to 0", () => {
      expect(lerp(10, 20, -0.5)).toBe(10);
      expect(lerp(0, 100, -10)).toBe(0);
    });

    it("clamps progress above 1 to 1", () => {
      expect(lerp(10, 20, 1.5)).toBe(20);
      expect(lerp(0, 100, 10)).toBe(100);
    });

    it("handles negative start and end values", () => {
      expect(lerp(-100, 100, 0.5)).toBe(0);
      expect(lerp(-50, -10, 0.5)).toBe(-30);
    });

    it("handles identical start and end values", () => {
      expect(lerp(42, 42, 0)).toBe(42);
      expect(lerp(42, 42, 0.5)).toBe(42);
      expect(lerp(42, 42, 1)).toBe(42);
    });

    it("handles extreme bounds without precision distortion", () => {
      expect(lerp(0, Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER);
      expect(lerp(Number.MIN_SAFE_INTEGER, 0, 0)).toBe(Number.MIN_SAFE_INTEGER);
    });
  });

  describe("3. Bounding Box & Overlap Utilities (boundingBoxOverlap / rectanglesOverlap)", () => {
    it("detects overlapping 2D bounding boxes", () => {
      const boxA = { x: 0, y: 0, width: 10, height: 10 };
      const boxB = { x: 5, y: 5, width: 10, height: 10 };
      expect(boundingBoxOverlap(boxA, boxB)).toBe(true);
      expect(rectanglesOverlap(boxA, boxB)).toBe(true);
    });

    it("detects non-overlapping 2D bounding boxes across all quadrants", () => {
      const boxA = { x: 0, y: 0, width: 10, height: 10 };

      // To the right
      expect(
        boundingBoxOverlap(boxA, { x: 20, y: 0, width: 10, height: 10 })
      ).toBe(false);
      // To the left
      expect(
        boundingBoxOverlap(boxA, { x: -20, y: 0, width: 10, height: 10 })
      ).toBe(false);
      // Above
      expect(
        boundingBoxOverlap(boxA, { x: 0, y: 20, width: 10, height: 10 })
      ).toBe(false);
      // Below
      expect(
        boundingBoxOverlap(boxA, { x: 0, y: -20, width: 10, height: 10 })
      ).toBe(false);
    });

    it("evaluates touching edges as non-overlapping", () => {
      const boxA = { x: 0, y: 0, width: 10, height: 10 };
      // Touching right edge
      expect(
        boundingBoxOverlap(boxA, { x: 10, y: 0, width: 10, height: 10 })
      ).toBe(false);
      // Touching bottom edge
      expect(
        boundingBoxOverlap(boxA, { x: 0, y: 10, width: 10, height: 10 })
      ).toBe(false);
    });

    it("handles completely nested and identical bounding boxes", () => {
      const outer = { x: 0, y: 0, width: 100, height: 100 };
      const inner = { x: 25, y: 25, width: 50, height: 50 };
      expect(boundingBoxOverlap(outer, inner)).toBe(true);
      expect(boundingBoxOverlap(outer, outer)).toBe(true);
    });

    it("handles zero-width or zero-height bounding boxes", () => {
      const zeroWidthBox = { x: 0, y: 0, width: 0, height: 10 };
      const zeroHeightBox = { x: 0, y: 0, width: 10, height: 0 };
      const boxB = { x: 0, y: 0, width: 10, height: 10 };
      expect(boundingBoxOverlap(zeroWidthBox, boxB)).toBe(false);
      expect(boundingBoxOverlap(zeroHeightBox, boxB)).toBe(false);
    });

    it("handles negative coordinates and extreme dimensions", () => {
      const boxA = { x: -100, y: -100, width: 50, height: 50 };
      const boxB = { x: -75, y: -75, width: 50, height: 50 };
      expect(boundingBoxOverlap(boxA, boxB)).toBe(true);

      const hugeBox = {
        x: 0,
        y: 0,
        width: Number.MAX_SAFE_INTEGER,
        height: Number.MAX_SAFE_INTEGER,
      };
      const smallBox = { x: 100, y: 100, width: 10, height: 10 };
      expect(boundingBoxOverlap(hugeBox, smallBox)).toBe(true);
    });
  });

  describe("4. Seeded Random Generator (createSeededRandom)", () => {
    it("generates deterministic random values for identical seeds", () => {
      const rng1 = createSeededRandom(12345);
      const rng2 = createSeededRandom(12345);

      const seq1 = [rng1(), rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it("produces diverging sequences for different seeds", () => {
      const rngA = createSeededRandom(100);
      const rngB = createSeededRandom(200);

      expect(rngA()).not.toEqual(rngB());
    });

    it("produces values strictly inside [0, 1) range over repeated iterations", () => {
      const rng = createSeededRandom(999);
      for (let i = 0; i < 1000; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it("handles negative, zero, float, and large integer seed inputs", () => {
      const rngNeg = createSeededRandom(-42);
      const rngZero = createSeededRandom(0);
      const rngFloat = createSeededRandom(3.14159);
      const rngLarge = createSeededRandom(4294967295);

      expect(typeof rngNeg()).toBe("number");
      expect(typeof rngZero()).toBe("number");
      expect(typeof rngFloat()).toBe("number");
      expect(typeof rngLarge()).toBe("number");
    });
  });

  describe("5. Score Multiplier Calculator (calculateScoreMultiplier)", () => {
    it("calculates multiplier with default parameters (base: 1, step: 3, max: 10)", () => {
      expect(calculateScoreMultiplier(0)).toBe(1);
      expect(calculateScoreMultiplier(1)).toBe(1);
      expect(calculateScoreMultiplier(2)).toBe(1);
      expect(calculateScoreMultiplier(3)).toBe(2);
      expect(calculateScoreMultiplier(5)).toBe(2);
      expect(calculateScoreMultiplier(6)).toBe(3);
      expect(calculateScoreMultiplier(27)).toBe(10);
      expect(calculateScoreMultiplier(50)).toBe(10); // Capped at maxMultiplier (10)
    });

    it("supports custom step size, base multiplier, and max multiplier", () => {
      const options = { baseMultiplier: 2, step: 5, maxMultiplier: 5 };
      expect(calculateScoreMultiplier(0, options)).toBe(2);
      expect(calculateScoreMultiplier(4, options)).toBe(2);
      expect(calculateScoreMultiplier(5, options)).toBe(3);
      expect(calculateScoreMultiplier(10, options)).toBe(4);
      expect(calculateScoreMultiplier(15, options)).toBe(5);
      expect(calculateScoreMultiplier(20, options)).toBe(5); // Capped at 5
    });

    it("handles negative, non-integer, and non-finite combo counts", () => {
      expect(calculateScoreMultiplier(-10)).toBe(1);
      expect(calculateScoreMultiplier(4.9)).toBe(2); // Math.floor(4) / 3 -> +1 = 2
      expect(calculateScoreMultiplier(NaN)).toBe(1);
      expect(calculateScoreMultiplier(Infinity)).toBe(10); // Capped at max
    });

    it("handles invalid or extreme option values defensively", () => {
      expect(
        calculateScoreMultiplier(6, {
          baseMultiplier: NaN,
          step: -1,
          maxMultiplier: NaN,
        })
      ).toBe(7); // combo=6, safeStep=1 -> 1 + 6 = 7

      expect(
        calculateScoreMultiplier(6, {
          baseMultiplier: -5,
          step: NaN,
          maxMultiplier: Infinity,
        })
      ).toBe(6); // safeBase=0, safeStep=1, safeMax=Infinity -> 0 + Math.floor(6/1) = 6

      expect(
        calculateScoreMultiplier(6, {
          baseMultiplier: Infinity,
          step: Infinity,
          maxMultiplier: 5,
        })
      ).toBe(5); // safeBase=1, safeStep=1, safeMax=5 -> 1 + 6 = 7 -> capped at 5
    });
  });

  describe("6. Score Scaling Utility (scaleScoreWithMultiplier)", () => {
    it("scales base score by multiplier with default integer rounding", () => {
      expect(scaleScoreWithMultiplier(100, 2)).toBe(200);
      expect(scaleScoreWithMultiplier(150, 1.5)).toBe(225);
      expect(scaleScoreWithMultiplier(10, 1.25)).toBe(13); // 12.5 rounded -> 13
    });

    it("supports unrounded floating-point scaling when round is false", () => {
      expect(scaleScoreWithMultiplier(10, 1.25, false)).toBe(12.5);
      expect(scaleScoreWithMultiplier(7, 1.33, false)).toBe(9.31);
    });

    it("handles multiplier of 0 or zero base score", () => {
      expect(scaleScoreWithMultiplier(100, 0)).toBe(0);
      expect(scaleScoreWithMultiplier(0, 5)).toBe(0);
    });

    it("handles invalid or non-finite inputs defensively", () => {
      expect(scaleScoreWithMultiplier(NaN, 2)).toBe(0);
      expect(scaleScoreWithMultiplier(-50, 2)).toBe(0);
      expect(scaleScoreWithMultiplier(100, NaN)).toBe(100); // safeMultiplier defaults to 1
      expect(scaleScoreWithMultiplier(100, -2)).toBe(0);
    });
  });
});

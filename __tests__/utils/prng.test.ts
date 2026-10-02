// @vitest-environment node
import { describe, expect, it } from "vitest";
import { drawInt, fnv1a, mulberry32, uniformAt } from "@/lib/utils/prng";

describe("lib/utils/prng", () => {
  describe("fnv1a", () => {
    it("produces deterministic unsigned 32-bit integer hashes", () => {
      const hash1 = fnv1a("test-seed#0");
      const hash2 = fnv1a("test-seed#0");
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThanOrEqual(0);
      expect(hash1).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(hash1)).toBe(true);
    });

    it("produces distinct hashes for distinct input strings", () => {
      expect(fnv1a("seed1#0")).not.toBe(fnv1a("seed2#0"));
      expect(fnv1a("seed1#0")).not.toBe(fnv1a("seed1#1"));
    });
  });

  describe("mulberry32", () => {
    it("produces deterministic 32-bit mixed outputs", () => {
      const val1 = mulberry32(12345678);
      const val2 = mulberry32(12345678);
      expect(val1).toBe(val2);
      expect(val1).toBeGreaterThanOrEqual(0);
      expect(val1).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(val1)).toBe(true);
    });
  });

  describe("uniformAt", () => {
    it("returns a deterministic float in [0, 1)", () => {
      const val1 = uniformAt("my-seed", 0);
      const val2 = uniformAt("my-seed", 0);
      expect(val1).toBe(val2);
      expect(val1).toBeGreaterThanOrEqual(0);
      expect(val1).toBeLessThan(1);
    });

    it("varies output across draw indices and seeds", () => {
      const valA = uniformAt("seedA", 0);
      const valB = uniformAt("seedA", 1);
      const valC = uniformAt("seedB", 0);
      expect(valA).not.toBe(valB);
      expect(valA).not.toBe(valC);
    });

    it("throws RangeError for negative or non-integer drawIndex", () => {
      expect(() => uniformAt("seed", -1)).toThrow(RangeError);
      expect(() => uniformAt("seed", 1.5)).toThrow(RangeError);
      expect(() => uniformAt("seed", NaN)).toThrow(RangeError);
    });
  });

  describe("drawInt", () => {
    it("returns deterministic integers in [0, bound)", () => {
      const val1 = drawInt("seed", 5, 10);
      const val2 = drawInt("seed", 5, 10);
      expect(val1).toBe(val2);
      expect(val1).toBeGreaterThanOrEqual(0);
      expect(val1).toBeLessThan(10);
      expect(Number.isInteger(val1)).toBe(true);
    });

    it("distributes drawn values across the bound range", () => {
      const counts = [0, 0, 0, 0];
      for (let i = 0; i < 4000; i += 1) {
        counts[drawInt("distribution-test", i, 4)] += 1;
      }
      counts.forEach((count) => {
        expect(count).toBeGreaterThan(800);
        expect(count).toBeLessThan(1200);
      });
    });

    it("throws RangeError for invalid bounds", () => {
      expect(() => drawInt("seed", 0, 0)).toThrow(RangeError);
      expect(() => drawInt("seed", 0, -5)).toThrow(RangeError);
      expect(() => drawInt("seed", 0, 2.5)).toThrow(RangeError);
      expect(() => drawInt("seed", 0, NaN)).toThrow(RangeError);
    });

    it("throws RangeError for invalid drawIndex", () => {
      expect(() => drawInt("seed", -1, 10)).toThrow(RangeError);
      expect(() => drawInt("seed", 0.5, 10)).toThrow(RangeError);
      expect(() => drawInt("seed", NaN, 10)).toThrow(RangeError);
    });
  });
});

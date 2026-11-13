import { describe, expect, it } from "vitest";
import {
  fnv1a as sharedFnv1a,
  mulberry32 as sharedMulberry32,
  mulberry32Stream,
} from "@/lib/utils/prng";
import {
  fnv1a as driftFnv1a,
  mulberry32 as driftMulberry32,
  seededDraw,
} from "@/lib/protocol-drift";

/**
 * One Mulberry32 serves every seeded module (#3479). These values were taken
 * from the local copies the office art, the loon's scene art and Protocol
 * Drift carried before they shared `lib/utils/prng`, so a seed still paints
 * the same scene and draws the same numbers.
 */
const BEFORE: Record<number, readonly number[]> = {
  // Working With Duck's office art (1675, 42, 7).
  1675: [
    0.8933985498733819, 0.15355730638839304, 0.9947707958053797,
    0.8072517002001405, 0.21187124750576913,
  ],
  42: [
    0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    0.6697340414393693, 0.17481389874592423,
  ],
  7: [
    0.011704753153026104, 0.06195825757458806, 0.97690763277933,
    0.6990287057124078, 0.5214452685322613,
  ],
  // Laser Loon's scene layers (1597 + i * 101 + theme.length * 7).
  1597: [
    0.6158919031731784, 0.9173819404095411, 0.32885448005981743,
    0.6476537787821144, 0.5916291358880699,
  ],
  1733: [
    0.30158676905557513, 0.4461064354982227, 0.20442353817634284,
    0.7099592622835189, 0.9766063785646111,
  ],
};

describe("mulberry32Stream", () => {
  it("draws what the art modules' own generators drew", () => {
    for (const [seed, values] of Object.entries(BEFORE)) {
      const next = mulberry32Stream(Number(seed));
      expect(Array.from({ length: values.length }, next)).toEqual(values);
    }
  });

  it("steps the shared mulberry32", () => {
    const next = mulberry32Stream(99);
    expect(next()).toBe(sharedMulberry32(99) / 0x100000000);
    expect(next()).toBe(
      sharedMulberry32((99 + 0x6d2b79f5) >>> 0) / 0x100000000
    );
  });

  it("stays in [0, 1)", () => {
    const next = mulberry32Stream(0);
    for (let i = 0; i < 1000; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("Protocol Drift's randomness", () => {
  it("is the shared FNV-1a and Mulberry32", () => {
    expect(driftMulberry32).toBe(sharedMulberry32);
    expect(driftFnv1a).toBe(sharedFnv1a);
  });

  it("draws what it drew before", () => {
    expect(seededDraw(7, "site-1|subj-2")).toBe(0.3557391806971282);
    expect(seededDraw(2026, "visit|3")).toBe(0.35139102046377957);
    expect(driftFnv1a("protocol")).toBe(4213704117);
    expect(driftMulberry32(12345)).toBe(4207900869);
  });
});

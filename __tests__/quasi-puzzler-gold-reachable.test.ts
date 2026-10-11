// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  computeLevelStars,
  puzzleLevels,
  tacticDefs,
  type TacticId,
} from "@/lib/quasi-perfect";

/**
 * #1939: levels 11 and 16 asked for more RAM left than their own hinted
 * solution could leave, so gold was impossible. Each entry is the cheapest
 * proof the level's hints describe; it must earn three stars in Hacker Mode.
 */
const REFERENCE_PATHS: Record<number, TacticId[]> = {
  1: ["rfl"],
  2: ["rw"],
  3: ["rw", "rw"],
  4: ["rw"],
  5: ["rw"],
  6: ["ring"],
  7: ["intro", "exact"],
  8: ["apply", "exact"],
  9: ["split", "exact", "exact"],
  10: ["apply", "apply", "exact"],
  11: ["cases", "right", "exact", "left", "exact"],
  12: ["norm_num"],
  13: ["linarith"],
  14: ["linarith"],
  15: ["rw"],
  16: ["rw", "simp"],
  17: ["rw", "ring"],
  18: ["rw", "ring"],
};

const offered = (level: (typeof puzzleLevels)[number]) =>
  new Set(
    level.availableTactics.map((t) => (typeof t === "string" ? t : t.id))
  );

describe("Quasi Puzzler gold targets", () => {
  it("has a reference path for every level", () => {
    expect(Object.keys(REFERENCE_PATHS).map(Number)).toEqual(
      puzzleLevels.map((l) => l.id)
    );
  });

  it.each(puzzleLevels.map((l) => [l.id, l] as const))(
    "level %i: the hinted proof earns three stars",
    (id, level) => {
      const path = REFERENCE_PATHS[Number(id)];
      for (const tactic of path) expect(offered(level).has(tactic)).toBe(true);
      const used = path.reduce(
        (sum: number, t: TacticId) => sum + tacticDefs[t].baseRamCost,
        0
      );
      expect(
        computeLevelStars(level, "hacker", level.initialRam - used, false)
      ).toBe(3);
      expect(level.silverRamTarget).toBeLessThan(level.goldRamTarget);
    }
  );
});

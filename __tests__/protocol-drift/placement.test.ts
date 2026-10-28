import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { CHIP_SPECS, type ChipKind } from "@/lib/protocol-drift";
import {
  findChipSpot,
  type ChipSpotMode,
} from "@/components/protocol-drift/parts/placement";
import {
  CHIP_WIDTH,
  chipHeight,
  type ChipNode,
} from "@/components/protocol-drift/graph-model";

const CHIP_GAP = 16;

const kindsByLane = (lane: string): ChipKind[] =>
  (Object.keys(CHIP_SPECS) as ChipKind[]).filter(
    (kind) => CHIP_SPECS[kind].lane === lane
  );

/** Two chips overlap when their boxes, plus the gap, intersect. */
const overlaps = (a: ChipNode, b: ChipNode): boolean => {
  const ah = chipHeight(a.data.kind);
  const bh = chipHeight(b.data.kind);
  return (
    a.position.x < b.position.x + CHIP_WIDTH + CHIP_GAP &&
    b.position.x < a.position.x + CHIP_WIDTH + CHIP_GAP &&
    a.position.y < b.position.y + bh + CHIP_GAP &&
    b.position.y < a.position.y + ah + CHIP_GAP
  );
};

/** Places `count` chips of `kinds` one at a time, as the canvas does. */
const placeAll = (
  kinds: ChipKind[],
  count: number,
  mode: ChipSpotMode
): ChipNode[] => {
  const nodes: ChipNode[] = [];
  for (let i = 0; i < count; i++) {
    const kind = kinds[i % kinds.length];
    nodes.push({
      id: `${kind}-${i}`,
      type: "chip",
      position: findChipSpot(kind, nodes, { mode }),
      data: { kind },
    });
  }
  return nodes;
};

describe("findChipSpot", () => {
  const lanes = ["TABULATION", "ANALYSIS"] as const;

  for (const mode of ["touch", "desktop"] as const) {
    for (const lane of lanes) {
      it(`never clashes for 0-20 chips in the ${lane} lane (${mode})`, () => {
        const kinds = kindsByLane(lane);
        expect(kinds.length).toBeGreaterThan(0);
        fc.assert(
          fc.property(fc.integer({ min: 0, max: 20 }), (count) => {
            const nodes = placeAll(kinds, count, mode);
            for (let i = 0; i < nodes.length; i++) {
              for (let j = i + 1; j < nodes.length; j++) {
                if (overlaps(nodes[i], nodes[j])) return false;
              }
            }
            return true;
          }),
          { numRuns: 40 }
        );
      });
    }
  }

  it("the touch mode returns the same spot as the touch export", () => {
    const nodes = placeAll(kindsByLane("TABULATION"), 5, "touch");
    const kind = kindsByLane("TABULATION")[0];
    expect(findChipSpot(kind, nodes, { mode: "touch" })).toEqual(
      findChipSpot(kind, nodes, { mode: "touch" })
    );
  });
});

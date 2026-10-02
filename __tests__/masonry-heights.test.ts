// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  calculateCardHeightFromBlocks,
  calculateMasonryLayout,
  type MasonryConfig,
  type PreparedData,
} from "@/lib/masonry";
import type { PreparedBlock } from "@/lib/pretext-block-parser";

vi.mock("@chenglou/pretext/rich-inline", () => ({
  walkRichInlineLineRanges: vi.fn(
    (p: { n: number }, _width: number, cb: (r: unknown) => void) => {
      for (let i = 0; i < p.n; i++) cb({ start: i, end: i + 1 });
    }
  ),
  materializeRichInlineLineRange: vi.fn(
    (_p: unknown, r: { start: number }) => ({
      text: `line${r.start}`,
    })
  ),
}));

const CONFIG: MasonryConfig = {
  COLS: { SM: 1, MD: 2, LG: 3 },
  BREAKPOINTS: { MD: 768, LG: 1024 },
  GAP: 10,
  CARD_PADDING: 16,
  LINE_HEIGHT: 20,
  FALLBACK_ITEM_HEIGHT: 250,
  MOBILE_PADDING_ADJUSTMENT: 22,
};

const prep = (n: number) => ({ n }) as never;
const para = (n: number): PreparedBlock => ({
  type: "paragraph",
  lines: [],
  raw: "x",
  prepared: prep(n),
  items: [],
});
const code = (lines: string[]): PreparedBlock => ({
  type: "code",
  lines,
  raw: lines.join("\n"),
});

describe("calculateCardHeightFromBlocks", () => {
  it("sums paragraph lines, structured blocks, gaps and padding", () => {
    // paragraph: 3 * 20 = 60; code: 2 lines * 18 + 18 = 54; gap 12
    const h = calculateCardHeightFromBlocks(
      [para(3), code(["a", "b"])],
      300,
      100,
      CONFIG,
      2
    );
    expect(h).toBe(60 + 54 + 12 + 100);
  });

  it("adds no gap for a single block", () => {
    expect(calculateCardHeightFromBlocks([para(2)], 300, 10, CONFIG, 2)).toBe(
      50
    );
  });

  it("applies mobile adjustment only for one column", () => {
    expect(calculateCardHeightFromBlocks([para(2)], 300, 100, CONFIG, 1)).toBe(
      40 + 100 - 22
    );
    expect(calculateCardHeightFromBlocks([para(2)], 300, 100, CONFIG, 3)).toBe(
      140
    );
    const noAdj = { ...CONFIG, MOBILE_PADDING_ADJUSTMENT: undefined };
    expect(calculateCardHeightFromBlocks([para(2)], 300, 100, noAdj, 1)).toBe(
      140
    );
  });

  it("treats a paragraph without prepared data as a structured block", () => {
    const noPrep: PreparedBlock = {
      type: "paragraph",
      lines: [],
      raw: "",
    };
    // fallback estimate: 1 line * 20
    expect(calculateCardHeightFromBlocks([noPrep], 300, 0, CONFIG, 2)).toBe(20);
  });
});

describe("calculateMasonryLayout heights", () => {
  const layout = (
    width: number,
    data: PreparedData,
    overrides?: Record<string, number>
  ) =>
    calculateMasonryLayout(
      width,
      [{ id: "a" }],
      { a: data },
      CONFIG,
      overrides
    );

  it("computes height from blocks with gaps", () => {
    const { columns } = layout(500, {
      blocks: [para(2), code(["a"]), para(1)],
      paddingHeight: 100,
    });
    // 40 + (18+18) + 20 = 96, gaps 2*12 = 24, +100, -22 (single column)
    expect(columns[0][0].height).toBe(96 + 24 + 100 - 22);
    expect(columns[0][0].paragraphsLines).toHaveLength(2);
    expect(columns[0][0].paragraphsLines[0]).toEqual([
      { text: "line0" },
      { text: "line1" },
    ]);
  });

  it("collects block items only when present", () => {
    const withItems = { ...para(1), items: [{ text: "t" }] } as PreparedBlock;
    const noItems = { ...para(1), items: undefined } as PreparedBlock;
    const { columns } = layout(500, {
      blocks: [withItems, noItems],
      paddingHeight: 0,
    });
    expect(columns[0][0].paragraphsItems).toEqual([[{ text: "t" }]]);
    expect(columns[0][0].paragraphsLines).toHaveLength(2);
  });

  it("uses text width of column width minus double padding", () => {
    // 2 columns at 800: (800 - 10) / 2 = 395; textWidth = 395 - 32 = 363
    const codeBlock = code(["x".repeat(400)]);
    // approxCharsPerLine = floor((363-24)/7) = 48 -> ceil(400/48) = 9 lines
    const { columns } = layout(800, { blocks: [codeBlock], paddingHeight: 0 });
    expect(columns[0][0].height).toBe(9 * 18 + 18);
  });

  it("supports the paragraphs shape with gaps and item arrays", () => {
    const { columns } = layout(500, {
      paragraphs: [
        { prepared: prep(1), items: [{ text: "a" } as never] },
        { prepared: prep(2), items: [] },
      ],
      paddingHeight: 10,
    });
    expect(columns[0][0].height).toBe(20 + 40 + 12 + 10 - 22);
    expect(columns[0][0].paragraphsItems).toEqual([[{ text: "a" }], []]);
    expect(columns[0][0].paragraphsLines).toEqual([
      [{ text: "line0" }],
      [{ text: "line0" }, { text: "line1" }],
    ]);
  });

  it("normalizes the legacy flat shape and defaults items", () => {
    const { columns } = layout(500, { prepared: prep(2), paddingHeight: 5 });
    expect(columns[0][0].height).toBe(40 + 5 - 22);
    expect(columns[0][0].paragraphsItems).toEqual([[]]);
    expect(columns[0][0].paragraphsLines).toEqual([
      [{ text: "line0" }, { text: "line1" }],
    ]);
  });

  it("returns zero text height with no prepared content", () => {
    const { columns } = layout(500, { paddingHeight: 30 });
    expect(columns[0][0].height).toBe(30 - 22);
    expect(columns[0][0].paragraphsLines).toEqual([]);
  });

  it("does not subtract mobile adjustment with multiple columns", () => {
    const { columns } = layout(800, { prepared: prep(2), paddingHeight: 5 });
    expect(columns[0][0].height).toBe(45);
  });

  it("uses override for both height and reality height", () => {
    const { columns } = layout(
      500,
      { prepared: prep(2), paddingHeight: 5 },
      { a: 77 }
    );
    expect(columns[0][0].height).toBe(77);
    expect(columns[0][0].preCalculatedRealityHeight).toBe(77);
  });

  it("computes reality height from realityBlocks when present", () => {
    const { columns } = layout(800, {
      prepared: prep(1),
      realityBlocks: [para(3)],
      paddingHeight: 10,
    });
    expect(columns[0][0].height).toBe(30);
    expect(columns[0][0].preCalculatedRealityHeight).toBe(70);
  });

  it("falls back to height when realityBlocks is empty", () => {
    const { columns } = layout(800, {
      prepared: prep(1),
      realityBlocks: [],
      paddingHeight: 10,
    });
    expect(columns[0][0].preCalculatedRealityHeight).toBe(30);
  });

  it("uses override or fallback for uncached items with empty lines", () => {
    const r = calculateMasonryLayout(500, [{ id: "z" }], {}, CONFIG, { z: 9 });
    expect(r.columns[0][0]).toMatchObject({
      height: 9,
      preCalculatedRealityHeight: 9,
      paragraphsLines: [],
      paragraphsItems: [],
    });
    const f = calculateMasonryLayout(500, [{ id: "z" }], {}, CONFIG, {});
    expect(f.columns[0][0].height).toBe(250);
    const zero = calculateMasonryLayout(500, [{ id: "z" }], {}, CONFIG, {
      z: 0,
    });
    expect(zero.columns[0][0].height).toBe(0);
  });

  it("treats non-paragraph blocks with prepared data as structured", () => {
    const codeWithPrepared: PreparedBlock = {
      ...code(["a", "b"]),
      prepared: prep(7),
    };
    // structured: 2 * 18 + 18 = 54 (not 7 * 20)
    const { columns } = layout(800, {
      blocks: [codeWithPrepared],
      paddingHeight: 0,
    });
    expect(columns[0][0].height).toBe(54);
    expect(columns[0][0].paragraphsLines).toEqual([]);
    expect(
      calculateCardHeightFromBlocks([codeWithPrepared], 300, 0, CONFIG, 2)
    ).toBe(54);
  });

  it("counts zero lines for an empty prepared paragraph", () => {
    expect(calculateCardHeightFromBlocks([para(0)], 300, 0, CONFIG, 2)).toBe(0);
    const { columns } = layout(800, { blocks: [para(0)], paddingHeight: 0 });
    expect(columns[0][0].height).toBe(0);
  });

  it("falls back to legacy shapes when blocks is an empty array", () => {
    const { columns } = layout(800, {
      blocks: [],
      prepared: prep(2),
      paddingHeight: 0,
    });
    expect(columns[0][0].height).toBe(40);
  });
});

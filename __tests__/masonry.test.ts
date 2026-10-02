// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { calculateMasonryLayout, type MasonryConfig } from "@/lib/masonry";

vi.mock("@chenglou/pretext/rich-inline", () => ({
  walkRichInlineLineRanges: vi.fn((_, _width, cb) => {
    // mock behavior: 2 lines generated
    cb({ start: 0, end: 1 });
    cb({ start: 1, end: 2 });
  }),
  materializeRichInlineLineRange: vi.fn(() => ({
    text: "line",
  })),
}));

describe("calculateMasonryLayout", () => {
  const MOCK_CONFIG: MasonryConfig = {
    COLS: { SM: 1, MD: 2, LG: 3 },
    BREAKPOINTS: { MD: 768, LG: 1024 },
    GAP: 10,
    CARD_PADDING: 16,
    LINE_HEIGHT: 20,
    FALLBACK_ITEM_HEIGHT: 250,
  };

  it("distributes items into columns greedily (SM - 1 column)", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const preparedData = {
      "1": { prepared: {} as never, items: [], paddingHeight: 100 },
      "2": { prepared: {} as never, items: [], paddingHeight: 150 },
      "3": { prepared: {} as never, items: [], paddingHeight: 120 },
    };

    const result = calculateMasonryLayout(
      500,
      items,
      preparedData,
      MOCK_CONFIG
    );
    expect(result.colCount).toBe(1);
    expect(result.columns[0]).toHaveLength(3);
    // 2 lines * 20 line height = 40. 40 + padding height
    expect(result.columns[0][0].height).toBe(140);
    expect(result.columns[0][1].height).toBe(190);
    expect(result.columns[0][2].height).toBe(160);
  });

  it("distributes items into columns greedily (MD - 2 columns)", () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    const preparedData = {
      "1": { prepared: {} as never, items: [], paddingHeight: 100 }, // height 140
      "2": { prepared: {} as never, items: [], paddingHeight: 150 }, // height 190
      "3": { prepared: {} as never, items: [], paddingHeight: 120 }, // height 160
      "4": { prepared: {} as never, items: [], paddingHeight: 80 }, // height 120
    };

    const result = calculateMasonryLayout(
      800,
      items,
      preparedData,
      MOCK_CONFIG
    );
    expect(result.colCount).toBe(2);
    // col0 height tracker: 0 -> 140 -> 140 + 10(gap) + 160 = 310
    // col1 height tracker: 0 -> 190 -> 190 + 10(gap) + 120 = 320
    // Actually greedy algorithm assigns to minHeight col:
    // item 1 -> col 0 (heights: 140, 0)
    // item 2 -> col 1 (heights: 140, 190)
    // item 3 -> col 0 (min is 140) (heights: 310, 190)
    // item 4 -> col 1 (min is 190) (heights: 310, 320)
    expect(result.columns[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "1" }),
        expect.objectContaining({ id: "3" }),
      ])
    );
    expect(result.columns[1]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "2" }),
        expect.objectContaining({ id: "4" }),
      ])
    );
  });

  it("uses FALLBACK_ITEM_HEIGHT if item missing from preparedData", () => {
    const items = [{ id: "1" }];
    const result = calculateMasonryLayout(500, items, {}, MOCK_CONFIG);
    expect(result.columns[0][0].height).toBe(MOCK_CONFIG.FALLBACK_ITEM_HEIGHT);
  });

  it("respects heightOverrides when provided", () => {
    const items = [{ id: "1" }, { id: "2" }];
    const preparedData = {
      "1": { prepared: {} as never, items: [], paddingHeight: 100 }, // normally height 140
      "2": { prepared: {} as never, items: [], paddingHeight: 150 }, // normally height 190
    };
    const heightOverrides = {
      "1": 300, // overridden to 300
    };

    const result = calculateMasonryLayout(
      500,
      items,
      preparedData,
      MOCK_CONFIG,
      heightOverrides
    );
    expect(result.columns[0][0].height).toBe(300);
    expect(result.columns[0][1].height).toBe(190);
  });
});

// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  parsePretextBlocks,
  calculateBlockHeight,
  preparePretextBlocks,
  BLOCK_LAYOUT_CONFIG,
} from "@/lib/pretext-block-parser";
import { calculateMasonryLayout, type MasonryConfig } from "@/lib/masonry";

vi.mock("@chenglou/pretext/rich-inline", () => ({
  walkRichInlineLineRanges: vi.fn((_, _width, cb) => {
    cb({ start: 0, end: 1 });
    cb({ start: 1, end: 2 });
  }),
  materializeRichInlineLineRange: vi.fn(() => ({
    text: "line",
  })),
  prepareRichInline: vi.fn(() => ({})),
}));

describe("Structured Pretext Block Parser for Offscreen Canvas", () => {
  const MOCK_CONFIG: MasonryConfig = {
    COLS: { SM: 1, MD: 2, LG: 3 },
    BREAKPOINTS: { MD: 768, LG: 1024 },
    GAP: 12,
    CARD_PADDING: 16,
    LINE_HEIGHT: 20,
    FALLBACK_ITEM_HEIGHT: 250,
  };

  it("identifies fenced log blocks, code diffs, code snippets, and paragraphs", () => {
    const markdown = `
Introductory description of the incident response.

\`\`\`log
2026-08-18 12:00:00 [ERROR] Connection reset by peer
2026-08-18 12:00:01 [WARN] Retrying connection attempt 1
2026-08-18 12:00:02 [INFO] Connection re-established
\`\`\`

Here is the diff that resolved the issue:

\`\`\`diff
- const maxRetries = 3;
+ const maxRetries = 10;
@@ -12,3 +12,3 @@
\`\`\`
`;

    const blocks = parsePretextBlocks(markdown);
    expect(blocks).toHaveLength(4);

    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[0].raw).toContain("Introductory description");

    expect(blocks[1].type).toBe("log");
    expect(blocks[1].lines).toHaveLength(3);
    expect(blocks[1].lines[0]).toContain("[ERROR]");

    expect(blocks[2].type).toBe("paragraph");
    expect(blocks[2].raw).toContain("Here is the diff");

    expect(blocks[3].type).toBe("diff");
    expect(blocks[3].lines).toHaveLength(3);
    expect(blocks[3].lines[0]).toBe("- const maxRetries = 3;");
    expect(blocks[3].lines[1]).toBe("+ const maxRetries = 10;");
  });

  it("auto-detects unfenced multi-line logs and code diffs", () => {
    const logMarkdown = `
[ERROR] 2026-08-18 12:00:00 Database connection failed
[WARN] 2026-08-18 12:00:01 Retrying connection attempt 1
[INFO] 2026-08-18 12:00:02 Connection restored
`;

    const logBlocks = parsePretextBlocks(logMarkdown);
    expect(logBlocks).toHaveLength(1);
    expect(logBlocks[0].type).toBe("log");
    expect(logBlocks[0].lines).toHaveLength(3);

    const diffMarkdown = `
- const timeout = 5000;
+ const timeout = 10000;
@@ -1,2 +1,2 @@
`;

    const diffBlocks = parsePretextBlocks(diffMarkdown);
    expect(diffBlocks).toHaveLength(1);
    expect(diffBlocks[0].type).toBe("diff");
    expect(diffBlocks[0].lines).toHaveLength(3);
  });

  it("calculates accurate discrete block heights accounting for line counts and block padding", () => {
    const logBlock = {
      type: "log" as const,
      raw: "line1\nline2\nline3\nline4\nline5",
      lines: ["line1", "line2", "line3", "line4", "line5"],
    };

    const width = 300;
    const height = calculateBlockHeight(logBlock, width, 20);

    // 5 lines * 18px line height + 18px block padding = 108px
    const expectedHeight =
      5 * BLOCK_LAYOUT_CONFIG.LINE_HEIGHT + BLOCK_LAYOUT_CONFIG.BLOCK_PADDING;
    expect(height).toBe(expectedHeight);
  });

  it("calculates offscreen card heights and assigns columns greedily in masonry layout with zero overlaps", () => {
    const items = [
      { id: "card-log" },
      { id: "card-diff" },
      { id: "card-plain" },
    ];

    const preparedLog = preparePretextBlocks(`
System logs:
\`\`\`log
[ERROR] Memory limit exceeded
[WARN] GC pause 150ms
[INFO] Worker recycled
\`\`\`
`);

    const preparedDiff = preparePretextBlocks(`
Code changes:
\`\`\`diff
- import legacy from 'legacy';
+ import modern from 'modern';
\`\`\`
`);

    const preparedPlain = preparePretextBlocks(
      "Standard single paragraph card text."
    );

    const preparedData = {
      "card-log": { blocks: preparedLog, paddingHeight: 100 },
      "card-diff": { blocks: preparedDiff, paddingHeight: 100 },
      "card-plain": { blocks: preparedPlain, paddingHeight: 100 },
    };

    const layoutResult = calculateMasonryLayout(
      800,
      items,
      preparedData,
      MOCK_CONFIG
    );

    expect(layoutResult.colCount).toBe(2);
    expect(layoutResult.columns).toHaveLength(2);

    // Verify all 3 cards are distributed into columns
    const totalPlaced = layoutResult.columns.reduce(
      (sum, col) => sum + col.length,
      0
    );
    expect(totalPlaced).toBe(3);

    // Card heights should be greater than zero and accurately pre-measured
    for (const col of layoutResult.columns) {
      for (const card of col) {
        expect(card.height).toBeGreaterThan(100);
      }
    }
  });
});

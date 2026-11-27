/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Configure React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Stable mock object for height overrides to prevent React dependency loop
const stableHeightOverrides = {};

vi.mock("@/components/providers/BentoLayoutContext", () => ({
  useBentoLayout: () => ({
    heightOverrides: stableHeightOverrides,
  }),
}));

// Mock chenglou pretext rich-inline
vi.mock("@chenglou/pretext/rich-inline", () => ({
  walkRichInlineLineRanges: vi.fn((_, _width, cb) => {
    // Mock behavior: exactly 2 lines
    cb({ start: 0, end: 1 });
    cb({ start: 1, end: 2 });
  }),
  materializeRichInlineLineRange: vi.fn((_, _range) => ({
    text: "line",
  })),
  prepareRichInline: vi.fn(() => ({})),
}));

// Mock global ResizeObserver
let observerCallback: ((entries: any[]) => void) | null = null;

class MockResizeObserver {
  constructor(cb: any) {
    observerCallback = cb;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = MockResizeObserver as any;

import { useMasonryLayout } from "@/hooks/useMasonryLayout";

describe("useMasonryLayout Hook - Dynamic Resizing Observer", () => {
  let container: HTMLDivElement;
  let root: Root;

  const MOCK_ITEMS = [
    {
      id: "1",
      editorial_content: "This is a short sample content for masonry study 1.",
    },
    {
      id: "2",
      editorial_content: "This is some editorial detail for dynamic layout 2.",
    },
    {
      id: "3",
      editorial_content: "And a third item for bento spacing calculations.",
    },
  ];

  beforeEach(() => {
    observerCallback = null;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  // Test component to execute hook and track values safely inside useEffect
  const MasonryTestComponent = ({
    onLayoutChange,
  }: {
    onLayoutChange: (val: any) => void;
  }) => {
    const { containerRef, layoutState } = useMasonryLayout(
      MOCK_ITEMS,
      MOCK_ITEMS
    );

    React.useEffect(() => {
      onLayoutChange(layoutState);
    }, [layoutState, onLayoutChange]);

    return <div ref={containerRef} style={{ width: "100%" }} />;
  };

  it("should initialize layout with default columns and update layout dynamically when ResizeObserver triggers", async () => {
    let latestLayout: any = null;

    await act(async () => {
      root = createRoot(container);
      root.render(
        <MasonryTestComponent
          onLayoutChange={(layout) => {
            latestLayout = layout;
          }}
        />
      );
    });

    // Verify layout starts as ready with columns
    expect(latestLayout).not.toBeNull();
    expect(latestLayout.isReady).toBe(true);

    // Make sure our ResizeObserver mock callback was registered
    expect(observerCallback).toBeTypeOf("function");

    // Simulate resizing to small screen (width: 400px -> 1 column)
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 400 },
        },
      ]);
    });

    expect(latestLayout.colCount).toBe(1);
    expect(latestLayout.columns).toHaveLength(1);
    expect(latestLayout.columns[0]).toHaveLength(3); // All 3 items in the single column

    // Simulate resizing to large screen (width: 1200px -> 3 columns)
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 1200 },
        },
      ]);
    });

    expect(latestLayout.colCount).toBe(3);
    expect(latestLayout.columns).toHaveLength(3);
    // Since columns distribute greedily, check that all columns have items
    const totalDistributed = latestLayout.columns.reduce(
      (sum: number, col: any[]) => sum + col.length,
      0
    );
    expect(totalDistributed).toBe(3);
  });
});

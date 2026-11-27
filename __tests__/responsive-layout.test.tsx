/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  calculateColumnCount,
  calculateColumnWidth,
  distributeItemsGreedily,
} from "@/lib/graphics-engine";
import { LAYOUT_CONFIG } from "@/lib/layout-config";
import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { usePretextLayout } from "@/hooks/usePretextLayout";

// Mock AudioProvider
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playClick: vi.fn(),
    playNote: vi.fn(),
    playSuccess: vi.fn(),
  }),
}));

// Mock pretext prepare & layout
vi.mock("@chenglou/pretext", () => ({
  prepare: vi.fn((text, font) => ({ text, font })),
  layout: vi.fn((prepared, width, lineHeight) => {
    const lines = Math.max(1, Math.ceil((prepared.text.length * 10) / width));
    return {
      height: lines * lineHeight,
      lineCount: lines,
    };
  }),
  clearCache: vi.fn(),
}));

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

describe("Responsive Layout & Multi-Viewport Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    observerCallback = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  describe("Column Calculations per Breakpoint", () => {
    const breakpoints = LAYOUT_CONFIG.BREAKPOINTS;
    const cols = LAYOUT_CONFIG.COLS;

    it("evaluates to 1 column on mobile viewports (<768px)", () => {
      expect(calculateColumnCount(320, breakpoints, cols)).toBe(1);
      expect(calculateColumnCount(390, breakpoints, cols)).toBe(1);
      expect(calculateColumnCount(640, breakpoints, cols)).toBe(1);
      expect(calculateColumnCount(767, breakpoints, cols)).toBe(1);
    });

    it("evaluates to 2 columns on tablet viewports (768px - 1023px)", () => {
      expect(calculateColumnCount(768, breakpoints, cols)).toBe(2);
      expect(calculateColumnCount(810, breakpoints, cols)).toBe(2);
      expect(calculateColumnCount(1023, breakpoints, cols)).toBe(2);
    });

    it("evaluates to 3 columns on desktop viewports (>=1024px)", () => {
      expect(calculateColumnCount(1024, breakpoints, cols)).toBe(3);
      expect(calculateColumnCount(1280, breakpoints, cols)).toBe(3);
      expect(calculateColumnCount(1920, breakpoints, cols)).toBe(3);
    });

    it("computes accurate column widths with gaps across 1, 2, and 3 columns", () => {
      const gap = 16;
      // Single column: entire width
      expect(calculateColumnWidth(400, 1, gap)).toBe(400);

      // Two columns: (800 - 16) / 2 = 392
      expect(calculateColumnWidth(800, 2, gap)).toBe(392);

      // Three columns: (1200 - 32) / 3 = 389.333...
      const threeColWidth = calculateColumnWidth(1200, 3, gap);
      expect(Math.round(threeColWidth)).toBe(389);
    });

    it("distributes cards greedily into balanced columns on mobile, tablet, and desktop", () => {
      const mockItems = [
        { id: "1", height: 300 },
        { id: "2", height: 200 },
        { id: "3", height: 250 },
        { id: "4", height: 150 },
      ];

      // 1 column (Mobile): all items in single column
      const mobileResult = distributeItemsGreedily(mockItems, 1, 16);
      expect(mobileResult.columns).toHaveLength(1);
      expect(mobileResult.columns[0]).toHaveLength(4);

      // 2 columns (Tablet): items distributed across 2 columns
      const tabletResult = distributeItemsGreedily(mockItems, 2, 16);
      expect(tabletResult.columns).toHaveLength(2);
      expect(
        tabletResult.columns[0].length + tabletResult.columns[1].length
      ).toBe(4);

      // 3 columns (Desktop): items distributed across 3 columns
      const desktopResult = distributeItemsGreedily(mockItems, 3, 16);
      expect(desktopResult.columns).toHaveLength(3);
    });
  });

  describe("Pretext Dynamic Responsive Metrics", () => {
    function TestHeadline({ width }: { width: number }) {
      const { ref, height, lineCount, isReady } = usePretextLayout({
        text: "Crafting the Interface Between Systems Rigor and Human Delight",
        fontSize: 60,
        lineHeight: 60,
        getResponsiveMetrics: (w) => {
          if (w < 640) return { fontSize: 36, lineHeight: 40 };
          if (w < 768) return { fontSize: 48, lineHeight: 52 };
          return { fontSize: 60, lineHeight: 60 };
        },
      });

      return (
        <div ref={ref} data-testid="headline-container" data-width={width}>
          <span data-testid="is-ready">{isReady ? "ready" : "measuring"}</span>
          <span data-testid="height">{height}</span>
          <span data-testid="line-count">{lineCount}</span>
        </div>
      );
    }

    it("adapts layout metrics dynamically when resize observer fires", async () => {
      await act(async () => {
        root.render(<TestHeadline width={1200} />);
      });

      // Simulate initial desktop layout observation
      if (observerCallback) {
        await act(async () => {
          observerCallback!([
            {
              contentRect: { width: 1200, height: 200 },
              target: container.querySelector(
                '[data-testid="headline-container"]'
              )!,
            },
          ]);
        });
      }

      const readyEl = container.querySelector('[data-testid="is-ready"]');
      expect(readyEl?.textContent).toBe("ready");

      const desktopHeight = Number(
        container.querySelector('[data-testid="height"]')?.textContent
      );
      expect(desktopHeight).toBeGreaterThan(0);

      // Simulate mobile resize
      if (observerCallback) {
        await act(async () => {
          observerCallback!([
            {
              contentRect: { width: 360, height: 200 },
              target: container.querySelector(
                '[data-testid="headline-container"]'
              )!,
            },
          ]);
        });
      }

      const mobileHeight = Number(
        container.querySelector('[data-testid="height"]')?.textContent
      );
      expect(mobileHeight).toBeGreaterThan(0);
    });
  });

  describe("VirtualDPad Interactive Component", () => {
    it("renders directional buttons and triggers direction callbacks on touch/click", async () => {
      const onDirectionPress = vi.fn();
      const onDirectionRelease = vi.fn();
      const onActionAPress = vi.fn();
      const onActionBPress = vi.fn();

      await act(async () => {
        root.render(
          <VirtualDPad
            onDirectionPress={onDirectionPress}
            onDirectionRelease={onDirectionRelease}
            onActionAPress={onActionAPress}
            onActionBPress={onActionBPress}
            actionALabel="FIRE"
            actionBLabel="SWITCH"
          />
        );
      });

      const upBtn = container.querySelector('button[aria-label="Move Up"]');
      const downBtn = container.querySelector('button[aria-label="Move Down"]');
      const leftBtn = container.querySelector('button[aria-label="Move Left"]');
      const rightBtn = container.querySelector(
        'button[aria-label="Move Right"]'
      );
      const fireBtn = container.querySelector('button[aria-label="FIRE"]');
      const switchBtn = container.querySelector('button[aria-label="SWITCH"]');

      expect(upBtn).not.toBeNull();
      expect(downBtn).not.toBeNull();
      expect(leftBtn).not.toBeNull();
      expect(rightBtn).not.toBeNull();
      expect(fireBtn).not.toBeNull();
      expect(switchBtn).not.toBeNull();

      // Test mouseDown/mouseUp (simulating user interaction)
      act(() => {
        upBtn?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(onDirectionPress).toHaveBeenCalledWith("up");

      act(() => {
        upBtn?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });
      expect(onDirectionRelease).toHaveBeenCalledWith("up");

      act(() => {
        fireBtn?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      });
      expect(onActionAPress).toHaveBeenCalled();

      act(() => {
        switchBtn?.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true })
        );
      });
      expect(onActionBPress).toHaveBeenCalled();
    });
  });
});

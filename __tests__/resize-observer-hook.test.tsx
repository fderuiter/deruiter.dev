/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, act, cleanup } from "@testing-library/react";
import { useResizeObserver } from "@/hooks/useResizeObserver";

let observerCallback: ((entries: any[]) => void) | null = null;
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();

class MockResizeObserver {
  constructor(cb: any) {
    observerCallback = cb;
  }
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

globalThis.ResizeObserver = MockResizeObserver as any;

function TestComponent({
  onResize,
}: {
  onResize: (entry: ResizeObserverEntry) => void;
}) {
  const ref = useResizeObserver<HTMLDivElement>(onResize);
  return (
    <div
      ref={ref}
      data-testid="observe-target"
      style={{ width: "100px", height: "100px" }}
    />
  );
}

describe("useResizeObserver Hook - Throttling & Layout Isolation", () => {
  beforeEach(() => {
    observerCallback = null;
    mockDisconnect.mockClear();
    mockObserve.mockClear();
    mockUnobserve.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("sets up and disconnects the ResizeObserver cleanly on mount and unmount", () => {
    const handleResize = vi.fn();
    const { unmount } = render(<TestComponent onResize={handleResize} />);

    expect(mockObserve).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).not.toHaveBeenCalled();

    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("ignores height-only changes to bypass vertical scrolling adjustments", async () => {
    const handleResize = vi.fn();
    render(<TestComponent onResize={handleResize} />);

    // Trigger initial size
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 100, height: 100 },
          target: null,
        },
      ]);
    });

    expect(handleResize).toHaveBeenCalledTimes(1);
    handleResize.mockClear();

    // Trigger height-only change
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 100, height: 250 },
          target: null,
        },
      ]);
    });

    // Callback should NOT be called when trackVertical is default (false)
    expect(handleResize).not.toHaveBeenCalled();
  });

  it("observes height changes when opt-in vertical resize mode is enabled (trackVertical = true)", async () => {
    function VerticalComponent({
      onResize,
    }: {
      onResize: (entry: ResizeObserverEntry) => void;
    }) {
      const ref = useResizeObserver<HTMLDivElement>(onResize, {
        trackVertical: true,
      });
      return (
        <div
          ref={ref}
          data-testid="observe-vertical-target"
          style={{ width: "100px", height: "100px" }}
        />
      );
    }

    const handleResize = vi.fn();
    render(<VerticalComponent onResize={handleResize} />);

    // Trigger initial size
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 100, height: 100 },
          target: null,
        },
      ]);
    });

    expect(handleResize).toHaveBeenCalledTimes(1);
    handleResize.mockClear();

    // Trigger height-only change
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 100, height: 300 },
          target: null,
        },
      ]);
    });

    // Callback SHOULD be called when trackVertical is true
    expect(handleResize).toHaveBeenCalledTimes(1);
    expect(handleResize.mock.calls[0][0].contentRect.height).toBe(300);
  });

  it("throttles multiple width changes and resolves with trailing-edge dimensions", async () => {
    const handleResize = vi.fn();
    render(<TestComponent onResize={handleResize} />);

    // Trigger initial size
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 100, height: 100 },
          target: null,
        },
      ]);
    });

    expect(handleResize).toHaveBeenCalledTimes(1);
    expect(handleResize.mock.calls[0][0].contentRect.width).toBe(100);
    handleResize.mockClear();

    // Trigger multiple rapid width changes in the same tick
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 150, height: 100 },
          target: null,
        },
      ]);
      observerCallback!([
        {
          contentRect: { width: 180, height: 100 },
          target: null,
        },
      ]);
      observerCallback!([
        {
          contentRect: { width: 220, height: 100 },
          target: null,
        },
      ]);
    });

    // It should have throttled and resolved only ONCE with the final trailing-edge value (220)
    expect(handleResize).toHaveBeenCalledTimes(1);
    expect(handleResize.mock.calls[0][0].contentRect.width).toBe(220);
  });

  it("completely cancels pending updates when unmounted", async () => {
    const handleResize = vi.fn();
    const { unmount } = render(<TestComponent onResize={handleResize} />);

    // Trigger size changes
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 200, height: 100 },
          target: null,
        },
      ]);
    });

    expect(handleResize).toHaveBeenCalledTimes(1);
    handleResize.mockClear();

    // Trigger a change, then immediately unmount
    await act(async () => {
      observerCallback!([
        {
          contentRect: { width: 300, height: 100 },
          target: null,
        },
      ]);
      unmount();
    });

    // Callback should not run for the unmounted component
    expect(handleResize).not.toHaveBeenCalled();
  });
});

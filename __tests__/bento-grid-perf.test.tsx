// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { BentoGrid, Card } from "@/components/BentoGrid";

describe("BentoGrid Performance Optimizations", () => {
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;
  let cancelAnimationFrameSpy: ReturnType<typeof vi.spyOn>;
  let rafCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    rafCallbacks = [];
    requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
    cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("caches getBoundingClientRect on pointerenter and resize, avoiding calls on pointermove", () => {
    const getBoundingClientRectMock = vi.fn().mockReturnValue({
      width: 300,
      height: 200,
      left: 10,
      top: 10,
      right: 310,
      bottom: 210,
      x: 10,
      y: 10,
      toJSON: () => {},
    });

    const originalGetBoundingClientRect =
      HTMLDivElement.prototype.getBoundingClientRect;
    HTMLDivElement.prototype.getBoundingClientRect = getBoundingClientRectMock;

    try {
      const { container } = render(
        <BentoGrid>
          <Card>
            <div>Test Card Content</div>
          </Card>
        </BentoGrid>
      );

      const cardElement = container.firstElementChild
        ?.firstElementChild as HTMLElement;
      expect(cardElement).toBeDefined();

      // Trigger pointerenter - should call getBoundingClientRect
      fireEvent.pointerEnter(cardElement);
      const callsAfterEnter = getBoundingClientRectMock.mock.calls.length;
      expect(callsAfterEnter).toBeGreaterThanOrEqual(1);

      // Trigger multiple pointermove events
      fireEvent.pointerMove(cardElement, {
        clientX: 50,
        clientY: 50,
        pointerType: "mouse",
      });
      fireEvent.pointerMove(cardElement, {
        clientX: 60,
        clientY: 60,
        pointerType: "mouse",
      });
      fireEvent.pointerMove(cardElement, {
        clientX: 70,
        clientY: 70,
        pointerType: "mouse",
      });

      // getBoundingClientRect should NOT have been called during pointermove
      expect(getBoundingClientRectMock.mock.calls.length).toBe(callsAfterEnter);

      // Trigger window resize event - invalidates cache (rectRef.current = null) without synchronous reflow (#817, ADR 0052)
      fireEvent(window, new Event("resize"));
      expect(getBoundingClientRectMock.mock.calls.length).toBe(callsAfterEnter);

      // Next pointermove lazily remeasures once
      fireEvent.pointerMove(cardElement, {
        clientX: 80,
        clientY: 80,
        pointerType: "mouse",
      });
      expect(getBoundingClientRectMock.mock.calls.length).toBe(
        callsAfterEnter + 1
      );

      // Subsequent pointermove does not measure again
      fireEvent.pointerMove(cardElement, {
        clientX: 90,
        clientY: 90,
        pointerType: "mouse",
      });
      expect(getBoundingClientRectMock.mock.calls.length).toBe(
        callsAfterEnter + 1
      );
    } finally {
      HTMLDivElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }
  });

  it("batches CSS variable updates inside requestAnimationFrame", () => {
    const getBoundingClientRectMock = vi.fn().mockReturnValue({
      width: 300,
      height: 200,
      left: 10,
      top: 10,
      right: 310,
      bottom: 210,
      x: 10,
      y: 10,
      toJSON: () => {},
    });

    const originalGetBoundingClientRect =
      HTMLDivElement.prototype.getBoundingClientRect;
    HTMLDivElement.prototype.getBoundingClientRect = getBoundingClientRectMock;

    try {
      const { container } = render(
        <BentoGrid>
          <Card>
            <div>Test Card Content</div>
          </Card>
        </BentoGrid>
      );

      const cardElement = container.firstElementChild
        ?.firstElementChild as HTMLElement;

      fireEvent.pointerEnter(cardElement);

      const initialMx = cardElement.style.getPropertyValue("--m-x").trim();

      // Trigger pointermove - should schedule requestAnimationFrame
      fireEvent.pointerMove(cardElement, {
        clientX: 50,
        clientY: 50,
        pointerType: "mouse",
      });
      expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);

      // CSS variable should not be updated yet (still initial value)
      expect(cardElement.style.getPropertyValue("--m-x").trim()).toBe(
        initialMx
      );

      // Execute queued rAF callback
      const callback = rafCallbacks.shift();
      if (callback) {
        callback(performance.now());
      }

      // CSS variable should now be updated to new calculated glare position
      expect(cardElement.style.getPropertyValue("--m-x").trim()).not.toBe(
        initialMx
      );
    } finally {
      HTMLDivElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }
  });

  it("cancels pending requestAnimationFrame on pointerleave", () => {
    const getBoundingClientRectMock = vi.fn().mockReturnValue({
      width: 300,
      height: 200,
      left: 10,
      top: 10,
      right: 310,
      bottom: 210,
      x: 10,
      y: 10,
      toJSON: () => {},
    });

    const originalGetBoundingClientRect =
      HTMLDivElement.prototype.getBoundingClientRect;
    HTMLDivElement.prototype.getBoundingClientRect = getBoundingClientRectMock;

    try {
      const { container } = render(
        <BentoGrid>
          <Card>
            <div>Test Card Content</div>
          </Card>
        </BentoGrid>
      );

      const cardElement = container.firstElementChild
        ?.firstElementChild as HTMLElement;

      fireEvent.pointerEnter(cardElement);
      fireEvent.pointerMove(cardElement, {
        clientX: 50,
        clientY: 50,
        pointerType: "mouse",
      });

      expect(requestAnimationFrameSpy).toHaveBeenCalled();

      fireEvent.pointerLeave(cardElement);

      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    } finally {
      HTMLDivElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect;
    }
  });
});

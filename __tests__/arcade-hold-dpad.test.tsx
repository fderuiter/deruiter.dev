// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { HoldDpad } from "@/components/arcade/mobile";

// The hold timing the kit ships with (holdRepeat.ts).
const HOLD_REPEAT_DELAY_MS = 220;
const HOLD_REPEAT_INTERVAL_MS = 140;

describe("HoldDpad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("names every direction and keeps the centre as decoration", () => {
    render(<HoldDpad onMove={() => {}} />);
    for (const name of ["Move Up", "Move Down", "Move Left", "Move Right"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("a press moves once, and a release before the delay adds no second step", () => {
    const onMove = vi.fn();
    render(<HoldDpad onMove={onMove} />);
    const up = screen.getByRole("button", { name: "Move Up" });

    fireEvent.pointerDown(up, { pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(up, { pointerId: 1, pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(
        HOLD_REPEAT_DELAY_MS + HOLD_REPEAT_INTERVAL_MS * 3
      );
    });

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("up");
  });

  it("a hold keeps stepping at the interval until release", () => {
    const onMove = vi.fn();
    render(<HoldDpad onMove={onMove} />);
    const right = screen.getByRole("button", { name: "Move Right" });

    fireEvent.pointerDown(right, { pointerId: 2, pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(
        HOLD_REPEAT_DELAY_MS + HOLD_REPEAT_INTERVAL_MS * 2
      );
    });
    expect(onMove).toHaveBeenCalledTimes(4);

    fireEvent.pointerUp(right, { pointerId: 2, pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onMove).toHaveBeenCalledTimes(4);
  });

  it("two directions held at once each repeat without stopping the other", () => {
    const onMove = vi.fn();
    render(<HoldDpad onMove={onMove} />);
    const up = screen.getByRole("button", { name: "Move Up" });
    const left = screen.getByRole("button", { name: "Move Left" });

    fireEvent.pointerDown(up, { pointerId: 3, pointerType: "touch" });
    fireEvent.pointerDown(left, { pointerId: 4, pointerType: "touch" });
    fireEvent.pointerUp(up, { pointerId: 3, pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(HOLD_REPEAT_DELAY_MS + HOLD_REPEAT_INTERVAL_MS);
    });

    expect(
      onMove.mock.calls.filter(([d]) => d === "left").length
    ).toBeGreaterThanOrEqual(2);
    expect(onMove.mock.calls.filter(([d]) => d === "up")).toHaveLength(1);
    fireEvent.pointerUp(left, { pointerId: 4, pointerType: "touch" });
  });

  it("stops repeating when the page unmounts mid-hold", () => {
    const onMove = vi.fn();
    const view = render(<HoldDpad onMove={onMove} />);
    const down = screen.getByRole("button", { name: "Move Down" });
    fireEvent.pointerDown(down, { pointerId: 5, pointerType: "touch" });
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onMove).toHaveBeenCalledTimes(1);
  });
});

describe("hold controls under multi-touch and page changes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps holding one arrow while a second finger taps another", () => {
    const onMove = vi.fn();
    render(<HoldDpad onMove={onMove} />);
    const right = screen.getByRole("button", { name: "Move Right" });
    const up = screen.getByRole("button", { name: "Move Up" });

    fireEvent.pointerDown(right, { pointerId: 1, pointerType: "touch" });
    fireEvent.pointerDown(up, { pointerId: 2, pointerType: "touch" });
    fireEvent.pointerUp(up, { pointerId: 2, pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(
        HOLD_REPEAT_DELAY_MS + HOLD_REPEAT_INTERVAL_MS * 2
      );
    });

    // Right is still held: it kept repeating after Up was tapped and lifted.
    const rightSteps = onMove.mock.calls.filter(([d]) => d === "right").length;
    expect(rightSteps).toBeGreaterThanOrEqual(3);
    expect(onMove.mock.calls.filter(([d]) => d === "up")).toHaveLength(1);
    fireEvent.pointerUp(right, { pointerId: 1, pointerType: "touch" });
  });

  it("a tap that would move focus does not release a held arrow", () => {
    const onMove = vi.fn();
    render(<HoldDpad onMove={onMove} />);
    const right = screen.getByRole("button", { name: "Move Right" });
    const up = screen.getByRole("button", { name: "Move Up" });

    fireEvent.pointerDown(right, { pointerId: 1, pointerType: "touch" });
    // A mousedown on another key is cancelled, so focus stays on Right.
    expect(fireEvent.mouseDown(up)).toBe(false);
    act(() => {
      right.focus();
      up.focus();
    });
    act(() => {
      vi.advanceTimersByTime(HOLD_REPEAT_DELAY_MS + HOLD_REPEAT_INTERVAL_MS);
    });
    expect(
      onMove.mock.calls.filter(([d]) => d === "right").length
    ).toBeGreaterThanOrEqual(2);
    fireEvent.pointerUp(right, { pointerId: 1, pointerType: "touch" });
  });

  it("releases every hold on window blur, a hidden page and pagehide", () => {
    for (const release of [
      () => fireEvent(window, new Event("blur")),
      () => fireEvent(window, new Event("pagehide")),
      () => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        fireEvent(document, new Event("visibilitychange"));
        delete (document as { visibilityState?: unknown }).visibilityState;
      },
    ]) {
      const onMove = vi.fn();
      const { unmount } = render(<HoldDpad onMove={onMove} />);
      const left = screen.getByRole("button", { name: "Move Left" });
      fireEvent.pointerDown(left, { pointerId: 5, pointerType: "touch" });
      release();
      const after = onMove.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(HOLD_REPEAT_DELAY_MS * 3);
      });
      expect(onMove.mock.calls.length).toBe(after);
      unmount();
    }
  });

  it("a paused game stops a repeat that is running", () => {
    const onMove = vi.fn();
    const { rerender } = render(<HoldDpad onMove={onMove} />);
    const down = screen.getByRole("button", { name: "Move Down" });
    fireEvent.pointerDown(down, { pointerId: 6, pointerType: "touch" });
    rerender(<HoldDpad onMove={onMove} paused />);
    const after = onMove.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(HOLD_REPEAT_DELAY_MS * 3);
    });
    expect(onMove.mock.calls.length).toBe(after);
    fireEvent.pointerUp(down, { pointerId: 6, pointerType: "touch" });
  });
});

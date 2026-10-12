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
import { HoldDpad } from "@/components/arcade/mobile/HoldDpad";
import {
  HOLD_REPEAT_DELAY_MS,
  HOLD_REPEAT_INTERVAL_MS,
} from "@/components/arcade/mobile/holdRepeat";

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

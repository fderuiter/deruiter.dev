// @vitest-environment jsdom
import React, { useRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GestureHandlers } from "@/components/arcade/mobile/gesture";
import {
  useGesture,
  type UseGestureOptions,
} from "@/components/arcade/mobile/useGesture";

/** A stage with the hook bound, and a button outside it to hold focus. */
function Stage({
  handlers,
  options,
}: {
  handlers: GestureHandlers;
  options?: UseGestureOptions;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useGesture(ref, handlers, options);
  return (
    <>
      <button type="button">Outside</button>
      <div ref={ref} data-testid="stage" />
    </>
  );
}

function mount(handlers: GestureHandlers, options?: UseGestureOptions) {
  render(<Stage handlers={handlers} options={options} />);
  return screen.getByTestId("stage");
}

type PointerInit = {
  id?: number;
  type?: string;
  x?: number;
  y?: number;
  button?: number;
};

function init({
  id = 1,
  type = "touch",
  x = 0,
  y = 0,
  button = 0,
}: PointerInit) {
  return { pointerId: id, pointerType: type, clientX: x, clientY: y, button };
}

const down = (el: HTMLElement, p: PointerInit = {}) =>
  fireEvent.pointerDown(el, init(p));
const move = (el: HTMLElement, p: PointerInit = {}) =>
  fireEvent.pointerMove(el, init(p));
const up = (el: HTMLElement, p: PointerInit = {}) =>
  fireEvent.pointerUp(el, init(p));

describe("useGesture (#2360)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("tap", () => {
    it("a press and release inside the slop is one tap at the release point", () => {
      const onTap = vi.fn();
      const el = mount({ onTap });
      down(el, { x: 10, y: 10 });
      move(el, { x: 14, y: 13 });
      up(el, { x: 14, y: 13 });
      expect(onTap).toHaveBeenCalledTimes(1);
      expect(onTap).toHaveBeenCalledWith({ x: 14, y: 13, input: "touch" });
    });

    it("a Pencil reads as touch and a mouse as mouse (ADR 0061)", () => {
      const onTap = vi.fn();
      const el = mount({ onTap });
      down(el, { type: "pen" });
      up(el, { type: "pen" });
      down(el, { type: "mouse" });
      up(el, { type: "mouse" });
      expect(onTap.mock.calls.map(([info]) => info.input)).toEqual([
        "touch",
        "mouse",
      ]);
    });

    it("ignores a right or middle mouse button", () => {
      const onTap = vi.fn();
      const el = mount({ onTap });
      down(el, { type: "mouse", button: 2 });
      up(el, { type: "mouse", button: 2 });
      expect(onTap).not.toHaveBeenCalled();
    });

    it("neither steals focus nor prevents the pointer's default action", () => {
      const onTap = vi.fn();
      const el = mount({ onTap, onLongPress: vi.fn(), onPan: vi.fn() });
      const outside = screen.getByRole("button", { name: "Outside" });
      outside.focus();
      expect(down(el, { x: 0, y: 0 })).toBe(true);
      expect(move(el, { x: 40, y: 0 })).toBe(true);
      expect(up(el, { x: 40, y: 0 })).toBe(true);
      expect(document.activeElement).toBe(outside);
    });

    it("lets the click that follows a tap through", () => {
      const onClick = vi.fn();
      const el = mount({ onTap: vi.fn() });
      el.addEventListener("click", onClick);
      down(el);
      up(el);
      fireEvent.click(el);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("double-tap", () => {
    it("is off by default", () => {
      const onDoubleTap = vi.fn();
      const el = mount({ onDoubleTap });
      down(el);
      up(el);
      down(el);
      up(el);
      expect(onDoubleTap).not.toHaveBeenCalled();
    });

    it("fires on the second of two quick taps once opted in, after both taps", () => {
      const onTap = vi.fn();
      const onDoubleTap = vi.fn();
      const el = mount({ onTap, onDoubleTap }, { doubleTap: true });
      down(el, { x: 50, y: 50 });
      up(el, { x: 50, y: 50 });
      vi.advanceTimersByTime(200);
      down(el, { x: 54, y: 52 });
      up(el, { x: 54, y: 52 });
      expect(onTap).toHaveBeenCalledTimes(2);
      expect(onDoubleTap).toHaveBeenCalledTimes(1);
    });

    it("two taps too far apart in time are two single taps", () => {
      const onDoubleTap = vi.fn();
      const el = mount({ onDoubleTap }, { doubleTap: true });
      down(el);
      up(el);
      vi.advanceTimersByTime(400);
      down(el);
      up(el);
      expect(onDoubleTap).not.toHaveBeenCalled();
    });
  });

  describe("long-press", () => {
    it("fires after 450ms of a still press, with a haptic tick, and not a tap", () => {
      const vibrate = vi.fn();
      vi.stubGlobal("navigator", { ...navigator, vibrate });
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const el = mount({ onLongPress, onTap });
      down(el, { x: 20, y: 30 });
      vi.advanceTimersByTime(449);
      expect(onLongPress).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onLongPress).toHaveBeenCalledWith({
        x: 20,
        y: 30,
        input: "touch",
      });
      expect(vibrate).toHaveBeenCalledTimes(1);
      up(el, { x: 20, y: 30 });
      expect(onTap).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("skips the haptic when asked", () => {
      const vibrate = vi.fn();
      vi.stubGlobal("navigator", { ...navigator, vibrate });
      const el = mount({ onLongPress: vi.fn() }, { haptic: false });
      down(el);
      vi.advanceTimersByTime(500);
      expect(vibrate).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("cancels when the pointer moves past the slop", () => {
      const onLongPress = vi.fn();
      const el = mount({ onLongPress });
      down(el, { x: 0, y: 0 });
      move(el, { x: 9, y: 0 });
      vi.advanceTimersByTime(1000);
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("survives a wobble inside the slop", () => {
      const onLongPress = vi.fn();
      const el = mount({ onLongPress });
      down(el, { x: 0, y: 0 });
      move(el, { x: 5, y: 5 });
      vi.advanceTimersByTime(450);
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it("swallows the click the browser sends after it", () => {
      const onClick = vi.fn();
      const el = mount({ onLongPress: vi.fn() });
      el.addEventListener("click", onClick);
      down(el);
      vi.advanceTimersByTime(450);
      up(el);
      fireEvent.click(el);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("lets the next tap's click through when no click followed it", () => {
      const onClick = vi.fn();
      const el = mount({ onLongPress: vi.fn() });
      el.addEventListener("click", onClick);
      down(el);
      vi.advanceTimersByTime(450);
      up(el);
      vi.advanceTimersByTime(100);
      down(el);
      up(el);
      fireEvent.click(el);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("holds back the touch context menu but not a right-click's", () => {
      const el = mount({ onLongPress: vi.fn() });
      down(el);
      vi.advanceTimersByTime(450);
      expect(fireEvent.contextMenu(el)).toBe(false);
      up(el);
      down(el, { type: "mouse", button: 2 });
      expect(fireEvent.contextMenu(el)).toBe(true);
    });
  });

  describe("pan and swipe", () => {
    it("starts after 8px of slop and reports distance, delta and velocity", () => {
      const onPanStart = vi.fn();
      const onPan = vi.fn();
      const onPanEnd = vi.fn();
      const onTap = vi.fn();
      const el = mount({ onPanStart, onPan, onPanEnd, onTap });
      down(el, { x: 100, y: 100 });
      vi.advanceTimersByTime(10);
      move(el, { x: 108, y: 100 });
      expect(onPanStart).not.toHaveBeenCalled();
      vi.advanceTimersByTime(10);
      move(el, { x: 110, y: 100 });
      expect(onPanStart).toHaveBeenCalledTimes(1);
      expect(onPanStart.mock.calls[0][0]).toMatchObject({ dx: 10, dy: 0 });
      vi.advanceTimersByTime(20);
      move(el, { x: 130, y: 110 });
      expect(onPan).toHaveBeenCalledTimes(1);
      expect(onPan.mock.calls[0][0]).toMatchObject({
        x: 130,
        y: 110,
        dx: 30,
        dy: 10,
        deltaX: 20,
        deltaY: 10,
        vx: 1,
        vy: 0.5,
        input: "touch",
      });
      up(el, { x: 130, y: 110 });
      expect(onPanEnd).toHaveBeenCalledTimes(1);
      expect(onTap).not.toHaveBeenCalled();
    });

    it("keeps the long-press from firing once a pan starts", () => {
      const onLongPress = vi.fn();
      const el = mount({ onLongPress, onPan: vi.fn() });
      down(el);
      move(el, { x: 20 });
      vi.advanceTimersByTime(1000);
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("names the swipe direction through swipeDirection", () => {
      const onSwipe = vi.fn();
      const el = mount({ onSwipe });
      const swipe = (x: number, y: number) => {
        down(el, { x: 100, y: 100 });
        move(el, { x: 100 + x, y: 100 + y });
        up(el, { x: 100 + x, y: 100 + y });
      };
      swipe(60, 5);
      swipe(-60, 5);
      swipe(4, 60);
      swipe(4, -60);
      expect(onSwipe.mock.calls.map(([direction]) => direction)).toEqual([
        "right",
        "left",
        "down",
        "up",
      ]);
    });

    it("a pan shorter than the swipe threshold is no swipe", () => {
      const onSwipe = vi.fn();
      const onPanEnd = vi.fn();
      const el = mount({ onSwipe, onPanEnd });
      down(el, { x: 0, y: 0 });
      move(el, { x: 12, y: 0 });
      up(el, { x: 12, y: 0 });
      expect(onPanEnd).toHaveBeenCalledTimes(1);
      expect(onSwipe).not.toHaveBeenCalled();
    });

    it("swallows the click that ends a pan", () => {
      const onClick = vi.fn();
      const el = mount({ onPan: vi.fn() });
      el.addEventListener("click", onClick);
      down(el);
      move(el, { x: 40 });
      up(el, { x: 40 });
      fireEvent.click(el);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("cancellation", () => {
    it("a second finger cancels the gesture when pinch is off", () => {
      const onCancel = vi.fn();
      const onPanEnd = vi.fn();
      const onTap = vi.fn();
      const el = mount({ onCancel, onPanEnd, onTap, onPan: vi.fn() });
      down(el, { id: 1, x: 0, y: 0 });
      move(el, { id: 1, x: 30, y: 0 });
      down(el, { id: 2, x: 200, y: 0 });
      expect(onCancel).toHaveBeenCalledTimes(1);
      move(el, { id: 1, x: 60, y: 0 });
      up(el, { id: 2, x: 200, y: 0 });
      up(el, { id: 1, x: 60, y: 0 });
      expect(onPanEnd).not.toHaveBeenCalled();
      expect(onTap).not.toHaveBeenCalled();
    });

    it("a second finger on a pending press cancels the tap", () => {
      const onTap = vi.fn();
      const el = mount({ onTap });
      down(el, { id: 1 });
      down(el, { id: 2 });
      up(el, { id: 1 });
      up(el, { id: 2 });
      expect(onTap).not.toHaveBeenCalled();
    });

    it("pointercancel cancels a pan and the long-press", () => {
      const onCancel = vi.fn();
      const onPanEnd = vi.fn();
      const onLongPress = vi.fn();
      const el = mount({ onCancel, onPanEnd, onLongPress, onPan: vi.fn() });
      down(el);
      move(el, { x: 30 });
      fireEvent.pointerCancel(el, init({ x: 30 }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      up(el, { x: 30 });
      expect(onPanEnd).not.toHaveBeenCalled();

      down(el);
      fireEvent.pointerCancel(el, init({}));
      vi.advanceTimersByTime(1000);
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it("stops listening when disabled", () => {
      const onTap = vi.fn();
      const el = mount({ onTap }, { enabled: false });
      down(el);
      up(el);
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe("pinch", () => {
    it("reports scale and midpoint pan for two fingers once opted in", () => {
      const onPinchStart = vi.fn();
      const onPinch = vi.fn();
      const onPinchEnd = vi.fn();
      const onCancel = vi.fn();
      const onTap = vi.fn();
      const el = mount(
        { onPinchStart, onPinch, onPinchEnd, onCancel, onTap },
        { pinch: true }
      );
      down(el, { id: 1, x: 100, y: 100 });
      down(el, { id: 2, x: 200, y: 100 });
      expect(onPinchStart).toHaveBeenCalledWith({
        scale: 1,
        centerX: 150,
        centerY: 100,
        panX: 0,
        panY: 0,
      });
      move(el, { id: 1, x: 50, y: 120 });
      move(el, { id: 2, x: 250, y: 120 });
      expect(onPinch).toHaveBeenLastCalledWith({
        scale: 2,
        centerX: 150,
        centerY: 120,
        panX: 0,
        panY: 20,
      });
      up(el, { id: 2, x: 250, y: 120 });
      expect(onPinchEnd).toHaveBeenCalledTimes(1);
      // The finger left behind does not turn into a pan or a tap.
      move(el, { id: 1, x: 10, y: 120 });
      up(el, { id: 1, x: 10, y: 120 });
      expect(onTap).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("a pan in progress gives way to the pinch", () => {
      const onCancel = vi.fn();
      const onPinchStart = vi.fn();
      const el = mount(
        { onCancel, onPinchStart, onPan: vi.fn() },
        { pinch: true }
      );
      down(el, { id: 1, x: 0, y: 0 });
      move(el, { id: 1, x: 30, y: 0 });
      down(el, { id: 2, x: 130, y: 0 });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onPinchStart).toHaveBeenCalledTimes(1);
    });

    it("pointercancel mid-pinch cancels it", () => {
      const onCancel = vi.fn();
      const onPinchEnd = vi.fn();
      const el = mount({ onCancel, onPinchEnd }, { pinch: true });
      down(el, { id: 1, x: 0, y: 0 });
      down(el, { id: 2, x: 100, y: 0 });
      fireEvent.pointerCancel(el, init({ id: 1 }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      up(el, { id: 2, x: 100, y: 0 });
      expect(onPinchEnd).not.toHaveBeenCalled();
    });
  });
});

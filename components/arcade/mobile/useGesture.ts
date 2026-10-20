"use client";

import { useEffect, useRef, type RefObject } from "react";
import { triggerHaptic } from "@/lib/haptics";
import {
  createGestureRecognizer,
  type GestureHandlers,
  type GestureOptions,
  type GesturePointer,
} from "@/components/arcade/mobile/gesture";

/** Options for `useGesture`: the recogniser's tuning, plus an on/off switch. */
export interface UseGestureOptions extends Omit<
  GestureOptions,
  "setTimer" | "clearTimer" | "now" | "onHaptic"
> {
  /** Attach the listeners. Default true. */
  enabled?: boolean;
  /** A short vibration on long-press, where the device allows it. Default true. */
  haptic?: boolean;
}

/**
 * A click the browser sends this soon after a long-press, pan or pinch is the
 * tail of that gesture, not a tap of its own, and is swallowed.
 */
const CLICK_SWALLOW_MS = 500;

function sample(event: PointerEvent): GesturePointer {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    x: event.clientX,
    y: event.clientY,
  };
}

/**
 * Recognises tap, double-tap (opt-in), long-press (450ms, with a haptic tick),
 * pan with delta and velocity after 8px of slop, swipe (through
 * `swipeDirection`) and a two-finger pinch and pan (opt-in) on one element.
 *
 * It listens to pointer events and captures the pointer, so a pan keeps
 * reporting when the finger leaves the element. A Pencil counts as touch.
 * A gesture cancels on `pointercancel` and when a second finger lands with
 * pinch off. The hook never calls `focus()` and never calls `preventDefault`
 * on a pointer event, so focus and the page outside the element are untouched;
 * a stage that pans or pinches sets `touch-action: none` on itself. The click
 * that follows a long-press, pan or pinch is swallowed so it does not also
 * act as a tap, and the context menu a long-press opens on touch is
 * suppressed on the element when `onLongPress` is set.
 *
 * @param ref - The element to watch.
 * @param handlers - Callbacks per gesture; the latest render's are used.
 * @param options - Slop, timings and the opt-in gestures.
 */
export function useGesture(
  ref: RefObject<HTMLElement | null>,
  handlers: GestureHandlers,
  options: UseGestureOptions = {}
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  const {
    enabled = true,
    haptic = true,
    slop,
    longPressMs,
    doubleTap,
    doubleTapMs,
    pinch,
    swipeThreshold,
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const recognizer = createGestureRecognizer(() => handlersRef.current, {
      slop,
      longPressMs,
      doubleTap,
      doubleTapMs,
      pinch,
      swipeThreshold,
      onHaptic: haptic ? () => triggerHaptic(10) : undefined,
    });
    let swallowUntil = 0;
    let lastPointerType = "";

    const onDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      if (!recognizer.down(sample(event))) return;
      try {
        el.setPointerCapture?.(event.pointerId);
      } catch {
        // The pointer is already gone; the recogniser still sees its up.
      }
    };
    const onMove = (event: PointerEvent) => recognizer.move(sample(event));
    const onUp = (event: PointerEvent) => {
      const outcome = recognizer.up(sample(event));
      if (outcome !== "none" && outcome !== "tap") {
        swallowUntil = Date.now() + CLICK_SWALLOW_MS;
      }
    };
    const onCancel = () => {
      recognizer.cancel();
      swallowUntil = Date.now() + CLICK_SWALLOW_MS;
    };
    const onClick = (event: MouseEvent) => {
      if (Date.now() > swallowUntil) return;
      swallowUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    };
    const onContextMenu = (event: MouseEvent) => {
      // Only a touch or Pencil press: a right-click still opens the menu.
      if (!handlersRef.current.onLongPress) return;
      if (lastPointerType === "" || lastPointerType === "mouse") return;
      event.preventDefault();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("click", onClick, true);
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("contextmenu", onContextMenu);
      recognizer.dispose();
    };
  }, [
    ref,
    enabled,
    haptic,
    slop,
    longPressMs,
    doubleTap,
    doubleTapMs,
    pinch,
    swipeThreshold,
  ]);
}

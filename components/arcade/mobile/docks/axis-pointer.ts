"use client";

import { useEffect, useRef } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { touchAxisInput, useActionSink, type ActionVector } from "@/lib/arcade";

/** Where a drag measures its direction from. */
export type AxisOrigin = "center" | "touch";

const ZERO: ActionVector = Object.freeze({ x: 0, y: 0 });

const ARROWS: Readonly<Record<string, ActionVector>> = Object.freeze({
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
});

function round(value: number): number {
  // Two places: enough for steering, and a finger's tremor does not send a
  // change every frame. `+ 0` turns -0 into 0.
  return Math.round(value * 100) / 100 + 0;
}

/**
 * The direction of a drag: the offset over the radius, capped at 1, with
 * the dead zone cut out and the rest rescaled so the edge of the dead zone
 * is 0 and the rim is 1.
 *
 * @param dx - Horizontal offset from the origin, in px.
 * @param dy - Vertical offset, screen y down.
 * @param radius - The offset that reads as full tilt, in px.
 * @param deadZone - The share of the radius that reads as centred, 0 to 1.
 * @returns The vector, each axis from -1 to 1.
 */
export function axisVector(
  dx: number,
  dy: number,
  radius: number,
  deadZone: number
): ActionVector {
  const length = Math.hypot(dx, dy);
  if (radius <= 0 || length === 0) return ZERO;
  const tilt = Math.min(length / radius, 1);
  if (tilt <= deadZone) return ZERO;
  const scaled = deadZone >= 1 ? 0 : (tilt - deadZone) / (1 - deadZone);
  return { x: round((dx / length) * scaled), y: round((dy / length) * scaled) };
}

/** The vector of the arrow keys held, a diagonal kept at length 1. */
function arrowsVector(held: ReadonlySet<string>): ActionVector {
  let x = 0;
  let y = 0;
  for (const key of held) {
    x += ARROWS[key]?.x ?? 0;
    y += ARROWS[key]?.y ?? 0;
  }
  const length = Math.hypot(x, y);
  return length === 0 ? ZERO : { x: round(x / length), y: round(y / length) };
}

interface AxisPointerOptions {
  /** The `axis2d` action the drag drives. */
  action: string;
  origin: AxisOrigin;
  /** The share of the radius that reads as centred. */
  deadZone: number;
  /** The radius in px for an element of this size. */
  radiusFor: (box: DOMRect) => number;
  /** True while the game takes no input; a drag in progress lets go. */
  paused: boolean;
  /** Moves the knob, if the control draws one. */
  onKnob?: (x: number, y: number) => void;
}

/**
 * The pointer and keyboard handling a stick and a drag pad share. It follows
 * only the first finger to land, so a second finger works another control.
 * It sends the action's vector on every change and a zero vector on release,
 * when the window blurs or the page hides, when the game pauses, and on
 * unmount. The arrow keys drive it from a keyboard.
 *
 * @param options - The action, origin, dead zone and radius.
 * @returns The element's event handlers.
 */
export function useAxisPointer(options: AxisPointerOptions) {
  const sink = useActionSink();
  const optionsRef = useRef(options);
  const sinkRef = useRef(sink);
  const pointerRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const vectorRef = useRef<ActionVector>(ZERO);
  const keysRef = useRef<Set<string>>(new Set());

  const send = (next: ActionVector) => {
    const current = vectorRef.current;
    if (current.x === next.x && current.y === next.y) return;
    vectorRef.current = next;
    sinkRef.current?.(touchAxisInput(optionsRef.current.action, next));
  };
  const release = () => {
    pointerRef.current = null;
    keysRef.current.clear();
    optionsRef.current.onKnob?.(0, 0);
    send(ZERO);
  };
  const releaseRef = useRef(release);

  useEffect(() => {
    optionsRef.current = options;
    sinkRef.current = sink;
    releaseRef.current = release;
  });

  useEffect(() => {
    const release = () => releaseRef.current();
    const hidden = () => {
      if (document.visibilityState === "hidden") release();
    };
    window.addEventListener("blur", release);
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("pagehide", release);
      document.removeEventListener("visibilitychange", hidden);
      // A control that leaves mid-drag must not leave the game steering.
      release();
    };
  }, []);

  const { paused } = options;
  useEffect(() => {
    if (paused) releaseRef.current();
  }, [paused]);

  const follow = (element: HTMLElement, clientX: number, clientY: number) => {
    const { deadZone, radiusFor, onKnob } = optionsRef.current;
    const box = element.getBoundingClientRect();
    const radius = radiusFor(box);
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const length = Math.hypot(dx, dy);
    const reach = length > radius && length > 0 ? radius / length : 1;
    onKnob?.(dx * reach, dy * reach);
    send(axisVector(dx, dy, radius, deadZone));
  };

  return {
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (pointerRef.current !== null || optionsRef.current.paused) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      pointerRef.current = event.pointerId;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events have no capture; the drag still follows the pad.
      }
      const box = event.currentTarget.getBoundingClientRect();
      originRef.current =
        optionsRef.current.origin === "touch"
          ? { x: event.clientX, y: event.clientY }
          : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      triggerHaptic(8);
      follow(event.currentTarget, event.clientX, event.clientY);
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      if (event.pointerId !== pointerRef.current) return;
      follow(event.currentTarget, event.clientX, event.clientY);
    },
    onPointerUp(event: React.PointerEvent<HTMLElement>) {
      if (event.pointerId === pointerRef.current) releaseRef.current();
    },
    onPointerCancel(event: React.PointerEvent<HTMLElement>) {
      if (event.pointerId === pointerRef.current) releaseRef.current();
    },
    onLostPointerCapture(event: React.PointerEvent<HTMLElement>) {
      if (event.pointerId === pointerRef.current) releaseRef.current();
    },
    onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
      if (!(event.key in ARROWS) || optionsRef.current.paused) return;
      event.preventDefault();
      keysRef.current.add(event.key);
      send(arrowsVector(keysRef.current));
    },
    onKeyUp(event: React.KeyboardEvent<HTMLElement>) {
      if (!keysRef.current.delete(event.key)) return;
      send(arrowsVector(keysRef.current));
    },
    onContextMenu(event: React.MouseEvent<HTMLElement>) {
      event.preventDefault();
    },
  };
}

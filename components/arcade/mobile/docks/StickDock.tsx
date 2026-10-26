"use client";

import React, { useId, useRef } from "react";
import type { ActionMap } from "@/lib/arcade";
import { useAxisPointer, type AxisOrigin } from "./axis-pointer";
import {
  dockActionLabel,
  type DockSize,
  useDockHeight,
  useDockSize,
} from "./dock-kit";

/** The stick's diameter for each dock size, in px. */
const STICK_PX: Readonly<Record<DockSize, number>> = {
  sm: 112,
  md: 128,
  lg: 144,
};

/** Props for {@link StickDock}. */
export interface StickDockProps<A extends string> {
  /** The game's action map; the stick's name comes from it. */
  map: ActionMap<A>;
  /** The `axis2d` action the stick drives. */
  action: A;
  /**
   * `fixed` measures from the stick's centre. `floating` measures from where
   * the thumb lands, so a thumb that lands off centre does not start moving.
   * Defaults to `fixed`.
   */
  origin?: "fixed" | "floating";
  /** The share of the radius that reads as centred, 0 to 1. Defaults to 0.15. */
  deadZone?: number;
  /** Defaults to this device's key size, from the Setup sheet. */
  size?: DockSize;
  /** True while the game takes no input; a held stick lets go. */
  paused?: boolean;
  className?: string;
}

/**
 * A virtual analog stick (#2359). It sends its `axis2d` action as a vector,
 * phase `change`, as a gamepad stick does, and a zero vector on release. The
 * knob follows the thumb inside the rim. It follows one thumb; the other
 * thumb is free for the action keys. A keyboard drives it with the arrow
 * keys. It lets go on blur, on a hidden page, on pause and on unmount.
 *
 * @param props - The map, the action and the stick's feel.
 * @returns The stick.
 */
export function StickDock<A extends string>({
  map,
  action,
  origin = "fixed",
  deadZone = 0.15,
  size: sizeProp,
  paused = false,
  className = "",
}: StickDockProps<A>) {
  const size = useDockSize(sizeProp);
  const knobRef = useRef<HTMLSpanElement>(null);
  const hintId = useId();
  const dockRef = useDockHeight<HTMLDivElement>();
  const handlers = useAxisPointer({
    action,
    origin: (origin === "floating" ? "touch" : "center") as AxisOrigin,
    deadZone,
    paused,
    radiusFor: (box) => Math.min(box.width, box.height) / 2,
    onKnob: (x, y) => {
      const knob = knobRef.current;
      // Moved on the element, not through state: a drag is many moves a
      // second and none of them needs a render.
      if (knob) knob.style.transform = `translate(${x}px, ${y}px)`;
    },
  });
  const edge = STICK_PX[size];
  return (
    <div
      ref={dockRef}
      data-dock-preset="stick"
      data-dock-size={size}
      className={`flex items-center justify-center ${className}`}
    >
      <div
        role="group"
        tabIndex={0}
        aria-label={dockActionLabel(map, action)}
        aria-roledescription="stick"
        aria-describedby={hintId}
        data-testid="dock-stick"
        style={{ width: edge, height: edge }}
        className="relative flex touch-none select-none items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        {...handlers}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[22%] rounded-full border border-zinc-800"
        />
        <span
          ref={knobRef}
          aria-hidden="true"
          className="h-[42%] w-[42%] rounded-full border border-zinc-600 bg-zinc-700 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.9)]"
        />
        <span id={hintId} hidden>
          Drag to steer, or use the arrow keys.
        </span>
      </div>
    </div>
  );
}

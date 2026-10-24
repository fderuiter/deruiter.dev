"use client";

import React, { useId } from "react";
import type { ActionMap } from "@/lib/arcade";
import { useAxisPointer } from "./axis-pointer";
import { dockActionLabel, useDockHeight, type DockSize } from "./dock-kit";

/** The pad's minimum height for each dock size, in px. */
const PAD_MIN_PX: Readonly<Record<DockSize, number>> = {
  sm: 112,
  md: 128,
  lg: 144,
};

/** Props for {@link DragPad}. */
export interface DragPadProps<A extends string> {
  /** The game's action map; the pad's name comes from it. */
  map: ActionMap<A>;
  /** The `axis2d` action the pad drives. */
  action: A;
  /** The drag, in px, that reads as full tilt. Defaults to 48. */
  reach?: number;
  /** The share of `reach` that reads as still, 0 to 1. Defaults to 0.12. */
  deadZone?: number;
  /** Defaults to `md`. */
  size?: DockSize;
  /** True while the game takes no input; a drag in progress lets go. */
  paused?: boolean;
  className?: string;
}

/**
 * A relative drag pad for steering (#2359), as For Better or Bulk walks: a
 * thumb lands anywhere on the pad, and the direction and distance it slides
 * from there steer. It sends its `axis2d` action as a vector, phase
 * `change`, and a zero vector on release, blur, a hidden page, pause and
 * unmount. It follows one thumb. A keyboard drives it with the arrow keys.
 *
 * @param props - The map, the action and the pad's reach.
 * @returns The pad, filling its dock cell.
 */
export function DragPad<A extends string>({
  map,
  action,
  reach = 48,
  deadZone = 0.12,
  size = "md",
  paused = false,
  className = "",
}: DragPadProps<A>) {
  const hintId = useId();
  const dockRef = useDockHeight<HTMLDivElement>();
  const handlers = useAxisPointer({
    action,
    origin: "touch",
    deadZone,
    paused,
    radiusFor: () => reach,
  });
  return (
    <div
      ref={dockRef}
      data-dock-preset="drag-pad"
      data-dock-size={size}
      className={`flex h-full w-full ${className}`}
    >
      <div
        role="group"
        tabIndex={0}
        aria-label={dockActionLabel(map, action)}
        aria-roledescription="drag pad"
        aria-describedby={hintId}
        data-testid="dock-drag-pad"
        style={{ minHeight: PAD_MIN_PX[size] }}
        className="flex h-full w-full touch-none select-none items-end justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        {...handlers}
      >
        <span aria-hidden="true" className="font-mono text-xs text-zinc-400">
          {dockActionLabel(map, action)}
        </span>
        <span id={hintId} hidden>
          Drag from anywhere on the pad to steer, or use the arrow keys.
        </span>
      </div>
    </div>
  );
}

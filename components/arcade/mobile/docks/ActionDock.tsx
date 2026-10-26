"use client";

import React from "react";
import {
  DockFrame,
  type Handedness,
} from "@/components/arcade/mobile/DockFrame";

/** Props for {@link ActionDock}. */
export interface ActionDockProps {
  /** The movement preset: a d-pad, a stick or a drag pad. */
  move?: React.ReactNode;
  /** The action preset: a cluster, a strip or a hold button. */
  actions?: React.ReactNode;
  /** Which thumb works the actions. Defaults to this device's hand. */
  handedness?: Handedness;
  className?: string;
}

/**
 * The common dock (#2359): movement under one thumb and actions under the
 * other, swapped for a left-handed player through `DockFrame`. Inside
 * PhoneStage or TabletStage, pass the presets to the `moveDock` and
 * `actionDock` slots instead; the stage already follows handedness.
 *
 * @param props - The two presets and the hand.
 * @returns The dock row.
 */
export function ActionDock({
  move,
  actions,
  handedness,
  className = "",
}: ActionDockProps) {
  return (
    <DockFrame
      handedness={handedness}
      className={`items-end px-2 pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <div data-dock-side="move" className="flex min-w-0 items-end">
        {move}
      </div>
      <div data-dock-side="actions" className="flex min-w-0 items-end">
        {actions}
      </div>
    </DockFrame>
  );
}

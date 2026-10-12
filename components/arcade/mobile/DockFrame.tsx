"use client";

import React from "react";

/**
 * The dominant hand. `right` keeps the movement group on the left and the
 * action group on the right. `left` mirrors the two groups, so the actions
 * sit under the left thumb.
 */
export type Handedness = "left" | "right";

export interface DockFrameProps {
  /** Which thumb works the actions. Defaults to `right`. */
  handedness?: Handedness;
  /** Pass the movement dock first and the action dock second. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Lays two control docks side by side and flips their order for left-handed
 * players. It only reorders; the docks keep their own markup and sizes, so it
 * wraps `DpadActionDock`, `TwinStickAimDock` and the rest without changes.
 */
export const DockFrame: React.FC<DockFrameProps> = ({
  handedness = "right",
  children,
  className = "",
}) => (
  <div
    data-handedness={handedness}
    className={`flex w-full items-end justify-between gap-3 ${
      handedness === "left" ? "flex-row-reverse" : "flex-row"
    } ${className}`}
  >
    {children}
  </div>
);

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
 * Lays docks out in a row and flips their order for left-handed players. It
 * only reorders; the docks keep their own markup and sizes. Docks stretch to
 * the row's height, so a middle child (a playfield) can take the space between
 * them, and each dock centres itself in its own column.
 */
export const DockFrame: React.FC<DockFrameProps> = ({
  handedness = "right",
  children,
  className = "",
}) => (
  <div
    data-handedness={handedness}
    className={`flex w-full items-stretch justify-between gap-1 ${
      handedness === "left" ? "flex-row-reverse" : "flex-row"
    } ${className}`}
  >
    {children}
  </div>
);

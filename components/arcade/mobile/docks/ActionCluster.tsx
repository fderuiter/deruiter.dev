"use client";

import React from "react";
import { TouchButton } from "@/components/arcade/mobile/TouchButton";
import type { Handedness } from "@/components/arcade/mobile/DockFrame";
import type { ActionMap } from "@/lib/arcade";
import {
  DOCK_KEY_CLASS,
  DOCK_KEY_STYLE,
  dockActionLabel,
  type DockSize,
  useDockHandedness,
  useDockHeight,
  useDockSize,
} from "./dock-kit";

/** The most face buttons a cluster holds. */
export const ACTION_CLUSTER_MAX = 4;

/** Props for {@link ActionCluster}. */
export interface ActionClusterProps<A extends string> {
  map: ActionMap<A>;
  /** One to four actions, the primary first. Extra actions are dropped. */
  actions: readonly A[];
  /** An icon per action, drawn above its label. */
  icons?: Partial<Record<A, React.ReactNode>>;
  /** Which thumb works the cluster. Defaults to this device's hand. */
  handedness?: Handedness;
  /** Defaults to this device's key size, from the Setup sheet. */
  size?: DockSize;
  /** Actions that cannot act now, such as a tool out of ammo. */
  disabled?: Partial<Record<A, boolean>>;
  className?: string;
}

// Face-button slots in a 3x3 grid, as on a gamepad: the primary at the
// bottom, nearest the thumb's rest, then the side toward the thumb, the side
// away from it, and the top. [row, column] for a right thumb.
const SLOTS: readonly (readonly [number, number])[] = [
  [3, 2],
  [2, 3],
  [2, 1],
  [1, 2],
];

/**
 * One to four face buttons in a thumb arc (#2359). Each sends its action to
 * the nearest `ActionSinkProvider` on press and release, is named by the
 * action's label, takes its own finger, and works with Enter and Space. For
 * a left thumb the arc mirrors, so the second action still sits toward the
 * thumb.
 *
 * @param props - The map, the actions and the cluster's hand and size.
 * @returns The cluster.
 */
export function ActionCluster<A extends string>({
  map,
  actions,
  icons = {},
  handedness: handednessProp,
  size: sizeProp,
  disabled = {},
  className = "",
}: ActionClusterProps<A>) {
  const size = useDockSize(sizeProp);
  const handedness = useDockHandedness(handednessProp);
  const dockRef = useDockHeight<HTMLDivElement>();
  const shown = actions.slice(0, ACTION_CLUSTER_MAX);
  const single = shown.length === 1;
  return (
    <div
      ref={dockRef}
      role="group"
      aria-label="Actions"
      data-dock-preset="cluster"
      data-dock-size={size}
      data-handedness={handedness}
      className={`grid w-max touch-none select-none gap-1 ${
        single ? "grid-cols-1" : "grid-cols-3 grid-rows-3"
      } ${className}`}
    >
      {shown.map((action, index) => {
        const [row, column] = SLOTS[index];
        const label = dockActionLabel(map, action);
        return (
          <TouchButton
            key={action}
            action={action}
            label={label}
            disabled={disabled[action]}
            data-dock-action={action}
            style={
              single
                ? undefined
                : {
                    gridRow: row,
                    gridColumn: handedness === "left" ? 4 - column : column,
                  }
            }
            className={`${DOCK_KEY_CLASS[size]} ${DOCK_KEY_STYLE} flex-col gap-0.5 rounded-full disabled:opacity-40`}
          >
            {icons[action] && (
              <span aria-hidden="true" className="inline-flex">
                {icons[action]}
              </span>
            )}
            <span className="max-w-full truncate px-1 text-xs leading-none">
              {label}
            </span>
          </TouchButton>
        );
      })}
    </div>
  );
}

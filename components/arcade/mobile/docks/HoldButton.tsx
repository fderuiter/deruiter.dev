"use client";

import React, { useState } from "react";
import { TouchButton } from "@/components/arcade/mobile/TouchButton";
import type { ActionMap } from "@/lib/arcade";
import {
  DOCK_KEY_PX,
  DOCK_KEY_STYLE,
  dockActionLabel,
  type DockSize,
  useDockHeight,
  useDockSize,
} from "./dock-kit";

/** Props for {@link HoldButton}. */
export interface HoldButtonProps<A extends string> {
  map: ActionMap<A>;
  /** The `hold` (or `press`) action. */
  action: A;
  /** Drawn before the label. */
  icon?: React.ReactNode;
  /** Defaults to this device's key size, from the Setup sheet. */
  size?: DockSize;
  className?: string;
}

/**
 * One large key for a hold action (#2359), such as charge or brake: down
 * while a finger rests on it, up when the last finger lifts, the window
 * blurs or the page hides. It is twice a key wide, named by the action's
 * label, and works with Enter and Space.
 *
 * @param props - The map, the action and the size.
 * @returns The button.
 */
export function HoldButton<A extends string>({
  map,
  action,
  icon,
  size: sizeProp,
  className = "",
}: HoldButtonProps<A>) {
  const size = useDockSize(sizeProp);
  const dockRef = useDockHeight<HTMLDivElement>();
  const [held, setHeld] = useState(false);
  const edge = DOCK_KEY_PX[size];
  const label = dockActionLabel(map, action);
  return (
    <div
      ref={dockRef}
      data-dock-preset="hold"
      data-dock-size={size}
      className={`flex ${className}`}
    >
      <TouchButton
        action={action}
        label={label}
        data-dock-action={action}
        data-held={held ? "" : undefined}
        onPress={() => setHeld(true)}
        onRelease={() => setHeld(false)}
        style={{ height: edge, minWidth: edge * 2 }}
        className={`${DOCK_KEY_STYLE} gap-1.5 px-3 data-[held]:border-amber-400 data-[held]:bg-amber-500/25 data-[held]:text-amber-100`}
      >
        {icon && (
          <span aria-hidden="true" className="inline-flex">
            {icon}
          </span>
        )}
        <span>{label}</span>
      </TouchButton>
    </div>
  );
}

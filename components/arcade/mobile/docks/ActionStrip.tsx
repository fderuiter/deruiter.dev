"use client";

import React, { useState } from "react";
import { IconDots } from "@tabler/icons-react";
import { TouchButton } from "@/components/arcade/mobile/TouchButton";
import { BottomSheet } from "@/components/arcade/mobile/ui";
import { touchActionInput, useActionSink, type ActionMap } from "@/lib/arcade";
import {
  DOCK_KEY_PX,
  DOCK_KEY_STYLE,
  dockActionLabel,
  type DockSize,
  useDockHeight,
  useDockSize,
} from "./dock-kit";

/** Props for {@link ActionStrip}. */
export interface ActionStripProps<A extends string> {
  map: ActionMap<A>;
  /** The actions, most used first. */
  actions: readonly A[];
  /**
   * The most keys in the row. When there are more actions, the last key is
   * "More", which opens a sheet with the rest. Defaults to 4.
   */
  max?: number;
  /** An icon per action, drawn before its label. */
  icons?: Partial<Record<A, React.ReactNode>>;
  /** Defaults to this device's key size, from the Setup sheet. */
  size?: DockSize;
  className?: string;
}

/**
 * A row of action keys (#2359), each named by its action's label, each its
 * own hold so several fingers work at once, with Enter and Space from a
 * keyboard. Actions past `max` go into a "More" sheet; a key there sends its
 * action's press and release on tap and closes the sheet.
 *
 * @param props - The map, the actions and the row's size.
 * @returns The strip.
 */
export function ActionStrip<A extends string>({
  map,
  actions,
  max = 4,
  icons = {},
  size: sizeProp,
  className = "",
}: ActionStripProps<A>) {
  const size = useDockSize(sizeProp);
  const dockRef = useDockHeight<HTMLDivElement>();
  const sink = useActionSink();
  const [moreOpen, setMoreOpen] = useState(false);
  const overflow = actions.length > max;
  const shown = overflow ? actions.slice(0, Math.max(0, max - 1)) : actions;
  const rest = overflow ? actions.slice(shown.length) : [];
  const edge = DOCK_KEY_PX[size];
  const keyStyle = { height: edge, minWidth: edge };

  return (
    <div
      ref={dockRef}
      role="group"
      aria-label="Actions"
      data-dock-preset="strip"
      data-dock-size={size}
      className={`flex w-full min-w-0 touch-none select-none items-stretch gap-1 ${className}`}
    >
      {shown.map((action) => {
        const label = dockActionLabel(map, action);
        return (
          <TouchButton
            key={action}
            action={action}
            label={label}
            data-dock-action={action}
            style={keyStyle}
            className={`${DOCK_KEY_STYLE} min-w-0 flex-1 gap-1 px-2`}
          >
            {icons[action] && (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {icons[action]}
              </span>
            )}
            <span className="truncate">{label}</span>
          </TouchButton>
        );
      })}
      {overflow && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
          onMouseDown={(event) => event.preventDefault()}
          style={keyStyle}
          className={`${DOCK_KEY_STYLE} min-w-0 flex-1 gap-1 px-2 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
        >
          <IconDots className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>More</span>
        </button>
      )}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More actions"
        initialSnap="peek"
        testId="dock-more-sheet"
      >
        <div className="grid grid-cols-2 gap-2">
          {rest.map((action) => (
            <button
              key={action}
              type="button"
              data-dock-action={action}
              onClick={() => {
                sink?.(touchActionInput(action, "down"));
                sink?.(touchActionInput(action, "up"));
                setMoreOpen(false);
              }}
              className={`${DOCK_KEY_STYLE} min-h-12 gap-1.5 px-3 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
            >
              {icons[action] && (
                <span aria-hidden="true" className="inline-flex">
                  {icons[action]}
                </span>
              )}
              {dockActionLabel(map, action)}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

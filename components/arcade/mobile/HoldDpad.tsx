"use client";

import React, { useEffect, useRef } from "react";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
} from "@tabler/icons-react";
import { TouchButton } from "@/components/arcade/mobile/TouchButton";
import { useHoldRepeat } from "@/components/arcade/mobile/useHoldRepeat";
import type { SwipeDirection } from "@/components/arcade/mobile/swipe";
import { touchActionInput, useActionSink } from "@/lib/arcade";

export interface HoldDpadProps {
  /** Moves one step in a direction. Called on press and again while held. */
  onMove?: (direction: SwipeDirection) => void;
  /**
   * The action each arrow performs (#2356). A press sends it to the nearest
   * `ActionSinkProvider`, and each step of a hold sends it again marked as a
   * repeat, the way a held key does. `onMove` still runs alongside.
   */
  actions?: Partial<Record<SwipeDirection, string>>;
  className?: string;
  /**
   * Keys at the 44px touch floor instead of 48px, for a dock that is short
   * of width. The default is the comfortable 48px.
   */
  compact?: boolean;
  /**
   * Keys fill their dock cell, and on a portrait tablet (600px and up) they
   * take the dock's --touch-key size in a tight cluster instead.
   */
  large?: boolean;
  /**
   * True while the game is not taking moves (paused, or an options sheet is
   * open). Any repeat in progress is released at once.
   */
  paused?: boolean;
  /**
   * The arrows to draw. Defaults to all four. A game that steers on one axis
   * passes just that pair, so no arrow is drawn that does nothing.
   */
  directions?: readonly SwipeDirection[];
}

const DIRECTION_LABEL: Record<SwipeDirection, string> = {
  up: "Move Up",
  down: "Move Down",
  left: "Move Left",
  right: "Move Right",
};

const DIRECTION_ICON: Record<
  SwipeDirection,
  React.FC<{ className?: string }>
> = {
  up: IconArrowUp,
  down: IconArrowDown,
  left: IconArrowLeft,
  right: IconArrowRight,
};

// Grid cells for a 3x3 pad: the centre cell is the hub, not a control.
const CELLS: ({ dir: SwipeDirection } | null)[] = [
  null,
  { dir: "up" },
  null,
  { dir: "left" },
  null,
  { dir: "right" },
  null,
  { dir: "down" },
  null,
];

/**
 * The key's size. Large keys fill their cell of a height-filling pad, so the
 * pad takes the whole dock. Otherwise 44px when compact, else 48px.
 */
function keySize(compact: boolean, large: boolean): string {
  // A tablet's dock sets --touch-key (96 to 120px); without it, the key fills
  // its cell as before.
  if (large) return "h-[var(--touch-key,100%)] w-[var(--touch-key,100%)]";
  return compact ? "h-11 w-11" : "h-12 w-12";
}

function DirectionButton({
  direction,
  onMove,
  action,
  compact,
  large,
  paused,
}: {
  direction: SwipeDirection;
  onMove?: (direction: SwipeDirection) => void;
  action?: string;
  compact: boolean;
  large: boolean;
  paused: boolean;
}) {
  const sink = useActionSink();
  // The first step of a hold is the press; the steps after it are repeats.
  const repeatingRef = useRef(false);
  const repeat = useHoldRepeat(() => {
    if (action && sink) {
      sink(touchActionInput(action, "down", repeatingRef.current));
    }
    repeatingRef.current = true;
    onMove?.(direction);
  });
  useEffect(() => {
    if (paused) repeat.stop();
  }, [paused, repeat]);
  const Icon = DIRECTION_ICON[direction];
  return (
    <TouchButton
      label={DIRECTION_LABEL[direction]}
      onPress={() => {
        repeatingRef.current = false;
        repeat.start();
      }}
      onRelease={() => {
        repeat.stop();
        if (action && sink) sink(touchActionInput(action, "up"));
      }}
      className={`flex ${keySize(compact, large)} items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/90 text-zinc-200 focus-visible:ring-amber-400 active:bg-cyan-500/30 active:text-cyan-300`}
    >
      <Icon
        className={`${large ? "min-[480px]:h-[calc(var(--touch-key,80px)*0.3)] min-[480px]:w-[calc(var(--touch-key,80px)*0.3)] " : ""}h-6 w-6`}
        aria-hidden="true"
      />
    </TouchButton>
  );
}

/**
 * A 3x3 directional pad for a grid game. Pressing a direction takes one step
 * at once; holding it repeats at the keyboard's pace until release, so a hold
 * walks a corridor. Each arrow is its own hold, so a finger on Move Up and a
 * finger on an action button both register at once.
 */
export const HoldDpad: React.FC<HoldDpadProps> = ({
  onMove,
  actions,
  className = "",
  compact = false,
  large = false,
  paused = false,
  directions,
}) => (
  <div
    role="group"
    aria-label="Directional pad"
    data-hold-dpad=""
    className={`grid grid-cols-3 gap-1 touch-none select-none ${
      large
        ? "h-full grid-rows-3 min-[480px]:h-auto min-[480px]:w-max min-[480px]:grid-rows-none min-[480px]:gap-2"
        : ""
    } ${className}`}
  >
    {CELLS.map((cell, index) =>
      cell && (!directions || directions.includes(cell.dir)) ? (
        <DirectionButton
          key={cell.dir}
          direction={cell.dir}
          onMove={onMove}
          action={actions?.[cell.dir]}
          compact={compact}
          large={large}
          paused={paused}
        />
      ) : (
        <div
          key={`hub-${index}`}
          aria-hidden="true"
          className={keySize(compact, large)}
        />
      )
    )}
  </div>
);

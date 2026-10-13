"use client";

import React, { useEffect } from "react";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
} from "@tabler/icons-react";
import { TouchButton } from "@/components/arcade/mobile/TouchButton";
import { useHoldRepeat } from "@/components/arcade/mobile/useHoldRepeat";
import type { SwipeDirection } from "@/components/arcade/mobile/swipe";

export interface HoldDpadProps {
  /** Moves one step in a direction. Called on press and again while held. */
  onMove: (direction: SwipeDirection) => void;
  className?: string;
  /**
   * Keys at the 44px touch floor instead of 48px, for a dock that is short
   * of width. The default is the comfortable 48px.
   */
  compact?: boolean;
  /** Keys at 80px, for a portrait tablet whose lower dock has the room. */
  large?: boolean;
  /**
   * True while the game is not taking moves (paused, or an options sheet is
   * open). Any repeat in progress is released at once.
   */
  paused?: boolean;
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

/** The key's square size: 80px when large, 44px when compact, else 48px. */
function keySize(compact: boolean, large: boolean): string {
  if (large) return "h-20 w-20";
  return compact ? "h-11 w-11" : "h-12 w-12";
}

function DirectionButton({
  direction,
  onMove,
  compact,
  large,
  paused,
}: {
  direction: SwipeDirection;
  onMove: (direction: SwipeDirection) => void;
  compact: boolean;
  large: boolean;
  paused: boolean;
}) {
  const repeat = useHoldRepeat(() => onMove(direction));
  useEffect(() => {
    if (paused) repeat.stop();
  }, [paused, repeat]);
  const Icon = DIRECTION_ICON[direction];
  return (
    <TouchButton
      label={DIRECTION_LABEL[direction]}
      onPress={() => repeat.start()}
      onRelease={() => repeat.stop()}
      className={`flex ${keySize(compact, large)} items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/90 text-zinc-200 focus-visible:ring-cyan-400 active:bg-cyan-500/30 active:text-cyan-300`}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
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
  className = "",
  compact = false,
  large = false,
  paused = false,
}) => (
  <div
    role="group"
    aria-label="Directional pad"
    data-hold-dpad=""
    className={`grid grid-cols-3 gap-1 touch-none select-none ${className}`}
  >
    {CELLS.map((cell, index) =>
      cell ? (
        <DirectionButton
          key={cell.dir}
          direction={cell.dir}
          onMove={onMove}
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

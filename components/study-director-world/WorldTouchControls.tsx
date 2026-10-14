"use client";

import React from "react";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
} from "@tabler/icons-react";
import {
  TouchButton,
  TouchControlsGate,
  useHoldRepeat,
} from "@/components/arcade/mobile";
import type { Facing } from "@/lib/study-director-world";

const ARROWS: Array<{
  dir: Facing;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { dir: "left", label: "Walk left", Icon: IconArrowLeft },
  { dir: "up", label: "Walk up", Icon: IconArrowUp },
  { dir: "down", label: "Walk down", Icon: IconArrowDown },
  { dir: "right", label: "Walk right", Icon: IconArrowRight },
];

const KEY =
  "flex h-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/90 font-mono text-xs font-bold text-zinc-100 active:bg-amber-500/30 disabled:opacity-40 focus-visible:ring-amber-400";

const ArrowKey: React.FC<{
  label: string;
  Icon: React.FC<{ className?: string }>;
  disabled: boolean;
  onStep: () => void;
}> = ({ label, Icon, disabled, onStep }) => {
  // A hold walks at the keyboard's pace; the tick reads the latest world.
  const repeat = useHoldRepeat(onStep);
  return (
    <TouchButton
      label={label}
      disabled={disabled}
      onPress={() => repeat.start()}
      onRelease={() => repeat.stop()}
      className={`${KEY} w-12`}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </TouchButton>
  );
};

/**
 * The office's on-screen keys for a touch cabinet (#2076): four arrows that
 * walk a tile and repeat while held, E (use what you face, or talk) and F (ask
 * yourself how it is going). Tapping the floor walks too; these are for the
 * last tile and for the two actions. They hide while a keyboard is in use.
 */
export const WorldTouchControls: React.FC<{
  disabled: boolean;
  /** What E would do now, such as "Talk to Maya", or null when nothing is faced. */
  action: string | null;
  onMove: (dir: Facing) => void;
  onUse: () => void;
  onSelf: () => void;
}> = ({ disabled, action, onMove, onUse, onSelf }) => (
  <TouchControlsGate>
    <div
      role="group"
      aria-label="Walking controls"
      data-testid="world-touch-controls"
      className="flex min-w-0 items-center justify-between gap-2 pt-1 font-mono"
    >
      <div className="flex shrink-0 gap-1.5">
        {ARROWS.map(({ dir, label, Icon }) => (
          <ArrowKey
            key={dir}
            label={label}
            Icon={Icon}
            disabled={disabled}
            onStep={() => onMove(dir)}
          />
        ))}
      </div>
      <div className="flex min-w-0 gap-1.5">
        <TouchButton
          label="Use or talk (E)"
          disabled={disabled}
          onPress={onUse}
          className={`${KEY} min-w-0 gap-2 px-3 ${action ? "border-amber-500/70 text-amber-300" : ""}`}
        >
          <span aria-hidden="true" className="border border-current px-1.5">
            E
          </span>
          <span
            className="line-clamp-2 min-w-0 break-words text-left leading-tight"
            data-testid="world-use-label"
          >
            {action ?? "Use / talk"}
          </span>
        </TouchButton>
        <TouchButton
          label="How are you? (F)"
          disabled={disabled}
          onPress={onSelf}
          className={`${KEY} gap-2 px-3`}
        >
          <span aria-hidden="true" className="border border-current px-1.5">
            F
          </span>
          <span>How are you?</span>
        </TouchButton>
      </div>
    </div>
  </TouchControlsGate>
);

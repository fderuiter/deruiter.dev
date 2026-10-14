"use client";

import React from "react";
import {
  IconBook,
  IconVolume,
  IconVolumeOff,
  IconX,
} from "@tabler/icons-react";
import { FieldManualButton } from "@/components/FieldManualButton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { LaserMode } from "@/lib/laser-loon";

const MODES: ReadonlyArray<{ mode: LaserMode; label: string }> = [
  { mode: "campaign", label: "Campaign" },
  { mode: "arcade", label: "Arcade Survival" },
  { mode: "sandbox", label: "Zero-G Sandbox" },
];

interface TouchMenuSheetProps {
  mode: LaserMode;
  soundEnabled: boolean;
  screenShakeEnabled: boolean;
  onMode: (mode: LaserMode) => void;
  onMuseum: () => void;
  onManualOpenChange: (open: boolean) => void;
  onToggleSound: () => void;
  onToggleShake: () => void;
  onClose: () => void;
}

const ROW =
  "ll-sheet-button inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 font-mono text-xs font-bold text-neutral-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400";

/**
 * The Laser Loon menu for the touch cabinet (#2081): the three game modes, the
 * Flag Museum, the Field Manual and the audio and shake switches that the
 * desktop keeps in a collapsed panel above the arena and a strip under it. It
 * is a bottom sheet inside the arena, so it needs no page room, and it traps
 * focus; Escape closes it and leaves the cabinet open.
 *
 * @param props - The current settings and the handlers for each row.
 * @returns The sheet.
 */
export function TouchMenuSheet({
  mode,
  soundEnabled,
  screenShakeEnabled,
  onMode,
  onMuseum,
  onManualOpenChange,
  onToggleSound,
  onToggleShake,
  onClose,
}: TouchMenuSheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, { onEscape: onClose });
  return (
    <div
      data-testid="loon-menu-sheet-backdrop"
      className="ll-sheet-backdrop absolute inset-0 z-40 flex items-end justify-center bg-black/70 select-none"
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="laser-loon-menu-title"
        data-testid="loon-menu-sheet"
        className="ll-sheet w-full max-w-xl overflow-y-auto rounded-t-3xl border border-neutral-700 bg-neutral-950 p-4 font-mono shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="laser-loon-menu-title"
            className="text-lg font-bold tracking-tight text-white"
          >
            Laser Loon menu
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ll-sheet-button inline-flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <IconX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div
          role="group"
          aria-label="Game mode"
          className="mt-3 grid grid-cols-3 gap-2"
        >
          {MODES.map((entry) => (
            <button
              key={entry.mode}
              type="button"
              aria-pressed={mode === entry.mode}
              onClick={() => onMode(entry.mode)}
              className={`ll-sheet-button rounded-xl border px-2 text-xs font-bold active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                mode === entry.mode
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-neutral-700 bg-neutral-900 text-neutral-200"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onMuseum}
            className={`${ROW} min-h-12`}
          >
            <IconBook className="h-4 w-4 text-amber-300" aria-hidden="true" />
            <span>Flag Museum</span>
          </button>
          <FieldManualButton
            manualId="laser-loon"
            label="Manual"
            variant="inline"
            onOpenChange={onManualOpenChange}
            className="ll-sheet-button w-full"
          />
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
            className={ROW}
          >
            {soundEnabled ? (
              <IconVolume className="h-4 w-4 text-red-400" aria-hidden="true" />
            ) : (
              <IconVolumeOff className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Audio: {soundEnabled ? "On" : "Muted"}</span>
          </button>
          <button
            type="button"
            onClick={onToggleShake}
            aria-pressed={screenShakeEnabled}
            className={ROW}
          >
            <span>Screen shake: {screenShakeEnabled ? "On" : "Off"}</span>
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-neutral-300">
          Drag on the arena to aim and steer. Hold Fire to shoot. Keys 1 to 4
          pick the optic, and Tremolo clears the screen once it is charged. With
          a keyboard: WASD or arrows fly, Space fires, U Tremolo, M museum, P
          pause.
        </p>
      </div>
    </div>
  );
}

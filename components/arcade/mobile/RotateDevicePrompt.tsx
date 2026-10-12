"use client";

import React from "react";
import { IconDeviceMobileRotated } from "@tabler/icons-react";
import {
  useOrientationMismatch,
  type LockedOrientation,
} from "@/components/arcade/mobile/orientation";

export interface RotateDevicePromptProps {
  /** The orientation the game is designed for. */
  target: LockedOrientation;
  /** Lets the player leave the cabinet without turning the phone. */
  onExit?: () => void;
}

/**
 * Covers the immersive cabinet while the phone is held against the game's
 * declared orientation. Renders nothing once the device matches. The cabinet
 * renders it only on touch devices, and it never appears for `either` games.
 * It reuses the rotate icon from `TabletOrientationHint`, which is a dismissible
 * banner for the hub and not a blocking overlay.
 */
export const RotateDevicePrompt: React.FC<RotateDevicePromptProps> = ({
  target,
  onExit,
}) => {
  const mismatch = useOrientationMismatch(target);
  if (!mismatch) return null;

  return (
    <div
      role="status"
      data-testid="rotate-device-prompt"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/95 p-6 text-center font-mono text-zinc-200"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <IconDeviceMobileRotated
        className="h-12 w-12 text-amber-400 motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <p className="max-w-xs text-sm leading-relaxed">
        Turn your phone to {target} to play this cabinet.
      </p>
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-300 touch-manipulation active:scale-[0.98]"
        >
          Leave cabinet
        </button>
      )}
    </div>
  );
};

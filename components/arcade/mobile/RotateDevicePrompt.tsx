"use client";

import React, { useEffect, useId, useRef } from "react";
import { IconDeviceMobileRotated } from "@tabler/icons-react";
import type { LockedOrientation } from "@/components/arcade/mobile/orientation";

export interface RotateDevicePromptProps {
  /** The orientation the game is designed for. */
  target: LockedOrientation;
  /** Lets the player leave the cabinet without turning the phone. */
  onExit?: () => void;
}

/**
 * The blocking prompt shown while a phone is held against the game's declared
 * orientation. PlayCabinet decides when to render it and makes the rest of the
 * cabinet inert. Here it is an alertdialog that takes focus on show, on its
 * "Leave cabinet" button, and gives focus back to the element that had it when
 * it is removed. It only renders when the device is mismatched, so it does not
 * check the orientation itself. It reuses the rotate icon from
 * `TabletOrientationHint`, a dismissible hub banner rather than a blocking one.
 */
export const RotateDevicePrompt: React.FC<RotateDevicePromptProps> = ({
  target,
  onExit,
}) => {
  const titleId = useId();
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    exitRef.current?.focus({ preventScroll: true });
    return () => {
      if (
        previous &&
        previous.isConnected &&
        typeof previous.focus === "function"
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="rotate-device-prompt"
      data-rotate-prompt=""
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
      <p id={titleId} className="max-w-xs text-sm leading-relaxed">
        Turn your phone to {target} to play this cabinet.
      </p>
      {onExit && (
        <button
          ref={exitRef}
          type="button"
          onClick={onExit}
          className="min-h-[44px] min-w-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-300 touch-manipulation motion-safe:active:scale-[0.98]"
        >
          Leave cabinet
        </button>
      )}
    </div>
  );
};

"use client";

import React, { useContext } from "react";
import { CabinetFullscreenContext } from "./CabinetFullscreen";
import { IconMaximize, IconMinimize } from "@tabler/icons-react";

interface FullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
  variant?: "header" | "floating" | "icon";
  className?: string;
  /**
   * True when `isFullscreen` reflects the CSS-overlay fallback rather than
   * the real Fullscreen API (always the case on iPhone Safari, which never
   * exposes `requestFullscreen` on arbitrary elements). Surfaced only as a
   * label suffix so screen-reader users and anyone debugging a device
   * report aren't left guessing why fullscreen looks/behaves differently.
   */
  isPseudoFullscreen?: boolean;
}

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({
  isFullscreen,
  onToggle,
  variant = "header",
  className = "",
  isPseudoFullscreen = false,
}) => {
  const cabinetFullscreen = useContext(CabinetFullscreenContext);
  if (cabinetFullscreen) return null;

  const compatibilitySuffix =
    isFullscreen && isPseudoFullscreen ? " (Compatibility Mode)" : "";

  if (variant === "floating") {
    if (!isFullscreen) return null;
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Exit Fullscreen${compatibilitySuffix} (Esc or F)`}
        title={`Exit Fullscreen${compatibilitySuffix} (Esc or F)`}
        className={`absolute top-3 right-3 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl bg-black/85 hover:bg-black text-zinc-300 hover:text-white border border-zinc-700/80 shadow-2xl backdrop-blur-md transition-all touch-manipulation select-none active:scale-[0.98] cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none ${className}`}
      >
        <IconMinimize className="w-5 h-5 text-amber-400" />
      </button>
    );
  }

  if (variant === "icon") {
    const label = isFullscreen
      ? `Exit Fullscreen${compatibilitySuffix}`
      : "Enter Fullscreen";
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        title={label}
        className={`h-12 w-12 inline-flex items-center justify-center rounded-xl border transition-all cursor-pointer touch-manipulation select-none active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none ${
          isFullscreen
            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
            : "bg-neutral-900/90 hover:bg-neutral-800 text-zinc-300 border-neutral-800"
        } ${className}`}
      >
        {isFullscreen ? (
          <IconMinimize className="w-4 h-4" aria-hidden="true" />
        ) : (
          <IconMaximize className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        isFullscreen
          ? `Exit Fullscreen${compatibilitySuffix} (F)`
          : "Enter Fullscreen (F)"
      }
      title={
        isFullscreen
          ? `Exit Fullscreen${compatibilitySuffix} (F)`
          : "Enter Fullscreen (F)"
      }
      className={`min-h-12 min-w-12 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:outline-none ${
        isFullscreen
          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
          : "bg-neutral-900/90 hover:bg-neutral-800 text-zinc-300 hover:text-white border border-neutral-800 hover:border-zinc-700 shadow-sm"
      } ${className}`}
    >
      {isFullscreen ? (
        <>
          <IconMinimize className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline font-bold">Exit Fullscreen</span>
        </>
      ) : (
        <>
          <IconMaximize className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden sm:inline font-bold">Fullscreen</span>
        </>
      )}
    </button>
  );
};

"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAudio } from "@/components/providers/AudioProvider";
import {
  IconChevronUp,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";

/* jscpd:ignore-start */
export interface VirtualDPadProps {
  onDirectionPress?: (direction: "up" | "down" | "left" | "right") => void;
  onDirectionRelease?: (direction: "up" | "down" | "left" | "right") => void;
  onActionAPress?: () => void;
  onActionARelease?: () => void;
  onActionBPress?: () => void;
  onActionBRelease?: () => void;
  actionALabel?: string;
  actionBLabel?: string;
  actionASubtitle?: string;
  actionBSubtitle?: string;
  className?: string;
}

export const VirtualDPad: React.FC<VirtualDPadProps> = ({
  onDirectionPress,
  onDirectionRelease,
  onActionAPress,
  onActionARelease,
  onActionBPress,
  onActionBRelease,
  actionALabel = "ACTION",
  actionBLabel = "SWAP",
  actionASubtitle = "SPACE",
  actionBSubtitle = "E",
  className,
}) => {
  const { playNote } = useAudio();
  const activeTouchesRef = useRef<Map<string, number>>(new Map());

  const handlePress = useCallback(
    (action: (() => void) | undefined, e: React.TouchEvent | React.MouseEvent, id: string) => {
      e.preventDefault();
      try {
        if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
          navigator.vibrate(15);
        }
      } catch {
        // Fallback gracefully if vibration is not permitted
      }
      playNote(880, 0.02);
      action?.();
      activeTouchesRef.current.set(id, Date.now());
    },
    [playNote]
  );

  const handleRelease = useCallback(
    (releaseAction: (() => void) | undefined, e: React.TouchEvent | React.MouseEvent, id: string) => {
      e.preventDefault();
      releaseAction?.();
      activeTouchesRef.current.delete(id);
    },
    []
  );

  return (
    <div
      role="group"
      aria-label="Virtual Game Controller"
      className={cn(
        "w-full flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/80 backdrop-blur-xl select-none touch-none",
        className
      )}
      style={{ touchAction: "none" }}
    >
      {/* 4-Way Directional Pad */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Cross center backing */}
        <div className="absolute w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800/60 pointer-events-none" />

        {/* Up Button */}
        <button
          type="button"
          aria-label="Move Up"
          onTouchStart={(e) => handlePress(() => onDirectionPress?.("up"), e, "up")}
          onTouchEnd={(e) => handleRelease(() => onDirectionRelease?.("up"), e, "up")}
          onMouseDown={(e) => handlePress(() => onDirectionPress?.("up"), e, "up")}
          onMouseUp={(e) => handleRelease(() => onDirectionRelease?.("up"), e, "up")}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-t-xl bg-zinc-900/90 border-t border-x border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
        >
          <IconChevronUp className="w-6 h-6 pointer-events-none" />
        </button>

        {/* Down Button */}
        <button
          type="button"
          aria-label="Move Down"
          onTouchStart={(e) => handlePress(() => onDirectionPress?.("down"), e, "down")}
          onTouchEnd={(e) => handleRelease(() => onDirectionRelease?.("down"), e, "down")}
          onMouseDown={(e) => handlePress(() => onDirectionPress?.("down"), e, "down")}
          onMouseUp={(e) => handleRelease(() => onDirectionRelease?.("down"), e, "down")}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-b-xl bg-zinc-900/90 border-b border-x border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
        >
          <IconChevronDown className="w-6 h-6 pointer-events-none" />
        </button>

        {/* Left Button */}
        <button
          type="button"
          aria-label="Move Left"
          onTouchStart={(e) => handlePress(() => onDirectionPress?.("left"), e, "left")}
          onTouchEnd={(e) => handleRelease(() => onDirectionRelease?.("left"), e, "left")}
          onMouseDown={(e) => handlePress(() => onDirectionPress?.("left"), e, "left")}
          onMouseUp={(e) => handleRelease(() => onDirectionRelease?.("left"), e, "left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-l-xl bg-zinc-900/90 border-l border-y border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
        >
          <IconChevronLeft className="w-6 h-6 pointer-events-none" />
        </button>

        {/* Right Button */}
        <button
          type="button"
          aria-label="Move Right"
          onTouchStart={(e) => handlePress(() => onDirectionPress?.("right"), e, "right")}
          onTouchEnd={(e) => handleRelease(() => onDirectionRelease?.("right"), e, "right")}
          onMouseDown={(e) => handlePress(() => onDirectionPress?.("right"), e, "right")}
          onMouseUp={(e) => handleRelease(() => onDirectionRelease?.("right"), e, "right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-r-xl bg-zinc-900/90 border-r border-y border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
        >
          <IconChevronRight className="w-6 h-6 pointer-events-none" />
        </button>
      </div>

      {/* Action Buttons Cluster */}
      <div className="flex items-center gap-3">
        {onActionBPress && (
          <button
            type="button"
            aria-label={actionBLabel}
            onTouchStart={(e) => handlePress(onActionBPress, e, "actionB")}
            onTouchEnd={(e) => handleRelease(onActionBRelease, e, "actionB")}
            onMouseDown={(e) => handlePress(onActionBPress, e, "actionB")}
            onMouseUp={(e) => handleRelease(onActionBRelease, e, "actionB")}
            className="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 active:bg-purple-500/20 active:border-purple-400 active:text-purple-300 text-zinc-300 flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shadow-md active:scale-95"
          >
            <span className="text-[11px] font-mono font-black tracking-wider pointer-events-none">
              {actionBLabel}
            </span>
            <span className="text-[9px] font-mono text-zinc-500 pointer-events-none">
              {actionBSubtitle}
            </span>
          </button>
        )}

        {onActionAPress && (
          <button
            type="button"
            aria-label={actionALabel}
            onTouchStart={(e) => handlePress(onActionAPress, e, "actionA")}
            onTouchEnd={(e) => handleRelease(onActionARelease, e, "actionA")}
            onMouseDown={(e) => handlePress(onActionAPress, e, "actionA")}
            onMouseUp={(e) => handleRelease(onActionARelease, e, "actionA")}
            className="w-18 h-18 rounded-2xl bg-brand-cyan/15 border-2 border-brand-cyan/60 active:bg-brand-cyan/30 active:border-brand-cyan active:scale-95 text-brand-cyan flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.15)]"
          >
            <span className="text-xs font-mono font-black tracking-wider pointer-events-none">
              {actionALabel}
            </span>
            <span className="text-[9px] font-mono text-brand-cyan/70 pointer-events-none">
              {actionASubtitle}
            </span>
          </button>
        )}
      </div>
    </div>
  );
/* jscpd:ignore-end */
};

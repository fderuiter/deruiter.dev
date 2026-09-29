"use client";

import React, { useState, useEffect } from "react";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconSword,
  IconFlask,
} from "@tabler/icons-react";

export interface VirtualDPadProps {
  onDirectionPress?: (direction: "up" | "down" | "left" | "right") => void;
  onDirectionRelease?: (direction: "up" | "down" | "left" | "right") => void;
  className?: string;
}

/* jscpd:ignore-start */
export const VirtualDPad: React.FC<VirtualDPadProps> = ({
  onDirectionPress,
  onDirectionRelease,
  className = "",
}) => {
  const handlePress = (
    e: React.SyntheticEvent,
    direction: "up" | "down" | "left" | "right"
  ) => {
    if (e.cancelable) e.preventDefault();
    onDirectionPress?.(direction);
  };

  const handleRelease = (
    e: React.SyntheticEvent,
    direction: "up" | "down" | "left" | "right"
  ) => {
    if (e.cancelable) e.preventDefault();
    onDirectionRelease?.(direction);
  };

  return (
    <div
      role="group"
      aria-label="Virtual D-Pad"
      className={`relative w-32 h-32 grid grid-cols-3 grid-rows-3 gap-1 p-1 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-md shadow-lg select-none touch-none ${className}`}
    >
      <div />
      <button
        type="button"
        aria-label="Move Up"
        onTouchStart={(e) => handlePress(e, "up")}
        onTouchEnd={(e) => handleRelease(e, "up")}
        onTouchCancel={(e) => handleRelease(e, "up")}
        onMouseDown={(e) => handlePress(e, "up")}
        onMouseUp={(e) => handleRelease(e, "up")}
        onMouseLeave={(e) => handleRelease(e, "up")}
        onPointerDown={(e) => handlePress(e, "up")}
        onPointerUp={(e) => handleRelease(e, "up")}
        onPointerLeave={(e) => handleRelease(e, "up")}
        onPointerCancel={(e) => handleRelease(e, "up")}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform"
      >
        <IconArrowUp className="w-5 h-5" />
      </button>
      <div />
      <button
        type="button"
        aria-label="Move Left"
        onTouchStart={(e) => handlePress(e, "left")}
        onTouchEnd={(e) => handleRelease(e, "left")}
        onTouchCancel={(e) => handleRelease(e, "left")}
        onMouseDown={(e) => handlePress(e, "left")}
        onMouseUp={(e) => handleRelease(e, "left")}
        onMouseLeave={(e) => handleRelease(e, "left")}
        onPointerDown={(e) => handlePress(e, "left")}
        onPointerUp={(e) => handleRelease(e, "left")}
        onPointerLeave={(e) => handleRelease(e, "left")}
        onPointerCancel={(e) => handleRelease(e, "left")}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform"
      >
        <IconArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex items-center justify-center rounded-lg bg-zinc-950/60 border border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-zinc-600" />
      </div>
      <button
        type="button"
        aria-label="Move Right"
        onTouchStart={(e) => handlePress(e, "right")}
        onTouchEnd={(e) => handleRelease(e, "right")}
        onTouchCancel={(e) => handleRelease(e, "right")}
        onMouseDown={(e) => handlePress(e, "right")}
        onMouseUp={(e) => handleRelease(e, "right")}
        onMouseLeave={(e) => handleRelease(e, "right")}
        onPointerDown={(e) => handlePress(e, "right")}
        onPointerUp={(e) => handleRelease(e, "right")}
        onPointerLeave={(e) => handleRelease(e, "right")}
        onPointerCancel={(e) => handleRelease(e, "right")}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform"
      >
        <IconArrowRight className="w-5 h-5" />
      </button>
      <div />
      <button
        type="button"
        aria-label="Move Down"
        onTouchStart={(e) => handlePress(e, "down")}
        onTouchEnd={(e) => handleRelease(e, "down")}
        onTouchCancel={(e) => handleRelease(e, "down")}
        onMouseDown={(e) => handlePress(e, "down")}
        onMouseUp={(e) => handleRelease(e, "down")}
        onMouseLeave={(e) => handleRelease(e, "down")}
        onPointerDown={(e) => handlePress(e, "down")}
        onPointerUp={(e) => handleRelease(e, "down")}
        onPointerLeave={(e) => handleRelease(e, "down")}
        onPointerCancel={(e) => handleRelease(e, "down")}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform"
      >
        <IconArrowDown className="w-5 h-5" />
      </button>
      <div />
    </div>
  );
};

interface VirtualGamepadProps {
  onDirectionPress?: (direction: "up" | "down" | "left" | "right") => void;
  onDirectionRelease?: (direction: "up" | "down" | "left" | "right") => void;
  onActionAPress?: () => void;
  onActionARelease?: () => void;
  onActionBPress?: () => void;
  onActionBRelease?: () => void;
  onWeaponSelect?: (index: number) => void;
  selectedWeapon?: number;
  weaponLabels?: string[];
  actionALabel?: string;
  actionBLabel?: string;
  forceVisible?: boolean;
  className?: string;
}

export const VirtualGamepad: React.FC<VirtualGamepadProps> = ({
  onDirectionPress,
  onDirectionRelease,
  onActionAPress,
  onActionARelease,
  onActionBPress,
  onActionBRelease,
  onWeaponSelect,
  selectedWeapon,
  weaponLabels,
  actionALabel = "Attack",
  actionBLabel = "Potion",
  forceVisible = false,
  className = "",
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  useEffect(() => {
    const handleTouchStart = () => setIsTouchDevice(true);
    const checkTouch = () => {
      if (typeof window === "undefined") return;
      const hasTouch =
        "ontouchstart" in window ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
        getMatchMediaMatches("(pointer: coarse)");
      setIsTouchDevice(hasTouch);
    };

    checkTouch();
    window.addEventListener("touchstart", handleTouchStart, { once: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  if (!isTouchDevice && !forceVisible) {
    return null;
  }

  const handleAction = (e: React.SyntheticEvent, callback?: () => void) => {
    if (e.cancelable) e.preventDefault();
    callback?.();
  };

  return (
    <div
      role="group"
      aria-label="Virtual Gamepad Touch Controls"
      className={`select-none touch-none pointer-events-auto flex items-end justify-between gap-4 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent ${className}`}
    >
      {/* 4-Way D-Pad on Left */}
      <VirtualDPad
        onDirectionPress={onDirectionPress}
        onDirectionRelease={onDirectionRelease}
      />

      {/* Center Weapon Selector (if provided) */}
      {weaponLabels && weaponLabels.length > 0 && onWeaponSelect && (
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800 backdrop-blur-md">
          {weaponLabels.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => onWeaponSelect(idx)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                selectedWeapon === idx
                  ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                  : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/60"
              }`}
            >
              {idx + 1}: {label}
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons on Right */}
      <div className="flex items-center gap-3">
        {onActionBPress && (
          <button
            type="button"
            aria-label={actionBLabel}
            onTouchStart={(e) => handleAction(e, onActionBPress)}
            onTouchEnd={(e) => handleAction(e, onActionBRelease)}
            onTouchCancel={(e) => handleAction(e, onActionBRelease)}
            onMouseDown={(e) => handleAction(e, onActionBPress)}
            onMouseUp={(e) => handleAction(e, onActionBRelease)}
            onMouseLeave={(e) => handleAction(e, onActionBRelease)}
            onPointerDown={(e) => handleAction(e, onActionBPress)}
            onPointerUp={(e) => handleAction(e, onActionBRelease)}
            onPointerLeave={(e) => handleAction(e, onActionBRelease)}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/20 active:bg-rose-500/40 border border-rose-500/40 text-rose-300 active:scale-95 transition-transform shadow-lg"
          >
            <IconFlask className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-mono font-bold uppercase">
              {actionBLabel}
            </span>
          </button>
        )}

        {onActionAPress && (
          <button
            type="button"
            aria-label={actionALabel}
            onTouchStart={(e) => handleAction(e, onActionAPress)}
            onTouchEnd={(e) => handleAction(e, onActionARelease)}
            onTouchCancel={(e) => handleAction(e, onActionARelease)}
            onMouseDown={(e) => handleAction(e, onActionAPress)}
            onMouseUp={(e) => handleAction(e, onActionARelease)}
            onMouseLeave={(e) => handleAction(e, onActionARelease)}
            onPointerDown={(e) => handleAction(e, onActionAPress)}
            onPointerUp={(e) => handleAction(e, onActionARelease)}
            onPointerLeave={(e) => handleAction(e, onActionARelease)}
            className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-brand-cyan/20 active:bg-brand-cyan/40 border border-brand-cyan/40 text-brand-cyan active:scale-95 transition-transform shadow-lg"
          >
            <IconSword className="w-6 h-6 mb-0.5" />
            <span className="text-[10px] font-mono font-bold uppercase">
              {actionALabel}
            </span>
          </button>
        )}
      </div>
    </div>
  );
/* jscpd:ignore-end */
};

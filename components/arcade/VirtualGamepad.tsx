"use client";

import React, { useState, useEffect } from "react";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";
import { usePressHandler } from "@/hooks/usePressHandler";
import { useRovingTabIndex } from "@/hooks/useRovingTabIndex";
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

export const VirtualDPad: React.FC<VirtualDPadProps> = ({
  onDirectionPress,
  onDirectionRelease,
  className = "",
}) => {
  const { getTabProps } = useRovingTabIndex<"up" | "down" | "left" | "right">({
    items: ["up", "down", "left", "right"],
    defaultActiveId: "up",
  });

  const upTab = getTabProps("up");
  const upPress = usePressHandler({
    onPress: () => onDirectionPress?.("up"),
    onRelease: () => onDirectionRelease?.("up"),
    haptic: 15,
    onKeyDown: upTab.onKeyDown,
  });

  const downTab = getTabProps("down");
  const downPress = usePressHandler({
    onPress: () => onDirectionPress?.("down"),
    onRelease: () => onDirectionRelease?.("down"),
    haptic: 15,
    onKeyDown: downTab.onKeyDown,
  });

  const leftTab = getTabProps("left");
  const leftPress = usePressHandler({
    onPress: () => onDirectionPress?.("left"),
    onRelease: () => onDirectionRelease?.("left"),
    haptic: 15,
    onKeyDown: leftTab.onKeyDown,
  });

  const rightTab = getTabProps("right");
  const rightPress = usePressHandler({
    onPress: () => onDirectionPress?.("right"),
    onRelease: () => onDirectionRelease?.("right"),
    haptic: 15,
    onKeyDown: rightTab.onKeyDown,
  });

  return (
    <div
      role="group"
      aria-label="Virtual D-Pad"
      data-roving-group=""
      className={`relative w-32 h-32 grid grid-cols-3 grid-rows-3 gap-1 p-1 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 backdrop-blur-md shadow-lg select-none touch-none ${className}`}
    >
      <div />
      <button
        type="button"
        aria-label="Move Up"
        data-roving-id="up"
        tabIndex={upTab.tabIndex}
        onFocus={upTab.onFocus}
        {...upPress.pressProps}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
      >
        <IconArrowUp className="w-5 h-5 pointer-events-none" />
      </button>
      <div />
      <button
        type="button"
        aria-label="Move Left"
        data-roving-id="left"
        tabIndex={leftTab.tabIndex}
        onFocus={leftTab.onFocus}
        {...leftPress.pressProps}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
      >
        <IconArrowLeft className="w-5 h-5 pointer-events-none" />
      </button>
      <div className="flex items-center justify-center rounded-lg bg-zinc-950/60 border border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-zinc-600" />
      </div>
      <button
        type="button"
        aria-label="Move Right"
        data-roving-id="right"
        tabIndex={rightTab.tabIndex}
        onFocus={rightTab.onFocus}
        {...rightPress.pressProps}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
      >
        <IconArrowRight className="w-5 h-5 pointer-events-none" />
      </button>
      <div />
      <button
        type="button"
        aria-label="Move Down"
        data-roving-id="down"
        tabIndex={downTab.tabIndex}
        onFocus={downTab.onFocus}
        {...downPress.pressProps}
        className="flex items-center justify-center rounded-xl bg-zinc-800/80 active:bg-brand-cyan/40 active:text-brand-cyan border border-zinc-700 text-zinc-300 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
      >
        <IconArrowDown className="w-5 h-5 pointer-events-none" />
      </button>
      <div />
    </div>
  );
};

export interface VirtualGamepadProps {
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

  const actionBPress = usePressHandler({
    onPress: onActionBPress,
    onRelease: onActionBRelease,
    haptic: 15,
  });

  const actionAPress = usePressHandler({
    onPress: onActionAPress,
    onRelease: onActionARelease,
    haptic: 15,
  });

  if (!isTouchDevice && !forceVisible) {
    return null;
  }

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
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none ${
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
            {...actionBPress.pressProps}
            className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/20 active:bg-rose-500/40 border border-rose-500/40 text-rose-300 active:scale-95 transition-transform shadow-lg focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
          >
            <IconFlask className="w-5 h-5 mb-0.5 pointer-events-none" />
            <span className="text-[9px] font-mono font-bold uppercase pointer-events-none">
              {actionBLabel}
            </span>
          </button>
        )}

        {onActionAPress && (
          <button
            type="button"
            aria-label={actionALabel}
            {...actionAPress.pressProps}
            className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-brand-cyan/20 active:bg-brand-cyan/40 border border-brand-cyan/40 text-brand-cyan active:scale-95 transition-transform shadow-lg focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
          >
            <IconSword className="w-6 h-6 mb-0.5 pointer-events-none" />
            <span className="text-[10px] font-mono font-bold uppercase pointer-events-none">
              {actionALabel}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

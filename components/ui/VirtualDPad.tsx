"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAudio } from "@/components/providers/AudioProvider";
import { usePressHandler } from "@/hooks/usePressHandler";
import { useRovingTabIndex, type ArrowKey } from "@/hooks/useRovingTabIndex";
import {
  IconChevronUp,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";

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

type ButtonId = "up" | "down" | "left" | "right" | "actionB" | "actionA";

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

  const items = useMemo<ButtonId[]>(() => {
    const list: ButtonId[] = ["up", "down", "left", "right"];
    if (onActionBPress) list.push("actionB");
    if (onActionAPress) list.push("actionA");
    return list;
  }, [onActionBPress, onActionAPress]);

  const navigationMap = useMemo(() => {
    const map: Record<string, Partial<Record<ArrowKey, ButtonId>>> = {
      up: {
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "down",
      },
      down: {
        ArrowUp: "up",
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowDown: "up",
      },
      left: {
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "right",
      },
      right: {
        ArrowLeft: "left",
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowRight: onActionBPress
          ? "actionB"
          : onActionAPress
            ? "actionA"
            : "left",
      },
    };
    if (onActionBPress) {
      map.actionB = {
        ArrowLeft: "right",
        ArrowRight: onActionAPress ? "actionA" : "left",
        ArrowUp: onActionAPress ? "actionA" : "up",
        ArrowDown: onActionAPress ? "actionA" : "down",
      };
    }
    if (onActionAPress) {
      map.actionA = {
        ArrowLeft: onActionBPress ? "actionB" : "right",
        ArrowRight: "left",
        ArrowUp: onActionBPress ? "actionB" : "up",
        ArrowDown: onActionBPress ? "actionB" : "down",
      };
    }
    return map;
  }, [onActionBPress, onActionAPress]);

  const { getTabProps } = useRovingTabIndex<ButtonId>({
    items,
    defaultActiveId: "up",
    navigationMap,
  });

  const upTab = getTabProps("up");
  const upPress = usePressHandler({
    onPress: () => onDirectionPress?.("up"),
    onRelease: () => onDirectionRelease?.("up"),
    onAudio: () => playNote(880, 0.02),
    haptic: 15,
    onKeyDown: upTab.onKeyDown,
  });

  const downTab = getTabProps("down");
  const downPress = usePressHandler({
    onPress: () => onDirectionPress?.("down"),
    onRelease: () => onDirectionRelease?.("down"),
    onAudio: () => playNote(880, 0.02),
    haptic: 15,
    onKeyDown: downTab.onKeyDown,
  });

  const leftTab = getTabProps("left");
  const leftPress = usePressHandler({
    onPress: () => onDirectionPress?.("left"),
    onRelease: () => onDirectionRelease?.("left"),
    onAudio: () => playNote(880, 0.02),
    haptic: 15,
    onKeyDown: leftTab.onKeyDown,
  });

  const rightTab = getTabProps("right");
  const rightPress = usePressHandler({
    onPress: () => onDirectionPress?.("right"),
    onRelease: () => onDirectionRelease?.("right"),
    onAudio: () => playNote(880, 0.02),
    haptic: 15,
    onKeyDown: rightTab.onKeyDown,
  });

  const actionBTab = getTabProps("actionB");
  const actionBPress = usePressHandler({
    onPress: onActionBPress,
    onRelease: onActionBRelease,
    onAudio: () => playNote(880, 0.02),
    haptic: 15,
    onKeyDown: actionBTab.onKeyDown,
  });

  const actionATab = getTabProps("actionA");
  const actionAPress = usePressHandler({
    onPress: onActionAPress,
    onRelease: onActionARelease,
    onAudio: () => playNote(880, 0.02),
    haptic: 15,
    onKeyDown: actionATab.onKeyDown,
  });

  return (
    <div
      role="group"
      aria-label="Virtual Game Controller"
      data-roving-group=""
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
          data-roving-id="up"
          tabIndex={upTab.tabIndex}
          onFocus={upTab.onFocus}
          {...upPress.pressProps}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-t-xl bg-zinc-900/90 border-t border-x border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
        >
          <IconChevronUp className="w-6 h-6 pointer-events-none" />
        </button>

        {/* Down Button */}
        <button
          type="button"
          aria-label="Move Down"
          data-roving-id="down"
          tabIndex={downTab.tabIndex}
          onFocus={downTab.onFocus}
          {...downPress.pressProps}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 rounded-b-xl bg-zinc-900/90 border-b border-x border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
        >
          <IconChevronDown className="w-6 h-6 pointer-events-none" />
        </button>

        {/* Left Button */}
        <button
          type="button"
          aria-label="Move Left"
          data-roving-id="left"
          tabIndex={leftTab.tabIndex}
          onFocus={leftTab.onFocus}
          {...leftPress.pressProps}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-l-xl bg-zinc-900/90 border-l border-y border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
        >
          <IconChevronLeft className="w-6 h-6 pointer-events-none" />
        </button>

        {/* Right Button */}
        <button
          type="button"
          aria-label="Move Right"
          data-roving-id="right"
          tabIndex={rightTab.tabIndex}
          onFocus={rightTab.onFocus}
          {...rightPress.pressProps}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-r-xl bg-zinc-900/90 border-r border-y border-zinc-700/80 active:bg-brand-cyan/20 active:border-brand-cyan active:text-brand-cyan text-zinc-300 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
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
            data-roving-id="actionB"
            tabIndex={actionBTab.tabIndex}
            onFocus={actionBTab.onFocus}
            {...actionBPress.pressProps}
            className="w-16 h-16 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 active:bg-purple-500/20 active:border-purple-400 active:text-purple-300 text-zinc-300 flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shadow-md active:scale-95 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none"
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
            data-roving-id="actionA"
            tabIndex={actionATab.tabIndex}
            onFocus={actionATab.onFocus}
            {...actionAPress.pressProps}
            className="w-18 h-18 rounded-2xl bg-brand-cyan/15 border-2 border-brand-cyan/60 active:bg-brand-cyan/30 active:border-brand-cyan active:scale-95 text-brand-cyan flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.15)] focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:outline-none"
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
};

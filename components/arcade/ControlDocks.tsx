"use client";

import React, { useState, useEffect } from "react";
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconSword,
  IconFlask,
  IconCrosshair,
  IconSparkles,
  IconPlayerPlay,
  IconArrowBackUp,
  IconBrightnessUp,
} from "@tabler/icons-react";
import { useAudio } from "@/components/providers/AudioProvider";
import { triggerHaptic } from "@/lib/haptics";
import { getMatchMediaMatches } from "@/hooks/useMediaQuery";

/* jscpd:ignore-start */
function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(false);

  useEffect(() => {
    const checkTouch = () => {
      if (typeof window === "undefined") return;
      const touchDetected =
        "ontouchstart" in window ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
        getMatchMediaMatches("(pointer: coarse)");
      setIsTouch(touchDetected);
    };

    checkTouch();
    const handleTouchStart = () => setIsTouch(true);
    window.addEventListener("touchstart", handleTouchStart, { once: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  return isTouch;
}

/* =========================================================================
   1. DPAD ACTION DOCK (Retro Labyrinth / Grid Games)
   ========================================================================= */

interface DpadActionDockProps {
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

export const DpadActionDock: React.FC<DpadActionDockProps> = ({
  onDirectionPress,
  onDirectionRelease,
  onActionAPress,
  onActionARelease,
  onActionBPress,
  onActionBRelease,
  onWeaponSelect,
  selectedWeapon = 0,
  weaponLabels,
  actionALabel = "Attack",
  actionBLabel = "Potion",
  forceVisible = false,
  className = "",
}) => {
  const isTouch = useIsTouchDevice();
  const audio = useAudio();
  const activePointersRef = React.useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    const activePointers = activePointersRef.current;
    return () => {
      activePointers.forEach((target, pointerId) => {
        if (
          "releasePointerCapture" in target &&
          typeof target.releasePointerCapture === "function"
        ) {
          try {
            if (target.hasPointerCapture?.(pointerId)) {
              target.releasePointerCapture(pointerId);
            }
          } catch {
            // Ignore capture release errors on unmounted targets
          }
        }
      });
      activePointers.clear();
    };
  }, []);

  const handleDirPress = (
    e: React.PointerEvent<HTMLButtonElement>,
    dir: "up" | "down" | "left" | "right"
  ) => {
    if (e.cancelable) e.preventDefault();
    const target = e.currentTarget;
    if (
      target &&
      "setPointerCapture" in target &&
      typeof target.setPointerCapture === "function"
    ) {
      try {
        target.setPointerCapture(e.pointerId);
        activePointersRef.current.set(e.pointerId, target);
      } catch {
        // Safe catch for synthetic/mock pointer events or unattached elements
      }
    }
    triggerHaptic(15);
    audio.playHover();
    onDirectionPress?.(dir);
  };

  const handleDirRelease = (
    e: React.PointerEvent<HTMLButtonElement>,
    dir: "up" | "down" | "left" | "right"
  ) => {
    if (e.cancelable) e.preventDefault();
    const target = e.currentTarget;
    if (
      target &&
      "releasePointerCapture" in target &&
      typeof target.releasePointerCapture === "function"
    ) {
      try {
        if (target.hasPointerCapture?.(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe catch
      }
    }
    activePointersRef.current.delete(e.pointerId);
    onDirectionRelease?.(dir);
  };

  const handleActionDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    callback?: () => void
  ) => {
    if (e.cancelable) e.preventDefault();
    const target = e.currentTarget;
    if (
      target &&
      "setPointerCapture" in target &&
      typeof target.setPointerCapture === "function"
    ) {
      try {
        target.setPointerCapture(e.pointerId);
        activePointersRef.current.set(e.pointerId, target);
      } catch {
        // Safe catch
      }
    }
    triggerHaptic(20);
    audio.playSubmit();
    callback?.();
  };

  const handleActionUp = (
    e: React.PointerEvent<HTMLButtonElement>,
    callback?: () => void
  ) => {
    if (e.cancelable) e.preventDefault();
    const target = e.currentTarget;
    if (
      target &&
      "releasePointerCapture" in target &&
      typeof target.releasePointerCapture === "function"
    ) {
      try {
        if (target.hasPointerCapture?.(e.pointerId)) {
          target.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Safe catch
      }
    }
    activePointersRef.current.delete(e.pointerId);
    callback?.();
  };
/* jscpd:ignore-end */

  if (!isTouch && !forceVisible) return null;

  return (
    <div
      role="group"
      aria-label="Virtual Gamepad Directional & Action Controls"
      className={`select-none touch-none w-full max-w-2xl flex flex-wrap items-end justify-between gap-2 p-2 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-md shadow-2xl ${className}`}
    >
      {/* 4-Way D-Pad */}
      <div className="relative shrink-0 grid grid-cols-[repeat(3,48px)] grid-rows-[repeat(3,48px)] gap-1 p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-inner">
        <div />
        <button
          type="button"
          aria-label="Move Up"
          onPointerDown={(e) => handleDirPress(e, "up")}
          onPointerUp={(e) => handleDirRelease(e, "up")}
          onPointerCancel={(e) => handleDirRelease(e, "up")}
          onLostPointerCapture={(e) => handleDirRelease(e, "up")}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:bg-cyan-500/30 active:text-cyan-300 border border-zinc-700 text-zinc-200 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <IconArrowUp className="w-6 h-6" />
        </button>
        <div />

        <button
          type="button"
          aria-label="Move Left"
          onPointerDown={(e) => handleDirPress(e, "left")}
          onPointerUp={(e) => handleDirRelease(e, "left")}
          onPointerCancel={(e) => handleDirRelease(e, "left")}
          onLostPointerCapture={(e) => handleDirRelease(e, "left")}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:bg-cyan-500/30 active:text-cyan-300 border border-zinc-700 text-zinc-200 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <IconArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
        </div>
        <button
          type="button"
          aria-label="Move Right"
          onPointerDown={(e) => handleDirPress(e, "right")}
          onPointerUp={(e) => handleDirRelease(e, "right")}
          onPointerCancel={(e) => handleDirRelease(e, "right")}
          onLostPointerCapture={(e) => handleDirRelease(e, "right")}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:bg-cyan-500/30 active:text-cyan-300 border border-zinc-700 text-zinc-200 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <IconArrowRight className="w-6 h-6" />
        </button>

        <div />
        <button
          type="button"
          aria-label="Move Down"
          onPointerDown={(e) => handleDirPress(e, "down")}
          onPointerUp={(e) => handleDirRelease(e, "down")}
          onPointerCancel={(e) => handleDirRelease(e, "down")}
          onLostPointerCapture={(e) => handleDirRelease(e, "down")}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-zinc-800/90 hover:bg-zinc-700 active:bg-cyan-500/30 active:text-cyan-300 border border-zinc-700 text-zinc-200 active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <IconArrowDown className="w-6 h-6" />
        </button>
        <div />
      </div>

      {/* Center Weapon Arsenal Selector */}
      {weaponLabels && weaponLabels.length > 0 && onWeaponSelect && (
        <div className="flex flex-col gap-1.5 p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
          <span className="text-[9px] font-mono uppercase text-zinc-500 font-bold px-1 text-center">
            Arsenal
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {weaponLabels.map((label, idx) => (
              <button
                key={label}
                type="button"
                aria-label={`${idx + 1}: ${label}`}
                onClick={() => {
                  audio.playHover();
                  onWeaponSelect(idx);
                }}
                className={`min-h-[48px] px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  selectedWeapon === idx
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/60 hover:text-white"
                }`}
              >
                <span>{idx + 1}:</span>
                <span className="truncate max-w-[64px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Action Buttons */}
      <div className="flex items-center gap-3">
        {onActionBPress && (
          <button
            type="button"
            aria-label={actionBLabel}
            onPointerDown={(e) => handleActionDown(e, onActionBPress)}
            onPointerUp={(e) => handleActionUp(e, onActionBRelease)}
            onPointerCancel={(e) => handleActionUp(e, onActionBRelease)}
            onLostPointerCapture={(e) => handleActionUp(e, onActionBRelease)}
            className="min-w-[52px] min-h-[52px] w-14 h-14 rounded-2xl bg-rose-500/20 active:bg-rose-500/40 border border-rose-500/40 text-rose-300 active:scale-95 transition-transform shadow-lg flex flex-col items-center justify-center focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none"
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
            onPointerDown={(e) => handleActionDown(e, onActionAPress)}
            onPointerUp={(e) => handleActionUp(e, onActionARelease)}
            onPointerCancel={(e) => handleActionUp(e, onActionARelease)}
            onLostPointerCapture={(e) => handleActionUp(e, onActionARelease)}
            className="min-w-[56px] min-h-[56px] w-16 h-16 rounded-2xl bg-cyan-500/20 active:bg-cyan-500/40 border border-cyan-500/40 text-cyan-300 active:scale-95 transition-transform shadow-lg flex flex-col items-center justify-center focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
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
};

/* =========================================================================
   2. TWIN STICK / AIM DOCK (Laser Loon / Shooter Games)
   ========================================================================= */

interface WeaponOption {
  id: string;
  label: string;
  color?: "red" | "cyan" | "purple" | "amber" | "emerald";
}

interface TwinStickAimDockProps {
  onFirePress?: () => void;
  onFireRelease?: () => void;
  onTremoloPress?: () => void;
  onTremoloRelease?: () => void;
  onWeaponSelect?: (index: number) => void;
  selectedWeapon?: number;
  weapons?: WeaponOption[];
  energyPercent?: number;
  forceVisible?: boolean;
  className?: string;
}

export const TwinStickAimDock: React.FC<TwinStickAimDockProps> = ({
  onFirePress,
  onFireRelease,
  onTremoloPress,
  onTremoloRelease,
  onWeaponSelect,
  selectedWeapon = 0,
  weapons = [],
  energyPercent = 0,
  forceVisible = false,
  className = "",
}) => {
  const isTouch = useIsTouchDevice();
  const audio = useAudio();

  const handleAction = (e: React.SyntheticEvent, callback?: () => void) => {
    if (e.cancelable) e.preventDefault();
    triggerHaptic(20);
    audio.playSubmit();
    callback?.();
  };

  if (!isTouch && !forceVisible) return null;

  const isTremoloReady = energyPercent >= 100;

  return (
    <div
      role="group"
      aria-label="Laser Loon Touch Controls"
      className={`select-none touch-none w-full max-w-2xl flex flex-wrap items-center justify-between gap-2 p-2 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-md shadow-2xl ${className}`}
    >
      {/* Arsenal Selection Pills */}
      {weapons.length > 0 && onWeaponSelect && (
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800">
          {weapons.map((w, idx) => (
            <button
              key={w.id}
              type="button"
              aria-label={`${idx + 1}: ${w.label}`}
              onClick={() => {
                audio.playHover();
                onWeaponSelect(idx);
              }}
              className={`min-h-[48px] px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none ${
                selectedWeapon === idx
                  ? "bg-red-500/20 text-red-300 border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                  : "bg-zinc-800/60 text-zinc-400 border border-zinc-700/60 hover:text-white"
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  w.color === "cyan"
                    ? "bg-cyan-400"
                    : w.color === "purple"
                      ? "bg-purple-400"
                      : w.color === "amber"
                        ? "bg-amber-400"
                        : "bg-red-400"
                }`}
              />
              <span className="truncate max-w-[80px]">{w.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Action Buttons: Loon Tremolo & Primary Fire */}
      <div className="flex items-center gap-3">
        {onTremoloPress && (
          <button
            type="button"
            aria-label="Loon Tremolo"
            disabled={!isTremoloReady}
            onPointerDown={(e) => handleAction(e, onTremoloPress)}
            onPointerUp={(e) => handleAction(e, onTremoloRelease)}
            onPointerCancel={(e) => handleAction(e, onTremoloRelease)}
            className={`min-w-[52px] min-h-[52px] w-14 h-14 rounded-2xl border flex flex-col items-center justify-center transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
              isTremoloReady
                ? "bg-cyan-500/30 border-cyan-400 text-cyan-200 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 cursor-pointer"
                : "bg-zinc-900 border-zinc-800 text-zinc-600 opacity-60 cursor-not-allowed"
            }`}
          >
            <IconSparkles className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-mono font-bold uppercase">
              Tremolo
            </span>
          </button>
        )}

        {onFirePress && (
          <button
            type="button"
            aria-label="Primary Fire"
            onPointerDown={(e) => handleAction(e, onFirePress)}
            onPointerUp={(e) => handleAction(e, onFireRelease)}
            onPointerCancel={(e) => handleAction(e, onFireRelease)}
            className="min-w-[56px] min-h-[56px] w-16 h-16 rounded-2xl bg-red-500/20 active:bg-red-500/40 border border-red-500/50 text-red-300 active:scale-95 transition-transform shadow-lg flex flex-col items-center justify-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none"
          >
            <IconCrosshair className="w-6 h-6 mb-0.5" />
            <span className="text-[10px] font-mono font-bold uppercase">
              Fire
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   3. BEZEL CLUSTER DOCK (Garmin Smartwatch Hardware Buttons)
   ========================================================================= */

type BezelButtonId = "light" | "up" | "down" | "start" | "back";

interface BezelClusterDockProps {
  onButtonPress?: (btn: BezelButtonId) => void;
  onButtonRelease?: (btn: BezelButtonId) => void;
  activeButton?: BezelButtonId | null;
  forceVisible?: boolean;
  className?: string;
}

export const BezelClusterDock: React.FC<BezelClusterDockProps> = ({
  onButtonPress,
  onButtonRelease,
  activeButton,
  forceVisible = false,
  className = "",
}) => {
  const isTouch = useIsTouchDevice();
  const audio = useAudio();

  const handlePress = (e: React.SyntheticEvent, btn: BezelButtonId) => {
    if (e.cancelable) e.preventDefault();
    triggerHaptic(20);
    audio.playNote(btn === "start" ? 440 : 330, 0.05);
    onButtonPress?.(btn);
  };

  const handleRelease = (e: React.SyntheticEvent, btn: BezelButtonId) => {
    if (e.cancelable) e.preventDefault();
    onButtonRelease?.(btn);
  };

  if (!isTouch && !forceVisible) return null;

  const buttons: {
    id: BezelButtonId;
    label: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: "light",
      label: "Light / Power",
      icon: <IconBrightnessUp className="w-5 h-5" />,
      color: "text-amber-400 border-amber-500/30",
    },
    {
      id: "up",
      label: "Up / Menu",
      icon: <IconArrowUp className="w-5 h-5" />,
      color: "text-zinc-300 border-zinc-700",
    },
    {
      id: "down",
      label: "Down",
      icon: <IconArrowDown className="w-5 h-5" />,
      color: "text-zinc-300 border-zinc-700",
    },
    {
      id: "start",
      label: "Start / Stop",
      icon: <IconPlayerPlay className="w-5 h-5 text-emerald-400" />,
      color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
    },
    {
      id: "back",
      label: "Back / Lap",
      icon: <IconArrowBackUp className="w-5 h-5 text-rose-400" />,
      color: "text-rose-400 border-rose-500/40 bg-rose-500/10",
    },
  ];

  return (
    <div
      role="group"
      aria-label="Garmin Watch Hardware Bezel Buttons"
      className={`select-none touch-none w-full max-w-xl flex items-center justify-center flex-wrap gap-2 p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-md shadow-2xl ${className}`}
    >
      {buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={b.label}
          onPointerDown={(e) => handlePress(e, b.id)}
          onPointerUp={(e) => handleRelease(e, b.id)}
          onPointerCancel={(e) => handleRelease(e, b.id)}
          className={`min-w-[48px] min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-zinc-900/90 active:scale-95 transition-all flex items-center gap-1.5 font-mono text-xs font-bold focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${b.color} ${
            activeButton === b.id
              ? "ring-2 ring-amber-400 scale-95 bg-zinc-800"
              : ""
          }`}
        >
          {b.icon}
          <span className="hidden sm:inline">{b.label}</span>
        </button>
      ))}
    </div>
  );
};

/* =========================================================================
   4. ACTION STRIP DOCK (Clinical Chaos / Duck / Quasi Puzzler / Meme Vault)
   ========================================================================= */

interface ActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
  color?: "cyan" | "emerald" | "amber" | "rose" | "purple";
}

interface ActionStripDockProps {
  actions: ActionItem[];
  onAction: (id: string) => void;
  activeActionId?: string | null;
  forceVisible?: boolean;
  className?: string;
}

export const ActionStripDock: React.FC<ActionStripDockProps> = ({
  actions,
  onAction,
  activeActionId,
  forceVisible = false,
  className = "",
}) => {
  const isTouch = useIsTouchDevice();
  const audio = useAudio();

  const handleAction = (id: string, disabled?: boolean) => {
    if (disabled) return;
    triggerHaptic(20);
    audio.playSubmit();
    onAction(id);
  };

  if (!isTouch && !forceVisible) return null;

  return (
    <div
      role="group"
      aria-label="Simulation Action Strip"
      className={`select-none touch-none w-full max-w-3xl flex items-center justify-center flex-wrap gap-2 p-2.5 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl backdrop-blur-md shadow-2xl ${className}`}
    >
      {actions.map((act) => {
        const isActive = activeActionId === act.id;
        const colorClasses = {
          cyan: "hover:border-cyan-500/50 active:bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
          emerald:
            "hover:border-emerald-500/50 active:bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
          amber:
            "hover:border-amber-500/50 active:bg-amber-500/20 text-amber-300 border-amber-500/30",
          rose: "hover:border-rose-500/50 active:bg-rose-500/20 text-rose-300 border-rose-500/30",
          purple:
            "hover:border-purple-500/50 active:bg-purple-500/20 text-purple-300 border-purple-500/30",
        }[act.color || "cyan"];

        return (
          <button
            key={act.id}
            type="button"
            aria-label={act.label}
            disabled={act.disabled}
            onClick={() => handleAction(act.id, act.disabled)}
            className={`min-w-[48px] min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-zinc-900/90 active:scale-95 transition-all flex items-center gap-2 font-mono text-xs font-bold focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${colorClasses} ${
              isActive ? "bg-zinc-800 ring-2 ring-cyan-400" : ""
            } ${act.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {act.icon}
            <span>{act.label}</span>
            {act.badge && (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-zinc-950 border border-zinc-700 text-zinc-400">
                {act.badge}
              </span>
            )}
            {act.shortcut && (
              <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[9px] bg-zinc-950 text-zinc-500 font-mono">
                {act.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

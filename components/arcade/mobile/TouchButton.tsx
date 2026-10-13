"use client";

import React, { useEffect, useRef } from "react";
import { triggerHaptic } from "@/lib/haptics";

export interface TouchButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "onPointerDown"
  | "onPointerUp"
  | "onPointerCancel"
  | "onKeyDown"
  | "onKeyUp"
  | "onBlur"
> {
  /** Accessible name. Required: an icon-only control must still be named. */
  label: string;
  onPress?: () => void;
  onRelease?: () => void;
  /** Short vibration on press. Defaults to true. */
  haptic?: boolean;
}

/** The id the keyboard holds the button under, next to pointer ids. */
const KEYBOARD_HOLD = "keyboard";

/**
 * A press-and-hold control for a touch cabinet. It keeps the set of pointers
 * holding it: the press starts when the first one lands and the release when
 * the last one lifts, so two fingers on one button count once. It captures the
 * pointer on press, so a finger that slides off still releases it, and it
 * releases everything on blur. It is at least 44px square and uses
 * `touch-action: none` so a hold never turns into a pan or a zoom. Enter and
 * Space work from a keyboard too.
 */
export const TouchButton: React.FC<TouchButtonProps> = ({
  label,
  onPress,
  onRelease,
  haptic = true,
  className = "",
  style,
  children,
  ...rest
}) => {
  const heldRef = useRef<Set<number | string>>(new Set());
  // The release handler is read through a ref so the unmount cleanup below
  // sees the latest one without re-running on every render.
  const onReleaseRef = useRef(onRelease);
  useEffect(() => {
    onReleaseRef.current = onRelease;
  }, [onRelease]);

  // A button that leaves the screen while held must not leave the game
  // thinking the control is still down.
  useEffect(() => {
    const held = heldRef.current;
    return () => {
      if (held.size === 0) return;
      held.clear();
      onReleaseRef.current?.();
    };
  }, []);

  const hold = (id: number | string) => {
    const held = heldRef.current;
    if (held.has(id)) return;
    const first = held.size === 0;
    held.add(id);
    if (first) {
      if (haptic) triggerHaptic(10);
      onPress?.();
    }
  };

  const letGo = (id: number | string) => {
    const held = heldRef.current;
    if (!held.delete(id)) return;
    if (held.size === 0) onRelease?.();
  };

  const letGoAll = () => {
    const held = heldRef.current;
    if (held.size === 0) return;
    held.clear();
    onRelease?.();
  };

  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      data-touch-button=""
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic events and old engines have no capture; the press still counts.
        }
        hold(event.pointerId);
      }}
      onPointerUp={(event) => letGo(event.pointerId)}
      onPointerCancel={(event) => letGo(event.pointerId)}
      onLostPointerCapture={(event) => letGo(event.pointerId)}
      onBlur={letGoAll}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          hold(KEYBOARD_HOLD);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") letGo(KEYBOARD_HOLD);
      }}
      className={`min-h-[44px] min-w-[44px] touch-none select-none motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${className}`}
      style={{
        WebkitTouchCallout: "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
};

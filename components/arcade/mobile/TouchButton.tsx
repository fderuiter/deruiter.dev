"use client";

import React, { useRef } from "react";
import { triggerHaptic } from "@/lib/haptics";

export interface TouchButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onPointerDown" | "onPointerUp" | "onPointerCancel" | "onKeyDown" | "onKeyUp"
> {
  /** Accessible name. Required: an icon-only control must still be named. */
  label: string;
  onPress?: () => void;
  onRelease?: () => void;
  /** Short vibration on press. Defaults to true. */
  haptic?: boolean;
}

/**
 * A press-and-hold control for a touch cabinet. It uses pointer events and
 * captures the pointer on press, so a finger that slides off the button still
 * releases it, and two fingers on two buttons press both. It is at least
 * 44px square. Enter and Space work from a keyboard too.
 */
export const TouchButton: React.FC<TouchButtonProps> = ({
  label,
  onPress,
  onRelease,
  haptic = true,
  className = "",
  children,
  ...rest
}) => {
  const pressedRef = useRef(false);

  const press = () => {
    if (pressedRef.current) return;
    pressedRef.current = true;
    if (haptic) triggerHaptic(10);
    onPress?.();
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
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
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          press();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") release();
      }}
      className={`min-h-[44px] min-w-[44px] touch-manipulation select-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${className}`}
      style={{
        WebkitTouchCallout: "none",
        ...rest.style,
      }}
    >
      {children}
    </button>
  );
};

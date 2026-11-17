"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { triggerHaptic } from "@/lib/haptics";

export interface UsePressHandlerOptions {
  /** Callback invoked when the control is pressed down. */
  onPress?: () => void;
  /** Callback invoked when the control is released up. */
  onRelease?: () => void;
  /** Whether the control is disabled. */
  disabled?: boolean;
  /**
   * Haptic vibration duration in milliseconds, or boolean flag.
   * Defaults to 15ms when true or omitted.
   */
  haptic?: number | boolean;
  /** Optional audio feedback callback invoked on press. */
  onAudio?: () => void;
  /** Custom keydown listener chained before standard Space/Enter activation. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
  /** Custom keyup listener chained before standard Space/Enter release. */
  onKeyUp?: (event: React.KeyboardEvent<HTMLElement>) => void;
  /** Custom click listener chained before synthetic activation. */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface PressHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLElement>) => void;
  onTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchCancel: (event: React.TouchEvent<HTMLElement>) => void;
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseUp: (event: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: (event: React.MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: React.KeyboardEvent<HTMLElement>) => void;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLElement>) => void;
}

export interface UsePressHandlerResult {
  /** Whether the button is currently in a pressed state. */
  isPressed: boolean;
  /** Event handlers to spread onto the button element. */
  pressProps: PressHandlers;
}

/**
 * Unified press handler managing pointer, touch, keyboard, and assistive click interactions.
 *
 * Implements WCAG 2.2 Success Criterion 2.1.1 (Keyboard) and 4.1.2 (Name, Role, Value)
 * pursuant to Technique G90 and Technique SCR20.
 *
 * Handles Space and Enter keydown/keyup, suppresses repeat keystrokes, provides haptic
 * and audio pulses, and deduplicates synthetic clicks on hybrid touchscreen devices while
 * supporting screen reader virtual cursor activations.
 */
export function usePressHandler({
  onPress,
  onRelease,
  disabled = false,
  haptic = 15,
  onAudio,
  onKeyDown: customKeyDown,
  onKeyUp: customKeyUp,
  onClick: customClick,
}: UsePressHandlerOptions = {}): UsePressHandlerResult {
  const [isPressed, setIsPressed] = useState(false);
  const isPressedRef = useRef(false);
  const pressSourceRef = useRef<
    "pointer" | "touch" | "mouse" | "keyboard" | null
  >(null);
  const lastReleaseTimeRef = useRef(0);

  const onPressRef = useRef(onPress);
  const onReleaseRef = useRef(onRelease);
  const onAudioRef = useRef(onAudio);
  const customKeyDownRef = useRef(customKeyDown);
  const customKeyUpRef = useRef(customKeyUp);
  const customClickRef = useRef(customClick);

  useEffect(() => {
    onPressRef.current = onPress;
    onReleaseRef.current = onRelease;
    onAudioRef.current = onAudio;
    customKeyDownRef.current = customKeyDown;
    customKeyUpRef.current = customKeyUp;
    customClickRef.current = customClick;
  }, [onPress, onRelease, onAudio, customKeyDown, customKeyUp, customClick]);

  const triggerFeedback = useCallback(() => {
    if (haptic) {
      const duration = typeof haptic === "number" ? haptic : 15;
      triggerHaptic(duration);
    }
    onAudioRef.current?.();
  }, [haptic]);

  const startPress = useCallback(
    (
      source: "pointer" | "touch" | "mouse" | "keyboard",
      event?: React.SyntheticEvent
    ) => {
      if (disabled) return;
      if (event?.cancelable) {
        event.preventDefault();
      }
      if (isPressedRef.current) return;

      isPressedRef.current = true;
      pressSourceRef.current = source;
      setIsPressed(true);

      triggerFeedback();
      onPressRef.current?.();
    },
    [disabled, triggerFeedback]
  );

  const endPress = useCallback(
    (
      source: "pointer" | "touch" | "mouse" | "keyboard",
      event?: React.SyntheticEvent
    ) => {
      if (event?.cancelable) {
        event.preventDefault();
      }
      if (!isPressedRef.current) return;
      // If pressed via keyboard, do not let incidental pointer movement release the key
      if (pressSourceRef.current === "keyboard" && source !== "keyboard")
        return;

      isPressedRef.current = false;
      pressSourceRef.current = null;
      lastReleaseTimeRef.current = Date.now();
      setIsPressed(false);

      onReleaseRef.current?.();
    },
    []
  );

  // Clean up held state if window blurs or document hides
  useEffect(() => {
    const handleRelease = () => {
      if (isPressedRef.current) {
        isPressedRef.current = false;
        pressSourceRef.current = null;
        lastReleaseTimeRef.current = Date.now();
        setIsPressed(false);
        onReleaseRef.current?.();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleRelease();
      }
    };

    window.addEventListener("blur", handleRelease);
    window.addEventListener("pagehide", handleRelease);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleRelease);
      window.removeEventListener("pagehide", handleRelease);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (isPressedRef.current) {
        isPressedRef.current = false;
        onReleaseRef.current?.();
      }
    };
  }, []);

  const pressProps: PressHandlers = {
    onPointerDown: (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      startPress("pointer", event);
    },
    onPointerUp: (event) => {
      endPress("pointer", event);
    },
    onPointerCancel: (event) => {
      endPress("pointer", event);
    },
    onPointerLeave: (event) => {
      endPress("pointer", event);
    },
    onTouchStart: (event) => {
      startPress("touch", event);
    },
    onTouchEnd: (event) => {
      endPress("touch", event);
    },
    onTouchCancel: (event) => {
      endPress("touch", event);
    },
    onMouseDown: (event) => {
      if (event.button !== 0) return;
      startPress("mouse", event);
    },
    onMouseUp: (event) => {
      endPress("mouse", event);
    },
    onMouseLeave: (event) => {
      endPress("mouse", event);
    },
    onKeyDown: (event) => {
      customKeyDownRef.current?.(event);
      if (event.defaultPrevented) return;

      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        startPress("keyboard", event);
      }
    },
    onKeyUp: (event) => {
      customKeyUpRef.current?.(event);
      if (event.defaultPrevented) return;

      if (event.key === " " || event.key === "Enter") {
        endPress("keyboard", event);
      }
    },
    onClick: (event) => {
      customClickRef.current?.(event);
      if (event.defaultPrevented) return;

      // Deduplicate: if an active press or recent release (within 500ms) occurred, ignore synthetic click
      const timeSinceRelease = Date.now() - lastReleaseTimeRef.current;
      if (isPressedRef.current || timeSinceRelease < 500) {
        return;
      }

      // Assistive technology activation without prior keydown/pointerdown
      if (disabled) return;
      if (event.cancelable) {
        event.preventDefault();
      }
      triggerFeedback();
      onPressRef.current?.();
      onReleaseRef.current?.();
      lastReleaseTimeRef.current = Date.now();
    },
    onBlur: () => {
      if (isPressedRef.current && pressSourceRef.current === "keyboard") {
        endPress("keyboard");
      }
    },
  };

  return { isPressed, pressProps };
}

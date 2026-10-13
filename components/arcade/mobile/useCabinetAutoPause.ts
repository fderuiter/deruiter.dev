"use client";

import { useEffect, useRef } from "react";

export interface CabinetAutoPauseOptions {
  /**
   * Pause when the device rotates. Only a phone-class cabinet asks for this:
   * a tablet reflows cleanly, so rotating it must not stop a running room
   * (ADR 0061). Defaults to false.
   */
  pauseOnRotate?: boolean;
}

/**
 * Calls `onPause` when a game should stop on its own: the tab is hidden, the
 * page is being unloaded, the window loses focus, or, for a phone-class cabinet
 * (`pauseOnRotate`), the device rotates. The game decides how to resume; this
 * hook only reports the moment to stop.
 *
 * Listeners are attached only while `onPause` is a function, so a cabinet that
 * passes no handler, as every desktop cabinet does today, adds none.
 *
 * @param onPause - The pause handler, or undefined to stay inactive.
 * @param options - Which pause triggers apply to this cabinet.
 */
export function useCabinetAutoPause(
  onPause?: () => void,
  options: CabinetAutoPauseOptions = {}
): void {
  const onPauseRef = useRef(onPause);
  useEffect(() => {
    onPauseRef.current = onPause;
  });

  const active = typeof onPause === "function";
  const pauseOnRotate = options.pauseOnRotate === true;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const fire = () => onPauseRef.current?.();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") fire();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", fire);
    window.addEventListener("blur", fire);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", fire);
      window.removeEventListener("blur", fire);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !pauseOnRotate || typeof window === "undefined") return;
    const fire = () => onPauseRef.current?.();
    // One rotation, one pause: the Screen Orientation API when it exists,
    // otherwise the legacy event. Never both.
    const useScreenOrientation =
      typeof screen !== "undefined" &&
      !!screen.orientation &&
      typeof screen.orientation.addEventListener === "function";
    if (useScreenOrientation) {
      screen.orientation.addEventListener("change", fire);
    } else {
      window.addEventListener("orientationchange", fire);
    }
    return () => {
      if (useScreenOrientation) {
        screen.orientation.removeEventListener("change", fire);
      } else {
        window.removeEventListener("orientationchange", fire);
      }
    };
  }, [active, pauseOnRotate]);
}

"use client";

import { useEffect, useRef } from "react";

/** What made the cabinet stop on its own. */
type AutoPauseReason = "hidden" | "blur" | "rotate";

interface CabinetAutoPauseOptions {
  /**
   * Pause when the device rotates. Only a phone-class cabinet asks for this:
   * a tablet reflows cleanly, so rotating it must not stop a running room
   * (ADR 0061). Defaults to false.
   */
  pauseOnRotate?: boolean;
  /**
   * Pause when the window loses focus. A touch cabinet asks for this; a
   * desktop window that loses focus to another window keeps playing.
   * Defaults to true.
   */
  pauseOnBlur?: boolean;
  /**
   * Called right after the pause when the page hides (`visibilitychange` to
   * hidden, or `pagehide`), the session's synchronous moment to save its
   * run. `beforeunload` is never used: iOS Safari does not fire it reliably.
   */
  onSuspend?: () => void;
}

/**
 * Calls `onPause` when a game should stop on its own: the tab is hidden, the
 * page is being unloaded, the window loses focus, or, for a phone-class cabinet
 * (`pauseOnRotate`), the device rotates. It passes the reason. The game, or
 * the cabinet's pause service (#2357), decides how to resume; this hook only
 * reports the moment to stop.
 *
 * Listeners are attached only while `onPause` is a function, so a cabinet that
 * passes no handler, as every desktop cabinet without views does, adds none.
 *
 * @param onPause - The pause handler, or undefined to stay inactive.
 * @param options - Which pause triggers apply to this cabinet.
 */
export function useCabinetAutoPause(
  onPause?: (reason: AutoPauseReason) => void,
  options: CabinetAutoPauseOptions = {}
): void {
  const onPauseRef = useRef(onPause);
  const onSuspendRef = useRef(options.onSuspend);
  useEffect(() => {
    onPauseRef.current = onPause;
    onSuspendRef.current = options.onSuspend;
  });

  const active = typeof onPause === "function";
  const pauseOnRotate = options.pauseOnRotate === true;
  const pauseOnBlur = options.pauseOnBlur !== false;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const hide = () => {
      onPauseRef.current?.("hidden");
      onSuspendRef.current?.();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") hide();
    };
    const handleBlur = () => onPauseRef.current?.("blur");
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", hide);
    if (pauseOnBlur) window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", hide);
      if (pauseOnBlur) window.removeEventListener("blur", handleBlur);
    };
  }, [active, pauseOnBlur]);

  useEffect(() => {
    if (!active || !pauseOnRotate || typeof window === "undefined") return;
    const fire = () => onPauseRef.current?.("rotate");
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

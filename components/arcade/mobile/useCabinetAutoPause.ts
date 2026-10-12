"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onPause` when a game should stop on its own: the tab is hidden, the
 * page is being unloaded, the window loses focus, or the device rotates. The
 * game decides how to resume; this hook only reports the moment to stop.
 *
 * Listeners are attached only while `onPause` is a function, so a cabinet that
 * passes no handler, as every desktop cabinet does today, adds none.
 *
 * @param onPause - The pause handler, or undefined to stay inactive.
 */
export function useCabinetAutoPause(onPause?: () => void): void {
  const onPauseRef = useRef(onPause);
  useEffect(() => {
    onPauseRef.current = onPause;
  });

  const active = typeof onPause === "function";

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const fire = () => onPauseRef.current?.();
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") fire();
    };
    const orientation =
      typeof screen !== "undefined" ? screen.orientation : undefined;

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", fire);
    window.addEventListener("blur", fire);
    window.addEventListener("orientationchange", fire);
    orientation?.addEventListener?.("change", fire);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", fire);
      window.removeEventListener("blur", fire);
      window.removeEventListener("orientationchange", fire);
      orientation?.removeEventListener?.("change", fire);
    };
  }, [active]);
}

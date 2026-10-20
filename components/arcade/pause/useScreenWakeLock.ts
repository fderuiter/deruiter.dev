"use client";

import { useEffect } from "react";

interface WakeLockSentinelLike {
  readonly released?: boolean;
  release: () => Promise<void>;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

function getWakeLock(): WakeLockLike | null {
  if (typeof navigator === "undefined") return null;
  const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike })
    .wakeLock;
  return typeof wakeLock?.request === "function" ? wakeLock : null;
}

/**
 * Holds a screen wake lock while `active` is true, so the screen does not dim
 * in the middle of a real-time run (#2357). The lock is released when
 * `active` turns false. The browser drops the lock itself when the page is
 * hidden, so it is asked for again when the page is visible and `active` is
 * still true. Where the Screen Wake Lock API is missing, or the browser
 * refuses, this does nothing.
 *
 * @param active - Whether the screen should stay awake.
 */
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    const wakeLock = getWakeLock();
    if (!active || !wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;
    let pending = false;

    const acquire = () => {
      if (disposed || pending) return;
      if (sentinel && !sentinel.released) return;
      if (document.visibilityState !== "visible") return;
      pending = true;
      wakeLock.request("screen").then(
        (lock) => {
          pending = false;
          if (disposed) {
            void lock.release().catch(() => {});
            return;
          }
          sentinel = lock;
        },
        () => {
          // Refused, for example on low battery. Play goes on without it.
          pending = false;
        }
      );
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (sentinel && !sentinel.released) {
        void sentinel.release().catch(() => {});
      }
      sentinel = null;
    };
  }, [active]);
}

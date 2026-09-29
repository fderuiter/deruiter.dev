"use client";

import React, { useCallback, useSyncExternalStore } from "react";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";

/**
 * Props for the MedicalDisclaimerBanner component.
 */
interface MedicalDisclaimerBannerProps {
  /** Optional callback invoked when the user dismisses the disclaimer banner. */
  onDismiss?: () => void;
  /** Optional compact styling flag. */
  compact?: boolean;
  /** Optional CSS class overrides. */
  className?: string;
  /** Force show banner regardless of session storage (useful in isolation tests). */
  forceShow?: boolean;
}

const STORAGE_KEY = "patrol_shift_disclaimer_dismissed";

const disclaimerListeners = new Set<() => void>();
let inMemoryDismissed = false;

function subscribeDisclaimer(callback: () => void): () => void {
  disclaimerListeners.add(callback);
  if (typeof window !== "undefined") {
    try {
      window.addEventListener("storage", callback);
    } catch {
      // Storage events unavailable
    }
  }
  return () => {
    disclaimerListeners.delete(callback);
    if (typeof window !== "undefined") {
      try {
        window.removeEventListener("storage", callback);
      } catch {
        // Ignore removal error
      }
    }
  };
}

function getIsSessionDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (typeof window.sessionStorage?.getItem === "function") {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return stored === "true";
      }
      return false;
    }
  } catch {
    // Storage access blocked or restricted in sandbox
    return inMemoryDismissed;
  }
  return inMemoryDismissed;
}

function setSessionDismissed(dismissed: boolean): void {
  inMemoryDismissed = dismissed;
  if (typeof window !== "undefined") {
    try {
      if (typeof window.sessionStorage?.setItem === "function") {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          dismissed ? "true" : "false"
        );
      }
    } catch {
      // Storage access blocked or restricted
    }
  }
  disclaimerListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Persistent, non-blocking, dismissible-per-session medical disclaimer banner.
 * Conforms to WCAG AA requirements by not relying on color alone, providing
 * minimum 44x44px touch targets, explicit iconography, high-contrast borders,
 * and an accessible reopen trigger when minimized.
 *
 * Notice: Educational simulation prototype.
 * // PLACEHOLDER — needs OEC/NSP content review, see #744
 */
export const MedicalDisclaimerBanner: React.FC<
  MedicalDisclaimerBannerProps
> = ({ onDismiss, compact = false, className = "", forceShow = false }) => {
  const isSessionDismissed = useSyncExternalStore(
    subscribeDisclaimer,
    getIsSessionDismissed,
    () => false
  );

  const isDismissed = forceShow ? false : isSessionDismissed;

  const handleDismiss = useCallback(() => {
    setSessionDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const handleReopen = useCallback(() => {
    setSessionDismissed(false);
  }, []);

  if (isDismissed && !forceShow) {
    return (
      <aside
        aria-label="Medical Disclaimer Minimized Bar"
        className={`flex items-center justify-end ${className}`}
        data-testid="medical-disclaimer-minimized"
      >
        <button
          type="button"
          onClick={handleReopen}
          data-testid="medical-disclaimer-reopen"
          aria-label="Show medical and clinical simulation disclaimer"
          className="min-h-[44px] min-w-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-mono transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold underline underline-offset-2">
            Simulation Notice &amp; Medical Disclaimer
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      role="note"
      aria-label="Medical & Clinical Disclaimer"
      data-testid="medical-disclaimer-banner"
      className={`relative w-full rounded-2xl border-2 transition-all ${
        compact
          ? "p-3 bg-amber-950/40 border-amber-500/60 text-amber-200 text-xs font-mono"
          : "p-4 sm:p-5 bg-amber-950/40 border-amber-500/70 text-amber-200 text-xs font-mono shadow-lg shadow-amber-950/20"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2.5 border-b border-amber-500/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0">
            <IconAlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs sm:text-sm font-mono font-bold text-amber-300 uppercase tracking-wider">
                Simulation Notice &amp; Medical Disclaimer
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/50 text-amber-200 text-[10px] font-mono font-bold uppercase tracking-wider">
                Educational Prototype
              </span>
            </div>
            <span className="text-[11px] text-amber-300/80 font-mono">
              Non-clinical simulation artifact
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          data-testid="medical-disclaimer-dismiss"
          aria-label="Dismiss medical disclaimer for this session"
          className="min-h-[44px] min-w-[44px] shrink-0 self-end sm:self-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.98] border border-amber-500/40 hover:border-amber-500/60 text-amber-300 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <IconX className="w-4 h-4" />
          <span className="text-xs font-mono font-semibold">
            Dismiss for Session
          </span>
        </button>
      </div>

      <div className="pt-2.5 space-y-2 text-amber-100/90 font-sans leading-relaxed text-xs">
        <p>
          <strong>Notice:</strong> Patrol Shift is an architectural simulation
          prototype under active development. It models operational dispatch,
          toboggan descent dynamics, and state machines for educational and
          software architecture demonstration purposes.
        </p>
        <p className="text-[11px] text-amber-200/80">
          It does <strong>not</strong> provide certified clinical guidance,
          certified medical diagnosis, National Ski Patrol (NSP) Outdoor
          Emergency Care (OEC) standardized treatment protocols, or real-world
          emergency decision support. Real mountain incidents require certified
          first responders. In a real emergency, contact local ski patrol or
          dial 911 immediately.
        </p>
      </div>
    </aside>
  );
};

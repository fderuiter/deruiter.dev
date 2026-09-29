"use client";

import React, { createContext, useContext, useSyncExternalStore, useMemo } from "react";
import { useConsoleArt } from "@/hooks/useConsoleArt";
import {
  liveAnnouncer,
  initialAnnouncerState,
  type Priority,
  type AnnounceItem,
  type AnnouncerState,
  LiveAnnouncer,
  sanitizePII,
} from "@/lib/a11y/announcer";

export type { Priority, AnnounceItem, AnnouncerState };
export { sanitizePII, initialAnnouncerState, liveAnnouncer, LiveAnnouncer };

export interface AnnouncerContextType {
  announce: (message: string, priority?: Priority) => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

const fallbackAnnouncer: AnnouncerContextType = {
  announce: (message: string, priority?: Priority) => {
    liveAnnouncer.announce(message, priority);
  },
};

/**
 * Hook providing access to the screen reader LiveAnnouncer dispatcher.
 */
export function useAnnouncer(): AnnouncerContextType {
  const ctx = useContext(AnnouncerContext);
  return ctx ?? fallbackAnnouncer;
}

export interface A11yProviderProps {
  children: React.ReactNode;
  announcer?: LiveAnnouncer;
}

/**
 * Lightweight screen reader live region DOM renderer and context provider.
 */
export function A11yProvider({ children, announcer = liveAnnouncer }: A11yProviderProps) {
  useConsoleArt();
  const state = useSyncExternalStore(
    (cb) => announcer.subscribe(cb),
    () => announcer.getSnapshot(),
    () => initialAnnouncerState
  );

  const value = useMemo<AnnouncerContextType>(
    () => ({
      announce: (message: string, priority?: Priority) => {
        announcer.announce(message, priority);
      },
    }),
    [announcer]
  );

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state.activePolite?.text || ""}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {state.activeAssertive?.text || ""}
      </div>
    </AnnouncerContext.Provider>
  );
}

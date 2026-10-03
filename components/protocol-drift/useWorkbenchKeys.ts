"use client";

import { useCallback } from "react";
import { useProtocolDriftStore } from "./store";

const INTERACTIVE =
  "button, input, select, textarea, a, summary, [role='dialog']";

/**
 * Keyboard shortcuts for the workbench root: Space pauses or runs, N steps one
 * hour, I expands the inspector and Escape docks it again. Keys that belong to
 * a focused control or an open dialog are left alone.
 */
export function useWorkbenchKeys(): (event: React.KeyboardEvent) => void {
  return useCallback((event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const store = useProtocolDriftStore.getState();
    if (event.key === "Escape") {
      if (store.inspectorExpanded && !target?.closest("[role='dialog']")) {
        event.preventDefault();
        event.stopPropagation();
        store.setInspectorExpanded(false);
      }
      return;
    }
    if (target?.closest(INTERACTIVE)) return;
    const fsm = store.snapshot?.fsmState;
    if (!fsm || fsm === "BRIEF") return;
    switch (event.key) {
      case " ":
        event.preventDefault();
        void store.togglePause();
        return;
      case "n":
      case "N":
        event.preventDefault();
        void store.step();
        return;
      case "i":
      case "I":
        event.preventDefault();
        store.setInspectorExpanded(!store.inspectorExpanded);
        return;
    }
  }, []);
}

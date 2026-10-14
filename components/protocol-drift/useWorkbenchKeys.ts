"use client";

import { useCallback } from "react";
import { useProtocolDriftStore } from "./store";

/** Targets that own every key: text entry and open dialogs. */
const TEXT_ENTRY =
  "input, select, textarea, [contenteditable='true'], [role='dialog']";
/** Targets that own Space and Enter but have no use for letter keys. */
const INTERACTIVE = `button, a, summary, ${TEXT_ENTRY}`;
/** The clock controls, where Space should keep meaning pause or run. */
const CLOCK_GROUP = "[role='group'][aria-label='Clock']";

/**
 * Keyboard shortcuts for the workbench root: Space pauses or runs, N steps one
 * hour, I expands the inspector and Escape docks it again. Text fields and
 * dialogs keep every key. A focused button keeps Space unless it is one of the
 * clock controls, so clicking 5x and then pressing Space still pauses; N and I
 * work over any button.
 */
export function useWorkbenchKeys(): (event: React.KeyboardEvent) => void {
  return useCallback((event: React.KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const store = useProtocolDriftStore.getState();
    if (event.key === "Escape") {
      if (target?.closest("[role='dialog']")) return;
      // A started wire is cancelled first, so Escape never closes the cabinet
      // mid-wire on the touch cabinet (#2045).
      if (store.wireFrom) {
        event.preventDefault();
        event.stopPropagation();
        store.setWireFrom(null);
        store.notify("info", "Wiring cancelled.");
        return;
      }
      if (store.inspectorExpanded) {
        event.preventDefault();
        event.stopPropagation();
        store.setInspectorExpanded(false);
      }
      return;
    }
    if (target?.closest(TEXT_ENTRY)) return;
    const fsm = store.snapshot?.fsmState;
    if (!fsm || fsm === "BRIEF") return;
    switch (event.key) {
      case " ":
        if (target?.closest(INTERACTIVE) && !target.closest(CLOCK_GROUP)) {
          return;
        }
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

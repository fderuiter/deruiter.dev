/**
 * Single source of truth for NeuroRecon Studio tool hotkeys.
 *
 * Scenario copy, onboarding, the toolbar, the field manual, and the global key
 * handler all derive their labels and bindings from this table.
 */

import type { ToolMode } from "./types";

/** Hotkey binding metadata for a studio tool. */
export interface NeuroToolHotkey {
  /** Tool activated by the binding. */
  tool: ToolMode;
  /** Numeric shortcut. */
  digit: string;
  /** Mnemonic letter shortcut (uppercase for display). */
  letter: string;
  /** Short human-readable tool name. */
  name: string;
}

/** Tool hotkeys keyed by tool mode. */
export const NEURO_TOOL_HOTKEYS: Record<ToolMode, NeuroToolHotkey> = {
  inspect: { tool: "inspect", digit: "1", letter: "V", name: "Inspect" },
  control_point: {
    tool: "control_point",
    digit: "2",
    letter: "C",
    name: "Control Point",
  },
  paint: { tool: "paint", digit: "3", letter: "B", name: "Voxel Paint" },
  erase: { tool: "erase", digit: "4", letter: "E", name: "Voxel Erase" },
  roi_select: {
    tool: "roi_select",
    digit: "5",
    letter: "G",
    name: "ROI Region Grow",
  },
};

/** Letter key that runs the recon-all pipeline (Space also works). */
export const NEURO_RUN_RECON_KEY = "R";

/** Display label such as "Voxel Erase (E key)". */
export function formatNeuroToolKey(tool: ToolMode): string {
  const h = NEURO_TOOL_HOTKEYS[tool];
  return `${h.name} (${h.letter} key)`;
}

/** Action resolved from a keyboard event. */
export type NeuroHotkeyAction =
  { type: "tool"; tool: ToolMode } | { type: "run" } | { type: "manual" };

/** Minimal event shape needed to resolve a hotkey. */
export interface NeuroHotkeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target: EventTarget | null;
}

const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const ACTIVATING_TAGS = new Set(["BUTTON", "A", "SUMMARY"]);

/**
 * Resolve a keydown event to a studio action, or null when it must be ignored:
 * modifier chords, text entry, and (for Space only) natively activating
 * controls, which would otherwise fire twice.
 */
export function resolveNeuroHotkey(
  e: NeuroHotkeyEventLike
): NeuroHotkeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const target = e.target as HTMLElement | null;
  if (!target) return null;
  if (
    TEXT_ENTRY_TAGS.has(target.tagName) ||
    target.isContentEditable ||
    target.closest?.('[role="textbox"],[role="combobox"],[role="dialog"]')
  ) {
    return null;
  }
  const key = e.key.toLowerCase();
  for (const h of Object.values(NEURO_TOOL_HOTKEYS)) {
    if (key === h.digit || key === h.letter.toLowerCase()) {
      return { type: "tool", tool: h.tool };
    }
  }
  if (key === NEURO_RUN_RECON_KEY.toLowerCase()) return { type: "run" };
  if (e.key === " ") {
    if (
      ACTIVATING_TAGS.has(target.tagName) ||
      target.getAttribute?.("role") === "button"
    ) {
      return null;
    }
    return { type: "run" };
  }
  if (key === "m" || e.key === "?") return { type: "manual" };
  return null;
}

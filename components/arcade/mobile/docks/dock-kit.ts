"use client";

import { useEffect, useRef } from "react";
import type { ActionMap } from "@/lib/arcade";

/**
 * A dock's key size: `sm` is the 44px touch floor, `md` 52px and `lg` 60px.
 * The device setting (#2362) picks one per device; until then a game passes
 * its own.
 */
export type DockSize = "sm" | "md" | "lg";

/** Each dock size's key edge, in px. */
export const DOCK_KEY_PX: Readonly<Record<DockSize, number>> = Object.freeze({
  sm: 44,
  md: 52,
  lg: 60,
});

/** The classes that size one square key. */
export const DOCK_KEY_CLASS: Readonly<Record<DockSize, string>> = Object.freeze(
  {
    sm: "h-11 w-11",
    md: "h-[52px] w-[52px]",
    lg: "h-[60px] w-[60px]",
  }
);

/** The look every dock key shares, on the site's graphite palette. */
export const DOCK_KEY_STYLE =
  "flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/90 font-mono text-xs font-bold text-zinc-100 active:bg-amber-500/25 active:text-amber-200";

/**
 * The name a player hears for an action: its label from the map, so the
 * dock, the key hints and the manual say the same thing.
 *
 * @param map - The game's action map.
 * @param action - The action.
 * @returns The action's label, or the action name for an unknown one.
 */
export function dockActionLabel<A extends string>(
  map: ActionMap<A>,
  action: A
): string {
  return map.actions[action]?.label ?? action;
}

// The docks inside one stage, each with its height. The stage gets the
// tallest, as the dock row is as tall as its tallest dock.
const reported = new WeakMap<HTMLElement, Map<symbol, number>>();

function publish(target: HTMLElement) {
  const heights = reported.get(target);
  const tallest = heights ? Math.max(0, ...heights.values()) : 0;
  if (tallest > 0) {
    target.style.setProperty("--layout-dock-height", `${tallest}px`);
  } else {
    target.style.removeProperty("--layout-dock-height");
  }
}

/**
 * Reports a dock's rendered height as `--layout-dock-height` on the stage
 * that holds it (`.arcade-stage`, else the dock's parent), so the stage
 * budget leaves the dock its room. Two docks in one stage report the taller.
 *
 * @returns A ref for the dock's root element.
 */
export function useDockHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const dock = ref.current;
    const target =
      dock?.closest<HTMLElement>(".arcade-stage") ?? dock?.parentElement;
    if (!dock || !target) return;
    const id = Symbol("dock");
    const heights = reported.get(target) ?? new Map<symbol, number>();
    reported.set(target, heights);
    const measure = () => {
      heights.set(id, Math.round(dock.getBoundingClientRect().height));
      publish(target);
    };
    measure();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(dock);
    return () => {
      observer?.disconnect();
      heights.delete(id);
      publish(target);
    };
  }, []);
  return ref;
}

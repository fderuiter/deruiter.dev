"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import { ActionSinkProvider, type ActionInput } from "@/lib/arcade";
import {
  DUCK_ACTIONS,
  type DuckActionName,
} from "@/lib/working-with-duck-actions";

/** Duck actions that carry or drop Duck, or pause on Escape: keyboard and gamepad only. */
type DuckKeyOnlyAction =
  "escape" | "drag-up" | "drag-down" | "drag-left" | "drag-right" | "drop";

/**
 * The game actions the keyboard, the gamepad and the touch cabinet all
 * perform (ADR 0061, #2356). They are the actions of `DUCK_ACTIONS`, less the
 * key-only carry and Escape, plus the cabinet's auto-pause. A key or a touch
 * button names one of these, and the game runs it, so the inputs cannot
 * drift apart.
 */
export type DuckCommand =
  Exclude<DuckActionName, DuckKeyOnlyAction> | "auto-pause";

const KEY_ONLY_ACTIONS: ReadonlySet<string> = new Set<DuckKeyOnlyAction>([
  "escape",
  "drag-up",
  "drag-down",
  "drag-left",
  "drag-right",
  "drop",
]);

/**
 * Whether an action is one the bridge runs as a command.
 *
 * @param action - A Duck action name.
 * @returns True for every action but the key-only carry and Escape.
 */
export function isDuckCommand(
  action: DuckActionName
): action is Exclude<DuckActionName, DuckKeyOnlyAction> {
  return !KEY_ONLY_ACTIONS.has(action);
}

/** The part of the game the touch dock shows controls for. */
export interface DuckTouchSnapshot {
  scene: "office" | "park" | "bath";
  /** True while the park throw is being aimed, so Space throws. */
  aiming: boolean;
  /** True while the sprint is paused at all, for any reason. */
  paused: boolean;
  /**
   * True only when the player paused it, with P, the pause key or the
   * cabinet's auto-pause. Pausing for a scrapbook, wardrobe, manual or a hidden
   * tab is not this, and the dock offers no Resume for those.
   */
  manualPause: boolean;
}

/**
 * A small store between the cabinet's control dock, which sits beside the
 * game, and the game, which owns the state. The game publishes its scene and
 * registers a runner; the dock subscribes to the scene and calls the runner.
 */
export interface DuckTouchBridge {
  getSnapshot: () => DuckTouchSnapshot;
  subscribe: (listener: () => void) => () => void;
  publish: (snapshot: DuckTouchSnapshot) => void;
  setRunner: (runner: ((command: DuckCommand) => void) | null) => void;
  run: (command: DuckCommand) => void;
}

const INITIAL_SNAPSHOT: DuckTouchSnapshot = {
  scene: "office",
  aiming: false,
  paused: false,
  manualPause: false,
};

/**
 * Creates one bridge for a cabinet. Each page instance owns its own.
 *
 * @returns A fresh bridge with no runner and the office scene.
 */
export function createDuckTouchBridge(): DuckTouchBridge {
  let snapshot = INITIAL_SNAPSHOT;
  let runner: ((command: DuckCommand) => void) | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (next) => {
      if (
        next.scene === snapshot.scene &&
        next.aiming === snapshot.aiming &&
        next.paused === snapshot.paused &&
        next.manualPause === snapshot.manualPause
      ) {
        return;
      }
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
    setRunner: (next) => {
      runner = next;
    },
    run: (command) => {
      runner?.(command);
    },
  };
}

const DuckTouchContext = createContext<DuckTouchBridge | null>(null);

/**
 * Hands one bridge to the game and to the cabinet's control dock below it.
 * The dock's action-bound buttons send their actions through it to the game's
 * runner: a press runs the command, a release does nothing.
 *
 * @param props - The bridge and the cabinet.
 * @returns The children, with the bridge in context.
 */
export function DuckTouchProvider({
  bridge,
  children,
}: {
  bridge: DuckTouchBridge;
  children: React.ReactNode;
}) {
  const runAction = useCallback(
    (input: ActionInput<DuckActionName>) => {
      if (input.phase === "down" && isDuckCommand(input.action)) {
        bridge.run(input.action);
      }
    },
    [bridge]
  );
  return (
    <DuckTouchContext.Provider value={bridge}>
      <ActionSinkProvider actions={DUCK_ACTIONS} onAction={runAction}>
        {children}
      </ActionSinkProvider>
    </DuckTouchContext.Provider>
  );
}

/**
 * The bridge from the nearest provider, or null outside a cabinet (such as in
 * a unit test that renders the game alone).
 *
 * @returns The bridge, or null.
 */
export function useDuckTouchBridge(): DuckTouchBridge | null {
  return useContext(DuckTouchContext);
}

/**
 * Subscribes to the game's published scene. Without a bridge it reads the
 * office scene, unpaused.
 *
 * @param bridge - The bridge, or null.
 * @returns The latest published snapshot.
 */
export function useDuckTouchSnapshot(
  bridge: DuckTouchBridge | null
): DuckTouchSnapshot {
  const subscribe = useCallback(
    (listener: () => void) => (bridge ? bridge.subscribe(listener) : () => {}),
    [bridge]
  );
  const getSnapshot = useCallback(
    () => (bridge ? bridge.getSnapshot() : INITIAL_SNAPSHOT),
    [bridge]
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_SNAPSHOT);
}

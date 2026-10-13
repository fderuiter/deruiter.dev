"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

/**
 * The game actions the keyboard and the touch cabinet both perform (ADR 0061).
 * A key or a touch button names one of these, and the game runs it, so the
 * two inputs cannot drift apart.
 */
export type DuckCommand =
  | "toy-1"
  | "toy-2"
  | "toy-3"
  | "treat"
  | "trick-sit"
  | "trick-high-five"
  | "trick-drop-it"
  | "trick-spin"
  | "space"
  | "steer-up"
  | "steer-down"
  | "pause"
  | "auto-pause";

/** The part of the game the touch dock shows controls for. */
export interface DuckTouchSnapshot {
  scene: "office" | "park" | "bath";
  /** True while the park throw is being aimed, so Space throws. */
  aiming: boolean;
  paused: boolean;
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
        next.paused === snapshot.paused
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
  return (
    <DuckTouchContext.Provider value={bridge}>
      {children}
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

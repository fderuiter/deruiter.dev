"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { RunFairness, SessionRng, StepClock } from "@/lib/arcade";
import { useArcadeSession } from "./ArcadeSessionProvider";

/** Paints one frame. `alpha` is how far the loop is between fixed steps. */
export type FramePainter = (alpha: number) => void;

/**
 * A game's session as an external store (ADR 0062). The session owns the
 * game and its fixed-step loop; views read state through
 * {@link useSessionSelector}, send intents with `dispatch`, and paint through
 * `onFrame`, so a frame never re-renders React.
 *
 * Methods must not rely on `this`, since views call them detached.
 */
export interface ArcadeSession<State, Intent> {
  /** The current state. Returns the same object until the state changes. */
  readonly getState: () => State;
  /** Calls `listener` after every state change. Returns an unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Sends one intent, such as a move or a pause, to the game. */
  readonly dispatch: (intent: Intent) => void;
  /**
   * Calls `paint` once per frame while the loop runs, for a game that draws
   * to a canvas. Returns an unsubscribe. A session without a loop omits it.
   */
  readonly onFrame?: (paint: FramePainter) => () => void;
  /**
   * The run as plain data, for a view swap, a save on hide and Resume. The
   * pause service (#2357) defines the versioned envelope around it.
   */
  readonly snapshot?: () => unknown;
  /**
   * Restores a run from {@link ArcadeSession.snapshot}'s data. The saved
   * `rng` state and `step` are applied after it returns, so `restore` keeps
   * the same `rng` and `clock` objects rather than replacing them.
   */
  readonly restore?: (data: unknown) => void;
  /**
   * The gameplay random stream (#2544), from `createRng(seed)`. Every draw
   * that changes game state or score comes from it; views keep their own
   * cosmetic randomness. Its state is saved with the run as `rngState`.
   */
  readonly rng?: SessionRng;
  /**
   * The fixed-step clock (#2544), from `createStepClock()`. The loop runs the
   * game in its constant `dt`; its step count is saved with the run.
   */
  readonly clock?: StepClock;
  /** The input tuning this run plays with, such as touch assist strengths. */
  readonly tuning?: Readonly<Record<string, number | boolean>>;
  /**
   * The run's fairness record (#2547), from `createRunFairness(policy)`.
   * Its assists key on the input and ratchet within the run; the views note
   * the view and input with `useRunFairness`, and the run snapshot saves and
   * restores its tags.
   */
  readonly fairness?: RunFairness;
}

/**
 * A minimal session store: state changed only by a pure reducer, with no
 * loop. Games with a loop build their own session that also offers
 * `onFrame`; this suits turn-based games and tests.
 *
 * @param initial - The starting state.
 * @param reduce - Returns the next state for an intent, or the same state.
 * @returns The session.
 */
export function createArcadeStore<State, Intent>(
  initial: State,
  reduce: (state: State, intent: Intent) => State
): ArcadeSession<State, Intent> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(intent) {
      const next = reduce(state, intent);
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * A slice of the nearest session's state. The component re-renders only
 * when the slice changes. A selector that builds a new object or array
 * passes `isEqual`, such as a shallow compare, so an unchanged slice keeps
 * its previous value.
 *
 * @param selector - Picks the slice from the state.
 * @param isEqual - Whether two slices are the same. Defaults to `Object.is`.
 * @returns The slice.
 */
export function useSessionSelector<State, Selected>(
  selector: (state: State) => Selected,
  isEqual: (a: Selected, b: Selected) => boolean = Object.is
): Selected {
  const session = useArcadeSession<ArcadeSession<State, unknown>>();
  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(listener),
    [session]
  );
  // Holds the last slice so an equal one returns the same value.
  const cache = useRef<{ slice: Selected } | null>(null);
  const read = () => {
    const next = selector(session.getState());
    const previous = cache.current;
    if (previous && isEqual(previous.slice, next)) return previous.slice;
    cache.current = { slice: next };
    return next;
  };
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * The nearest session's `dispatch`.
 *
 * @returns A function that sends one intent to the game.
 */
export function useSessionDispatch<Intent>(): (intent: Intent) => void {
  return useArcadeSession<ArcadeSession<unknown, Intent>>().dispatch;
}

/**
 * Paints on every frame of the nearest session's loop while the calling view
 * is mounted. The latest `paint` is used, so it can close over props.
 *
 * @param paint - Draws one frame.
 */
export function useSessionFrame(paint: FramePainter): void {
  const session = useArcadeSession<ArcadeSession<unknown, unknown>>();
  const paintRef = useRef(paint);
  useEffect(() => {
    paintRef.current = paint;
  });
  useEffect(
    () => session.onFrame?.((alpha) => paintRef.current(alpha)),
    [session]
  );
}

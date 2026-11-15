"use client";

import { useCallback, useReducer } from "react";

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UseHistoryOptions<T> {
  /** Maximum number of previous states to retain in the past stack (default: 50). */
  capacity?: number;
  /** Custom equality function to avoid pushing duplicate states when a mutation produces identical output. */
  isEqual?: (a: T, b: T) => boolean;
}

export type HistoryUpdater<T> = T | ((prev: T) => T);

type HistoryAction<T> =
  | {
      type: "COMMIT";
      updater: HistoryUpdater<T>;
      capacity: number;
      isEqual?: (a: T, b: T) => boolean;
    }
  | {
      type: "SET_PRESENT";
      updater: HistoryUpdater<T>;
      isEqual?: (a: T, b: T) => boolean;
    }
  | { type: "UNDO"; capacity: number }
  | { type: "REDO"; capacity: number }
  | { type: "RESET"; newPresent: T };

function historyReducer<T>(
  state: HistoryState<T>,
  action: HistoryAction<T>
): HistoryState<T> {
  switch (action.type) {
    case "COMMIT": {
      const nextPresent =
        typeof action.updater === "function"
          ? (action.updater as (prev: T) => T)(state.present)
          : action.updater;
      if (
        state.present === nextPresent ||
        (action.isEqual && action.isEqual(state.present, nextPresent))
      ) {
        return state;
      }
      return {
        past: [...state.past.slice(-(action.capacity - 1)), state.present],
        present: nextPresent,
        future: [],
      };
    }
    case "SET_PRESENT": {
      const nextPresent =
        typeof action.updater === "function"
          ? (action.updater as (prev: T) => T)(state.present)
          : action.updater;
      if (
        state.present === nextPresent ||
        (action.isEqual && action.isEqual(state.present, nextPresent))
      ) {
        return state;
      }
      return {
        ...state,
        present: nextPresent,
      };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future].slice(0, action.capacity),
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past.slice(-(action.capacity - 1)), state.present],
        present: next,
        future: newFuture,
      };
    }
    case "RESET": {
      return {
        past: [],
        present: action.newPresent,
        future: [],
      };
    }
  }
}

/**
 * Shared history primitive providing atomic undo and redo stacks with functional updates.
 */
export function useHistory<T>(
  initialPresent: T | (() => T),
  options?: UseHistoryOptions<T>
) {
  const capacity = options?.capacity ?? 50;
  const isEqual = options?.isEqual;

  const [state, dispatch] = useReducer(
    historyReducer<T>,
    undefined,
    (): HistoryState<T> => {
      const initial =
        typeof initialPresent === "function"
          ? (initialPresent as () => T)()
          : initialPresent;
      return {
        past: [],
        present: initial,
        future: [],
      };
    }
  );

  const commit = useCallback(
    (updater: HistoryUpdater<T>) => {
      dispatch({ type: "COMMIT", updater, capacity, isEqual });
    },
    [capacity, isEqual]
  );

  const setWithoutUndo = useCallback(
    (updater: HistoryUpdater<T>) => {
      dispatch({ type: "SET_PRESENT", updater, isEqual });
    },
    [isEqual]
  );

  const undo = useCallback(() => {
    dispatch({ type: "UNDO", capacity });
  }, [capacity]);

  const redo = useCallback(() => {
    dispatch({ type: "REDO", capacity });
  }, [capacity]);

  const reset = useCallback((newPresent: T) => {
    dispatch({ type: "RESET", newPresent });
  }, []);

  return {
    state: state.present,
    present: state.present,
    past: state.past,
    future: state.future,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    set: commit,
    commit,
    setWithoutUndo,
    undo,
    redo,
    reset,
  };
}

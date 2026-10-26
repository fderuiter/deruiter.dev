"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  TUTORIAL_IDLE,
  arcadeTutorialsSlice,
  setTutorialOutcome,
  shouldOfferTutorial,
  signalCounts,
  tutorialReducer,
  useProgress,
  type TutorialAction,
  type TutorialScript,
  type TutorialState,
} from "@/lib/arcade";
import type { CabinetTutorialValue } from "./TutorialContext";

const NO_SCRIPT: TutorialScript = Object.freeze({
  gameId: "",
  version: 1,
  minutes: 0,
  steps: [],
});

/** A cabinet's tutorial run (#2972). */
export interface TutorialRun {
  /** False for a game with no tutorial: the run never starts. */
  readonly available: boolean;
  readonly script: TutorialScript;
  readonly state: TutorialState;
  /** True until this version is finished or turned down on this device. */
  readonly offered: boolean;
  /** Starts the tutorial from its first step. */
  readonly start: () => void;
  readonly dispatch: (action: TutorialAction) => void;
  /** Turns down the first-launch offer for this version. */
  readonly decline: () => void;
  /** Puts the run away after it finished or was left. */
  readonly close: () => void;
  /** What the game sees, for `CabinetTutorialContext`. */
  readonly value: CabinetTutorialValue;
}

/**
 * The state of a cabinet's tutorial: the run, the first-launch offer and the
 * device record. A finished run is recorded as completed; a run left part
 * way, or an offer turned down, is recorded as declined, so the cabinet
 * stops offering it but the Tutorial key still replays it.
 *
 * @param tutorial - The game's tutorial, if it has one.
 * @returns The run.
 */
export function useTutorialRun(tutorial?: TutorialScript): TutorialRun {
  const script = tutorial ?? NO_SCRIPT;
  const available = tutorial !== undefined && tutorial.steps.length > 0;
  const [state, setState] = useState<TutorialState>(TUTORIAL_IDLE);
  // Signals arrive from game loops, between renders: they are checked
  // against the latest state, not the last rendered one.
  const stateRef = useRef(state);
  const record = useProgress(arcadeTutorialsSlice).games[script.gameId];
  const offered = available && shouldOfferTutorial(record, script.version);

  const dispatch = useCallback(
    (action: TutorialAction) => {
      const previous = stateRef.current;
      const next = tutorialReducer(script, previous, action);
      if (next === previous) return;
      stateRef.current = next;
      setState(next);
      if (previous.status === "running" && next.status === "finished") {
        setTutorialOutcome(script.gameId, script.version, "completed");
      } else if (previous.status === "running" && next.status === "exited") {
        setTutorialOutcome(script.gameId, script.version, "declined");
      }
    },
    [script]
  );

  const start = useCallback(() => {
    if (available) dispatch({ type: "start" });
  }, [available, dispatch]);
  const decline = useCallback(() => {
    setTutorialOutcome(script.gameId, script.version, "declined");
  }, [script]);
  const close = useCallback(() => {
    stateRef.current = TUTORIAL_IDLE;
    setState(TUTORIAL_IDLE);
  }, []);
  const signal = useCallback(
    (name: string) => {
      if (stateRef.current.status !== "running") return;
      if (!signalCounts(script, stateRef.current, name)) return;
      dispatch({ type: "signal", name });
    },
    [script, dispatch]
  );

  const active = state.status === "running";
  const stepId = active ? (script.steps[state.index]?.id ?? null) : null;
  const value = useMemo(
    () => ({ active, stepId, signal }),
    [active, stepId, signal]
  );

  return {
    available,
    script,
    state,
    offered,
    start,
    dispatch,
    decline,
    close,
    value,
  };
}

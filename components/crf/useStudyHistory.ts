"use client";

import { useCallback, useState } from "react";
import type { StudyProtocol } from "@/lib/crf";
import { useHistory } from "@/hooks/useHistory";

/** Undo keeps this many earlier versions of the study, plus the one being replaced. */
const HISTORY_LIMIT = 20;

/** Every commit is its own undo step, even when it leaves the study unchanged. */
const neverEqual = () => false;

/**
 * The study being authored, its undo and redo stacks, and the baseline it is
 * compared against to decide whether the draft has unsaved changes.
 */
export function useStudyHistory(initialStudy: () => StudyProtocol) {
  const history = useHistory<StudyProtocol>(initialStudy, {
    capacity: HISTORY_LIMIT + 1,
    isEqual: neverEqual,
  });
  const { commit: commitStep, reset: resetHistory } = history;
  const [baselineStudy, setBaselineStudy] = useState<StudyProtocol>(
    history.state
  );

  const commit = useCallback(
    (newStudy: StudyProtocol) => {
      commitStep(newStudy);
    },
    [commitStep]
  );

  /** Loads another study as one undoable step and makes it the new baseline. */
  const replace = useCallback(
    (target: StudyProtocol) => {
      setBaselineStudy(target);
      commitStep(target);
    },
    [commitStep]
  );

  /** Starts over from a study: no undo, no redo, and it becomes the baseline. */
  const reset = useCallback(
    (target: StudyProtocol) => {
      resetHistory(target);
      setBaselineStudy(target);
    },
    [resetHistory]
  );

  return {
    study: history.state,
    /** Changes the study without an undo step, for state the author did not edit. */
    setStudy: history.setWithoutUndo,
    baselineStudy,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    commit,
    undo: history.undo,
    redo: history.redo,
    replace,
    reset,
  };
}

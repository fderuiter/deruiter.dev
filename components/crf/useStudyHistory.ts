"use client";

import { useCallback, useState } from "react";
import type { StudyProtocol } from "@/lib/crf";
import { useHistory } from "@/hooks/useHistory";

/** Undo keeps this many earlier versions of the study, plus the one being replaced. */
const HISTORY_LIMIT = 20;

/**
 * The study being authored, its undo and redo stacks, and the baseline it is
 * compared against to decide whether the draft has unsaved changes.
 */
export function useStudyHistory(initialStudy: () => StudyProtocol) {
  const history = useHistory<StudyProtocol>(initialStudy, {
    capacity: HISTORY_LIMIT + 1,
  });
  const [baselineStudy, setBaselineStudy] = useState<StudyProtocol>(
    history.state
  );

  const commit = useCallback(
    (newStudy: StudyProtocol) => {
      history.commit(newStudy);
    },
    [history]
  );

  /** Loads another study as one undoable step and makes it the new baseline. */
  const replace = useCallback(
    (target: StudyProtocol) => {
      setBaselineStudy(target);
      history.commit(target);
    },
    [history]
  );

  /** Starts over from a study: no undo, no redo, and it becomes the baseline. */
  const reset = useCallback(
    (target: StudyProtocol) => {
      history.reset(target);
      setBaselineStudy(target);
    },
    [history]
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

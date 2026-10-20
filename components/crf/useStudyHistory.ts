"use client";

import { useCallback, useState } from "react";
import type { StudyProtocol } from "@/lib/crf";

/** Undo keeps this many earlier versions of the study, plus the one being replaced. */
const HISTORY_LIMIT = 20;

/**
 * The study being authored, its undo and redo stacks, and the baseline it is
 * compared against to decide whether the draft has unsaved changes.
 */
export function useStudyHistory(initialStudy: () => StudyProtocol) {
  const [study, setStudy] = useState<StudyProtocol>(initialStudy);
  const [history, setHistory] = useState<StudyProtocol[]>([]);
  const [future, setFuture] = useState<StudyProtocol[]>([]);
  const [baselineStudy, setBaselineStudy] = useState<StudyProtocol>(study);

  /** Replaces the study as one undoable step, discarding anything to redo. */
  const commit = useCallback(
    (newStudy: StudyProtocol) => {
      setHistory((prev) => [...prev.slice(-HISTORY_LIMIT), study]);
      setFuture([]);
      setStudy(newStudy);
    },
    [study]
  );

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);

    setFuture((prev) => [study, ...prev]);
    setHistory(newHistory);
    setStudy(previous);
  }, [history, study]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory((prev) => [...prev, study]);
    setFuture(newFuture);
    setStudy(next);
  }, [future, study]);

  /** Loads another study as one undoable step and makes it the new baseline. */
  const replace = useCallback(
    (target: StudyProtocol) => {
      setBaselineStudy(target);
      commit(target);
    },
    [commit]
  );

  /** Starts over from a study: no undo, no redo, and it becomes the baseline. */
  const reset = useCallback((target: StudyProtocol) => {
    setHistory([]);
    setFuture([]);
    setStudy(target);
    setBaselineStudy(target);
  }, []);

  return {
    study,
    /** Changes the study without an undo step, for state the author did not edit. */
    setStudy,
    baselineStudy,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    commit,
    undo,
    redo,
    replace,
    reset,
  };
}

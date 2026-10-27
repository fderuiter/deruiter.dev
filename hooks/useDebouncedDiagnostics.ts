"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { StudyProtocol } from "@/lib/crf/types";
import { lintForm } from "@/lib/crf";

export interface UseDebouncedDiagnosticsOptions {
  debounceMs?: number;
  idleTimeoutMs?: number;
}

export interface UseDebouncedDiagnosticsResult {
  totalIssues: number;
  isPending: boolean;
  cancelPending: () => void;
  recalculateImmediately: () => number;
}

/**
 * Custom hook to calculate aggregate form issue counts for the studio header badge.
 * Defers heavy linting calculations during active typing using trailing-edge idle scheduling
 * and React transition wrappers (startTransition) to keep the main UI thread responsive (60fps).
 *
 * Preserves object reference identity without Web Worker serialization or message cloning.
 * Immediately cancels pending computations on new inputs, undo, or redo actions.
 */
export function useDebouncedDiagnostics(
  study: StudyProtocol,
  options: UseDebouncedDiagnosticsOptions = {}
): UseDebouncedDiagnosticsResult {
  const { debounceMs = 200, idleTimeoutMs = 300 } = options;

  // Initial issue count calculation on mount
  const [totalIssues, setTotalIssues] = useState<number>(() => {
    return study.forms.reduce((acc, f) => acc + lintForm(f).length, 0);
  });
  const [isPending, setIsPending] = useState(false);

  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleIdRef = useRef<number | null>(null);
  const studyRef = useRef<StudyProtocol>(study);
  const prevStudyRef = useRef<StudyProtocol>(study);
  const isMountedRef = useRef<boolean>(true);

  const cancelPending = () => {
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (idleIdRef.current !== null && typeof window !== "undefined") {
      if ("cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleIdRef.current);
      }
      idleIdRef.current = null;
    }
  };

  const recalculateImmediately = (): number => {
    cancelPending();
    const count = studyRef.current.forms.reduce(
      (acc, f) => acc + lintForm(f).length,
      0
    );
    setTotalIssues(count);
    setIsPending(false);
    return count;
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelPending();
    };
  }, []);

  useEffect(() => {
    studyRef.current = study;
    // Only schedule debounced computation if study reference has actually changed
    if (prevStudyRef.current === study) {
      return;
    }
    prevStudyRef.current = study;

    // 1. Requirement 5: Immediately cancel pending background diagnostic computations on new inputs/undo/redo
    cancelPending();
    setIsPending(true);

    // 2. Requirement 1: Debounce aggregate form issue count calculations using trailing-edge idle scheduling
    timeoutIdRef.current = setTimeout(() => {
      const runComputation = () => {
        if (!isMountedRef.current) return;
        const currentStudy = studyRef.current;
        // Requirement 4: Preserve object reference identity without worker message cloning
        const count = currentStudy.forms.reduce(
          (acc, f) => acc + lintForm(f).length,
          0
        );

        // Requirement 2: Schedule diagnostic badge updates using non-blocking transition wrappers
        startTransition(() => {
          if (isMountedRef.current) {
            setTotalIssues(count);
            setIsPending(false);
          }
        });
      };

      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleIdRef.current = window.requestIdleCallback(
          () => {
            runComputation();
            idleIdRef.current = null;
          },
          { timeout: idleTimeoutMs }
        );
      } else {
        runComputation();
      }
      timeoutIdRef.current = null;
    }, debounceMs);

    return () => {
      cancelPending();
    };
  }, [study, debounceMs, idleTimeoutMs]);

  return {
    totalIssues,
    isPending,
    cancelPending,
    recalculateImmediately,
  };
}

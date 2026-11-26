"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import type { StudyProtocol } from "@/lib/crf/types";
import { saveStudyDraft } from "@/lib/crf";
import { downloadFile } from "@/lib/download";

const AUTOSAVE_DEBOUNCE_MS = 800;

export type StudyAutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseStudyAutosaveResult {
  status: StudyAutosaveStatus;
  savedAt: string | null;
  errorMessage: string | null;
  /**
   * True while the latest committed revision has not been acknowledged by
   * draft storage. Independent of baseline-dirty (differs from the comparison
   * baseline) and not-exported (differs from the last explicit export).
   */
  hasUnsavedChanges: boolean;
  /**
   * Synchronously writes the latest committed revision now, skipping the
   * debounce. Idempotent: a revision storage already acknowledged is not
   * written again.
   */
  checkpoint: () => void;
  /** Triggers a native file download of the current study, for when local storage is unavailable. */
  downloadDraft: () => void;
}

/**
 * Debounces writes of `study` to the acknowledged local draft (see
 * lib/crf/internal/study-draft-storage.ts) and exposes a saving/saved/error status so
 * the studio can show whether the author's latest change is safely stored.
 *
 * Besides the 800 ms debounce, the latest revision is checkpointed
 * synchronously when the editor unmounts (an application route change), when
 * the tab becomes hidden and on `pagehide` (#3804). A browser or OS crash
 * before one of those events is delivered can still lose the last edit, and
 * the browser may evict local storage; recovery covers only the last
 * acknowledged checkpoint.
 */
export function useStudyAutosave(
  study: StudyProtocol,
  options?: { readonly enabled?: boolean }
): UseStudyAutosaveResult {
  const enabled = options?.enabled ?? true;
  const enabledRef = useRef(enabled);
  const [status, setStatus] = useState<StudyAutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<StudyProtocol>(study);

  const studyRef = useRef<StudyProtocol>(study);
  const prevStudyRef = useRef<StudyProtocol>(study);
  // The initial study came from storage or a template; it needs no write.
  const acknowledgedRef = useRef<StudyProtocol>(study);
  const isMountedRef = useRef(true);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const checkpoint = useCallback(() => {
    clearPendingTimer();
    if (!enabledRef.current) return;
    const revision = studyRef.current;
    if (revision === acknowledgedRef.current) return;

    const result = saveStudyDraft(revision);
    if (result.status === "saved") acknowledgedRef.current = revision;
    // Cleanup on unmount must not set state.
    if (!isMountedRef.current) return;

    if (result.status === "saved") {
      setStatus("saved");
      setSavedAt(result.savedAt);
      setErrorMessage(null);
      setAcknowledged(revision);
    } else if (result.status === "error") {
      setStatus("error");
      setErrorMessage(result.message);
    } else {
      setStatus("error");
      setErrorMessage("Local storage is unavailable in this browser.");
    }
  }, [clearPendingTimer]);

  // Keep the latest committed revision readable by lifecycle handlers before
  // passive effects run.
  useLayoutEffect(() => {
    studyRef.current = study;
    enabledRef.current = enabled;
  }, [enabled, study]);

  useEffect(() => {
    isMountedRef.current = true;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") checkpoint();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", checkpoint);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", checkpoint);
      isMountedRef.current = false;
      // Route departure: flush the latest revision instead of dropping it.
      checkpoint();
    };
  }, [checkpoint]);

  useEffect(() => {
    if (!enabled) {
      prevStudyRef.current = study;
      acknowledgedRef.current = study;
      return clearPendingTimer;
    }
    if (prevStudyRef.current === study) {
      return;
    }
    prevStudyRef.current = study;

    setStatus("saving");
    timeoutIdRef.current = setTimeout(checkpoint, AUTOSAVE_DEBOUNCE_MS);

    // Only reschedules; never flushes an obsolete revision.
    return clearPendingTimer;
  }, [enabled, study, checkpoint, clearPendingTimer]);

  const downloadDraft = useCallback(() => {
    downloadFile(
      JSON.stringify(studyRef.current, null, 2),
      `${studyRef.current.id || "crf-study"}.json`,
      { mimeType: "application/json" }
    );
  }, []);

  return {
    status,
    savedAt,
    errorMessage,
    hasUnsavedChanges: enabled && study !== acknowledged,
    checkpoint,
    downloadDraft,
  };
}

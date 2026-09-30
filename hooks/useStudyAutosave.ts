"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { StudyProtocol } from "@/lib/crf/types";
import { saveStudyDraft } from "@/lib/crf/study-draft-storage";
import { downloadFile } from "@/lib/download";

const AUTOSAVE_DEBOUNCE_MS = 800;

export type StudyAutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseStudyAutosaveResult {
  status: StudyAutosaveStatus;
  savedAt: string | null;
  errorMessage: string | null;
  /** Triggers a native file download of the current study, for when local storage is unavailable. */
  downloadDraft: () => void;
}

/**
 * Debounces writes of `study` to the acknowledged local draft (see
 * lib/crf/study-draft-storage.ts) and exposes a saving/saved/error status so
 * the studio can show whether the author's latest change is safely stored.
 */
export function useStudyAutosave(study: StudyProtocol): UseStudyAutosaveResult {
  const [status, setStatus] = useState<StudyAutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const studyRef = useRef<StudyProtocol>(study);
  const prevStudyRef = useRef<StudyProtocol>(study);
  const isMountedRef = useRef(true);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutIdRef.current !== null) clearTimeout(timeoutIdRef.current);
    };
  }, []);

  useEffect(() => {
    studyRef.current = study;
    if (prevStudyRef.current === study) {
      return;
    }
    prevStudyRef.current = study;

    setStatus("saving");
    timeoutIdRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      const result = saveStudyDraft(studyRef.current);
      if (result.status === "saved") {
        setStatus("saved");
        setSavedAt(result.savedAt);
        setErrorMessage(null);
      } else if (result.status === "error") {
        setStatus("error");
        setErrorMessage(result.message);
      } else {
        setStatus("error");
        setErrorMessage("Local storage is unavailable in this browser.");
      }
      timeoutIdRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutIdRef.current !== null) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, [study]);

  const downloadDraft = useCallback(() => {
    downloadFile(
      JSON.stringify(studyRef.current, null, 2),
      `${studyRef.current.id || "crf-study"}.json`,
      { mimeType: "application/json" }
    );
  }, []);

  return { status, savedAt, errorMessage, downloadDraft };
}

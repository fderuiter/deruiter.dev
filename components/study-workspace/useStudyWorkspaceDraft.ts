"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  serializeStudyWorkspace,
  type StudyWorkspace,
} from "@/lib/study-workspace";
import { downloadFile } from "@/lib/download";
import {
  saveStudyWorkspaceDraft,
  type StudyWorkspaceDraftRecord,
  type StudyWorkspaceDraftStorageOptions,
  type StudyWorkspaceDraftUi,
} from "./randomization-draft-storage";

/** Idle time after the last edit before a draft is written. */
export const STUDY_WORKSPACE_AUTOSAVE_MS = 750;

/** Where the latest edit stands. */
export type StudyWorkspaceDraftStatus =
  "idle" | "saving" | "saved" | "unavailable" | "error" | "conflict";

/** What `useStudyWorkspaceDraft` gives the studio. */
export interface UseStudyWorkspaceDraftResult {
  readonly status: StudyWorkspaceDraftStatus;
  readonly savedAt: string | null;
  readonly errorMessage: string | null;
  /** The draft another tab saved, while status is `conflict`. */
  readonly conflict: StudyWorkspaceDraftRecord | null;
  /** True until storage has the latest workspace and view state. */
  readonly hasUnsavedChanges: boolean;
  /** Writes now, skipping the wait. Writes nothing already saved. */
  readonly checkpoint: () => void;
  /** Overwrites the other tab's draft with this one. */
  readonly keepMine: () => void;
  /** Downloads the workspace file, for when storage fails. */
  readonly downloadDraft: () => void;
}

/** Options for `useStudyWorkspaceDraft`. */
export interface UseStudyWorkspaceDraftOptions extends StudyWorkspaceDraftStorageOptions {
  /**
   * The write id of the draft the studio started from: the record it
   * recovered, or null when it started without one.
   */
  readonly initialWriteId: string | null;
  /** Set false to stop writing, e.g. while a recovery choice is shown. */
  readonly enabled?: boolean;
}

/**
 * Autosaves a workspace and its view state as a browser draft, 750 ms after
 * the last change, and at once when the tab is hidden, the page is left or
 * the studio unmounts. Each new workspace object is a change, so a
 * successful run, which never changes the workspace, cannot stop the next
 * edit from being saved. A draft another tab wrote is never overwritten
 * without `keepMine`. Pass a memoized `ui`: a new object is a change.
 */
export function useStudyWorkspaceDraft(
  workspace: StudyWorkspace,
  ui: StudyWorkspaceDraftUi,
  options: UseStudyWorkspaceDraftOptions
): UseStudyWorkspaceDraftResult {
  const { initialWriteId, enabled = true, storage, now, makeId } = options;
  const [status, setStatus] = useState<StudyWorkspaceDraftStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<StudyWorkspaceDraftRecord | null>(
    null
  );
  const [acknowledged, setAcknowledged] = useState({ workspace, ui });

  const latestRef = useRef({ workspace, ui });
  const previousRef = useRef({ workspace, ui });
  // The starting workspace came from storage, a file or a template.
  const acknowledgedRef = useRef({ workspace, ui });
  const writeIdRef = useRef(initialWriteId);
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const blockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Held in a ref so inline options never re-create the handlers.
  const storageRef = useRef<StudyWorkspaceDraftStorageOptions>({
    storage,
    now,
    makeId,
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const write = useCallback(
    (force: boolean) => {
      clearTimer();
      if (!enabledRef.current) return;
      if (blockedRef.current && !force) return;
      const latest = latestRef.current;
      const done = acknowledgedRef.current;
      if (
        !force &&
        latest.workspace === done.workspace &&
        latest.ui === done.ui
      ) {
        return;
      }
      const result = saveStudyWorkspaceDraft(
        {
          workspace: latest.workspace,
          ui: latest.ui,
          expectedWriteId: writeIdRef.current,
          force,
        },
        storageRef.current
      );
      if (result.status === "saved") {
        writeIdRef.current = result.writeId;
        acknowledgedRef.current = latest;
        blockedRef.current = false;
      } else if (result.status === "conflict") {
        blockedRef.current = true;
      }
      if (!mountedRef.current) return;
      switch (result.status) {
        case "saved":
          setStatus("saved");
          setSavedAt(result.savedAt);
          setErrorMessage(null);
          setConflict(null);
          setAcknowledged(latest);
          break;
        case "conflict":
          setStatus("conflict");
          setConflict(result.stored);
          break;
        case "unavailable":
          setStatus("unavailable");
          setErrorMessage("This browser is not keeping local drafts.");
          break;
        default:
          setStatus("error");
          setErrorMessage(
            result.reason === "quota"
              ? "The browser's storage is full, so the draft was not saved."
              : result.message
          );
      }
    },
    [clearTimer]
  );

  const checkpoint = useCallback(() => write(false), [write]);
  const keepMine = useCallback(() => write(true), [write]);

  useLayoutEffect(() => {
    latestRef.current = { workspace, ui };
    enabledRef.current = enabled;
    storageRef.current = { storage, now, makeId };
  }, [workspace, ui, enabled, storage, now, makeId]);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") checkpoint();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", checkpoint);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", checkpoint);
      mountedRef.current = false;
      checkpoint();
    };
  }, [checkpoint]);

  useEffect(() => {
    const previous = previousRef.current;
    if (previous.workspace === workspace && previous.ui === ui) return;
    previousRef.current = { workspace, ui };
    if (!enabled || blockedRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("saving");
    timerRef.current = setTimeout(checkpoint, STUDY_WORKSPACE_AUTOSAVE_MS);
    return clearTimer;
  }, [workspace, ui, enabled, checkpoint, clearTimer]);

  const downloadDraft = useCallback(() => {
    const current = latestRef.current.workspace;
    const name = current.source.fileName?.replace(/\.json$/i, "") || "study";
    downloadFile(serializeStudyWorkspace(current), `${name}.study.json`, {
      mimeType: "application/json",
    });
  }, []);

  return {
    status,
    savedAt,
    errorMessage,
    conflict,
    hasUnsavedChanges:
      workspace !== acknowledged.workspace || ui !== acknowledged.ui,
    checkpoint,
    keepMine,
    downloadDraft,
  };
}

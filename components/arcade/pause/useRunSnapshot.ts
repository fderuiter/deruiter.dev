"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearRunSnapshot,
  getRunSnapshotStorage,
  readRunSnapshot,
  writeRunSnapshot,
  type FormFactor,
  type RunSnapshotFormat,
} from "@/lib/arcade";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import type { ArcadeSession } from "@/components/arcade/views";
import { useCabinetPauseController } from "./CabinetPause";

/** The one line shown when a save could not be read and was cleared. */
export const DISCARDED_RUN_NOTICE =
  "Your saved run could not be read, so it was cleared.";

/**
 * The note under a Resume offer. WebKit clears script storage after seven
 * days of Safari use without a visit, so a save is a convenience, not a
 * promise.
 */
export const SAVED_RUN_NOTE =
  "Saved on this device. Your browser can clear it, so it may not be here next time.";

/** A saved run waiting for the player to resume or discard it. */
export interface SavedRun {
  readonly savedAt: number;
  readonly view: FormFactor;
}

/** What {@link useRunSnapshot} returns. */
export interface RunSnapshotControls {
  /** A saved run from an earlier visit, until it is resumed or discarded. */
  readonly saved: SavedRun | null;
  /** {@link DISCARDED_RUN_NOTICE} when a save failed to parse, else null. */
  readonly notice: string | null;
  /** Restores the saved run into the session. */
  readonly resumeSaved: () => void;
  /** Throws the saved run away and keeps the fresh one. */
  readonly discardSaved: () => void;
  /** Writes the run now. The cabinet already does this on pause and hide. */
  readonly save: () => void;
  /** Removes the save, for a run that has ended. */
  readonly clear: () => void;
}

type SnapshotSession = Pick<
  ArcadeSession<unknown, unknown>,
  "snapshot" | "restore" | "tuning" | "rng" | "clock" | "fairness"
>;

/**
 * Saves a session's run under the game's one versioned snapshot,
 * `arcade_run_<slug>_v1` (#2357, ADR 0062). The run is written on every pause
 * and when the page hides (`visibilitychange` to hidden and `pagehide`, never
 * `beforeunload`). On mount a save from an earlier visit is offered through
 * `saved`; one that fails to parse, or carries another schema version, is
 * discarded with one notice and never throws into a view.
 *
 * A session with a seeded `rng` or a `clock` also saves their `rngState` and
 * `step`, and Resume puts them back after `restore`, so the restored run draws
 * the same numbers (#2544). A session with a `fairness` record saves its
 * tags, and Resume puts them back, so the ratchet survives a reload (#2547).
 *
 * Call it in the game's session holder, under the cabinet, with a session
 * that offers `snapshot` and `restore`. Without them this saves nothing.
 *
 * @param session - The game's session.
 * @param format - The schema version and the Zod schema of the state.
 * @returns The saved run, if any, and its controls.
 */
export function useRunSnapshot<State>(
  session: SnapshotSession,
  format: RunSnapshotFormat<State>
): RunSnapshotControls {
  const controller = useCabinetPauseController();
  const { announce } = useAnnouncer();
  const [initial] = useState(() =>
    readRunSnapshot(
      getRunSnapshotStorage(),
      controller.getInfo().gameId,
      format
    )
  );
  const [pending, setPending] = useState(
    initial.status === "ok" ? initial.snapshot : null
  );
  const notice = initial.status === "discarded" ? DISCARDED_RUN_NOTICE : null;

  // A run offered for Resume is not overwritten by the fresh one before the
  // player chooses.
  const pendingRef = useRef(pending);
  const sessionRef = useRef(session);
  useEffect(() => {
    pendingRef.current = pending;
    sessionRef.current = session;
  });

  const save = useCallback(() => {
    if (pendingRef.current) return;
    const current = sessionRef.current;
    if (typeof current.snapshot !== "function") return;
    const state = current.snapshot();
    if (state === undefined) return;
    const { gameId, view } = controller.getInfo();
    writeRunSnapshot(getRunSnapshotStorage(), gameId, {
      schema: format.schema,
      savedAt: Date.now(),
      view,
      tuning: current.tuning ?? {},
      state,
      rngState: current.rng?.getState(),
      step: current.clock?.getStep(),
      tags: current.fairness?.getTags(),
    });
  }, [controller, format.schema]);

  const clear = useCallback(() => {
    clearRunSnapshot(getRunSnapshotStorage(), controller.getInfo().gameId);
  }, [controller]);

  useEffect(() => {
    const stopPause = controller.onPause(save);
    const stopSuspend = controller.onSuspend(save);
    return () => {
      stopPause();
      stopSuspend();
    };
  }, [controller, save]);

  useEffect(() => {
    if (notice) announce(notice, "polite");
  }, [announce, notice]);

  const resumeSaved = useCallback(() => {
    const run = pendingRef.current;
    if (!run) return;
    pendingRef.current = null;
    setPending(null);
    try {
      const current = sessionRef.current;
      current.restore?.(run.state);
      // The stream and step continue from the save (#2544), so the rest of
      // the run is the run that was saved, not a re-roll.
      if (run.rngState !== undefined) current.rng?.setState(run.rngState);
      if (run.step !== undefined) current.clock?.setStep(run.step);
      // The resumed run keeps the assists it had reached (#2547).
      if (run.tags) current.fairness?.restore(run.tags);
    } catch {
      // A restore that throws leaves the fresh run in place.
      clear();
    }
  }, [clear]);

  const discardSaved = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
    clear();
  }, [clear]);

  return useMemo(
    () => ({
      saved: pending ? { savedAt: pending.savedAt, view: pending.view } : null,
      notice,
      resumeSaved,
      discardSaved,
      save,
      clear,
    }),
    [pending, notice, resumeSaved, discardSaved, save, clear]
  );
}

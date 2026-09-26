import { RUN_SAVE_VERSION, RunActionSchema, RunSaveSchema } from "../types";
import type { z } from "zod";
import type { RunAction, RunPlan, RunState } from "./run";
import { advanceRun, createRunState, deriveRunView } from "./run";

/**
 * Saving and resuming a run (#1079). Pure: the browser adapter reads and
 * writes the string; these functions only build, check and replay it.
 */

// The save schema must describe exactly the moves the run reducer takes,
// minus RESTART_RUN, which starts a new log instead of joining one.
type SavedAction = z.infer<typeof RunActionSchema>;
/** A move a save records: every run action but RESTART_RUN. */
export type LoggedAction = Exclude<RunAction, { type: "RESTART_RUN" }>;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemaMatchesReducer: Same<SavedAction, LoggedAction> = true;
void schemaMatchesReducer;

/** A run as the save keeps it: where it started and every move since. */
export interface RunLog {
  /** The plan's id: the act played on its own, or the campaign. */
  actId: string;
  seed: string;
  actions: LoggedAction[];
}

/** A resumable run rebuilt from a save. */
export interface RestoredRun {
  act: RunPlan;
  log: RunLog;
  run: RunState;
}

/**
 * Upgrades an older save document one version at a time. Only v1 exists, so
 * the table is empty; a later version adds `{ 1: (v1) => v2 }` and bumps
 * `RUN_SAVE_VERSION`. A document with no path to the current version is
 * rejected.
 */
const MIGRATIONS: Readonly<Record<number, (doc: unknown) => unknown>> = {};

function migrate(doc: unknown): unknown | null {
  let current = doc;
  for (;;) {
    const version =
      typeof current === "object" && current !== null
        ? (current as { version?: unknown }).version
        : undefined;
    if (version === RUN_SAVE_VERSION) return current;
    const step = typeof version === "number" ? MIGRATIONS[version] : undefined;
    if (!step) return null;
    current = step(current);
  }
}

/** The save document for a run log, as a JSON string. */
export function serializeRun(log: RunLog, savedAt: Date): string {
  return JSON.stringify(
    RunSaveSchema.parse({
      version: RUN_SAVE_VERSION,
      actId: log.actId,
      savedAt: savedAt.toISOString(),
      seed: log.seed,
      actions: log.actions,
    })
  );
}

/** Replays a log from its seed. The same seed and moves give the same run. */
export function replayRun(act: RunPlan, log: RunLog): RunState {
  return log.actions.reduce(
    (run, action) => advanceRun(act, run, action),
    createRunState(act, log.seed)
  );
}

/**
 * Rebuilds a saved run, or returns null when there is nothing to resume:
 * corrupt JSON, an unknown version, a schema mismatch, a plan (an act or the
 * campaign) that no longer exists, a replay that fails, or a run that has already ended. Never
 * throws. Any selection is cleared as recorded moves, so the resumed run and
 * its log stay in step.
 */
export function parseRunSave(
  json: string | null,
  acts: readonly RunPlan[]
): RestoredRun | null {
  if (!json) return null;
  try {
    const parsed = RunSaveSchema.safeParse(migrate(JSON.parse(json)));
    if (!parsed.success) return null;
    const save = parsed.data;
    const act = acts.find((a) => a.id === save.actId);
    if (!act) return null;
    const replayed = replayRun(act, save);
    const deselect = replayed.table.selected.map((cardId): LoggedAction => ({
      type: "TOGGLE_SELECT",
      cardId,
    }));
    const log: RunLog = {
      actId: save.actId,
      seed: save.seed,
      actions: [...save.actions, ...deselect],
    };
    const run = deselect.reduce(
      (r, action) => advanceRun(act, r, action),
      replayed
    );
    const phase = deriveRunView(act, run).phase;
    if (phase === "RUN_FAILED" || phase === "RUN_WON") return null;
    return { act, log, run };
  } catch {
    return null;
  }
}

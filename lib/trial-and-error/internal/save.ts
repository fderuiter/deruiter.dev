import { RUN_SAVE_VERSION, RunActionSchema, RunSaveSchema } from "../types";
import type { z } from "zod";
import type { RunAction, RunPlan, RunState } from "./run";
import type { RunChoice } from "./run-rules";
import type { RunOrigin } from "./seed";
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
  /** The run's sponsor (#950). Absent means Virtual Biotech. */
  sponsorId?: RunChoice["sponsorId"];
  /** The run's stake (#950). Absent means stake 1. */
  stake?: RunChoice["stake"];
  /**
   * AUTHORED for a run first saved before decks were shuffled (#2055): it
   * replays in written deal order. Absent means a shuffled run.
   */
  dealing?: "AUTHORED";
  /**
   * AUTHORED for a run first saved before the run deck (#2082): every Blind
   * deals its authored deck and the shop stocks no shells. Absent means a
   * run with a run deck.
   */
  decks?: "AUTHORED";
  /**
   * CLASSIC for a run first saved before each act had its own shop (#2083):
   * every act stocks the shared catalog, drawn evenly. Absent means a shop
   * per act, drawn by rarity.
   */
  shops?: "CLASSIC";
  /**
   * FIXED for a run first saved before first-Blind openers (#2413): the
   * first Blind deals its own scripted setup. Absent means the seed picks
   * the opener.
   */
  openers?: "FIXED";
  actions: LoggedAction[];
  /** How the seed was chosen; absent means a random run. */
  origin?: RunOrigin;
}

/** A resumable run rebuilt from a save. */
export interface RestoredRun {
  act: RunPlan;
  log: RunLog;
  run: RunState;
}

/**
 * Upgrades an older save document one version at a time. A document with no
 * path to the current version is rejected.
 *
 * v1 to v2 (#2055): v1 runs dealt every deck in its written order, and their
 * moves name the cards that order dealt, so they keep dealing that way.
 *
 * v2 to v3 (#2082): v2 runs had no run deck, and their shop moves name slots
 * stocked from a catalog without shells, so they keep their authored decks.
 *
 * v3 to v4 (#2083): v3 runs stocked every act from one shared catalog, drawn
 * evenly, and their shop moves name the slots that draw stocked, so they
 * keep that catalog and that draw.
 *
 * v4 to v5 (#2413): v4 runs opened every first Blind on its own scripted
 * setup, and their first moves name the cards it dealt, so they keep it.
 */
const MIGRATIONS: Readonly<Record<number, (doc: unknown) => unknown>> = {
  1: (doc) => ({ ...(doc as object), version: 2, dealing: "AUTHORED" }),
  2: (doc) => ({ ...(doc as object), version: 3, decks: "AUTHORED" }),
  3: (doc) => ({ ...(doc as object), version: 4, shops: "CLASSIC" }),
  4: (doc) => ({ ...(doc as object), version: 5, openers: "FIXED" }),
};

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
      sponsorId: log.sponsorId,
      stake: log.stake,
      ...(log.dealing ? { dealing: log.dealing } : {}),
      ...(log.decks ? { decks: log.decks } : {}),
      ...(log.shops ? { shops: log.shops } : {}),
      ...(log.openers ? { openers: log.openers } : {}),
      actions: log.actions,
      ...(log.origin ? { origin: log.origin } : {}),
    })
  );
}

/**
 * Replays a log from its seed, sponsor, stake, deal mode, deck mode, shop
 * mode and opener mode. The same seed, choice and moves give the same run.
 */
export function replayRun(act: RunPlan, log: RunLog): RunState {
  return log.actions.reduce(
    (run, action) => advanceRun(act, run, action),
    createRunState(
      act,
      log.seed,
      { sponsorId: log.sponsorId, stake: log.stake },
      log.dealing ?? "SHUFFLED",
      log.decks ?? "RUN",
      log.shops ?? "PER_ACT",
      log.openers ?? "POOL"
    )
  );
}

/**
 * Rebuilds a saved run, or returns null when there is nothing to resume:
 * corrupt JSON, an unknown version, a schema mismatch, a plan (an act or the
 * campaign) that no longer exists, a replay that fails, or a run that has
 * already ended (a won campaign still offering post-marketing has not).
 * Never throws. Any selection is cleared as recorded moves, so the resumed
 * run and its log stay in step.
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
      ...(save.sponsorId !== undefined && { sponsorId: save.sponsorId }),
      ...(save.stake !== undefined && { stake: save.stake }),
      ...(save.dealing !== undefined && { dealing: save.dealing }),
      ...(save.decks !== undefined && { decks: save.decks }),
      ...(save.shops !== undefined && { shops: save.shops }),
      ...(save.openers !== undefined && { openers: save.openers }),
      actions: [...save.actions, ...deselect],
      ...(save.origin ? { origin: save.origin } : {}),
    };
    const run = deselect.reduce(
      (r, action) => advanceRun(act, r, action),
      replayed
    );
    const view = deriveRunView(act, run);
    // A won campaign still offering post-marketing waits on the player's
    // choice, so it resumes; any other ended run does not.
    if (view.phase === "RUN_FAILED") return null;
    if (view.phase === "RUN_WON" && !view.endless?.canContinue) return null;
    return { act, log, run };
  } catch {
    return null;
  }
}

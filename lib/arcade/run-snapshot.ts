import type { z } from "zod";
import { safeRawStorage } from "@/lib/safe-storage";
import { FORM_FACTORS, type FormFactor } from "./form-factor";
import { isRngState } from "./rng";
import { parseRunTags, type RunTags } from "./run-tags";
import { isStepCount } from "./step-clock";

/**
 * One versioned run snapshot per game (ADR 0062). A live view swap, the save
 * when the page hides and Resume on the next visit all read and write this
 * one envelope under {@link runSnapshotKey}.
 */
export interface RunSnapshot<State> {
  /** The game's own state version. Bump it on any change to `state`. */
  readonly schema: number;
  /** When the run was saved, in milliseconds since the epoch. */
  readonly savedAt: number;
  /** The view that was playing, which labels the run for score records. */
  readonly view: FormFactor;
  /** The input tuning the run played with, such as touch assist strengths. */
  readonly tuning: Readonly<Record<string, number | boolean>>;
  /** The run itself, as plain data from the session's `snapshot()`. */
  readonly state: State;
  /**
   * The gameplay stream's state at the save, from the session's
   * `rng.getState()` (#2544), so a restored run draws the same numbers and a
   * reload cannot re-roll a bad draw. Absent for a session without a seeded
   * stream and in saves written before it existed, which still read.
   */
  readonly rngState?: number;
  /**
   * The fixed-step count at the save, from the session's `clock.getStep()`
   * (#2544). Absent when the session has no step clock.
   */
  readonly step?: number;
  /**
   * Every view and input the run has used and the assists it reached
   * (#2547), so a resumed run keeps its ratchet and its score is labelled
   * honestly. Absent in saves written before it existed, which still read.
   */
  readonly tags?: RunTags;
}

/** The part of `Storage` a run snapshot needs. */
export type RunSnapshotStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

/** Why a stored snapshot was thrown away instead of restored. */
export type RunSnapshotDiscardReason = "schema" | "parse";

/** What {@link readRunSnapshot} found. */
export type RunSnapshotRead<State> =
  | { readonly status: "empty" }
  | { readonly status: "ok"; readonly snapshot: RunSnapshot<State> }
  | { readonly status: "discarded"; readonly reason: RunSnapshotDiscardReason };

/** How a game reads its snapshot back. */
export interface RunSnapshotFormat<State> {
  /** The schema version this build writes and accepts. */
  readonly schema: number;
  /** Parses the stored `state`. A failed parse discards the save. */
  readonly state: z.ZodType<State>;
}

/**
 * The storage key for a game's run snapshot, `arcade_run_<slug>_v1`. The
 * `_v1` names the envelope's own shape; a change to a game's state bumps its
 * `schema` instead. The optional `rngState` and `step` fields (#2544) and
 * `tags` (#2547) were added without a bump, because a v1 save without them
 * still reads.
 *
 * @param slug - The game's id, such as `laser-loon`.
 * @returns The key.
 */
export function runSnapshotKey(slug: string): string {
  return `arcade_run_${slug}_v1`;
}

/**
 * The browser's local storage through `lib/safe-storage`, which handles
 * blocked storage and quota errors, or null on the server.
 *
 * @returns The storage, or null.
 */
export function getRunSnapshotStorage(): RunSnapshotStorage | null {
  return typeof window === "undefined" ? null : safeRawStorage;
}

/**
 * Saves a run. A full or blocked storage is not an error: the run is simply
 * not saved.
 *
 * @param storage - Where to save, or null to skip.
 * @param slug - The game's id.
 * @param snapshot - The run to save.
 * @returns Whether the run was saved.
 */
export function writeRunSnapshot<State>(
  storage: RunSnapshotStorage | null,
  slug: string,
  snapshot: RunSnapshot<State>
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(runSnapshotKey(slug), JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes a game's saved run, if there is one.
 *
 * @param storage - Where the run is saved, or null to skip.
 * @param slug - The game's id.
 */
export function clearRunSnapshot(
  storage: RunSnapshotStorage | null,
  slug: string
): void {
  if (!storage) return;
  try {
    storage.removeItem(runSnapshotKey(slug));
  } catch {
    // Nothing to clear where storage is blocked.
  }
}

interface Envelope {
  readonly schema: number;
  readonly savedAt: number;
  readonly view: FormFactor;
  readonly tuning: Readonly<Record<string, number | boolean>>;
  readonly state: unknown;
  readonly rngState?: number;
  readonly step?: number;
  readonly tags?: RunTags;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Checked by hand rather than with Zod, so the cabinet's shared chunk does
// not carry Zod; a game's own state schema brings it into the game's chunk.
function parseEnvelope(json: unknown): Envelope | null {
  if (!isPlainObject(json) || !("state" in json)) return null;
  const { schema, savedAt, view, tuning, state, rngState, step, tags } = json;
  if (typeof schema !== "number" || !Number.isInteger(schema)) return null;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  const knownView = FORM_FACTORS.find((factor) => factor === view);
  if (!knownView || !isPlainObject(tuning)) return null;
  const knobs: Record<string, number | boolean> = {};
  for (const [name, knob] of Object.entries(tuning)) {
    if (typeof knob !== "number" && typeof knob !== "boolean") return null;
    knobs[name] = knob;
  }
  // Optional since #2544: a save without them is a valid v1 save, but a
  // present value that is not a stream state or step count is corrupt.
  if (rngState !== undefined && !isRngState(rngState)) return null;
  if (step !== undefined && !isStepCount(step)) return null;
  const runTags = tags === undefined ? undefined : parseRunTags(tags);
  if (runTags === null) return null;
  return {
    schema,
    savedAt,
    view: knownView,
    tuning: knobs,
    state,
    ...(rngState === undefined ? {} : { rngState }),
    ...(step === undefined ? {} : { step }),
    ...(runTags === undefined ? {} : { tags: runTags }),
  };
}

/**
 * Reads a game's saved run. A save from another schema version, or one whose
 * envelope or state does not parse, is removed and reported as discarded.
 * This never throws, so a bad save can never break a view.
 *
 * @param storage - Where the run is saved, or null for none.
 * @param slug - The game's id.
 * @param format - The schema version and the state's Zod schema.
 * @returns The run, nothing, or why the save was discarded.
 */
export function readRunSnapshot<State>(
  storage: RunSnapshotStorage | null,
  slug: string,
  format: RunSnapshotFormat<State>
): RunSnapshotRead<State> {
  if (!storage) return { status: "empty" };
  let raw: string | null;
  try {
    raw = storage.getItem(runSnapshotKey(slug));
  } catch {
    return { status: "empty" };
  }
  if (raw === null) return { status: "empty" };

  const discard = (
    reason: RunSnapshotDiscardReason
  ): RunSnapshotRead<State> => {
    clearRunSnapshot(storage, slug);
    return { status: "discarded", reason };
  };

  let envelope: Envelope | null;
  try {
    envelope = parseEnvelope(JSON.parse(raw));
  } catch {
    return discard("parse");
  }
  if (!envelope) return discard("parse");
  if (envelope.schema !== format.schema) return discard("schema");
  let parsed: ReturnType<z.ZodType<State>["safeParse"]>;
  try {
    parsed = format.state.safeParse(envelope.state);
  } catch {
    return discard("parse");
  }
  if (!parsed.success) return discard("parse");
  return { status: "ok", snapshot: { ...envelope, state: parsed.data } };
}

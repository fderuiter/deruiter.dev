/**
 * The run-fairness contract (#2547, ADR 0062 bar item 19): what keeps touch
 * play fair, and what every run records about how it was played.
 *
 * - **Tuning keys on the input, never the view.** A view may change layout
 *   and hit areas, but timing windows, aim assist and ramps follow the
 *   input the player is using: a desktop player who narrows the window to
 *   the phone view still plays with keys and gets no touch assists.
 * - **Assists ratchet within a run.** A run keeps the most generous tuning
 *   it has used. Moving from touch to keys does not tighten it; moving from
 *   keys to touch loosens it, and the run records that.
 * - **A run records every view and input it used,** in first-seen order, so
 *   "view and input" is never ambiguous when either changes mid-run.
 *
 * Score gates (trophies, par stars, the Arcade Daily, share text) read the
 * record through {@link isUnassisted} and {@link assistLabel}, so no game
 * invents its own check. This file is pure, so the rules are unit tested
 * without a browser.
 */

import { FORM_FACTORS, type FormFactor } from "./form-factor";

/**
 * The input the player is using: a touch screen, an Apple Pencil, a
 * hardware keyboard or a mouse or trackpad.
 */
export type InputModality = "touch" | "pen" | "keyboard" | "mouse";

/** Every input modality, in the order a record lists them. */
export const INPUT_MODALITIES: readonly InputModality[] = [
  "touch",
  "pen",
  "keyboard",
  "mouse",
] as const;

/** One assist's setting: a named strength, or on and off. */
export type AssistValue = string | boolean;

/**
 * How a run was played (#2547). Stored in the run snapshot and with a
 * game's best score.
 */
export interface RunTags {
  /** Every view the run was played in, in the order they were first used. */
  readonly views: readonly FormFactor[];
  /** Every input the run was played with, in the order they were first used. */
  readonly inputs: readonly InputModality[];
  /**
   * The assists the run has used, at the most generous setting it reached.
   * An assist at its least setting is left out, so an empty record is an
   * unassisted run.
   */
  readonly assists: Readonly<Record<string, AssistValue>>;
}

/**
 * A game's assist table: what each input gets, and the order of each
 * assist's settings from least to most generous.
 */
export interface FairnessPolicy {
  /**
   * Each assist's settings, least generous first. The first is "no assist",
   * e.g. `{ aimAssist: ["off", "light", "strong"], autoFire: [false, true] }`.
   */
  readonly levels: Readonly<Record<string, readonly AssistValue[]>>;
  /** The assists an input gets. An assist left out is at its first level. */
  readonly assistsFor: (
    input: InputModality
  ) => Readonly<Record<string, AssistValue>>;
}

/** The record of a run that has not started: no views, inputs or assists. */
export const EMPTY_RUN_TAGS: RunTags = Object.freeze({
  views: Object.freeze([]) as readonly FormFactor[],
  inputs: Object.freeze([]) as readonly InputModality[],
  assists: Object.freeze({}),
});

/** How generous a setting is: its place in the assist's levels, or -1. */
function rank(
  policy: FairnessPolicy,
  assist: string,
  value: AssistValue | undefined
): number {
  if (value === undefined) return 0;
  return policy.levels[assist]?.indexOf(value) ?? -1;
}

/**
 * Raises a run's assists to what `input` gets, keeping any assist already
 * more generous. Settings outside the policy's levels are ignored.
 */
function ratchet(
  assists: Readonly<Record<string, AssistValue>>,
  input: InputModality,
  policy: FairnessPolicy
): Readonly<Record<string, AssistValue>> {
  const next: Record<string, AssistValue> = { ...assists };
  let changed = false;
  for (const [assist, value] of Object.entries(policy.assistsFor(input))) {
    const offered = rank(policy, assist, value);
    // The first level is no assist, and an unknown setting grants nothing.
    if (offered <= 0) continue;
    if (offered > rank(policy, assist, next[assist])) {
      next[assist] = value;
      changed = true;
    }
  }
  return changed ? next : assists;
}

function withFirstSeen<T>(list: readonly T[], item: T): readonly T[] {
  return list.includes(item) ? list : [...list, item];
}

/**
 * Starts a run's record in a view, with an input.
 *
 * @param view - The view the run starts in.
 * @param input - The input the player is using.
 * @param policy - The game's assist table.
 * @returns The record, with the assists that input gets.
 */
export function startRunTags(
  view: FormFactor,
  input: InputModality,
  policy: FairnessPolicy
): RunTags {
  return {
    views: [view],
    inputs: [input],
    assists: ratchet({}, input, policy),
  };
}

/**
 * Records a view swap. A view never changes tuning, so the assists stay.
 *
 * @param tags - The run so far.
 * @param view - The view the run is now in.
 * @returns The record, or `tags` itself when the view was already in it.
 */
export function noteRunView(tags: RunTags, view: FormFactor): RunTags {
  const views = withFirstSeen(tags.views, view);
  return views === tags.views ? tags : { ...tags, views };
}

/**
 * Records an input change, and ratchets the assists: an input with more
 * generous assists loosens the run, and one with fewer never tightens it.
 *
 * @param tags - The run so far.
 * @param input - The input the player is now using.
 * @param policy - The game's assist table.
 * @returns The record, or `tags` itself when nothing changed.
 */
export function noteRunInput(
  tags: RunTags,
  input: InputModality,
  policy: FairnessPolicy
): RunTags {
  const inputs = withFirstSeen(tags.inputs, input);
  const assists = ratchet(tags.assists, input, policy);
  if (inputs === tags.inputs && assists === tags.assists) return tags;
  return { ...tags, inputs, assists };
}

/**
 * The tuning a session plays with now: every assist in the policy, at the
 * run's setting or its first level. Read this, not the current input, so
 * the ratchet holds.
 *
 * @param tags - The run so far.
 * @param policy - The game's assist table.
 * @returns Each assist's setting.
 */
export function runAssists(
  tags: RunTags,
  policy: FairnessPolicy
): Readonly<Record<string, AssistValue>> {
  const tuning: Record<string, AssistValue> = {};
  for (const [assist, levels] of Object.entries(policy.levels)) {
    const value = tags.assists[assist];
    if (value !== undefined) tuning[assist] = value;
    else if (levels.length > 0) tuning[assist] = levels[0];
  }
  return tuning;
}

/**
 * A run's record as a small external store, for a session to hold (#2547).
 * The view and input are noted as they change; the record ratchets, and
 * {@link RunFairness.assists} is the tuning to play with.
 */
export interface RunFairness {
  /** The game's assist table. */
  readonly policy: FairnessPolicy;
  /** The run's record. Returns the same object until it changes. */
  readonly getTags: () => RunTags;
  /** Calls `listener` after every change. Returns an unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Notes the view the run is in now. */
  readonly noteView: (view: FormFactor) => void;
  /** Notes the input the player is using now, and ratchets the assists. */
  readonly noteInput: (input: InputModality) => void;
  /**
   * Puts back a saved run's record on Resume, then notes the view and
   * input in use now, so the resumed run keeps its ratchet and records
   * how it carries on.
   */
  readonly restore: (tags: RunTags) => void;
  /** Starts a new run's record in the view and input in use now. */
  readonly reset: () => void;
  /** The tuning to play with now, from {@link runAssists}. */
  readonly assists: () => Readonly<Record<string, AssistValue>>;
}

/**
 * Makes a run's record for a session. Methods do not rely on `this`.
 *
 * @param policy - The game's assist table.
 * @returns The store, with an empty record.
 */
export function createRunFairness(policy: FairnessPolicy): RunFairness {
  let tags: RunTags = EMPTY_RUN_TAGS;
  let view: FormFactor | null = null;
  let input: InputModality | null = null;
  const listeners = new Set<() => void>();

  const set = (next: RunTags) => {
    if (next === tags) return;
    tags = next;
    [...listeners].forEach((listener) => listener());
  };
  const current = (from: RunTags) => {
    let next = from;
    if (view) next = noteRunView(next, view);
    if (input) next = noteRunInput(next, input, policy);
    return next;
  };

  return {
    policy,
    getTags: () => tags,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    noteView(next) {
      view = next;
      set(noteRunView(tags, next));
    },
    noteInput(next) {
      input = next;
      set(noteRunInput(tags, next, policy));
    },
    restore: (saved) => set(current(saved)),
    reset: () => set(current(EMPTY_RUN_TAGS)),
    assists: () => runAssists(tags, policy),
  };
}

/**
 * Whether a run used no assist, for gates such as par stars and trophies
 * that only count unassisted play.
 *
 * @param tags - The run's record.
 * @returns True when the run used no assist.
 */
export function isUnassisted(tags: RunTags): boolean {
  return Object.keys(tags.assists).length === 0;
}

/** `aimAssist` reads "aim assist". */
function words(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase();
}

/**
 * A short line naming a run's assists, for share text and score lists:
 * "Unassisted", or "Assisted: aim assist strong, auto fire".
 *
 * @param tags - The run's record.
 * @returns The line.
 */
export function assistLabel(tags: RunTags): string {
  const parts = Object.keys(tags.assists)
    .sort()
    .map((assist) => {
      const value = tags.assists[assist];
      return value === true ? words(assist) : `${words(assist)} ${value}`;
    });
  return parts.length === 0 ? "Unassisted" : `Assisted: ${parts.join(", ")}`;
}

/**
 * Orders two records of the same score: an unassisted run first, then the
 * one with fewer assists, then by their JSON, so a merge that keeps the
 * better record is the same whichever copy it starts from.
 *
 * @param a - One record.
 * @param b - The other.
 * @returns Negative when `a` is the better record, positive for `b`, 0 when equal.
 */
export function compareRunTags(a: RunTags, b: RunTags): number {
  const byAssists =
    Object.keys(a.assists).length - Object.keys(b.assists).length;
  if (byAssists !== 0) return byAssists;
  const left = canonicalJson(a);
  const right = canonicalJson(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(tags: RunTags): string {
  const assists = Object.keys(tags.assists)
    .sort()
    .map((assist) => [assist, tags.assists[assist]]);
  return JSON.stringify([tags.views, tags.inputs, assists]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueOf<T>(value: unknown, allowed: readonly T[]): T[] | null {
  if (!Array.isArray(value)) return null;
  const seen: T[] = [];
  for (const item of value) {
    const known = allowed.find((candidate) => candidate === item);
    if (known === undefined || seen.includes(known)) return null;
    seen.push(known);
  }
  return seen;
}

/**
 * Reads a stored record. Anything that is not a well-formed record (an
 * unknown view or input, a repeat, an assist that is not a string or a
 * boolean) reads as null, so a damaged record is dropped rather than
 * trusted. Checked by hand rather than with Zod, so the cabinet's shared
 * chunk does not carry Zod.
 *
 * @param value - The stored value.
 * @returns The record, or null.
 */
export function parseRunTags(value: unknown): RunTags | null {
  if (!isPlainObject(value)) return null;
  const views = uniqueOf(value.views, FORM_FACTORS);
  const inputs = uniqueOf(value.inputs, INPUT_MODALITIES);
  if (!views || !inputs || !isPlainObject(value.assists)) return null;
  const assists: Record<string, AssistValue> = {};
  for (const [assist, setting] of Object.entries(value.assists)) {
    // A stored "__proto__" key would set the record's prototype, not a field.
    if (assist === "__proto__") return null;
    if (typeof setting !== "string" && typeof setting !== "boolean") {
      return null;
    }
    assists[assist] = setting;
  }
  return { views, inputs, assists };
}

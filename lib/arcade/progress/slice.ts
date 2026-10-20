/**
 * Progress slices (#2548): a typed, versioned, mergeable view of one
 * existing storage key, built on `createArcadeStore`. A slice keeps today's
 * key and bytes; it adds a schema, a version with a migration chain, and the
 * merge that sync and import will use (design §4 and §5).
 */

import { logger } from "@/lib/logger";
import { createArcadeStore, type ArcadeStore } from "./store";

/**
 * What a slice holds. `profile`: bests, trophies and unlocks, merged with
 * joins. `save`: a run in progress, never merged. `device`: a cache that
 * stays on this device.
 */
export type ArcadeSliceClass = "profile" | "save" | "device";

/** How a slice's value is framed in storage. */
export type ArcadeSliceFormat =
  /** Plain JSON, as most games write. */
  | "json"
  /** safe-storage's `{ value, lastAccessedAt, ... }` envelope. */
  | "envelope";

/**
 * The schema a slice validates with. A Zod schema fits; so does anything
 * with the same `safeParse`.
 */
export interface ArcadeSliceSchema<T> {
  safeParse(
    value: unknown
  ): { success: true; data: T } | { success: false; error?: unknown };
}

/** Everything that defines a slice. */
export interface ArcadeSliceDefinition<T> {
  /** A stable name, e.g. `arcade.core`. */
  id: string;
  /** The storage key, exactly as the game wrote it before. */
  key: string;
  class: ArcadeSliceClass;
  /**
   * The current version. A stored value's version is its `version` field,
   * or 0 when it has none.
   */
  version: number;
  /** Checks a stored (and migrated) value. A value it rejects is corrupt. */
  schema: ArcadeSliceSchema<T>;
  /** Brings a value stored at `fromVersion` up to `version`. */
  migrate?: (value: unknown, fromVersion: number) => unknown;
  /**
   * Combines two copies of the slice. For a profile slice it must be a join:
   * commutative, associative, idempotent, and never lower a best.
   */
  merge: (a: T, b: T) => T;
  /** The value when nothing is stored. */
  empty: () => T;
  /**
   * Holds a balance that can go down (Labyrinth's crypto), so it merges by
   * last writer rather than by `max`.
   */
  spendable?: boolean;
  /** How the value is framed in storage; `json` unless given. */
  format?: ArcadeSliceFormat;
  /** Whether a refused write is kept in memory for the page (default true). */
  retainInMemory?: boolean;
  /** A one-time upgrade, as for `createArcadeStore`. */
  upgrade?: (value: T, stored: boolean) => T | null;
}

/** A slice's description, without its value type. */
export interface ArcadeSliceInfo {
  readonly id: string;
  readonly key: string;
  readonly class: ArcadeSliceClass;
  readonly version: number;
  readonly spendable: boolean;
}

/** A defined slice. Read and write it with `read`, `write` and friends. */
export interface ArcadeSlice<T> extends ArcadeSliceInfo {
  readonly merge: (a: T, b: T) => T;
  readonly empty: () => T;
  /** Checks a value against the slice's schema; null when it fails. */
  readonly validate: (value: unknown) => T | null;
  /** The store underneath. */
  readonly store: ArcadeStore<T>;
}

function isEnvelope(value: unknown): value is { value: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof (value as Record<string, unknown>).lastAccessedAt === "number"
  );
}

function storedVersion(value: unknown): number {
  if (typeof value !== "object" || value === null) return 0;
  const version = (value as Record<string, unknown>).version;
  return typeof version === "number" && Number.isInteger(version) ? version : 0;
}

/**
 * Defines a slice over an existing key. Nothing is moved or rewritten: the
 * first write stores the same format the game used before.
 *
 * @param definition - The slice's key, schema, version and merge.
 * @returns The slice.
 */
export function defineSlice<T>(
  definition: ArcadeSliceDefinition<T>
): ArcadeSlice<T> {
  const format = definition.format ?? "json";

  const validate = (value: unknown): T | null => {
    const result = definition.schema.safeParse(value);
    return result.success ? result.data : null;
  };

  const store = createArcadeStore<T>(definition.key, {
    parse: (raw) => {
      let value: unknown = JSON.parse(raw);
      if (format === "envelope" && isEnvelope(value)) value = value.value;
      const from = storedVersion(value);
      if (from < definition.version && definition.migrate) {
        value = definition.migrate(value, from);
      }
      const parsed = definition.schema.safeParse(value);
      if (!parsed.success) {
        throw new TypeError(`"${definition.id}" failed its schema`);
      }
      return parsed.data;
    },
    serialize: (value) =>
      format === "envelope"
        ? // The bytes safe-storage's setItem wrote for this key before.
          JSON.stringify({
            value,
            lastAccessedAt: Date.now(),
            expiresAt: null,
            isExpirable: false,
          })
        : JSON.stringify(value),
    fallback: definition.empty(),
    retainInMemory: definition.retainInMemory,
    upgrade: definition.upgrade,
  });

  return {
    id: definition.id,
    key: definition.key,
    class: definition.class,
    version: definition.version,
    spendable: definition.spendable ?? false,
    merge: definition.merge,
    empty: definition.empty,
    validate,
    store,
  };
}

/**
 * A slice's current value. Sets a damaged value aside and runs the slice's
 * one-time upgrade first, so call it from handlers and game code; in a
 * component use {@link useProgress}.
 *
 * @param slice - The slice to read.
 * @returns The value.
 */
export function read<T>(slice: ArcadeSlice<T>): T {
  return slice.store.settle();
}

/**
 * Validates and stores a slice's value, then tells this tab's subscribers
 * with one `arcade_progress_changed` event (other tabs hear the native
 * `storage` event). A value that fails the schema is not written.
 *
 * @param slice - The slice to write.
 * @param next - The new value.
 * @returns True when the value reached localStorage.
 */
export function write<T>(slice: ArcadeSlice<T>, next: T): boolean {
  const valid = slice.validate(next);
  if (valid === null) {
    logger.warn(`Arcade progress: refused an invalid "${slice.id}" value.`);
    return false;
  }
  return slice.store.set(valid);
}

/**
 * Calls `onChange` after any write to the slice, in this tab or another.
 *
 * @param slice - The slice to watch.
 * @param onChange - Called after each write.
 * @returns A function that stops listening.
 */
export function subscribe<T>(
  slice: ArcadeSlice<T>,
  onChange: () => void
): () => void {
  return slice.store.subscribe(onChange);
}

/**
 * A slice's value in a React component, on `useSyncExternalStore`. The
 * server render reads the slice's empty value.
 *
 * @param slice - The slice to read.
 * @returns The current value.
 */
export function useProgress<T>(slice: ArcadeSlice<T>): T {
  return slice.store.useValue();
}

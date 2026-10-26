/**
 * The `arcade.tutorials` slice (#2972): which game tutorials have been
 * finished or turned down on this device, and at which script version. It is
 * a device setting, like the coach marks, so a new device offers the
 * tutorial again.
 */

import { defineSlice, read, write } from "./slice";

/** The storage key of the tutorial record. */
export const ARCADE_TUTORIALS_KEY = "arcade_tutorials_v1";

/** How a tutorial ended for a game. */
export type TutorialOutcome = "completed" | "declined";

/** One game's tutorial record. */
export interface TutorialRecord {
  /** The script version the outcome applies to. */
  readonly version: number;
  readonly outcome: TutorialOutcome;
}

/** Every game's tutorial record. */
export interface ArcadeTutorials {
  readonly version: 1;
  readonly games: Readonly<Record<string, TutorialRecord>>;
}

function parseRecord(value: unknown): TutorialRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const { version, outcome } = value as Record<string, unknown>;
  if (typeof version !== "number" || !Number.isInteger(version)) return null;
  if (outcome !== "completed" && outcome !== "declined") return null;
  return { version, outcome };
}

/** The tutorial record: `arcade_tutorials_v1`. */
export const arcadeTutorialsSlice = defineSlice<ArcadeTutorials>({
  id: "arcade.tutorials",
  key: ARCADE_TUTORIALS_KEY,
  class: "device",
  version: 1,
  schema: {
    // Damaged entries are dropped; only a value that is not a record at all
    // is corrupt.
    safeParse: (value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        return { success: false };
      const raw = (value as { games?: unknown }).games;
      const games: Record<string, TutorialRecord> = {};
      if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
        for (const [slug, entry] of Object.entries(raw)) {
          const record = parseRecord(entry);
          if (record) games[slug] = record;
        }
      }
      return { success: true, data: { version: 1, games } };
    },
  },
  // A device slice never merges with another copy; a completion beats a
  // decline, and a newer version beats an older one.
  merge: (a, b) => {
    const games: Record<string, TutorialRecord> = { ...a.games };
    for (const [slug, record] of Object.entries(b.games)) {
      const mine = games[slug];
      if (
        !mine ||
        record.version > mine.version ||
        (record.version === mine.version && record.outcome === "completed")
      ) {
        games[slug] = record;
      }
    }
    return { version: 1, games };
  },
  empty: () => ({ version: 1, games: {} }),
});

/**
 * Whether a game's tutorial should be offered when its cabinet launches:
 * true until the player finishes or turns down this version of it.
 *
 * @param record - The game's record, if any.
 * @param version - The script's current version.
 * @returns True when the offer should show.
 */
export function shouldOfferTutorial(
  record: TutorialRecord | undefined,
  version: number
): boolean {
  return !record || record.version < version;
}

/**
 * Records how a game's tutorial ended.
 *
 * @param gameId - The game's registry slug.
 * @param version - The script version.
 * @param outcome - Finished, or turned down.
 * @returns True when the record reached localStorage.
 */
export function setTutorialOutcome(
  gameId: string,
  version: number,
  outcome: TutorialOutcome
): boolean {
  const current = read(arcadeTutorialsSlice);
  const existing = current.games[gameId];
  // A decline never overwrites a completion of the same version.
  if (
    existing &&
    existing.version === version &&
    (existing.outcome === outcome || outcome === "declined")
  ) {
    return true;
  }
  const next: ArcadeTutorials = {
    version: 1,
    games: { ...current.games, [gameId]: { version, outcome } },
  };
  return write(arcadeTutorialsSlice, next);
}

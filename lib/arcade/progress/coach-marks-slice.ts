/**
 * The `arcade.coach-marks` slice (#2361): which games have shown their
 * first-run coach marks on this device. It is a device setting, not
 * progress, so it never syncs: a new phone teaches the touch controls again.
 */

import { defineSlice, read, write } from "./slice";

/** The storage key of the coach-mark record. */
export const ARCADE_COACH_MARKS_KEY = "arcade_coach_marks_v1";

/** The games whose coach marks were finished or skipped on this device. */
export interface ArcadeCoachMarks {
  readonly version: 1;
  /** Game slugs, sorted and unique. */
  readonly seen: readonly string[];
}

function normalise(seen: readonly string[]): string[] {
  return [...new Set(seen)].sort();
}

/** Which games have shown their coach marks: `arcade_coach_marks_v1`. */
export const arcadeCoachMarksSlice = defineSlice<ArcadeCoachMarks>({
  id: "arcade.coach-marks",
  key: ARCADE_COACH_MARKS_KEY,
  class: "device",
  version: 1,
  schema: {
    // Entries that are not strings are dropped; only a value that is not a
    // record at all is corrupt.
    safeParse: (value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value))
        return { success: false };
      const seen = (value as { seen?: unknown }).seen;
      return {
        success: true,
        data: {
          version: 1,
          seen: normalise(
            Array.isArray(seen)
              ? seen.filter((slug): slug is string => typeof slug === "string")
              : []
          ),
        },
      };
    },
  },
  // A device slice never merges with another copy; the union is the safe
  // answer if one ever does.
  merge: (a, b) => ({ version: 1, seen: normalise([...a.seen, ...b.seen]) }),
  empty: () => ({ version: 1, seen: [] }),
});

/**
 * Whether a game's coach marks have been finished or skipped on this device.
 *
 * @param gameId - The game's registry slug.
 * @returns True when they should not show again.
 */
export function hasSeenCoachMarks(gameId: string): boolean {
  return read(arcadeCoachMarksSlice).seen.includes(gameId);
}

/**
 * Records a game's coach marks as seen or, with `seen` false, clears the
 * record so they show again on the next run ("Show tips again").
 *
 * @param gameId - The game's registry slug.
 * @param seen - Whether the tips have been seen. Defaults to true.
 * @returns True when the record reached localStorage.
 */
export function setCoachMarksSeen(gameId: string, seen = true): boolean {
  const current = read(arcadeCoachMarksSlice).seen;
  if (current.includes(gameId) === seen) return true;
  return write(arcadeCoachMarksSlice, {
    version: 1,
    seen: seen
      ? normalise([...current, gameId])
      : current.filter((slug) => slug !== gameId),
  });
}

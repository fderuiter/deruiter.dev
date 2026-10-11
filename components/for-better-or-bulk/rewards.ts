/**
 * Which arcade trophies a finished run earns. Only a run at normal speed earns
 * any, the same rule that keeps a sped-up run off the board. Assisted runs earn
 * none of these. Replays never reach this code, so they earn nothing either.
 */

import type { GameState } from "@/lib/for-better-or-bulk";

/**
 * The line the setup screen and the side panel show before and during a day:
 * a helper day or a sped-up day earns no trophy and no board score.
 */
export const NO_REWARD_LINE =
  "Helper days and sped-up days don't earn trophies or a board score.";

/**
 * The trophy ids a finished run earns. A perfect run is three stars on the
 * standard day, or on a seeded day, which has its own trophy.
 */
export function runTrophyIds(
  state: GameState,
  stars: number,
  speed: number
): string[] {
  if (speed !== 1 || state.setup.assist) return [];
  const seeded = (state.setup.seed ?? 0) !== 0;
  const ids: string[] = [];
  if (stars === 3) {
    ids.push(
      seeded
        ? "for_better_or_bulk_perfect_day"
        : "for_better_or_bulk_three_stars"
    );
  }
  if (state.finishedAt !== null && state.burntBatches === 0) {
    ids.push("for_better_or_bulk_nothing_burnt");
  }
  return ids;
}

/**
 * Which finished runs may go on the standard high board. Only a standard day
 * at normal speed counts: a seeded day (its shower and rush change the work)
 * or a sped-up run for watching would otherwise replace the one board score.
 */

import type { GameState } from "@/lib/for-better-or-bulk";

/** Whether a finished level counts toward the standard high score. */
export function countsForBoard(state: GameState, speed: number): boolean {
  return speed === 1 && (state.setup.seed ?? 0) === 0;
}

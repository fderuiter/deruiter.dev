import type { StudyVisit } from "./types";

/**
 * Describes the allowed days before and after a visit's target day.
 * A symmetric window uses the compact ± notation; an asymmetric window
 * states both sides so a one-sided window cannot imply extra visit days.
 */
export function formatVisitWindow(
  visit: Pick<StudyVisit, "windowBefore" | "windowAfter">
): string {
  const before = Math.abs(visit.windowBefore);
  const after = Math.abs(visit.windowAfter);

  return before === after ? `±${before}d` : `-${before}d/+${after}d`;
}

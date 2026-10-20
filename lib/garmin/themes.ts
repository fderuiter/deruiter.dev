/**
 * Stage themes for Monkey C Mayhem (#1993). Each stage of the 5K has a fixed
 * theme, derived from the stage number, so no state needs saving and old runs
 * read as the default track.
 */

/** The look and physics of a stage. */
export type StageTheme = "track" | "pool" | "basement-gym" | "open-water";

/** Theme per stage, 1-based. Stages 1 and 5 stay on the track. */
export const STAGE_THEMES: readonly StageTheme[] = [
  "track",
  "pool",
  "basement-gym",
  "open-water",
  "track",
];

/** One pool length, in metres, for the lengths readout on water stages. */
export const LENGTH_METERS = 25;

/** The theme of a stage. Unknown or out-of-range stages are track. */
export function themeForStage(stage: number): StageTheme {
  if (!Number.isFinite(stage)) return "track";
  return STAGE_THEMES[Math.floor(stage) - 1] ?? "track";
}

/** True for the stages swum rather than run. */
export function isWaterTheme(theme: StageTheme): boolean {
  return theme === "pool" || theme === "open-water";
}

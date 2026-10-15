import {
  applyEffects,
  type Difficulty,
  type Effects,
  type StudyState,
} from "@/lib/study-director";

/**
 * Share of the sponsor's goodwill that office work earns, by difficulty
 * (#2192). A sponsor who has watched a study fail under someone else warms
 * to the next Study Director slowly, so in a rescue each status line, call
 * and visit counts for half. Without this a careful player's office work
 * pushed the sponsor to the top of the scale on every difficulty, and calm
 * and rescue ended alike.
 */
export const SPONSOR_GOODWILL: Record<Difficulty, number> = {
  calm: 1,
  standard: 1,
  rescue: 0.5,
};

/**
 * Applies the effects of office work: as `applyEffects`, with any gain in
 * the sponsor's regard scaled by the difficulty. Losses are never softened.
 */
export function applyOfficeEffects(
  study: StudyState,
  effects: Effects
): StudyState {
  const client = effects.meters?.client ?? 0;
  const share = SPONSOR_GOODWILL[study.difficulty ?? "standard"];
  if (client <= 0 || share === 1) return applyEffects(study, effects);
  return applyEffects(study, {
    ...effects,
    meters: { ...effects.meters, client: client * share },
  });
}

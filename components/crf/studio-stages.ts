import type { StudioMode } from "@/lib/crf";

/**
 * The studio's seven modes grouped into the three stages an author works
 * through (#2927 item 12, #2680): design the forms and their logic, schedule
 * them against visits, then verify the build and ship it. The mode bar, the
 * phone mode picker and the number-key shortcuts all read this order.
 */
export type StudioStageId = "design" | "schedule" | "verify";

interface StudioStage {
  id: StudioStageId;
  label: string;
  modes: readonly StudioMode[];
}

export const STUDIO_STAGES: readonly StudioStage[] = [
  { id: "design", label: "Design", modes: ["designer", "grid", "rules"] },
  { id: "schedule", label: "Schedule", modes: ["matrix"] },
  { id: "verify", label: "Verify and ship", modes: ["edc", "acrf", "export"] },
];

/** Every mode in stage order; a mode's shortcut is its position plus one. */
export const STUDIO_MODE_ORDER: readonly StudioMode[] = STUDIO_STAGES.flatMap(
  (stage) => stage.modes
);

export const MODE_BY_KEY: Readonly<Record<string, StudioMode>> =
  Object.fromEntries(
    STUDIO_MODE_ORDER.map((mode, index) => [String(index + 1), mode])
  );

export function modeShortcut(mode: StudioMode): string {
  return String(STUDIO_MODE_ORDER.indexOf(mode) + 1);
}

export function stageOfMode(mode: StudioMode): StudioStage {
  return STUDIO_STAGES.find((stage) => stage.modes.includes(mode))!;
}

/**
 * The one step the author should take after this mode: the first mode of
 * the next stage, or, from the last stage, running the study through the
 * pipeline.
 */
export type StudioNextStep =
  | { kind: "mode"; mode: StudioMode; label: string }
  | { kind: "pipeline"; label: string };

const NEXT_STEP_LABEL: Readonly<Record<StudioStageId, string>> = {
  design: "Schedule the forms",
  schedule: "Test in Live EDC",
  verify: "Run the pipeline",
};

export function nextStepFor(mode: StudioMode): StudioNextStep {
  const stage = stageOfMode(mode);
  const label = NEXT_STEP_LABEL[stage.id];
  const next = STUDIO_STAGES[STUDIO_STAGES.indexOf(stage) + 1];
  return next
    ? { kind: "mode", mode: next.modes[0], label }
    : { kind: "pipeline", label };
}

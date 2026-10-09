import type { HudReadout } from "@/lib/study-director-world";

/** The part of the working day a clock reading falls in. */
export type DayPhase = "morning" | "midday" | "afternoon" | "evening" | "night";

/** Where each phase starts, in minutes after midnight. After 18:00 the office dims. */
const PHASE_STARTS: ReadonlyArray<readonly [DayPhase, number]> = [
  ["night", 18 * 60],
  ["evening", 17 * 60],
  ["afternoon", 13 * 60],
  ["midday", 11 * 60 + 30],
];

export const PHASE_LABEL: Record<DayPhase, string> = {
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Winding down",
  night: "After hours",
};

/** The phase of the day for minutes after midnight. */
export function dayPhase(minute: number): DayPhase {
  for (const [phase, start] of PHASE_STARTS) if (minute >= start) return phase;
  return "morning";
}

/** Energy or focus below this is low, and the player is told once. */
export const LOW_LEVEL = 25;

/**
 * What a screen reader should hear when the HUD moves between two readouts:
 * only the changes that matter, never every tick of the clock. A new day or
 * phase, a meter dropping below the low mark, the budget going over, the
 * timeline slipping and enrollment moving each get one short sentence.
 */
export function hudChanges(
  prev: HudReadout,
  next: HudReadout,
  prevMinute: number,
  nextMinute: number
): string[] {
  const said: string[] = [];
  if (next.day !== prev.day) {
    said.push(`Day ${next.day}, ${next.weekday}.`);
  } else {
    const before = dayPhase(prevMinute);
    const after = dayPhase(nextMinute);
    if (after !== before) said.push(`${PHASE_LABEL[after]}, ${next.clock}.`);
  }
  for (const [label, was, now] of [
    ["Energy", prev.energy, next.energy],
    ["Focus", prev.focus, next.focus],
  ] as const) {
    if (was >= LOW_LEVEL && now < LOW_LEVEL)
      said.push(`${label} is low, ${Math.round(now)} of 100.`);
  }
  if (
    next.budget.spent > next.budget.total &&
    prev.budget.spent <= prev.budget.total
  )
    said.push("The budget is over.");
  if (next.timeline.slipDays > prev.timeline.slipDays)
    said.push(`The timeline slipped to ${next.timeline.slipDays} days late.`);
  if (next.enrollment.enrolled !== prev.enrollment.enrolled)
    said.push(
      `Enrollment ${next.enrollment.enrolled} of ${next.enrollment.target}.`
    );
  return said;
}

/** The tone of a meter reading, shared by the bar and its test. */
export function meterTone(value: number): "low" | "mid" | "high" {
  return value < LOW_LEVEL ? "low" : value < 50 ? "mid" : "high";
}

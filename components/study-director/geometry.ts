import { PHASES, phaseForDay, type Phase } from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";

/**
 * Points of a radar polygon: one axis per value, the first pointing up,
 * going clockwise. Values run 0 to 100 and are clamped.
 */
export function radarPoints(
  values: number[],
  center: number,
  radius: number
): Array<[number, number]> {
  const n = Math.max(1, values.length);
  return values.map((value, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const r = (clamp(value, 0, 100) / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  });
}

interface PhaseSpan {
  phase: Phase;
  /** First day of the phase, 1-based. */
  start: number;
  /** Last day of the phase, inclusive. */
  end: number;
}

/** The planned schedule split into phases, in order, skipping empty ones. */
export function phaseSpans(durationDays: number): PhaseSpan[] {
  const spans: PhaseSpan[] = [];
  for (let day = 1; day <= durationDays; day += 1) {
    const phase = phaseForDay(day, durationDays);
    const last = spans[spans.length - 1];
    if (last && last.phase === phase) last.end = day;
    else spans.push({ phase, start: day, end: day });
  }
  return spans.sort(
    (a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase)
  );
}

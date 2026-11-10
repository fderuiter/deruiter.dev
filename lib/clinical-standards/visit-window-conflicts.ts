/**
 * The window conflict check for a visit schedule: whether one visit's late
 * window runs into the next visit's early window, or past its target day.
 * CRF Studio's schedule editor and the /study-data sandbox use the same
 * check, so it lives here rather than in either module. It has no imports,
 * so a page can use it without loading CRF Studio.
 */

/** The parts of a planned visit the window check reads. */
export interface WindowedVisit {
  /** Visit id. */
  readonly id: string;
  /** Visit name, used in the conflict message. */
  readonly name: string;
  /** Planned study day. */
  readonly targetDay: number;
  /** Days the visit may fall before its target day. */
  readonly windowBefore: number;
  /** Days the visit may fall after its target day. */
  readonly windowAfter: number;
  /** An unscheduled visit is left out of the check. */
  readonly visitType?: string;
  /** Arms the visit applies to; absent or empty means every arm. */
  readonly armIds?: readonly string[];
}

export interface VisitWindowConflict {
  /** ID of the earlier visit in sequence */
  visitIdA: string;
  /** Name of the earlier visit */
  visitNameA: string;
  /** ID of the later visit in sequence */
  visitIdB: string;
  /** Name of the later visit */
  visitNameB: string;
  /** Target day of visit A */
  targetDayA: number;
  /** Target day of visit B */
  targetDayB: number;
  /** Latest allowed day for visit A (targetDayA + windowAfterA) */
  latestDayA: number;
  /** Earliest allowed day for visit B (targetDayB - windowBeforeB) */
  earliestDayB: number;
  /** Number of overlapping days between the two visit windows */
  overlapDays: number;
  /** Conflict severity: 'error' if targetDayA >= targetDayB or latestDayA > targetDayB, else 'warning' */
  severity: "warning" | "error";
  /** Human-readable explanatory message */
  message: string;
}

export interface VisitConflictSummary {
  /** True if one or more window conflicts exist */
  hasConflicts: boolean;
  /** Total number of overlapping visit pairs detected */
  totalConflicts: number;
  /** Map of visitId -> array of conflicts involving this visit */
  conflictsByVisitId: Record<string, VisitWindowConflict[]>;
  /** Flat list of all detected conflicts */
  conflicts: VisitWindowConflict[];
}

/**
 * Evaluates visit target days and windows (windowBefore, windowAfter) in real time to detect overlaps.
 * Detects window overlaps where `targetDay_A + windowAfter_A >= targetDay_B - windowBefore_B`
 * for consecutive visits.
 *
 * Unscheduled visits happen whenever a site needs them, so their target day
 * is a placeholder rather than a place on the timeline; they are left out.
 */
export function evaluateVisitWindowConflicts(
  visits: readonly WindowedVisit[],
  armId?: string
): VisitConflictSummary {
  const filteredVisits = visits.filter(
    (v) =>
      v.visitType !== "Unscheduled" &&
      (!armId ||
        armId === "all" ||
        !v.armIds ||
        v.armIds.length === 0 ||
        v.armIds.includes(armId))
  );

  if (filteredVisits.length <= 1) {
    return {
      hasConflicts: false,
      totalConflicts: 0,
      conflictsByVisitId: {},
      conflicts: [],
    };
  }

  const conflicts: VisitWindowConflict[] = [];
  const conflictsByVisitId: Record<string, VisitWindowConflict[]> = {};
  const seenPairs = new Set<string>();

  const checkPair = (visitA: WindowedVisit, visitB: WindowedVisit) => {
    const pairKey = `${visitA.id}:${visitB.id}`;
    if (seenPairs.has(pairKey)) return;

    const windowAfterA = Math.abs(visitA.windowAfter || 0);
    const windowBeforeB = Math.abs(visitB.windowBefore || 0);

    const latestDayA = visitA.targetDay + windowAfterA;
    const earliestDayB = visitB.targetDay - windowBeforeB;

    if (latestDayA >= earliestDayB) {
      seenPairs.add(pairKey);
      const overlapDays = Math.max(1, latestDayA - earliestDayB + 1);
      let severity: "warning" | "error" = "warning";

      if (
        visitA.targetDay >= visitB.targetDay ||
        latestDayA >= visitB.targetDay
      ) {
        severity = "error";
      }

      const message =
        visitA.targetDay >= visitB.targetDay
          ? `Out-of-order target days: ${visitA.name} (Day ${visitA.targetDay}) and ${visitB.name} (Day ${visitB.targetDay}).`
          : `${visitA.name} late window (Day ${latestDayA}) overlaps ${visitB.name} early window (Day ${earliestDayB}) by ${overlapDays} day(s).`;

      const conflictObj: VisitWindowConflict = {
        visitIdA: visitA.id,
        visitNameA: visitA.name,
        visitIdB: visitB.id,
        visitNameB: visitB.name,
        targetDayA: visitA.targetDay,
        targetDayB: visitB.targetDay,
        latestDayA,
        earliestDayB,
        overlapDays,
        severity,
        message,
      };

      conflicts.push(conflictObj);

      if (!conflictsByVisitId[visitA.id]) conflictsByVisitId[visitA.id] = [];
      conflictsByVisitId[visitA.id].push(conflictObj);

      if (!conflictsByVisitId[visitB.id]) conflictsByVisitId[visitB.id] = [];
      conflictsByVisitId[visitB.id].push(conflictObj);
    }
  };

  // 1. Evaluate consecutive pairs in input matrix sequence order
  for (let i = 0; i < filteredVisits.length - 1; i++) {
    checkPair(filteredVisits[i], filteredVisits[i + 1]);
  }

  // 2. Evaluate consecutive pairs in sorted target day sequence order
  const sorted = [...filteredVisits]
    .map((v, idx) => ({ v, originalIndex: idx }))
    .sort(
      (a, b) =>
        a.v.targetDay - b.v.targetDay || a.originalIndex - b.originalIndex
    )
    .map((item) => item.v);

  for (let i = 0; i < sorted.length - 1; i++) {
    checkPair(sorted[i], sorted[i + 1]);
  }

  return {
    hasConflicts: conflicts.length > 0,
    totalConflicts: conflicts.length,
    conflictsByVisitId,
    conflicts,
  };
}

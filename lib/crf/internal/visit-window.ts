import type { StudyVisit } from "../types";

export {
  evaluateVisitWindowConflicts,
  type VisitConflictSummary,
  type VisitWindowConflict,
  type WindowedVisit,
} from "@/lib/clinical-standards/visit-window-conflicts";

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

export interface ScheduleBounds {
  /** Target duration from first visit target day to last visit target day */
  targetDurationDays: number;
  /** Maximum possible study duration including last visit late window and first visit early window */
  maxExpansionDays: number;
  /** Minimum possible study duration including last visit early window and first visit late window */
  maxContractionDays: number;
  /** Total potential expansion buffer (sum of all windowAfter days across visits) */
  expansionBufferDays: number;
  /** Total potential contraction buffer (sum of all windowBefore days across visits) */
  contractionBufferDays: number;
}

export interface BaselineDriftComparison {
  /** Whether a baseline snapshot was found and compared against */
  hasBaseline: boolean;
  /** Label/version tag of baseline snapshot used */
  baselineLabel?: string;
  /** Target day drift: difference between current target duration and baseline target duration */
  targetDurationDriftDays: number;
  /** Maximum expansion drift: difference between current max duration and baseline max duration */
  maxExpansionDriftDays: number;
  /** Maximum contraction drift: difference between current min duration and baseline min duration */
  maxContractionDriftDays: number;
  /** Per-visit target day drift details */
  visitDrifts: Array<{
    visitId: string;
    visitName: string;
    currentTargetDay: number;
    baselineTargetDay?: number;
    targetDayDelta: number;
    windowBeforeDelta: number;
    windowAfterDelta: number;
  }>;
}

export interface ScheduleDriftAnalysis {
  bounds: ScheduleBounds;
  baselineDrift: BaselineDriftComparison;
}

export interface CohortForecastParameters {
  /** Study / Subject 1 Start Date (YYYY-MM-DD), defaults to current date */
  startDate: string;
  /** Planned total subject enrollment cohort size (e.g., 50 subjects) */
  cohortSize?: number;
  /** Estimated enrollment period in days required to enroll full cohort (e.g., 90 days) */
  enrollmentDurationDays?: number;
  /** Expected dropout / attrition percentage (0-100), e.g., 10% */
  expectedAttritionRate?: number;
}

export interface VisitMilestoneProjection {
  visitId: string;
  visitName: string;
  targetDay: number;
  /** Target projected date string (YYYY-MM-DD) */
  targetDate: string;
  /** Earliest allowed date string (YYYY-MM-DD) */
  earliestDate: string;
  /** Latest allowed date string (YYYY-MM-DD) */
  latestDate: string;
  /** Target date for First Subject In */
  fsiDate: string;
  /** Target date for Last Subject In */
  lsiDate: string;
  /** Target date for First Subject Last Visit / completion */
  fslvDate: string;
  /** Target date for Last Subject Last Visit / completion */
  lslvDate: string;
  /** Earliest possible LSLV date considering earliest windows */
  earliestLslvDate: string;
  /** Latest possible LSLV date considering latest windows */
  latestLslvDate: string;
}

export interface StudyMilestoneForecast {
  startDate: string;
  cohortSize: number;
  enrollmentDurationDays: number;
  expectedAttritionRate: number;
  /** First Subject In date */
  fsiDate: string;
  /** Last Subject In date (FSI + enrollmentDurationDays) */
  lsiDate: string;
  /** First Subject Last Visit target date (FSI + lastVisit.targetDay) */
  fslvDate: string;
  /** Last Subject Last Visit target date (LSI + lastVisit.targetDay) */
  lslvDate: string;
  /** Earliest overall study completion date (LSI + lastVisit earliest day) */
  earliestStudyCompletionDate: string;
  /** Latest overall study completion date (LSI + lastVisit latest day) */
  latestStudyCompletionDate: string;
  /** Per-visit projections */
  visitProjections: VisitMilestoneProjection[];
  /** Estimated completing subjects after attrition */
  projectedCompletingSubjects: number;
}

/**
 * Deterministically adds offsetDays to an ISO YYYY-MM-DD date string using UTC arithmetic.
 */
export function addDaysToIsoDate(
  isoDateStr: string,
  offsetDays: number
): string {
  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + offsetDays);
    return fallback.toISOString().slice(0, 10);
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const utcDate = new Date(Date.UTC(year, month, day + offsetDays));
  return utcDate.toISOString().slice(0, 10);
}

/**
 * Calculates total target duration, maximum expansion days, and maximum contraction days.
 */
export function calculateScheduleBounds(visits: StudyVisit[]): ScheduleBounds {
  if (!visits || visits.length === 0) {
    return {
      targetDurationDays: 0,
      maxExpansionDays: 0,
      maxContractionDays: 0,
      expansionBufferDays: 0,
      contractionBufferDays: 0,
    };
  }

  const sorted = [...visits].sort((a, b) => a.targetDay - b.targetDay);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const targetDurationDays = Math.max(0, last.targetDay - first.targetDay);

  const earliestStartDay = first.targetDay - Math.abs(first.windowBefore || 0);
  const latestEndDay = last.targetDay + Math.abs(last.windowAfter || 0);
  const maxExpansionDays = Math.max(
    targetDurationDays,
    latestEndDay - earliestStartDay
  );

  const latestStartDay = first.targetDay + Math.abs(first.windowAfter || 0);
  const earliestEndDay = last.targetDay - Math.abs(last.windowBefore || 0);
  const maxContractionDays = Math.max(0, earliestEndDay - latestStartDay);

  let expansionBufferDays = 0;
  let contractionBufferDays = 0;

  for (const v of visits) {
    expansionBufferDays += Math.abs(v.windowAfter || 0);
    contractionBufferDays += Math.abs(v.windowBefore || 0);
  }

  return {
    targetDurationDays,
    maxExpansionDays,
    maxContractionDays,
    expansionBufferDays,
    contractionBufferDays,
  };
}

/**
 * Calculates cumulative schedule drift compared against a baseline snapshot.
 * Falls back gracefully when no baseline snapshot exists.
 */
export function calculateBaselineDrift(
  currentVisits: StudyVisit[],
  baselineVisits?: StudyVisit[],
  baselineLabel?: string
): BaselineDriftComparison {
  const currentBounds = calculateScheduleBounds(currentVisits);

  if (!baselineVisits || baselineVisits.length === 0) {
    return {
      hasBaseline: false,
      targetDurationDriftDays: 0,
      maxExpansionDriftDays: 0,
      maxContractionDriftDays: 0,
      visitDrifts: [],
    };
  }

  const baselineBounds = calculateScheduleBounds(baselineVisits);

  const baselineMap = new Map<string, StudyVisit>();
  for (const bv of baselineVisits) {
    baselineMap.set(bv.id, bv);
    if (bv.oid) baselineMap.set(bv.oid, bv);
  }

  const visitDrifts: BaselineDriftComparison["visitDrifts"] = [];

  for (const cv of currentVisits) {
    const bv =
      baselineMap.get(cv.id) || (cv.oid ? baselineMap.get(cv.oid) : undefined);
    if (bv) {
      visitDrifts.push({
        visitId: cv.id,
        visitName: cv.name,
        currentTargetDay: cv.targetDay,
        baselineTargetDay: bv.targetDay,
        targetDayDelta: cv.targetDay - bv.targetDay,
        windowBeforeDelta:
          Math.abs(cv.windowBefore || 0) - Math.abs(bv.windowBefore || 0),
        windowAfterDelta:
          Math.abs(cv.windowAfter || 0) - Math.abs(bv.windowAfter || 0),
      });
    } else {
      visitDrifts.push({
        visitId: cv.id,
        visitName: cv.name,
        currentTargetDay: cv.targetDay,
        targetDayDelta: 0,
        windowBeforeDelta: 0,
        windowAfterDelta: 0,
      });
    }
  }

  return {
    hasBaseline: true,
    baselineLabel: baselineLabel || "Baseline Snapshot",
    targetDurationDriftDays:
      currentBounds.targetDurationDays - baselineBounds.targetDurationDays,
    maxExpansionDriftDays:
      currentBounds.maxExpansionDays - baselineBounds.maxExpansionDays,
    maxContractionDriftDays:
      currentBounds.maxContractionDays - baselineBounds.maxContractionDays,
    visitDrifts,
  };
}

/**
 * Computes deterministic subject milestone forecasts given a start date and cohort parameters.
 */
export function calculateMilestoneForecasts(
  visits: StudyVisit[],
  params?: CohortForecastParameters
): StudyMilestoneForecast {
  const startDate = params?.startDate || new Date().toISOString().slice(0, 10);
  const cohortSize =
    params?.cohortSize && params.cohortSize > 0 ? params.cohortSize : 50;
  const enrollmentDurationDays =
    params?.enrollmentDurationDays !== undefined &&
    params.enrollmentDurationDays >= 0
      ? params.enrollmentDurationDays
      : 90;
  const expectedAttritionRate =
    params?.expectedAttritionRate !== undefined
      ? params.expectedAttritionRate
      : 10;

  const sortedVisits = [...visits].sort((a, b) => a.targetDay - b.targetDay);
  const lastVisit = sortedVisits[sortedVisits.length - 1];

  const fsiDate = startDate;
  const lsiDate = addDaysToIsoDate(fsiDate, enrollmentDurationDays);

  const lastTargetDay = lastVisit ? lastVisit.targetDay : 0;
  const lastEarliestDay = lastVisit
    ? lastVisit.targetDay - Math.abs(lastVisit.windowBefore || 0)
    : 0;
  const lastLatestDay = lastVisit
    ? lastVisit.targetDay + Math.abs(lastVisit.windowAfter || 0)
    : 0;

  const fslvDate = addDaysToIsoDate(fsiDate, lastTargetDay);
  const lslvDate = addDaysToIsoDate(lsiDate, lastTargetDay);
  const earliestStudyCompletionDate = addDaysToIsoDate(
    lsiDate,
    lastEarliestDay
  );
  const latestStudyCompletionDate = addDaysToIsoDate(lsiDate, lastLatestDay);

  const visitProjections: VisitMilestoneProjection[] = sortedVisits.map((v) => {
    const targetDay = v.targetDay;
    const windowBefore = Math.abs(v.windowBefore || 0);
    const windowAfter = Math.abs(v.windowAfter || 0);

    const vFsi = fsiDate;
    const vLsi = lsiDate;

    return {
      visitId: v.id,
      visitName: v.name,
      targetDay,
      targetDate: addDaysToIsoDate(fsiDate, targetDay),
      earliestDate: addDaysToIsoDate(fsiDate, targetDay - windowBefore),
      latestDate: addDaysToIsoDate(fsiDate, targetDay + windowAfter),
      fsiDate: vFsi,
      lsiDate: vLsi,
      fslvDate: addDaysToIsoDate(vFsi, targetDay),
      lslvDate: addDaysToIsoDate(vLsi, targetDay),
      earliestLslvDate: addDaysToIsoDate(vLsi, targetDay - windowBefore),
      latestLslvDate: addDaysToIsoDate(vLsi, targetDay + windowAfter),
    };
  });

  const projectedCompletingSubjects = Math.round(
    cohortSize * (1 - expectedAttritionRate / 100)
  );

  return {
    startDate,
    cohortSize,
    enrollmentDurationDays,
    expectedAttritionRate,
    fsiDate,
    lsiDate,
    fslvDate,
    lslvDate,
    earliestStudyCompletionDate,
    latestStudyCompletionDate,
    visitProjections,
    projectedCompletingSubjects,
  };
}

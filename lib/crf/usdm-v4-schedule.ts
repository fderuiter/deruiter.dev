/**
 * Reading and writing the timing side of a USDM v4.0 schedule of activities.
 *
 * USDM v4 does not store a visit's study day. It stores a schedule timeline
 * whose scheduled activity instances are linked to encounters, and timings
 * that place each instance an ISO 8601 duration before or after another one,
 * starting from a "Fixed Reference" anchor (normally Day 1, first dose).
 * These helpers convert between that graph and the target day plus window
 * that CRF Studio and the study data pipeline work with.
 *
 * Study days follow the SDTM convention: there is no Day 0, so Day -1 is the
 * calendar day before Day 1.
 */

import type {
  UsdmV4InterventionalStudyDesign,
  UsdmV4ScheduleTimeline,
  UsdmV4Timing,
} from "./usdm-v4-types";

/** NCI code of the USDM Timing type "Fixed Reference" (the anchor). */
export const USDM_TIMING_FIXED_REFERENCE = "C201358";
/** NCI code of the USDM Timing type "Before" (Timing Type, C201264). */
export const USDM_TIMING_BEFORE = "C201357";
/** NCI code of the USDM Timing type "After" (Timing Type, C201264). */
export const USDM_TIMING_AFTER = "C201356";

const ISO_DURATION =
  /^(-)?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Converts an ISO 8601 duration such as `P14D`, `P2W` or `-P3D` into a whole
 * number of days. Years count as 365 days and months as 30; hours, minutes
 * and seconds are rounded to the nearest day. Returns `null` for anything
 * that is not an ISO 8601 duration.
 */
export function parseIsoDurationDays(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ISO_DURATION.exec(value.trim());
  if (!match || value.trim() === "P" || value.trim() === "-P") return null;
  const [, neg, y, mo, w, d, h, mi, s] = match;
  const num = (part: string | undefined) => (part ? Number(part) : 0);
  const days =
    num(y) * 365 +
    num(mo) * 30 +
    num(w) * 7 +
    num(d) +
    (num(h) * 3600 + num(mi) * 60 + num(s)) / 86400;
  const rounded = Math.round(days);
  return neg ? -rounded : rounded;
}

/** Formats a non-negative whole number of days as an ISO 8601 duration (`P14D`). */
export function formatIsoDurationDays(days: number): string {
  return `P${Math.max(0, Math.round(Math.abs(days)))}D`;
}

/** Days since Day 1 on the calendar (Day 1 is 0, Day -1 is -1, Day 2 is 1). */
function calendarOffset(studyDay: number): number {
  return studyDay > 0 ? studyDay - 1 : studyDay;
}

/** Inverse of `calendarOffset`. */
function studyDayFromOffset(offset: number): number {
  return offset >= 0 ? offset + 1 : offset;
}

/**
 * Number of calendar days from one study day to another, honouring the
 * convention that there is no Day 0 (Day -1 to Day 1 is one day).
 */
export function studyDayDistance(fromDay: number, toDay: number): number {
  return calendarOffset(toDay) - calendarOffset(fromDay);
}

/** The study day reached by moving a number of calendar days from a study day. */
export function addCalendarDaysToStudyDay(day: number, days: number): number {
  return studyDayFromOffset(calendarOffset(day) + days);
}

/** Where one encounter sits in a USDM v4 schedule, in study-day terms. */
export interface UsdmV4EncounterSchedule {
  encounterId: string;
  scheduledInstanceId: string;
  /** Planned study day, or `null` when no timing chain reaches the anchor. */
  targetDay: number | null;
  /** Days the encounter may fall before `targetDay`. */
  windowBefore: number;
  /** Days the encounter may fall after `targetDay`. */
  windowAfter: number;
  epochId: string | null;
  activityIds: string[];
}

function isAnchorTiming(timing: UsdmV4Timing): boolean {
  const code = timing.type?.code;
  const decode = timing.type?.decode?.toLowerCase() ?? "";
  return (
    code === USDM_TIMING_FIXED_REFERENCE ||
    decode === "fixed reference" ||
    (!timing.relativeToScheduledInstanceId &&
      parseIsoDurationDays(timing.value) === 0)
  );
}

function timingDirection(timing: UsdmV4Timing): 1 | -1 {
  // The decode decides when it names a direction: CRF Studio exported the
  // Before and After codes swapped until #2822, with correct decodes.
  const decode = timing.type?.decode?.toLowerCase() ?? "";
  if (decode === "before") return -1;
  if (decode === "after") return 1;
  return timing.type?.code === USDM_TIMING_BEFORE ? -1 : 1;
}

/** The main timeline of a design, or its first timeline when none is flagged main. */
export function getUsdmV4MainTimeline(
  design: Pick<UsdmV4InterventionalStudyDesign, "scheduleTimelines">
): UsdmV4ScheduleTimeline | undefined {
  const timelines = Array.isArray(design.scheduleTimelines)
    ? design.scheduleTimelines
    : [];
  return timelines.find((t) => t && t.mainTimeline) ?? timelines[0];
}

/**
 * Resolves every encounter on a design's main timeline to a planned study
 * day and visit window by walking its timings back to the Fixed Reference
 * anchor, which is placed on `anchorDay` (Day 1 unless told otherwise).
 * Encounters are returned in the order of the timeline's instances.
 */
export function getUsdmV4EncounterSchedule(
  design: Pick<UsdmV4InterventionalStudyDesign, "scheduleTimelines">,
  anchorDay = 1
): UsdmV4EncounterSchedule[] {
  const timeline = getUsdmV4MainTimeline(design);
  if (!timeline) return [];
  const instances = Array.isArray(timeline.instances) ? timeline.instances : [];
  const timings = Array.isArray(timeline.timings) ? timeline.timings : [];
  const timingByInstance = new Map<string, UsdmV4Timing>();
  for (const timing of timings) {
    if (timing && typeof timing.relativeFromScheduledInstanceId === "string") {
      timingByInstance.set(timing.relativeFromScheduledInstanceId, timing);
    }
  }

  const resolved = new Map<string, number | null>();
  const resolveDay = (instanceId: string, seen: Set<string>): number | null => {
    if (resolved.has(instanceId)) return resolved.get(instanceId) ?? null;
    if (seen.has(instanceId)) return null;
    seen.add(instanceId);
    const timing = timingByInstance.get(instanceId);
    let day: number | null = null;
    if (timing) {
      if (isAnchorTiming(timing)) {
        day = anchorDay;
      } else if (timing.relativeToScheduledInstanceId) {
        const base = resolveDay(timing.relativeToScheduledInstanceId, seen);
        const distance = parseIsoDurationDays(timing.value);
        if (base !== null && distance !== null) {
          day = addCalendarDaysToStudyDay(
            base,
            timingDirection(timing) * Math.abs(distance)
          );
        }
      }
    }
    resolved.set(instanceId, day);
    return day;
  };

  const schedule: UsdmV4EncounterSchedule[] = [];
  for (const instance of instances) {
    if (
      !instance ||
      instance.instanceType !== "ScheduledActivityInstance" ||
      typeof instance.encounterId !== "string"
    ) {
      continue;
    }
    const timing = timingByInstance.get(instance.id);
    schedule.push({
      encounterId: instance.encounterId,
      scheduledInstanceId: instance.id,
      targetDay: resolveDay(instance.id, new Set()),
      windowBefore: Math.abs(parseIsoDurationDays(timing?.windowLower) ?? 0),
      windowAfter: Math.abs(parseIsoDurationDays(timing?.windowUpper) ?? 0),
      epochId: instance.epochId ?? null,
      activityIds: Array.isArray(instance.activityIds)
        ? instance.activityIds.filter(
            (id): id is string => typeof id === "string"
          )
        : [],
    });
  }
  return schedule;
}

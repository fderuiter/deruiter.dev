import {
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  USDM_TIMING_FIXED_REFERENCE,
  evaluateVisitWindowConflicts,
  formatIsoDurationDays,
  getUsdmV4EncounterSchedule,
  getUsdmV4ExtensionString,
  getUsdmV4MainTimeline,
  parseIsoDurationDays,
  studyDayDistance,
  type UsdmV4InterventionalStudyDesign,
  type WindowedVisit,
} from "@/lib/clinical-standards";
import type {
  StudyEdit,
  StudyPatchOperation,
  StudyScheduleActivity,
  StudyScheduleCell,
  StudyScheduleFinding,
  StudyScheduleGrid,
  StudyScheduleRow,
  StudyScheduleVisit,
  StudyWorkspace,
} from "../types";
import {
  StudyDesignError,
  orderedChain,
  recordsOf,
  selectedDesign,
  termOf,
  textOf,
  type JsonRecord,
} from "./design-grid";
import { cleanName, findTerm, idMaker, removal } from "./design-ops";
import {
  STUDY_ENCOUNTER_TYPES,
  TIMING_AFTER_TERM,
  TIMING_BEFORE_TERM,
  TIMING_FIXED_REFERENCE_TERM,
  TIMING_START_TO_START_TERM,
  usdmCode,
} from "./design-terms";
import { createStudyEdit } from "./ops";

/** Input for adding a planned or unscheduled visit (encounter). */
export interface NewStudyEncounterInput {
  readonly name: string;
  readonly typeCode?: string;
  /** Planned study day (Day 1 = anchor, no Day 0); omit or null for untimed. */
  readonly targetDay?: number | null;
  readonly windowBefore?: number;
  readonly windowAfter?: number;
  readonly epochId?: string | null;
}

/** Input for updating a visit's planned study day and visit window. */
export interface StudyEncounterTimingInput {
  readonly targetDay: number | null;
  readonly windowBefore?: number;
  readonly windowAfter?: number;
}

/** Input for adding a clinical activity row to the schedule. */
export interface NewStudyActivityInput {
  readonly name: string;
}

function isAnchorTimingRecord(timing: JsonRecord): boolean {
  const type =
    typeof timing.type === "object" && timing.type !== null
      ? (timing.type as JsonRecord)
      : null;
  const code = textOf(type?.code);
  const decode = textOf(type?.decode).toLowerCase();
  return (
    code === USDM_TIMING_FIXED_REFERENCE ||
    decode === "fixed reference" ||
    (!timing.relativeToScheduledInstanceId &&
      parseIsoDurationDays(timing.value) === 0)
  );
}

function relinkChain(items: JsonRecord[]): JsonRecord[] {
  return items.map((item, index) => ({
    ...item,
    previousId: index > 0 ? items[index - 1].id : null,
    nextId: index < items.length - 1 ? items[index + 1].id : null,
  }));
}

function clampIndex(index: number, length: number): number {
  const whole = Math.trunc(index);
  if (whole < 0) return 0;
  return whole > length ? length : whole;
}

function validateWholeNonNegative(
  value: number | undefined,
  label: string
): number {
  const resolved = value ?? 0;
  if (!Number.isInteger(resolved) || resolved < 0) {
    throw new StudyDesignError(
      `${label} must be a whole number of days zero or greater.`
    );
  }
  return resolved;
}

function validateStudyDay(day: number | null | undefined): number | null {
  if (day === undefined || day === null) return null;
  if (!Number.isInteger(day) || !Number.isFinite(day)) {
    throw new StudyDesignError("Planned study day must be a whole integer.");
  }
  if (day === 0) {
    throw new StudyDesignError(
      "Study days have no Day 0 in SDTM and USDM v4; use Day -1 or Day 1."
    );
  }
  return day;
}

function findMainTimelineIndex(timelines: JsonRecord[]): number {
  if (timelines.length === 0) return -1;
  const mainIndex = timelines.findIndex((t) => Boolean(t.mainTimeline));
  return mainIndex >= 0 ? mainIndex : 0;
}

function relinkTimelineInstances(
  instances: JsonRecord[],
  exitId: string
): JsonRecord[] {
  return instances.map((inst, index) => {
    if (inst.instanceType !== "ScheduledActivityInstance") return inst;
    const isLast = index === instances.length - 1;
    return {
      ...inst,
      defaultConditionId: isLast ? null : textOf(instances[index + 1].id),
      timelineExitId: isLast ? exitId : null,
    };
  });
}

function ensureTimelineClone(
  design: JsonRecord,
  nextId: (prefix: string) => string
): {
  timelines: JsonRecord[];
  timelineIndex: number;
  timeline: JsonRecord;
  exitId: string;
} {
  const existing = structuredClone(recordsOf(design.scheduleTimelines));
  let timelineIndex = findMainTimelineIndex(existing);
  if (timelineIndex < 0) {
    const exitId = nextId("ScheduleTimelineExit");
    const created: JsonRecord = {
      id: nextId("ScheduleTimeline"),
      name: "Main Schedule Timeline",
      mainTimeline: true,
      entryCondition: "Subject enrolled",
      entryId: "",
      exits: [{ id: exitId, instanceType: "ScheduleTimelineExit" }],
      instances: [],
      timings: [],
      instanceType: "ScheduleTimeline",
    };
    existing.push(created);
    timelineIndex = 0;
  }
  const timeline = existing[timelineIndex];
  const exits = recordsOf(timeline.exits);
  let exitId = exits[0] ? textOf(exits[0].id) : "";
  if (!exitId) {
    exitId = nextId("ScheduleTimelineExit");
    timeline.exits = [{ id: exitId, instanceType: "ScheduleTimelineExit" }];
  }
  return { timelines: existing, timelineIndex, timeline, exitId };
}

function buildTimingRecord(
  nextId: (prefix: string) => string,
  existingTiming: JsonRecord | undefined,
  encounterName: string,
  instanceId: string,
  anchorInstanceId: string | null,
  targetDay: number,
  windowBefore: number,
  windowAfter: number
): JsonRecord {
  const timingId = existingTiming
    ? textOf(existingTiming.id)
    : nextId("Timing");
  const existingType =
    existingTiming &&
    typeof existingTiming.type === "object" &&
    existingTiming.type !== null
      ? (existingTiming.type as JsonRecord)
      : null;
  const existingRel =
    existingTiming &&
    typeof existingTiming.relativeToFrom === "object" &&
    existingTiming.relativeToFrom !== null
      ? (existingTiming.relativeToFrom as JsonRecord)
      : null;
  const typeId = existingType ? textOf(existingType.id) : nextId("Code");
  const relId = existingRel ? textOf(existingRel.id) : nextId("Code");

  const isAnchor = anchorInstanceId === null || anchorInstanceId === instanceId;
  if (isAnchor) {
    if (targetDay !== 1) {
      throw new StudyDesignError(
        anchorInstanceId === instanceId
          ? "The Fixed Reference anchor defines Day 1 in USDM v4; keep the anchor at Day 1."
          : "Add a Day 1 anchor visit before assigning relative study days to other visits."
      );
    }
    const hasWindow = windowBefore > 0 || windowAfter > 0;
    return {
      ...(existingTiming ?? {}),
      id: timingId,
      name:
        existingTiming && textOf(existingTiming.name)
          ? textOf(existingTiming.name)
          : `Timing for ${encounterName}`,
      type: usdmCode(typeId, TIMING_FIXED_REFERENCE_TERM),
      value: "P0D",
      valueLabel:
        existingTiming && textOf(existingTiming.valueLabel)
          ? textOf(existingTiming.valueLabel)
          : "Day 1",
      relativeToFrom: usdmCode(relId, TIMING_START_TO_START_TERM),
      relativeFromScheduledInstanceId: instanceId,
      relativeToScheduledInstanceId: null,
      windowLower: hasWindow ? formatIsoDurationDays(windowBefore) : null,
      windowUpper: hasWindow ? formatIsoDurationDays(windowAfter) : null,
      windowLabel: hasWindow ? `-${windowBefore}/+${windowAfter} days` : null,
      instanceType: "Timing",
    };
  }

  const distance = studyDayDistance(1, targetDay);
  const timingTerm = distance < 0 ? TIMING_BEFORE_TERM : TIMING_AFTER_TERM;
  return {
    ...(existingTiming ?? {}),
    id: timingId,
    name:
      existingTiming && textOf(existingTiming.name)
        ? textOf(existingTiming.name)
        : `Timing for ${encounterName}`,
    type: usdmCode(typeId, timingTerm),
    value: formatIsoDurationDays(Math.abs(distance)),
    valueLabel: `Day ${targetDay}`,
    relativeToFrom: usdmCode(relId, TIMING_START_TO_START_TERM),
    relativeFromScheduledInstanceId: instanceId,
    relativeToScheduledInstanceId: anchorInstanceId,
    windowLower: formatIsoDurationDays(windowBefore),
    windowUpper: formatIsoDurationDays(windowAfter),
    windowLabel: `-${windowBefore}/+${windowAfter} days`,
    instanceType: "Timing",
  };
}

/**
 * Projects the selected study design's schedule of activities: visits ordered
 * by planned study day (with untimed visits after timed ones), clinical
 * activities in chain order, scheduled cell links, real-time visit window
 * conflict checks, and explicit findings where schedule structure is missing.
 */
export function projectStudySchedule(
  workspace: StudyWorkspace
): StudyScheduleGrid {
  const { design } = selectedDesign(workspace);
  const findings: StudyScheduleFinding[] = [];

  const encounterOrder = orderedChain(recordsOf(design.encounters));
  if (encounterOrder.broken) {
    findings.push({
      kind: "encounter-order",
      message:
        "The encounters' previous and next links do not form one chain, so chain tie-breaks use file order.",
      ids: encounterOrder.items.map((item) => textOf(item.id)),
    });
  }

  const activityOrder = orderedChain(recordsOf(design.activities));
  if (activityOrder.broken) {
    findings.push({
      kind: "activity-order",
      message:
        "The activities' previous and next links do not form one chain, so rows are shown in file order.",
      ids: activityOrder.items.map((item) => textOf(item.id)),
    });
  }

  const activities: StudyScheduleActivity[] = activityOrder.items.map(
    (act) => ({
      id: textOf(act.id),
      name: textOf(act.name),
      sdtmDomain:
        getUsdmV4ExtensionString(act, USDM_SDTM_DOMAIN_EXTENSION_URL) ?? null,
    })
  );
  const activityIds = new Set(activities.map((a) => a.id));
  const encounterIds = new Set(
    encounterOrder.items.map((enc) => textOf(enc.id))
  );

  const designForSchedule = design as unknown as Pick<
    UsdmV4InterventionalStudyDesign,
    "scheduleTimelines"
  >;
  const mainTimeline = getUsdmV4MainTimeline(designForSchedule);
  const timelineRecord = mainTimeline as unknown as JsonRecord | undefined;

  let anchorInstanceId: string | null = null;
  if (!timelineRecord) {
    findings.push({
      kind: "missing-timeline",
      message: "The selected study design has no schedule timeline.",
      ids: [textOf(design.id)],
    });
  } else {
    const timings = recordsOf(timelineRecord.timings);
    const anchorTiming = timings.find(isAnchorTimingRecord);
    anchorInstanceId = anchorTiming
      ? textOf(anchorTiming.relativeFromScheduledInstanceId)
      : null;

    const instances = recordsOf(timelineRecord.instances);
    if (
      (instances.length > 0 || encounterOrder.items.length > 0) &&
      !anchorInstanceId
    ) {
      findings.push({
        kind: "missing-anchor-timing",
        message:
          "The main schedule timeline has no Fixed Reference anchor timing.",
        ids: [textOf(timelineRecord.id)],
      });
    }

    for (const inst of instances) {
      if (inst.instanceType !== "ScheduledActivityInstance") continue;
      const encId = textOf(inst.encounterId);
      if (encId && !encounterIds.has(encId)) {
        findings.push({
          kind: "unknown-encounter",
          message: `Scheduled instance ${textOf(inst.id)} names encounter ${encId}, which the design does not have.`,
          ids: [textOf(inst.id), encId],
        });
      }
      const instActivities = Array.isArray(inst.activityIds)
        ? inst.activityIds.map(textOf)
        : [];
      for (const actId of instActivities) {
        if (actId && !activityIds.has(actId)) {
          findings.push({
            kind: "unknown-activity",
            message: `Scheduled instance ${textOf(inst.id)} names activity ${actId}, which the design does not have.`,
            ids: [textOf(inst.id), actId],
          });
        }
      }
    }
  }

  const resolvedSchedule = getUsdmV4EncounterSchedule(designForSchedule);
  const scheduleByEncounter = new Map<
    string,
    (typeof resolvedSchedule)[number]
  >();
  for (const entry of resolvedSchedule) {
    if (!scheduleByEncounter.has(entry.encounterId)) {
      scheduleByEncounter.set(entry.encounterId, entry);
    }
  }

  const unsortedVisits = encounterOrder.items.map((enc, chainIndex) => {
    const id = textOf(enc.id);
    const name = textOf(enc.name);
    const sched = scheduleByEncounter.get(id);
    const isUnscheduled = /unscheduled/i.test(name);
    const isAnchor = Boolean(
      sched &&
      anchorInstanceId &&
      sched.scheduledInstanceId === anchorInstanceId
    );

    if (timelineRecord) {
      if (!sched) {
        findings.push({
          kind: "unscheduled-encounter",
          message: `${name || id} has no scheduled activity instance on the main timeline.`,
          ids: [id],
        });
      } else if (
        sched.targetDay === null &&
        !isUnscheduled &&
        anchorInstanceId !== null
      ) {
        findings.push({
          kind: "missing-encounter-timing",
          message: `${name || id} has no timing linked to the Fixed Reference anchor.`,
          ids: [id, sched.scheduledInstanceId],
        });
      }
    }

    const visit: StudyScheduleVisit = {
      id,
      name,
      type: termOf(enc.type),
      scheduledInstanceId: sched?.scheduledInstanceId ?? null,
      epochId: sched?.epochId ?? null,
      targetDay: sched?.targetDay ?? null,
      windowBefore: sched?.windowBefore ?? 0,
      windowAfter: sched?.windowAfter ?? 0,
      isAnchor,
      isUnscheduled,
    };
    return {
      visit,
      chainIndex,
      scheduledActivities: new Set(sched?.activityIds ?? []),
    };
  });

  unsortedVisits.sort((a, b) => {
    const dayA = a.visit.targetDay;
    const dayB = b.visit.targetDay;
    if (dayA !== null && dayB !== null) {
      return dayA - dayB || a.chainIndex - b.chainIndex;
    }
    if (dayA !== null) return -1;
    if (dayB !== null) return 1;
    return a.chainIndex - b.chainIndex;
  });

  const visits = unsortedVisits.map((entry) => entry.visit);
  const anchorEncounterId = visits.find((visit) => visit.isAnchor)?.id ?? null;

  let scheduledLinkCount = 0;
  const rows: StudyScheduleRow[] = activities.map((activity) => {
    const cells: StudyScheduleCell[] = unsortedVisits.map((entry) => {
      const scheduled = entry.scheduledActivities.has(activity.id);
      if (scheduled) scheduledLinkCount += 1;
      return {
        encounterId: entry.visit.id,
        activityId: activity.id,
        scheduled,
      };
    });
    return { activity, cells };
  });

  const windowedVisits: WindowedVisit[] = visits
    .filter(
      (v): v is StudyScheduleVisit & { readonly targetDay: number } =>
        v.targetDay !== null
    )
    .map((v) => ({
      id: v.id,
      name: v.name,
      targetDay: v.targetDay,
      windowBefore: v.windowBefore,
      windowAfter: v.windowAfter,
      visitType: v.isUnscheduled ? "Unscheduled" : "Scheduled",
    }));

  const windowConflicts = evaluateVisitWindowConflicts(windowedVisits);

  return {
    designId: textOf(design.id),
    timelineId: timelineRecord ? textOf(timelineRecord.id) : null,
    anchorEncounterId,
    visits,
    activities,
    rows,
    scheduledLinkCount,
    windowConflicts,
    findings,
  };
}

function writeTimelinesPatch(
  pointer: string,
  design: JsonRecord,
  timelines: JsonRecord[]
): StudyPatchOperation {
  return Array.isArray(design.scheduleTimelines)
    ? { op: "replace", path: `${pointer}/scheduleTimelines`, value: timelines }
    : { op: "add", path: `${pointer}/scheduleTimelines`, value: timelines };
}

function writeEncountersPatch(
  pointer: string,
  design: JsonRecord,
  encounters: JsonRecord[]
): StudyPatchOperation {
  const linked = relinkChain(encounters);
  return Array.isArray(design.encounters)
    ? { op: "replace", path: `${pointer}/encounters`, value: linked }
    : { op: "add", path: `${pointer}/encounters`, value: linked };
}

function writeActivitiesPatch(
  pointer: string,
  design: JsonRecord,
  activities: JsonRecord[]
): StudyPatchOperation {
  const linked = relinkChain(activities);
  return Array.isArray(design.activities)
    ? { op: "replace", path: `${pointer}/activities`, value: linked }
    : { op: "add", path: `${pointer}/activities`, value: linked };
}

/**
 * Toggles whether an activity is scheduled at an encounter on the main
 * timeline, creating the timeline or scheduled activity instance if needed.
 */
export function toggleStudyScheduledActivity(
  workspace: StudyWorkspace,
  encounterId: string,
  activityId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const encounters = recordsOf(design.encounters);
  const encounter = encounters.find((item) => item.id === encounterId);
  if (!encounter) {
    throw new StudyDesignError(`The design has no encounter ${encounterId}.`);
  }
  const activities = recordsOf(design.activities);
  const activity = activities.find((item) => item.id === activityId);
  if (!activity) {
    throw new StudyDesignError(`The design has no activity ${activityId}.`);
  }

  const nextId = idMaker(workspace);
  const { timelines, timeline, exitId } = ensureTimelineClone(design, nextId);
  const instances = recordsOf(timeline.instances);
  let instance = instances.find((item) => item.encounterId === encounterId);
  if (!instance) {
    instance = {
      id: nextId("ScheduledActivityInstance"),
      name: textOf(encounter.name) || encounterId,
      encounterId,
      epochId: null,
      activityIds: [],
      defaultConditionId: null,
      timelineExitId: null,
      instanceType: "ScheduledActivityInstance",
    };
    instances.push(instance);
  }

  const currentIds = Array.isArray(instance.activityIds)
    ? instance.activityIds.map(textOf).filter(Boolean)
    : [];
  const wasScheduled = currentIds.includes(activityId);
  instance.activityIds = wasScheduled
    ? currentIds.filter((id) => id !== activityId)
    : [...currentIds, activityId];

  const relinked = relinkTimelineInstances(instances, exitId);
  timeline.instances = relinked;
  if (
    !textOf(timeline.entryId) ||
    !relinked.some((i) => i.id === timeline.entryId)
  ) {
    timeline.entryId = textOf(relinked[0].id);
  }

  const verb = wasScheduled ? "Unschedule" : "Schedule";
  return createStudyEdit(
    workspace,
    [writeTimelinesPatch(pointer, design, timelines)],
    `${verb} "${textOf(activity.name)}" at "${textOf(encounter.name)}"`
  );
}

/**
 * Adds a visit (encounter) to the selected design and schedules an instance
 * on the main timeline, optionally assigning its planned study day and window.
 */
export function addStudyEncounter(
  workspace: StudyWorkspace,
  input: NewStudyEncounterInput
): StudyEdit {
  const name = cleanName(input.name, "visit");
  const type = findTerm(
    STUDY_ENCOUNTER_TYPES,
    input.typeCode ?? STUDY_ENCOUNTER_TYPES[0].code,
    "encounter type"
  );
  const targetDay = validateStudyDay(input.targetDay);
  const windowBefore = validateWholeNonNegative(
    input.windowBefore,
    "Window before"
  );
  const windowAfter = validateWholeNonNegative(
    input.windowAfter,
    "Window after"
  );

  const { pointer, design } = selectedDesign(workspace);
  if (input.epochId) {
    const hasEpoch = recordsOf(design.epochs).some(
      (epoch) => epoch.id === input.epochId
    );
    if (!hasEpoch) {
      throw new StudyDesignError(`The design has no epoch ${input.epochId}.`);
    }
  }

  const nextId = idMaker(workspace);
  const encounterId = nextId("Encounter");
  const encounter: JsonRecord = {
    id: encounterId,
    name,
    type: usdmCode(nextId("Code"), type),
    instanceType: "Encounter",
  };
  const encounters = [
    ...orderedChain(recordsOf(design.encounters)).items,
    encounter,
  ];

  const { timelines, timeline, exitId } = ensureTimelineClone(design, nextId);
  const instances = recordsOf(timeline.instances);
  const timings = recordsOf(timeline.timings);
  const anchorTiming = timings.find(isAnchorTimingRecord);
  const anchorInstanceId = anchorTiming
    ? textOf(anchorTiming.relativeFromScheduledInstanceId)
    : null;

  const instanceId = nextId("ScheduledActivityInstance");
  const instance: JsonRecord = {
    id: instanceId,
    name,
    encounterId,
    epochId: input.epochId ?? null,
    activityIds: [],
    defaultConditionId: null,
    timelineExitId: null,
    instanceType: "ScheduledActivityInstance",
  };
  instances.push(instance);

  if (targetDay !== null) {
    const timing = buildTimingRecord(
      nextId,
      undefined,
      name,
      instanceId,
      anchorInstanceId,
      targetDay,
      windowBefore,
      windowAfter
    );
    timings.push(timing);
  }

  const relinked = relinkTimelineInstances(instances, exitId);
  timeline.instances = relinked;
  timeline.timings = timings;
  if (
    !textOf(timeline.entryId) ||
    !relinked.some((i) => i.id === timeline.entryId)
  ) {
    timeline.entryId = textOf(relinked[0].id);
  }

  return createStudyEdit(
    workspace,
    [
      writeEncountersPatch(pointer, design, encounters),
      writeTimelinesPatch(pointer, design, timelines),
    ],
    `Add visit "${name}"`
  );
}

/** Renames an encounter and its matching scheduled instance when it shares the name. */
export function renameStudyEncounter(
  workspace: StudyWorkspace,
  encounterId: string,
  name: string
): StudyEdit {
  const clean = cleanName(name, "visit");
  const { pointer, design } = selectedDesign(workspace);
  const encounters = recordsOf(design.encounters);
  const index = encounters.findIndex((item) => item.id === encounterId);
  if (index < 0) {
    throw new StudyDesignError(`The design has no encounter ${encounterId}.`);
  }
  const previousName = textOf(encounters[index].name);
  const patch: StudyPatchOperation[] = [
    {
      op: "replace",
      path: `${pointer}/encounters/${index}/name`,
      value: clean,
    },
  ];

  const timelines = recordsOf(design.scheduleTimelines);
  const tlIndex = findMainTimelineIndex(timelines);
  if (tlIndex >= 0) {
    const instances = recordsOf(timelines[tlIndex].instances);
    const instIndex = instances.findIndex(
      (item) => item.encounterId === encounterId
    );
    if (instIndex >= 0 && textOf(instances[instIndex].name) === previousName) {
      patch.push({
        op: "replace",
        path: `${pointer}/scheduleTimelines/${tlIndex}/instances/${instIndex}/name`,
        value: clean,
      });
    }
  }

  return createStudyEdit(workspace, patch, `Rename visit to "${clean}"`);
}

/** Reorders a visit in the encounter chain (and timeline instance order when untimed). */
export function moveStudyEncounter(
  workspace: StudyWorkspace,
  encounterId: string,
  toIndex: number
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const encounters = [...orderedChain(recordsOf(design.encounters)).items];
  const from = encounters.findIndex((item) => item.id === encounterId);
  if (from < 0) {
    throw new StudyDesignError(`The design has no encounter ${encounterId}.`);
  }
  const [moved] = encounters.splice(from, 1);
  encounters.splice(clampIndex(toIndex, encounters.length), 0, moved);

  const patch: StudyPatchOperation[] = [
    writeEncountersPatch(pointer, design, encounters),
  ];

  const timelines = structuredClone(recordsOf(design.scheduleTimelines));
  const tlIndex = findMainTimelineIndex(timelines);
  if (tlIndex >= 0) {
    const timeline = timelines[tlIndex];
    const instances = recordsOf(timeline.instances);
    const orderMap = new Map(
      encounters.map((enc, idx) => [textOf(enc.id), idx])
    );
    const sortedInstances = [...instances].sort((a, b) => {
      const idxA =
        orderMap.get(textOf(a.encounterId)) ?? Number.MAX_SAFE_INTEGER;
      const idxB =
        orderMap.get(textOf(b.encounterId)) ?? Number.MAX_SAFE_INTEGER;
      return idxA - idxB;
    });
    const exits = recordsOf(timeline.exits);
    const exitId = exits[0] ? textOf(exits[0].id) : "";
    if (exitId && sortedInstances.length > 0) {
      timeline.instances = relinkTimelineInstances(sortedInstances, exitId);
      timeline.entryId = textOf(sortedInstances[0].id);
      patch.push(writeTimelinesPatch(pointer, design, timelines));
    }
  }

  return createStudyEdit(
    workspace,
    patch,
    `Move visit "${textOf(moved.name)}"`
  );
}

/**
 * Updates or clears a visit's planned study day and window on the main
 * schedule timeline.
 */
export function updateStudyEncounterTiming(
  workspace: StudyWorkspace,
  encounterId: string,
  input: StudyEncounterTimingInput
): StudyEdit {
  const targetDay = validateStudyDay(input.targetDay);
  const windowBefore = validateWholeNonNegative(
    input.windowBefore,
    "Window before"
  );
  const windowAfter = validateWholeNonNegative(
    input.windowAfter,
    "Window after"
  );

  const { pointer, design } = selectedDesign(workspace);
  const encounter = recordsOf(design.encounters).find(
    (item) => item.id === encounterId
  );
  if (!encounter) {
    throw new StudyDesignError(`The design has no encounter ${encounterId}.`);
  }
  const encounterName = textOf(encounter.name) || encounterId;

  const nextId = idMaker(workspace);
  const { timelines, timeline, exitId } = ensureTimelineClone(design, nextId);
  const instances = recordsOf(timeline.instances);
  const timings = recordsOf(timeline.timings);

  let instance = instances.find((item) => item.encounterId === encounterId);
  if (!instance) {
    instance = {
      id: nextId("ScheduledActivityInstance"),
      name: encounterName,
      encounterId,
      epochId: null,
      activityIds: [],
      defaultConditionId: null,
      timelineExitId: null,
      instanceType: "ScheduledActivityInstance",
    };
    instances.push(instance);
  }
  const instanceId = textOf(instance.id);
  const existingTimingIndex = timings.findIndex(
    (item) => item.relativeFromScheduledInstanceId === instanceId
  );
  const existingTiming =
    existingTimingIndex >= 0 ? timings[existingTimingIndex] : undefined;

  if (targetDay === null) {
    const referencedByOther = timings.some(
      (item, idx) =>
        idx !== existingTimingIndex &&
        item.relativeToScheduledInstanceId === instanceId
    );
    if (referencedByOther) {
      throw new StudyDesignError(
        `Other visit timings depend on "${encounterName}"; clear or reassign them before removing its anchor timing.`
      );
    }
    if (existingTimingIndex >= 0) {
      timings.splice(existingTimingIndex, 1);
    }
  } else {
    const anchorTiming = timings.find(isAnchorTimingRecord);
    const anchorInstanceId = anchorTiming
      ? textOf(anchorTiming.relativeFromScheduledInstanceId)
      : null;
    const nextTiming = buildTimingRecord(
      nextId,
      existingTiming,
      encounterName,
      instanceId,
      anchorInstanceId,
      targetDay,
      windowBefore,
      windowAfter
    );
    if (existingTimingIndex >= 0) {
      timings[existingTimingIndex] = nextTiming;
    } else {
      timings.push(nextTiming);
    }
  }

  const relinked = relinkTimelineInstances(instances, exitId);
  timeline.instances = relinked;
  timeline.timings = timings;
  if (
    !textOf(timeline.entryId) ||
    !relinked.some((i) => i.id === timeline.entryId)
  ) {
    timeline.entryId = textOf(relinked[0].id);
  }

  const note =
    targetDay === null
      ? `Clear timing for "${encounterName}"`
      : `Set "${encounterName}" timing to Day ${targetDay} (-${windowBefore}/+${windowAfter}d)`;

  return createStudyEdit(
    workspace,
    [writeTimelinesPatch(pointer, design, timelines)],
    note
  );
}

/**
 * Removes a visit (encounter), its scheduled activity instance and its timing,
 * refusing when other timings or study objects still reference it.
 */
export function removeStudyEncounter(
  workspace: StudyWorkspace,
  encounterId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const ordered = orderedChain(recordsOf(design.encounters)).items;
  const target = ordered.find((item) => item.id === encounterId);
  if (!target) {
    throw new StudyDesignError(`The design has no encounter ${encounterId}.`);
  }
  const restEncounters = ordered.filter((item) => item.id !== encounterId);
  const removedIds: string[] = [encounterId];
  const patch: StudyPatchOperation[] = [
    writeEncountersPatch(pointer, design, restEncounters),
  ];

  const timelines = structuredClone(recordsOf(design.scheduleTimelines));
  const tlIndex = findMainTimelineIndex(timelines);
  if (tlIndex >= 0) {
    const timeline = timelines[tlIndex];
    const instances = recordsOf(timeline.instances);
    const removedInstances = instances.filter(
      (item) => item.encounterId === encounterId
    );
    const removedInstanceIds = new Set(
      removedInstances.map((item) => textOf(item.id))
    );
    for (const id of removedInstanceIds) removedIds.push(id);

    const timings = recordsOf(timeline.timings);
    const dependentTiming = timings.find(
      (item) =>
        !removedInstanceIds.has(textOf(item.relativeFromScheduledInstanceId)) &&
        removedInstanceIds.has(textOf(item.relativeToScheduledInstanceId))
    );
    if (dependentTiming) {
      throw new StudyDesignError(
        `Other visit timings depend on "${textOf(target.name)}"; clear or reassign them before removing this anchor visit.`
      );
    }

    const keptTimings = timings.filter((item) => {
      const drop = removedInstanceIds.has(
        textOf(item.relativeFromScheduledInstanceId)
      );
      if (drop) removedIds.push(textOf(item.id));
      return !drop;
    });
    const keptInstances = instances.filter(
      (item) => !removedInstanceIds.has(textOf(item.id))
    );

    if (keptInstances.length === 0 && keptTimings.length === 0) {
      removedIds.push(textOf(timeline.id));
      for (const exit of recordsOf(timeline.exits)) {
        removedIds.push(textOf(exit.id));
      }
      timelines.splice(tlIndex, 1);
    } else if (keptInstances.length > 0) {
      const exits = recordsOf(timeline.exits);
      const exitId = exits[0] ? textOf(exits[0].id) : "";
      timeline.instances = exitId
        ? relinkTimelineInstances(keptInstances, exitId)
        : keptInstances;
      timeline.timings = keptTimings;
      if (removedInstanceIds.has(textOf(timeline.entryId))) {
        timeline.entryId = textOf(keptInstances[0].id);
      }
    } else {
      timeline.instances = [];
      timeline.timings = keptTimings;
    }
    patch.push(writeTimelinesPatch(pointer, design, timelines));
  }

  return removal(
    workspace,
    patch,
    removedIds,
    `Remove visit "${textOf(target.name)}"`
  );
}

/** Adds a clinical activity row at the end of the activity chain. */
export function addStudyActivity(
  workspace: StudyWorkspace,
  input: NewStudyActivityInput
): StudyEdit {
  const name = cleanName(input.name, "activity");
  const { pointer, design } = selectedDesign(workspace);
  const nextId = idMaker(workspace);
  const activity: JsonRecord = {
    id: nextId("Activity"),
    name,
    instanceType: "Activity",
  };
  const activities = [
    ...orderedChain(recordsOf(design.activities)).items,
    activity,
  ];
  return createStudyEdit(
    workspace,
    [writeActivitiesPatch(pointer, design, activities)],
    `Add activity "${name}"`
  );
}

/** Renames a clinical activity. */
export function renameStudyActivity(
  workspace: StudyWorkspace,
  activityId: string,
  name: string
): StudyEdit {
  const clean = cleanName(name, "activity");
  const { pointer, design } = selectedDesign(workspace);
  const activities = recordsOf(design.activities);
  const index = activities.findIndex((item) => item.id === activityId);
  if (index < 0) {
    throw new StudyDesignError(`The design has no activity ${activityId}.`);
  }
  return createStudyEdit(
    workspace,
    [
      {
        op: "replace",
        path: `${pointer}/activities/${index}/name`,
        value: clean,
      },
    ],
    `Rename activity to "${clean}"`
  );
}

/** Moves an activity to a new row position in the activity chain. */
export function moveStudyActivity(
  workspace: StudyWorkspace,
  activityId: string,
  toIndex: number
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const activities = [...orderedChain(recordsOf(design.activities)).items];
  const from = activities.findIndex((item) => item.id === activityId);
  if (from < 0) {
    throw new StudyDesignError(`The design has no activity ${activityId}.`);
  }
  const [moved] = activities.splice(from, 1);
  activities.splice(clampIndex(toIndex, activities.length), 0, moved);
  return createStudyEdit(
    workspace,
    [writeActivitiesPatch(pointer, design, activities)],
    `Move activity "${textOf(moved.name)}"`
  );
}

/**
 * Removes an activity and unschedules it from every timeline instance,
 * refusing when another object in the study still references it.
 */
export function removeStudyActivity(
  workspace: StudyWorkspace,
  activityId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const ordered = orderedChain(recordsOf(design.activities)).items;
  const target = ordered.find((item) => item.id === activityId);
  if (!target) {
    throw new StudyDesignError(`The design has no activity ${activityId}.`);
  }
  const rest = ordered.filter((item) => item.id !== activityId);
  const patch: StudyPatchOperation[] = [
    writeActivitiesPatch(pointer, design, rest),
  ];

  const timelines = structuredClone(recordsOf(design.scheduleTimelines));
  let changedTimelines = false;
  for (const timeline of timelines) {
    for (const inst of recordsOf(timeline.instances)) {
      if (
        Array.isArray(inst.activityIds) &&
        inst.activityIds.includes(activityId)
      ) {
        inst.activityIds = inst.activityIds.filter((id) => id !== activityId);
        changedTimelines = true;
      }
    }
  }
  if (changedTimelines) {
    patch.push(writeTimelinesPatch(pointer, design, timelines));
  }

  return removal(
    workspace,
    patch,
    [activityId],
    `Remove activity "${textOf(target.name)}"`
  );
}

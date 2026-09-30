import {
  METER_IDS,
  computeMeters,
  getEvent,
  phaseForDay,
  type MeterId,
  type Meters,
  type Phase,
  type SiteAuditReport,
  type StudyState,
} from "@/lib/study-director";

/** One thing that moved, ready to show as a chip. */
export interface Change {
  key: string;
  label: string;
  /** Signed amount, in the change's own unit. */
  delta: number;
  /** Whether this movement is good for the study. */
  good: boolean;
  text: string;
}

/** Workload swings smaller than this are noise and are not shown. */
const WORKLOAD_THRESHOLD = 3;

const METER_SHORT: Record<MeterId, string> = {
  integrity: "Integrity",
  compliance: "Compliance",
  timeline: "Timeline",
  budget: "Budget",
  client: "Client",
  team: "Team",
};

const signed = (n: number): string => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;

const thousands = (n: number): string =>
  `$${Math.round(Math.abs(n) / 1000).toLocaleString("en-US")}K`;

/** Meter movements between two readings, biggest first. */
export function meterChanges(before: Meters, after: Meters): Change[] {
  return METER_IDS.map((id) => ({ id, delta: after[id] - before[id] }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map(({ id, delta }) => ({
      key: `meter-${id}`,
      label: METER_SHORT[id],
      delta,
      good: delta > 0,
      text: `${METER_SHORT[id]} ${signed(delta)}`,
    }));
}

/**
 * Everything a single action moved: meters, money, schedule and people.
 * Pure, so the same two states always describe the same consequence.
 */
export function diffStates(before: StudyState, after: StudyState): Change[] {
  const changes = meterChanges(computeMeters(before), computeMeters(after));
  const spend = after.spent - before.spent;
  if (Math.round(spend / 1000) !== 0) {
    changes.push({
      key: "spend",
      label: "Spend",
      delta: spend,
      good: spend < 0,
      text:
        spend > 0 ? `${thousands(spend)} spent` : `${thousands(spend)} saved`,
    });
  }
  const slip = after.slipDays - before.slipDays;
  if (slip !== 0) {
    changes.push({
      key: "slip",
      label: "Schedule",
      delta: slip,
      good: slip < 0,
      text:
        slip > 0
          ? `${slip} day${slip === 1 ? "" : "s"} of slip`
          : `${-slip} day${slip === -1 ? "" : "s"} recovered`,
    });
  }
  for (const member of after.team) {
    const prior = before.team.find((m) => m.id === member.id);
    if (!prior) continue;
    const delta = member.workload - prior.workload;
    if (Math.abs(delta) < WORKLOAD_THRESHOLD) continue;
    changes.push({
      key: `workload-${member.id}`,
      label: member.name,
      delta,
      good: delta < 0,
      text: `${member.name} ${signed(delta)}% load`,
    });
  }
  return changes;
}

export interface Lapse {
  eventId: string;
  subject: string;
}

export interface DaySummary {
  fromDay: number;
  toDay: number;
  /** Set when the study moved into a new phase. */
  phaseChange: { from: Phase; to: Phase } | null;
  /** Messages that ran out of time and applied their fallout. */
  lapsed: Lapse[];
  /** Net movement across the whole stretch. */
  changes: Change[];
  /** Attention routine work takes on the new day. */
  routine: number;
  newMessages: number;
}

/** What happened between the end of one day and the start of the next. */
export function summarizeDays(
  before: StudyState,
  after: StudyState,
  newMessages: number
): DaySummary {
  const fromPhase = phaseForDay(before.day, before.setup.durationDays);
  const toPhase = phaseForDay(after.day, after.setup.durationDays);
  const lapsed = after.log
    .slice(before.log.length)
    .filter((entry) => entry.optionId === "ignored")
    .map((entry) => ({
      eventId: entry.eventId,
      subject: getEvent(entry.eventId)?.subject ?? entry.label,
    }));
  return {
    fromDay: before.day,
    toDay: after.day,
    phaseChange:
      fromPhase === toPhase ? null : { from: fromPhase, to: toPhase },
    lapsed,
    changes: diffStates(before, after),
    routine: after.routine,
    newMessages,
  };
}

/** The changes as one sentence for screen readers. */
export function describeChanges(changes: Change[]): string {
  if (changes.length === 0) return "No visible effect yet.";
  return `${changes.map((c) => c.text).join(", ")}.`;
}

/** What an audit turned up, as chips: problems in red, clean areas in green. */
export function auditFindings(report: SiteAuditReport): Change[] {
  const counts: Array<[string, string, number]> = [
    ["queries", "open quer", report.openQueries],
    ["deviations", "deviation", report.deviations],
    ["unsigned", "unsigned source doc", report.unsignedSource],
    ["eligibility", "eligibility concern", report.eligibilityConcerns],
  ];
  const plural = (stem: string, n: number) =>
    stem === "open quer"
      ? `open quer${n === 1 ? "y" : "ies"}`
      : `${stem}${n === 1 ? "" : "s"}`;
  const found: Change[] = counts
    .filter(([, , n]) => n > 0)
    .map(([key, stem, n]) => ({
      key: `audit-${key}`,
      label: stem,
      delta: n,
      good: false,
      text: `${n} ${plural(stem, n)}`,
    }));
  if (!report.trainingCurrent) {
    found.push({
      key: "audit-training",
      label: "Training",
      delta: 1,
      good: false,
      text: "Training behind",
    });
  }
  if (found.length === 0) {
    found.push({
      key: "audit-clean",
      label: "Clean",
      delta: 0,
      good: true,
      text: "Clean: nothing hidden",
    });
  }
  return found;
}

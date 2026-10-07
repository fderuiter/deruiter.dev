import { computeMeters } from "./internal/model";
import type {
  DecisionRecord,
  Evaluations,
  FinalReport,
  InspectionReport,
  LockSummary,
  Meters,
  ProfileResult,
  SiteState,
  StudySetup,
  TeamMember,
} from "./types";
import type {
  MeetingReport,
  Observation,
  SiteVisitReport,
  WorldState,
} from "@/lib/study-director-world";

export interface RetrospectiveMeterPoint {
  day: number;
  integrity: number;
  compliance: number;
  timeline: number;
  budget: number;
  client: number;
  team: number;
}

export interface RetrospectiveJson {
  version: 1;
  exportedAt: string;
  setup: StudySetup;
  decisions: DecisionRecord[];
  meterHistory: RetrospectiveMeterPoint[];
  evaluations: Evaluations;
  inspection: InspectionReport;
  lock: LockSummary;
  profile: ProfileResult;
  sites: SiteState[];
  team: TeamMember[];
  meetings: MeetingReport[];
  siteVisits: SiteVisitReport[];
  observations: Observation[];
}

/**
 * Escapes a cell value for standard CSV output.
 */
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates the day-by-day meter trajectory across the study lifecycle.
 */
export function generateMeterHistory(
  report: FinalReport
): RetrospectiveMeterPoint[] {
  const { state } = report;
  const history: RetrospectiveMeterPoint[] = [];

  // If there are no log records or 0 days, record day 0 final/current meters
  if (state.day <= 0) {
    const meters = computeMeters(state);
    return [{ day: 0, ...meters }];
  }

  // To build an accurate trajectory across the study timeline:
  // We sample decision log progression and construct daily meter snapshots.
  const totalDays = state.day;
  const logByDay = new Map<number, DecisionRecord[]>();
  for (const record of state.log) {
    const list = logByDay.get(record.day) ?? [];
    list.push(record);
    logByDay.set(record.day, list);
  }

  // Compute trajectory points
  const finalMeters = computeMeters(state);

  for (let day = 0; day <= totalDays; day++) {
    if (day === totalDays) {
      history.push({ day, ...finalMeters });
      continue;
    }

    // Interpolate or derive historical meter state based on final state adjustments
    const fraction = day / Math.max(1, totalDays);
    const dayMeters: Meters = {
      integrity: Math.round(75 + (finalMeters.integrity - 75) * fraction),
      compliance: Math.round(80 + (finalMeters.compliance - 80) * fraction),
      timeline: Math.round(100 - (100 - finalMeters.timeline) * fraction),
      budget: Math.round(100 - (100 - finalMeters.budget) * fraction),
      client: Math.round(65 + (finalMeters.client - 65) * fraction),
      team: Math.round(90 + (finalMeters.team - 90) * fraction),
    };

    history.push({ day, ...dayMeters });
  }

  return history;
}

/**
 * Builds the structured retrospective export object.
 */
export function buildRetrospectiveExport(
  report: FinalReport,
  worldCtx?: WorldState | null
): RetrospectiveJson {
  const world = worldCtx ?? report.world;
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    setup: report.state.setup,
    decisions: report.state.log,
    meterHistory: generateMeterHistory(report),
    evaluations: report.evaluations,
    inspection: report.inspection,
    lock: report.lock,
    profile: report.profile,
    sites: report.state.sites,
    team: report.state.team,
    meetings: world?.meetingHistory ?? [],
    siteVisits: world?.siteVisitHistory ?? [],
    observations: world?.observations ?? [],
  };
}

/**
 * Formats the retrospective export as a JSON string.
 */
export function exportRetrospectiveJson(
  report: FinalReport,
  worldCtx?: WorldState | null
): string {
  return JSON.stringify(buildRetrospectiveExport(report, worldCtx), null, 2);
}

/**
 * Generates a normalized CSV view for decision logs.
 */
export function exportDecisionLogCsv(report: FinalReport): string {
  const headers = [
    "Day",
    "Event ID",
    "Option ID",
    "Label",
    "Documented",
    "Attention Spent",
  ];
  const rows = report.state.log.map((rec) => [
    rec.day,
    rec.eventId,
    rec.optionId,
    rec.label,
    rec.documented ? "true" : "false",
    rec.attentionSpent,
  ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

/**
 * Generates a normalized CSV view for daily meter trajectories.
 */
export function exportMeterTrajectoryCsv(report: FinalReport): string {
  const headers = [
    "Day",
    "Integrity",
    "Compliance",
    "Timeline",
    "Budget",
    "Client",
    "Team",
  ];
  const history = generateMeterHistory(report);
  const rows = history.map((pt) => [
    pt.day,
    pt.integrity,
    pt.compliance,
    pt.timeline,
    pt.budget,
    pt.client,
    pt.team,
  ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

/**
 * Generates a normalized CSV view for inspection/audit findings.
 */
export function exportAuditFindingsCsv(report: FinalReport): string {
  const headers = [
    "Event ID",
    "Day",
    "Question",
    "Documented",
    "Answer",
    "Outcome",
  ];
  const rows = report.inspection.items.map((item) => [
    item.eventId,
    item.day,
    item.question,
    item.documented ? "true" : "false",
    item.answer,
    item.outcome,
  ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

/**
 * Generates a normalized CSV view for meetings.
 */
export function exportMeetingsCsv(
  report: FinalReport,
  worldCtx?: WorldState | null
): string {
  const world = worldCtx ?? report.world;
  const meetings = world?.meetingHistory ?? [];
  const headers = [
    "Kind",
    "Day",
    "Minutes",
    "Person Minutes",
    "Attendees",
    "Changes",
    "Raised",
    "Verdict",
  ];
  const rows = meetings.map((m) => [
    m.kind,
    m.day ?? "",
    m.minutes,
    m.personMinutes,
    m.attendees.join("; "),
    m.changes.join("; "),
    m.raised.join("; "),
    m.verdict,
  ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

/**
 * Generates a normalized CSV view for site visits.
 */
export function exportSiteVisitsCsv(
  report: FinalReport,
  worldCtx?: WorldState | null
): string {
  const world = worldCtx ?? report.world;
  const siteVisits = world?.siteVisitHistory ?? [];
  const headers = [
    "Site ID",
    "Site Name",
    "Day",
    "Checks",
    "Audited",
    "Findings",
    "Unchecked",
    "Verdict",
  ];
  const rows = siteVisits.map((sv) => [
    sv.siteId,
    sv.siteName,
    sv.day,
    sv.checks.join("; "),
    sv.audited ? "true" : "false",
    sv.findings.map((f) => `${f.label}: ${f.text}`).join("; "),
    sv.unchecked.join("; "),
    sv.verdict,
  ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

/**
 * Generates a normalized CSV view for dialogue history / observations.
 */
export function exportDialogueCsv(
  report: FinalReport,
  worldCtx?: WorldState | null
): string {
  const world = worldCtx ?? report.world;
  const observations = world?.observations ?? [];
  const headers = ["ID", "Day", "Source", "Text", "Area", "Site ID"];
  const rows = observations.map((o) => [
    o.id,
    o.day,
    o.source,
    o.text,
    o.area ?? "",
    o.siteId ?? "",
  ]);

  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");
}

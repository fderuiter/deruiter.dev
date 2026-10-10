import {
  buildRetrospectiveExport,
  toCsv,
  type FinalReport,
  type RetrospectiveJson,
} from "@/lib/study-director";
import {
  HISTORY_LIMIT,
  type MeetingReport,
  type Observation,
  type SiteVisitReport,
  type WorldState,
} from "../types";

/** Keeps the newest `HISTORY_LIMIT` entries so a long run cannot bloat its save. */
export function keepRecent<T>(entries: readonly T[]): T[] {
  return entries.slice(-HISTORY_LIMIT);
}

/** A retrospective export plus what only the office run knows. */
export interface WorldRetrospectiveJson extends RetrospectiveJson {
  meetings: MeetingReport[];
  siteVisits: SiteVisitReport[];
  observations: Observation[];
}

/** The retrospective export with the run's meetings, site visits and overheard lines. */
export function buildWorldRetrospective(
  report: FinalReport,
  world: WorldState
): WorldRetrospectiveJson {
  return {
    ...buildRetrospectiveExport(report),
    meetings: world.meetingHistory ?? [],
    siteVisits: world.siteVisitHistory ?? [],
    observations: world.observations ?? [],
  };
}

/** The world retrospective as formatted JSON. */
export function exportWorldRetrospectiveJson(
  report: FinalReport,
  world: WorldState
): string {
  return JSON.stringify(buildWorldRetrospective(report, world), null, 2);
}

/** One row per meeting held. */
export function exportMeetingsCsv(world: WorldState): string {
  return toCsv(
    [
      "Day",
      "Kind",
      "Minutes",
      "Person minutes",
      "Attendees",
      "What changed",
      "Raised",
      "Verdict",
    ],
    (world.meetingHistory ?? []).map((m) => [
      m.day,
      m.kind,
      m.minutes,
      m.personMinutes,
      m.attendees.join("; "),
      m.changes.join("; "),
      m.raised.join("; "),
      m.verdict,
    ])
  );
}

/** One row per site visit made. */
export function exportSiteVisitsCsv(world: WorldState): string {
  return toCsv(
    [
      "Day",
      "Site ID",
      "Site",
      "Checks",
      "Audited",
      "Findings",
      "Unchecked",
      "Verdict",
    ],
    (world.siteVisitHistory ?? []).map((v) => [
      v.day,
      v.siteId,
      v.siteName,
      v.checks.join("; "),
      v.audited ? "yes" : "no",
      v.findings.map((f) => f.text).join("; "),
      v.unchecked.join("; "),
      v.verdict,
    ])
  );
}

/** One row per thing the player was told or saw. */
export function exportDialogueCsv(world: WorldState): string {
  return toCsv(
    ["Day", "Source", "Text", "Area", "Site ID"],
    (world.observations ?? []).map((o) => [
      o.day,
      o.source,
      o.text,
      o.area ?? "",
      o.siteId ?? "",
    ])
  );
}

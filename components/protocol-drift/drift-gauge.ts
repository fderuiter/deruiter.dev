/**
 * Global Drift Gauge ("Operational Drift"): three segments, each green, amber
 * or red, with the overall severity being the worst segment rather than an
 * average. A low reading does not mean the data is true; it only reports
 * operational strain, so the UI labels it that way.
 */
import {
  isIssueOpen,
  type ProtocolDriftView,
  type SiteId,
} from "@/lib/protocol-drift";

/** Severity of one gauge segment. */
export type Severity = "green" | "amber" | "red";

/** One gauge segment with the reason it reads as it does. */
interface GaugeSegment {
  id: "queue" | "site-strain" | "version-exposure";
  label: string;
  severity: Severity;
  detail: string;
}

/** The full gauge reading. */
interface DriftGauge {
  overall: Severity;
  segments: GaugeSegment[];
}

const RANK: Record<Severity, number> = { green: 0, amber: 1, red: 2 };

/** The worse of two severities. */
function worse(a: Severity, b: Severity): Severity {
  return RANK[a] >= RANK[b] ? a : b;
}

function queueSegment(view: ProtocolDriftView): GaugeSegment {
  const open = view.issues.filter((i) => isIssueOpen(i.status));
  const oldest = open.reduce(
    (max, i) => Math.max(max, (view.minute - i.detectedAtMinute) / 60),
    0
  );
  let severity: Severity = "green";
  if (open.length > 6 || oldest > 72) severity = "red";
  else if (open.length > 0 || oldest > 24) severity = "amber";
  return {
    id: "queue",
    label: "Queue",
    severity,
    detail:
      open.length === 0
        ? "No actionable issues."
        : `${open.length} actionable issue${open.length === 1 ? "" : "s"}, oldest ${Math.floor(oldest)}h.`,
  };
}

function strainSegment(view: ProtocolDriftView, sites: SiteId[]): GaugeSegment {
  let severity: Severity = "green";
  const notes: string[] = [];
  for (const id of sites) {
    const site = view.sites[id];
    if (site.attention < 20 || site.goodwill < 25) {
      severity = worse(severity, "red");
      notes.push(
        `${id} strained (A ${Math.round(site.attention)}, G ${Math.round(site.goodwill)})`
      );
    } else if (site.attention < 40 || site.goodwill < 50) {
      severity = worse(severity, "amber");
      notes.push(
        `${id} watch (A ${Math.round(site.attention)}, G ${Math.round(site.goodwill)})`
      );
    }
  }
  return {
    id: "site-strain",
    label: "Site strain",
    severity,
    detail:
      notes.length === 0
        ? "Coordinator attention and goodwill are healthy."
        : `${notes.join("; ")}. Strain predicts errors; it is not proof of a wrong value.`,
  };
}

function versionSegment(
  view: ProtocolDriftView,
  sites: SiteId[]
): GaugeSegment {
  const misrouted = view.issues.filter(
    (i) => i.code === "APPLICABILITY_DISCREPANCY" && isIssueOpen(i.status)
  ).length;
  const hasRouter = view.publishedGraph?.nodes.some(
    (n) => n.type === "AmendmentRouter"
  );
  const anyV2 = sites.some((id) => view.sites[id].version === "v2");
  let severity: Severity = "green";
  let detail = "Amendment 01 not yet announced.";
  if (view.amendmentAnnounced) {
    if (misrouted > 0 || (anyV2 && !hasRouter)) {
      severity = "red";
      detail =
        misrouted > 0
          ? `${misrouted} misrouted submission${misrouted === 1 ? "" : "s"} awaiting review.`
          : "A site runs v2 forms but no deployed branch accepts them.";
    } else if (!hasRouter || anyV2) {
      severity = "amber";
      detail = hasRouter
        ? "Transition under way: some sites are still on v1."
        : "Amendment announced; add an AmendmentRouter before sites activate.";
    } else {
      detail = "Router deployed; all sites on v1 until activation.";
    }
  }
  return {
    id: "version-exposure",
    label: "Version exposure",
    severity,
    detail,
  };
}

/** Computes the gauge for a view. */
export function computeDriftGauge(view: ProtocolDriftView): DriftGauge {
  const sites: SiteId[] =
    view.scenario === "tracer" ? ["SITE-A"] : ["SITE-A", "SITE-B", "SITE-C"];
  const segments = [
    queueSegment(view),
    strainSegment(view, sites),
    versionSegment(view, sites),
  ];
  return {
    overall: segments.reduce<Severity>(
      (acc, s) => worse(acc, s.severity),
      "green"
    ),
    segments,
  };
}

/** The objective line for the strip. */
export function objectiveFor(view: ProtocolDriftView): string {
  if (view.fsmState === "LOCKED") return "Database locked: review the debrief.";
  if (view.fsmState === "LOCK_REVIEW") return "Dual lock audit in progress.";
  if (view.scenario === "tracer") {
    return "Wave 1: Establish baseline vitals ingestion for Site A";
  }
  switch (view.waveIndex) {
    case 1:
      return "Wave 1: Ingest baseline vitals and history from Sites A, B and C";
    case 2:
      return "Wave 2: Survive Amendment 01 and route by assessment date";
    case 3:
      return "Wave 3: Reconcile, derive ADaM and request Database Lock";
  }
}

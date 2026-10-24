/**
 * The report catalog (#2625): every report with its audience, tier, owner,
 * last refresh and usage, and a search over them.
 *
 * Usage is a count of views per report, read from the site's telemetry
 * counters under {@link reportTelemetrySlug}. The counters hold counts only,
 * never who viewed a report. The catalog takes them as input rather than
 * fetching them, because reading the counters queries the database, which a
 * platform page must not wake (ADR 0066).
 */
import type {
  MetricDefinition,
  ReportCatalogEntry,
  ReportCatalogQuery,
  ReportSpec,
} from "../../types";
import { METRIC_REGISTRY } from "../semantic/registry";

/** Prefix of the telemetry project slug a report's views are counted under. */
const TELEMETRY_PREFIX = "platform-report-";

/**
 * The telemetry project slug a report's views are counted under, for
 * example `platform-report-study-status`.
 *
 * @param reportId - Report id.
 * @returns The slug.
 */
export function reportTelemetrySlug(reportId: string): string {
  return `${TELEMETRY_PREFIX}${reportId}`;
}

/** What the catalog knows beyond the specs themselves. */
export interface ReportCatalogOptions {
  /** ISO 8601 data cut the reports were last refreshed to, if known. */
  readonly lastRefresh?: string;
  /** View counters keyed by telemetry project slug, as the telemetry API returns them. */
  readonly usage?: Readonly<Record<string, { readonly views: number }>>;
  /** The registry; defaults to `METRIC_REGISTRY`. */
  readonly metrics?: readonly MetricDefinition[];
}

/**
 * The catalog entries for some report specs, in the order given.
 *
 * @param specs - The reports.
 * @param options - Last refresh, usage counters and the registry.
 * @returns One entry per report. A report with no counter has `null`
 *   views when no usage was supplied at all, and 0 when usage was supplied
 *   without it.
 */
export function reportCatalog(
  specs: readonly ReportSpec[],
  options: ReportCatalogOptions = {}
): ReportCatalogEntry[] {
  const metrics = options.metrics ?? METRIC_REGISTRY;
  const names = new Map(metrics.map((metric) => [metric.id, metric.name]));
  return specs.map((spec) => ({
    id: spec.id,
    title: spec.title,
    audience: spec.audience,
    purpose: spec.purpose,
    tier: spec.tier,
    owner: spec.owner,
    version: spec.version,
    visual: spec.visual,
    metricNames: spec.metrics.map((id) => names.get(id) ?? id),
    lastRefresh: options.lastRefresh ?? null,
    refreshSlaHours: spec.refreshSlaHours,
    views:
      options.usage === undefined
        ? null
        : (options.usage[reportTelemetrySlug(spec.id)]?.views ?? 0),
  }));
}

function words(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Searches catalog entries. Every word of `text` must appear in the
 * entry's title, purpose, audience, owner or metric names, ignoring case;
 * the entry's tier must be one of `tiers`; and its audience must equal
 * `audience`. A criterion that is absent or empty matches every entry.
 *
 * @param entries - Catalog entries.
 * @param query - The search.
 * @returns The matching entries, in their catalog order.
 */
export function searchReportCatalog(
  entries: readonly ReportCatalogEntry[],
  query: ReportCatalogQuery
): ReportCatalogEntry[] {
  const wanted = words(query.text ?? "");
  const tiers = new Set(query.tiers ?? []);
  return entries.filter((entry) => {
    if (tiers.size > 0 && !tiers.has(entry.tier)) return false;
    if (query.audience !== undefined && entry.audience !== query.audience) {
      return false;
    }
    const haystack = [
      entry.title,
      entry.purpose,
      entry.audience,
      entry.owner,
      ...entry.metricNames,
    ]
      .join(" ")
      .toLowerCase();
    return wanted.every((word) => haystack.includes(word));
  });
}

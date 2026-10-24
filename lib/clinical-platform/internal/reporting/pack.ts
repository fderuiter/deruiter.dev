/**
 * The standard report pack (#2625): four operational reports, declared as
 * data and built by the one shared renderer. The pack spans all three
 * tiers, so the catalog shows what each tier means.
 */
import type { ReportSpec } from "../../types";

/** Date the pack's certified reports were signed off. */
const SIGNED_OFF_ON = "2026-10-24";

/** The standard report pack, in catalog order. */
export const REPORT_PACK: readonly ReportSpec[] = Object.freeze([
  {
    id: "study-status",
    title: "Study status report",
    audience: "Study leadership",
    purpose:
      "Shows how many subjects each study has screened and enrolled, so study leads can see which studies are behind on recruitment.",
    tier: "certified",
    owner: "Clinical Operations Lead",
    version: "1.0.0",
    metrics: ["subjects_screened", "subjects_enrolled"],
    dimensions: ["study"],
    filters: [],
    visual: "bar",
    refreshSlaHours: 24,
    signOff: {
      role: "Clinical Operations Lead",
      date: SIGNED_OFF_ON,
      version: "1.0.0",
    },
  },
  {
    id: "site-performance",
    title: "Site performance report",
    audience: "Clinical operations",
    purpose:
      "Compares sites on data entry lag, missed visits, query rate and important deviations, so monitors can choose where to focus.",
    tier: "managed",
    owner: "Clinical Monitoring Lead",
    version: "1.0.0",
    metrics: [
      "data_entry_lag_median",
      "missed_visit_rate",
      "query_rate_per_100_visits",
      "important_deviation_rate",
    ],
    dimensions: ["site"],
    filters: [],
    visual: "table",
    refreshSlaHours: 24,
    signOff: null,
  },
  {
    id: "data-management-metrics",
    title: "Data management metrics report",
    audience: "Data management",
    purpose:
      "Tracks data entry lag, query volume and age, source data verification and overdue monitoring reports per study, ahead of each data cut.",
    tier: "exploratory",
    owner: "Clinical Data Management Lead",
    version: "0.1.0",
    metrics: [
      "data_entry_lag_median",
      "data_entry_lag_p90",
      "query_rate_per_100_visits",
      "open_query_count",
      "query_aging_mean",
      "sdv_completion",
      "monitoring_reports_overdue",
    ],
    dimensions: ["study"],
    filters: [],
    visual: "table",
    refreshSlaHours: 168,
    signOff: null,
  },
  {
    id: "monthly-portfolio-review",
    title: "Monthly portfolio review",
    audience: "Portfolio leadership",
    purpose:
      "Shows subjects screened and enrolled across the portfolio each month, for the monthly review of recruitment against the portfolio plan.",
    tier: "certified",
    owner: "Portfolio Management Lead",
    version: "1.0.0",
    metrics: ["subjects_screened", "subjects_enrolled"],
    dimensions: ["month"],
    filters: [],
    visual: "line",
    refreshSlaHours: 720,
    signOff: {
      role: "Portfolio Management Lead",
      date: SIGNED_OFF_ON,
      version: "1.0.0",
    },
  },
]);

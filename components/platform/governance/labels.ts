import type {
  CatalogSlaStatus,
  DataCatalogEntry,
  DataClassification,
  DqIssueStatus,
  DqSeverity,
  DqStatus,
  MedallionLayer,
  MetricStatus,
  RaciCode,
} from "@/lib/clinical-platform";

/** Words for each value the governance page shows, so the catalog and its filters agree. */
export const KIND_LABEL: Readonly<Record<DataCatalogEntry["kind"], string>> = {
  product: "Data products",
  metric: "Metrics",
};

export const LAYER_LABEL: Readonly<Record<MedallionLayer, string>> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export const CLASSIFICATION_LABEL: Readonly<
  Record<DataClassification, string>
> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  restricted: "Restricted",
};

export const SLA_LABEL: Readonly<Record<CatalogSlaStatus, string>> = {
  met: "Met its contract",
  missed: "Missed its contract",
  unchecked: "Not checked",
};

export const METRIC_STATUS_LABEL: Readonly<Record<MetricStatus, string>> = {
  draft: "Draft",
  certified: "Certified",
  deprecated: "Deprecated",
};

export const RACI_LABEL: Readonly<Record<RaciCode, string>> = {
  R: "Responsible",
  A: "Accountable",
  C: "Consulted",
  I: "Informed",
};

/** A rule result's word and glyph, so its status never rests on colour. */
export const DQ_STATUS_LABEL: Readonly<
  Record<DqStatus, { label: string; glyph: string; text: string }>
> = {
  fail: { label: "Failed", glyph: "▲", text: "text-red-200" },
  warn: { label: "To review", glyph: "◆", text: "text-amber-200" },
  pass: { label: "Passed", glyph: "●", text: "text-emerald-300" },
  "not-applicable": {
    label: "Nothing to check",
    glyph: "○",
    text: "text-slate-400",
  },
};

export const DQ_SEVERITY_LABEL: Readonly<Record<DqSeverity, string>> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
};

export const DQ_ISSUE_STATUS_LABEL: Readonly<Record<DqIssueStatus, string>> = {
  detected: "Detected",
  assigned: "Assigned",
  "root-cause": "Root cause found",
  fixed: "Fixed",
  verified: "Verified",
};

/** The id a catalog entry's element carries, so other sections can link to it. */
export function catalogAnchor(id: string): string {
  return `catalog-${id}`;
}

/** The id a glossary term's element carries. */
export function glossaryAnchor(key: string): string {
  return `glossary-${key}`;
}

/** The id a policy's element carries. */
export function policyAnchor(id: string): string {
  return `policy-${id}`;
}

/** The id a product's row in the data quality scorecard carries. */
export function dqProductAnchor(id: string): string {
  return `dq-product-${id}`;
}

/** The id a data quality rule's row carries. */
export function dqRuleAnchor(id: string): string {
  return `dq-rule-${id}`;
}

/** The id a data quality issue's element carries. */
export function dqIssueAnchor(id: string): string {
  return `dq-issue-${id}`;
}

/** A share from 0 to 1 as a percentage with one decimal, never rounded up to 100%. */
export function percent(share: number): string {
  const tenths = Math.floor(share * 1000) / 10;
  return `${tenths.toFixed(tenths === 100 ? 0 : 1)}%`;
}

/**
 * Clinical Data Platform: key risk indicator, quality tolerance limit and
 * central monitoring types.
 */

/** Status of a key risk indicator at a site. */
export type KriStatus = "green" | "amber" | "red" | "insufficient-data";

/**
 * A key risk indicator (#2631): a governed registry metric evaluated per
 * site, with the thresholds at which it turns amber and red and why.
 */
export interface KriDefinition {
  /** KRI id, for example `kri-entry-lag`. */
  readonly id: string;
  readonly name: string;
  /** The registry metric the KRI evaluates per site. */
  readonly metricId: string;
  /** `high` when a high value is the risk, `low` when a low value is. */
  readonly direction: "high" | "low";
  /** Value at which the KRI turns amber, in the metric's unit. */
  readonly amber: number;
  /** Value at which the KRI turns red, in the metric's unit. */
  readonly red: number;
  /** Why these thresholds. */
  readonly reason: string;
  /**
   * The count metric and value below which the site has too little data to
   * assess, for example 3 enrolled subjects.
   */
  readonly minimum: { readonly metricId: string; readonly value: number };
}

/**
 * A quality tolerance limit (ICH E6(R3)): a study-level limit on a
 * registry metric whose breach calls for the response planned in advance.
 */
export interface QtlDefinition {
  /** QTL id, for example `qtl-early-termination`. */
  readonly id: string;
  readonly name: string;
  /** The registry metric the QTL evaluates per study. */
  readonly metricId: string;
  /** What the parameter stands for, and why it matters to the study's results. */
  readonly rationale: string;
  /** The response planned before any breach. */
  readonly response: string;
}

/** A QTL as a study's quality plan sets it. */
export interface QualityPlanQtl {
  readonly qtlId: string;
  /** Breached above this value, in the metric's unit. */
  readonly limit: number;
  /** Warning above this value: the secondary limit that triggers review before a breach. */
  readonly secondaryLimit: number;
}

/** A critical-to-quality factor (ICH E8(R1)) and how the plan watches it. */
export interface CriticalToQualityFactor {
  readonly id: string;
  readonly name: string;
  /** What could go wrong and what it would do to subjects or results. */
  readonly risk: string;
  /** KRIs that watch the factor. */
  readonly kriIds: readonly string[];
  /** QTLs that bound the factor. */
  readonly qtlIds: readonly string[];
  /** What the platform cannot watch yet, with the issue that adds it; `null` when nothing is missing. */
  readonly gap: { readonly reason: string; readonly issue: number } | null;
}

/** A study's quality plan: its critical-to-quality factors and QTL limits. */
export interface QualityPlan {
  readonly studyId: string;
  readonly version: string;
  /** ISO 8601 date the plan took effect. */
  readonly effectiveOn: string;
  readonly factors: readonly CriticalToQualityFactor[];
  readonly qtls: readonly QualityPlanQtl[];
  /** Synthetic plan for a fictional study. */
  readonly synthetic: true;
}

/** One KRI at one site. */
export interface KriAssessment {
  readonly kriId: string;
  readonly siteId: string;
  /** Metric value; `null` when the metric has no value for the site. */
  readonly value: number | null;
  readonly status: KriStatus;
}

/** Status of a QTL for a study. */
export type QtlStatus = "within" | "warning" | "breached" | "no-data";

/** One QTL for one study. */
export interface QtlAssessment {
  readonly qtlId: string;
  readonly value: number | null;
  readonly limit: number;
  readonly secondaryLimit: number;
  readonly status: QtlStatus;
}

/** A central statistical monitoring test (#2631). */
export interface CsmTestDefinition {
  /** Test id, for example `csm-query-under-reporting`. */
  readonly id: string;
  readonly name: string;
  /** What the test asks of the site against its peers, in one sentence. */
  readonly question: string;
  /** The statistic and its reference distribution. */
  readonly method: string;
  /** Gold tables and columns it reads. */
  readonly reads: readonly string[];
}

/** One test at one site. */
export interface CsmResult {
  readonly testId: string;
  readonly siteId: string;
  /** Observations at the site the test used. */
  readonly n: number;
  /** Test statistic. */
  readonly statistic: number;
  /** One-sided p-value. */
  readonly pValue: number;
  /** Benjamini-Hochberg adjusted p-value across the study's tests. */
  readonly qValue: number;
  /** Whether the q-value is at most the configured false discovery rate. */
  readonly flagged: boolean;
  /** The site's value and its peers', in plain words. */
  readonly detail: string;
}

/** A site or test the study's central monitoring could not assess, and why. */
export interface CsmExclusion {
  readonly siteId: string | null;
  readonly testId: string | null;
  readonly reason: string;
}

/** Central statistical monitoring of one study's sites. */
export interface CsmRun {
  /** False discovery rate the tests are controlled at. */
  readonly fdr: number;
  /** Sites with enough data, in id order. */
  readonly sites: readonly string[];
  readonly results: readonly CsmResult[];
  readonly excluded: readonly CsmExclusion[];
}

/** Where a risk signal came from. */
export type RiskSignalSource =
  | { readonly kind: "kri"; readonly kriId: string; readonly siteId: string }
  | { readonly kind: "qtl"; readonly qtlId: string }
  | {
      readonly kind: "csm";
      readonly siteId: string;
      readonly testIds: readonly string[];
    };

/** An action a signal can lead to. */
export type RiskSignalAction =
  "targeted-sdv" | "site-retraining" | "site-audit" | "for-cause-visit";

/** A step in a risk signal's workflow. */
export type RiskSignalEvent = "raised" | "assessed" | "actioned" | "closed";

/** One entry of a study's append-only risk signal log. */
export interface RiskSignalLogEntry {
  /** Position in the log, from 1, with no gaps. */
  readonly sequence: number;
  /** Signal id, for example `DEMO-302-SIG-001`. */
  readonly signalId: string;
  readonly event: RiskSignalEvent;
  /** ISO 8601 date of the event. */
  readonly on: string;
  /** Who recorded it: a role, or the automated central monitoring. */
  readonly by: string;
  /** What was found, decided or done. */
  readonly note: string;
  /** Where the signal came from; on `raised` entries only, otherwise `null`. */
  readonly source: RiskSignalSource | null;
  /** The action taken; on `actioned` entries only, otherwise `null`. */
  readonly action: RiskSignalAction | null;
}

/** A finding about a risk signal log that breaks its rules. */
export interface RiskSignalLogFinding {
  readonly sequence: number;
  readonly message: string;
}

/** Risk-based quality management for one study at one data cut. */
export interface StudyRiskAssessment {
  readonly studyId: string;
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  readonly plan: QualityPlan;
  /** Every KRI at every activated site, by site id then KRI order. */
  readonly kris: readonly KriAssessment[];
  readonly qtls: readonly QtlAssessment[];
  readonly csm: CsmRun;
  /** Signals raised at the data cut: red KRIs, QTL warnings and breaches, flagged sites. */
  readonly log: readonly RiskSignalLogEntry[];
}

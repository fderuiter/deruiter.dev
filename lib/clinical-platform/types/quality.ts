/**
 * Clinical Data Platform: data quality rule, conformance result, scorecard and
 * issue log types.
 */
import type { DqDimension, DqScore } from "./platform";

/** How much a failing data quality rule matters (#2636). */
export type DqSeverity = "critical" | "major" | "minor";

/** One data quality rule over a data product (#2636). */
export interface DqRule {
  /** Stable id: `DQ-` and a dimension letter for platform rules, the conformance rule id for ingested ones. */
  readonly id: string;
  /** Data product the rule checks: a warehouse table, or the Study Data Pipeline. */
  readonly productId: string;
  /** Dataset within the product, for an ingested conformance rule; `null` otherwise. */
  readonly dataset: string | null;
  readonly dimension: DqDimension;
  /** What the rule asks, in a sentence. */
  readonly name: string;
  /** The check as a SQL-style predicate over the product's rows. */
  readonly expression: string;
  readonly severity: DqSeverity;
  /** Least share of checked rows that must pass, from 0 to 1. */
  readonly threshold: number;
  /** Data steward of the product, from its contract registration. */
  readonly owner: string;
  /** Why the rule exists. */
  readonly rationale: string;
  /** `platform` for rules written here, `conformance` for Study Data Pipeline rules ingested as they are. */
  readonly source: "platform" | "conformance";
  /** Published rule or guide the rule models, for ingested rules; `null` otherwise. */
  readonly citation: string | null;
}

/**
 * A named defect of the kind real source feeds deliver, applied to a
 * warehouse to show which rules catch it (#2636).
 */
export interface DqScenario {
  /** Stable id, for example `finance-double-load`. */
  readonly id: string;
  readonly name: string;
  /** What went wrong at the source, in a sentence or two. */
  readonly story: string;
  /** Source system the defect arrives from. */
  readonly sourceSystem: string;
  /** Rules whose failing count the defect raises, in rule order. */
  readonly ruleIds: readonly string[];
}

/** Where a data quality issue is in its lifecycle (#2636). */
export type DqIssueStatus =
  "detected" | "assigned" | "root-cause" | "fixed" | "verified";

/** One entry in the append-only data quality issue log (#2636). */
export interface DqIssueEvent {
  /** Issue id, for example `DQI-001`. */
  readonly issueId: string;
  readonly status: DqIssueStatus;
  /** ISO 8601 date. */
  readonly on: string;
  /** Role that made the entry. */
  readonly actor: string;
  readonly note: string;
  /** Defect the issue records; set on the `detected` entry and `null` after it. */
  readonly scenarioId: string | null;
  /** Rules that raised the issue; set on the `detected` entry and empty after it. */
  readonly ruleIds: readonly string[];
}

/** A data quality issue as its log entries leave it (#2636). */
export interface DqIssue {
  readonly issueId: string;
  readonly scenarioId: string;
  readonly ruleIds: readonly string[];
  /** Status of the latest entry. */
  readonly status: DqIssueStatus;
  /** ISO 8601 date the issue was detected. */
  readonly detectedOn: string;
  /** ISO 8601 date the fix landed, or `null` while the defect is in the data. */
  readonly fixedOn: string | null;
  /** The issue's log entries, oldest first. */
  readonly history: readonly DqIssueEvent[];
}

/** The data quality scorecard as it read at the end of one week (#2636). */
export interface DqTrendPoint {
  /** ISO 8601 date the week ends. */
  readonly weekEnding: string;
  readonly overall: DqScore;
  /** Scores by dimension, in DAMA order. */
  readonly byDimension: readonly DqScore[];
  /** Rules that failed that week, in rule order. */
  readonly failingRuleIds: readonly string[];
  /** Issues whose defect was in the data that week, in id order. */
  readonly openIssueIds: readonly string[];
}

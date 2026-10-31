/**
 * The Study Data Pipeline's conformance rules, ingested as data quality
 * rules (#2636). The pipeline already runs them on every SDTM and ADaM
 * dataset (ADR 0065); the platform reads their results rather than checking
 * the same things twice, so the scorecards cover the study data too.
 */
import {
  CONFORMANCE_RULES,
  type ConformanceRule,
  type PipelineRun,
} from "@/lib/study-data";
import { STUDY_DATA_PRODUCT_ID } from "../../presets";
import type { DqDimension, DqRule, DqRuleResult, DqStatus } from "../../types";
import { PRODUCT_REGISTRATIONS } from "../governance/contracts/registry";

type Kind = ConformanceRule["kind"];

/** The dimension each kind of conformance rule measures. */
const DIMENSIONS: Readonly<Record<Kind, DqDimension>> = {
  required: "completeness",
  unique: "uniqueness",
  iso: "validity",
  ct: "validity",
  "study-day": "consistency",
  visit: "consistency",
  epoch: "consistency",
  baseline: "consistency",
  adam: "consistency",
  exception: "accuracy",
  duplicate: "uniqueness",
  unit: "consistency",
  eligibility: "consistency",
  relationship: "consistency",
  elements: "consistency",
  comment: "consistency",
  lineage: "consistency",
};

/** What each kind of rule asks of a dataset, and why. */
const TEXT: Readonly<
  Record<Kind, { name: (d: string, v: string) => string; rationale: string }>
> = {
  required: {
    name: (d) => `${d} required variables are populated`,
    rationale: "A record without its required variables cannot be analysed.",
  },
  unique: {
    name: (d, v) => `${v} is unique within ${d}`,
    rationale: "A duplicated key double counts the records it identifies.",
  },
  iso: {
    name: (d, v) => `${d}.${v} is an ISO 8601 date`,
    rationale: "Dates outside ISO 8601 cannot be compared or ordered.",
  },
  ct: {
    name: (d, v) => `${d}.${v} uses CDISC controlled terminology`,
    rationale: "Values outside the codelist do not pool across studies.",
  },
  "study-day": {
    name: (d, v) => `${d}.${v} agrees with its date and the reference start`,
    rationale:
      "A study day that disagrees with its date puts events in the wrong window.",
  },
  visit: {
    name: (d) => `${d} visits match the trial visits`,
    rationale: "Unplanned visit codes break by-visit summaries.",
  },
  epoch: {
    name: (d, v) => `${d}.${v} matches the trial elements`,
    rationale: "Epochs assign records to treatment periods.",
  },
  baseline: {
    name: (d, v) => `${d}.${v} flags one baseline per subject and test`,
    rationale: "Change from baseline needs exactly one baseline record.",
  },
  adam: {
    name: (d, v) => `${d}.${v} derivation agrees with its source`,
    rationale:
      "Analysis variables must trace back to the SDTM they derive from.",
  },
  exception: {
    name: (d, v) => `${d}.${v} values are plausible`,
    rationale:
      "Values that pass every format check can still be unlikely; a reviewer confirms each one.",
  },
  duplicate: {
    name: (d) => `${d} holds no measurement entered twice`,
    rationale:
      "A measurement entered twice is counted twice unless one copy is queried and removed.",
  },
  lineage: {
    name: (d) => `${d} records trace to their source records`,
    rationale:
      "A record that cannot be traced to its source cannot be verified or reproduced.",
  },
  eligibility: {
    name: (d) => `${d} records match who failed screening`,
    rationale:
      "Screen failure counts and reasons come from the criteria a subject did not meet; a disposition and its eligibility record must agree.",
  },
  relationship: {
    name: (d) => `${d} pairs resolve to existing AE and CM records`,
    rationale:
      "A reviewer follows an adverse event to the medication given for it through RELREC; a pair that names a missing record, or relates anything but one AE and one CM, breaks that trail.",
  },
  elements: {
    name: (d, v) =>
      v === "ETCD"
        ? `${d} elements follow the subject's arm in TA`
        : `${d} elements leave no gap between them`,
    rationale:
      "Subject elements place every record in the part of the study it happened in; an element outside the subject's planned arm, or a gap or overlap between elements, puts records in the wrong epoch.",
  },
  comment: {
    name: (d) => `${d} comments name an existing record`,
    rationale:
      "A reviewer reads a site's comment beside the record it explains; a comment that names a missing record has lost its context.",
  },
  unit: {
    name: (d, v) => `${d}.${v} is the test's standard unit`,
    rationale:
      "A result collected in another unit compares with the rest only after conversion, which the site should confirm.",
  },
};

const STATUSES: Readonly<
  Record<PipelineRun["conformance"]["ruleResults"][number]["status"], DqStatus>
> = {
  pass: "pass",
  warning: "warn",
  error: "fail",
};

/** Data quality rules for the conformance rules, in the pipeline's order. */
export function conformanceDqRules(): DqRule[] {
  const steward = PRODUCT_REGISTRATIONS[STUDY_DATA_PRODUCT_ID]?.steward;
  if (steward === undefined) {
    throw new Error("the Study Data Pipeline product is not registered");
  }
  return CONFORMANCE_RULES.map((rule): DqRule => {
    const dataset = rule.scope.domain;
    const variable = rule.variable ?? "";
    return {
      id: rule.id,
      productId: STUDY_DATA_PRODUCT_ID,
      dataset,
      dimension: DIMENSIONS[rule.kind],
      name: TEXT[rule.kind].name(dataset, variable),
      expression: `Study Data Pipeline conformance rule ${rule.id} (${rule.kind}) on ${rule.scope.layer.toUpperCase()} ${dataset}`,
      severity: rule.severity === "error" ? "critical" : "minor",
      threshold: 1,
      owner: steward,
      rationale: TEXT[rule.kind].rationale,
      source: "conformance",
      citation: rule.citation,
    };
  });
}

/**
 * Results of the conformance rules on one pipeline run. A rule checks every
 * record of its dataset and fails the records its findings name; its status
 * is the pipeline gate's, so a warning stays a finding to review.
 */
export function conformanceDqResults(run: PipelineRun): DqRuleResult[] {
  return CONFORMANCE_RULES.map((rule): DqRuleResult => {
    const dataset = run.datasets.find(
      (d) => d.name === rule.scope.domain && d.layer === rule.scope.layer
    );
    const outcome = run.conformance.ruleResults.find(
      (r) => r.ruleId === rule.id && r.dataset === rule.scope.domain
    );
    if (
      dataset === undefined ||
      outcome === undefined ||
      dataset.rowCount === 0
    ) {
      return {
        ruleId: rule.id,
        checked: 0,
        failed: 0,
        passRate: null,
        status: "not-applicable",
        sample: [],
      };
    }
    const findings = run.findings.filter(
      (f) => f.ruleId === rule.id && f.dataset === rule.scope.domain
    );
    const rows = [
      ...new Set(findings.flatMap((f) => (f.row === undefined ? [] : [f.row]))),
    ].sort((a, b) => a - b);
    const failed = Math.min(
      dataset.rowCount,
      rows.length > 0 ? rows.length : outcome.findingCount
    );
    return {
      ruleId: rule.id,
      checked: dataset.rowCount,
      failed,
      passRate: 1 - failed / dataset.rowCount,
      status: STATUSES[outcome.status],
      sample: rows
        .slice(0, 5)
        .map((row) => `${rule.scope.domain} row ${row + 1}`),
    };
  });
}

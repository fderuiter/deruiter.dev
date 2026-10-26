/** Runs the local versioned rule subset and records pass/fail per domain. */
import { STANDARD_VERSIONS } from "../../presets";
import { standardCitation } from "../../standards";
import type {
  ConformanceDomainSummary,
  ConformanceReport,
  ConformanceRuleResult,
  Dataset,
  Finding,
} from "../../types";
import {
  CDISC_CORE_URL,
  CONFORMANCE_RULES,
  CONFORMANCE_RULES_VERSION,
  type ConformanceRule,
  type RuleIssue,
} from "./rules";

const SCOPE_NOTICE = `Models a subset of published ${standardCitation("SDTMIG")} and ${standardCitation("ADaMIG")} rules. Run CDISC CORE for the complete published conformance catalog.`;
export interface ConformanceOutcome {
  readonly report: ConformanceReport;
  readonly findings: readonly Finding[];
}

/** Safe on malformed dataset structures: returns identifiable errors instead of throwing. */
export function runConformance(
  datasets: readonly Dataset[],
  rules: readonly ConformanceRule[] = CONFORMANCE_RULES
): ConformanceOutcome {
  const wellFormed = Array.isArray(datasets)
    ? datasets.filter(
        (value): value is Dataset =>
          value !== null &&
          typeof value === "object" &&
          typeof value.name === "string"
      )
    : [];
  // Rules see the collected layer too, so lineage can be traced to source.
  const safeDatasets = wellFormed.filter(
    (value) => value.layer === "sdtm" || value.layer === "adam"
  );
  const findings: Finding[] = [];
  const ruleResults: ConformanceRuleResult[] = [];
  for (const dataset of safeDatasets) {
    for (const rule of rules) {
      if (
        rule.scope.layer !== dataset.layer ||
        rule.scope.domain !== dataset.name ||
        (rule.scope.class && rule.scope.class !== dataset.class)
      )
        continue;
      let issues: readonly RuleIssue[];
      try {
        issues = rule.check(dataset, wellFormed);
      } catch {
        issues = [
          { message: "Rule could not evaluate malformed dataset structure." },
        ];
      }
      for (const issue of issues)
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          layer: dataset.layer,
          dataset: dataset.name,
          ...(issue.variable ? { variable: issue.variable } : {}),
          ...(issue.row === undefined ? {} : { row: issue.row }),
          message: issue.message,
          citation: rule.citation,
        });
      ruleResults.push({
        ruleId: rule.id,
        dataset: dataset.name,
        status:
          issues.length === 0
            ? "pass"
            : rule.severity === "error"
              ? "error"
              : "warning",
        findingCount: issues.length,
        citation: rule.citation,
      });
    }
  }
  const domains: ConformanceDomainSummary[] = safeDatasets.map((dataset) => {
    const results = ruleResults.filter(
      (result) => result.dataset === dataset.name
    );
    return {
      dataset: dataset.name,
      pass: results.filter((result) => result.status === "pass").length,
      warning: results.filter((result) => result.status === "warning").length,
      error: results.filter((result) => result.status === "error").length,
    };
  });
  const report: ConformanceReport = {
    status: findings.some((finding) => finding.severity === "error")
      ? "failed"
      : findings.some((finding) => finding.severity === "warning")
        ? "warning"
        : "pass",
    rulesVersion: CONFORMANCE_RULES_VERSION,
    terminologyVersion: STANDARD_VERSIONS["NCI-EVS-CT"],
    scopeNotice: SCOPE_NOTICE,
    coreUrl: CDISC_CORE_URL,
    domains,
    ruleResults,
  };
  return { report, findings };
}

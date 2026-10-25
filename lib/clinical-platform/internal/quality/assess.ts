/**
 * Data quality results and scorecards (#2636): every platform rule run on a
 * warehouse, every conformance rule read from a pipeline run, and the
 * scores by product, by dimension and overall.
 */
import type { PipelineRun } from "@/lib/study-data";
import { DQ_DIMENSIONS } from "../../presets";
import type {
  DqAssessment,
  DqRule,
  DqRuleResult,
  DqScore,
  Warehouse,
} from "../../types";
import { PRODUCT_REGISTRATIONS } from "../governance/contracts/registry";
import { conformanceDqResults, conformanceDqRules } from "./conformance";
import { dqContext } from "./context";
import { PLATFORM_DQ_RULES, type PlatformDqRule } from "./rules";

/** Failing keys a result lists. */
const SAMPLE_SIZE = 5;

function describe(rule: PlatformDqRule): DqRule {
  const { check: _check, fault: _fault, ...text } = rule;
  return text;
}

/**
 * Every data quality rule: the platform's rules over the warehouse, then the
 * Study Data Pipeline's conformance rules.
 */
export const DATA_QUALITY_RULES: readonly DqRule[] = Object.freeze([
  ...PLATFORM_DQ_RULES.map(describe),
  ...conformanceDqRules(),
]);

function platformResult(
  rule: PlatformDqRule,
  ctx: ReturnType<typeof dqContext>
): DqRuleResult {
  const { checked, failing } = rule.check(ctx);
  if (checked === 0) {
    return {
      ruleId: rule.id,
      checked,
      failed: 0,
      passRate: null,
      status: "not-applicable",
      sample: [],
    };
  }
  const passRate = 1 - failing.length / checked;
  return {
    ruleId: rule.id,
    checked,
    failed: failing.length,
    passRate,
    status: passRate >= rule.threshold ? "pass" : "fail",
    sample: [...new Set(failing)].sort().slice(0, SAMPLE_SIZE),
  };
}

function score(
  key: string,
  label: string,
  results: readonly DqRuleResult[]
): DqScore {
  const applicable = results.filter((r) => r.passRate !== null);
  return {
    key,
    label,
    rules: applicable.length,
    passing: applicable.filter(
      (r) => r.status === "pass" || r.status === "warn"
    ).length,
    score:
      applicable.length === 0
        ? null
        : applicable.reduce((total, r) => total + (r.passRate ?? 0), 0) /
          applicable.length,
  };
}

const capitalize = (text: string) => text[0].toUpperCase() + text.slice(1);

/** Scores by dimension, in DAMA order. */
function dimensionScores(results: readonly DqRuleResult[]): DqScore[] {
  const rules = new Map(DATA_QUALITY_RULES.map((r) => [r.id, r]));
  return DQ_DIMENSIONS.map((dimension) =>
    score(
      dimension,
      capitalize(dimension),
      results.filter((r) => rules.get(r.ruleId)?.dimension === dimension)
    )
  );
}

/**
 * Runs every data quality rule and scores the results.
 *
 * @param warehouse - The warehouse the platform rules check.
 * @param run - The Study Data Pipeline run whose conformance results are
 *   ingested.
 * @returns One result per rule in `DATA_QUALITY_RULES` order, and the scores
 *   overall, by product and by dimension. A score is the mean pass rate of
 *   the rules that checked something.
 */
export function assessDataQuality(
  warehouse: Warehouse,
  run: PipelineRun
): DqAssessment {
  const ctx = dqContext(warehouse);
  const results = [
    ...PLATFORM_DQ_RULES.map((rule) => platformResult(rule, ctx)),
    ...conformanceDqResults(run),
  ];
  const productOf = new Map(DATA_QUALITY_RULES.map((r) => [r.id, r.productId]));
  const products = [...new Set(productOf.values())].sort();
  return {
    dataCut: warehouse.asOf,
    results,
    overall: score("overall", "Overall", results),
    byProduct: products.map((id) =>
      score(
        id,
        PRODUCT_REGISTRATIONS[id]?.name ?? id,
        results.filter((r) => productOf.get(r.ruleId) === id)
      )
    ),
    byDimension: dimensionScores(results),
  };
}

/**
 * A copy of a warehouse with the smallest edit that breaks one platform
 * rule, for showing the rule catch a real defect.
 *
 * @throws Error for an unknown rule id, or a conformance rule, whose
 *   defects are the pipeline's to inject.
 */
export function breakDataQualityRule(
  warehouse: Warehouse,
  ruleId: string
): Warehouse {
  const rule = PLATFORM_DQ_RULES.find((r) => r.id === ruleId);
  if (rule === undefined) {
    throw new Error(`${ruleId} is not a platform data quality rule`);
  }
  return rule.fault(warehouse);
}

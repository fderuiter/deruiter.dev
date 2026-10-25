/**
 * Risk-based quality management for one study (#2631): its KRIs at every
 * activated site, its QTLs, central statistical monitoring of its sites,
 * and the signals all three raise at the data cut. KRIs and QTLs are
 * evaluated through the governed metric registry, so each value is the one
 * the registry's definition gives.
 */
import type {
  KriAssessment,
  KriDefinition,
  KriStatus,
  MetricDefinition,
  QtlAssessment,
  QtlStatus,
  StudyRiskAssessment,
  Warehouse,
} from "../../types";
import { formatMetricValue } from "../reporting/format";
import { evaluateMetric } from "../semantic/evaluate";
import { METRIC_REGISTRY } from "../semantic/registry";
import { CSM_DEFAULT_FDR, centralMonitoring } from "./csm";
import { CSM_TESTS, KRI_LIBRARY, QTL_LIBRARY, qualityPlan } from "./library";
import { raiseRiskSignals, type RaisedSignal } from "./signals";

function metric(id: string): MetricDefinition {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`the registry has no metric ${id}`);
  return found;
}

/** Values of a metric per site of one study. */
function bySite(
  warehouse: Warehouse,
  definition: MetricDefinition,
  studyId: string
): Map<string, number | null> {
  const result = evaluateMetric(warehouse, definition, {
    dimensions: ["site"],
    filters: [{ dimension: "study", operator: "in", values: [studyId] }],
  });
  return new Map(result.rows.map((row) => [row.dimensions.site!, row.value]));
}

/** Where a value falls against a KRI's thresholds. */
function kriStatus(kri: KriDefinition, value: number): KriStatus {
  if (kri.direction === "high") {
    if (value >= kri.red) return "red";
    return value >= kri.amber ? "amber" : "green";
  }
  if (value <= kri.red) return "red";
  return value <= kri.amber ? "amber" : "green";
}

function assessKris(
  warehouse: Warehouse,
  studyId: string,
  siteIds: readonly string[]
): KriAssessment[] {
  const columns = KRI_LIBRARY.map((kri) => ({
    kri,
    values: bySite(warehouse, metric(kri.metricId), studyId),
    minimum: bySite(warehouse, metric(kri.minimum.metricId), studyId),
  }));
  return siteIds.flatMap((siteId) =>
    columns.map(({ kri, values, minimum }) => {
      const value = values.get(siteId) ?? null;
      const enough = (minimum.get(siteId) ?? 0) >= kri.minimum.value;
      return {
        kriId: kri.id,
        siteId,
        value,
        status:
          value === null || !enough
            ? "insufficient-data"
            : kriStatus(kri, value),
      };
    })
  );
}

function assessQtls(
  warehouse: Warehouse,
  studyId: string,
  plan: ReturnType<typeof qualityPlan>
): QtlAssessment[] {
  return plan.qtls.map(({ qtlId, limit, secondaryLimit }) => {
    const qtl = QTL_LIBRARY.find((q) => q.id === qtlId)!;
    const value =
      evaluateMetric(warehouse, metric(qtl.metricId), {
        dimensions: ["study"],
        filters: [{ dimension: "study", operator: "in", values: [studyId] }],
      }).rows[0]?.value ?? null;
    const status: QtlStatus =
      value === null
        ? "no-data"
        : value > limit
          ? "breached"
          : value > secondaryLimit
            ? "warning"
            : "within";
    return { qtlId, value, limit, secondaryLimit, status };
  });
}

/**
 * Assesses one study's risk at the warehouse's data cut.
 *
 * @param warehouse - A warehouse from `buildWarehouse`.
 * @param studyId - The study to assess.
 * @param options - `fdr`, the false discovery rate for central monitoring (default 0.05).
 * @returns The study's quality plan, KRIs, QTLs, central monitoring and the signals raised.
 * @throws Error for an unknown study; RangeError for an `fdr` outside (0, 1).
 */
export function assessStudyRisk(
  warehouse: Warehouse,
  studyId: string,
  options: { readonly fdr?: number } = {}
): StudyRiskAssessment {
  const study = warehouse.tables["gold.dim_study"].find(
    (s) => s.study_id === studyId
  );
  if (study === undefined) throw new Error(`unknown study ${studyId}`);
  const plan = qualityPlan(
    studyId,
    String(study.product_type),
    String(study.start_on)
  );
  const siteIds = warehouse.tables["gold.dim_site"]
    .filter(
      (s) => s.study_id === studyId && s.is_current && s.activated_on !== null
    )
    .map((s) => String(s.site_id))
    .sort();
  const kris = assessKris(warehouse, studyId, siteIds);
  const qtls = assessQtls(warehouse, studyId, plan);
  const csm = centralMonitoring(
    warehouse,
    studyId,
    options.fdr ?? CSM_DEFAULT_FDR
  );

  const signals: RaisedSignal[] = [];
  for (const qtl of qtls) {
    if (qtl.status !== "breached" && qtl.status !== "warning") continue;
    const definition = QTL_LIBRARY.find((q) => q.id === qtl.qtlId)!;
    const m = metric(definition.metricId);
    const value = formatMetricValue(m, qtl.value);
    signals.push({
      source: { kind: "qtl", qtlId: qtl.qtlId },
      note:
        qtl.status === "breached"
          ? `${definition.name} is ${value}, past the tolerance limit of ${formatMetricValue(m, qtl.limit)}. Planned response: ${definition.response}`
          : `${definition.name} is ${value}, past the secondary limit of ${formatMetricValue(m, qtl.secondaryLimit)} and below the tolerance limit of ${formatMetricValue(m, qtl.limit)}. The study team reviews it before it breaches.`,
    });
  }
  for (const siteId of csm.sites) {
    const flagged = csm.results.filter((r) => r.siteId === siteId && r.flagged);
    if (flagged.length === 0) continue;
    const names = flagged.map(
      (r) =>
        `${CSM_TESTS.find((t) => t.id === r.testId)!.name} (q = ${r.qValue.toExponential(1)})`
    );
    signals.push({
      source: { kind: "csm", siteId, testIds: flagged.map((r) => r.testId) },
      note: `${siteId} stands out from its peers on ${flagged.length === 1 ? "one test" : `${flagged.length} tests`} at a false discovery rate of ${csm.fdr}: ${names.join("; ")}.`,
    });
  }
  for (const assessment of kris) {
    if (assessment.status !== "red") continue;
    const kri = KRI_LIBRARY.find((k) => k.id === assessment.kriId)!;
    const m = metric(kri.metricId);
    signals.push({
      source: { kind: "kri", kriId: kri.id, siteId: assessment.siteId },
      note: `${kri.name} at ${assessment.siteId} is ${formatMetricValue(m, assessment.value)}, ${kri.direction === "high" ? "at or above" : "at or below"} the red threshold of ${formatMetricValue(m, kri.red)}.`,
    });
  }

  return {
    studyId,
    dataCut: warehouse.asOf,
    plan,
    kris,
    qtls,
    csm,
    log: raiseRiskSignals(studyId, warehouse.asOf, signals),
  };
}

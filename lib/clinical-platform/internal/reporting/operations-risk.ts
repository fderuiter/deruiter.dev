/**
 * The Risk tab of the operations dashboard (#2631): the study's risk-based
 * quality management from `assessStudyRisk`, narrowed to the country or
 * site in scope and put into words. Every value is the registry's, through
 * the same formatter the reports use, so a KRI reads the way its metric
 * does on every other tab.
 */
import type {
  MetricDefinition,
  OperationsKri,
  OperationsQtl,
  OperationsRisk,
  OperationsRiskFactor,
  RiskSignalSource,
  StudyRiskAssessment,
  Warehouse,
} from "../../types";
import { assessStudyRisk } from "../rbqm/assess";
import { CSM_TESTS, KRI_LIBRARY, QTL_LIBRARY } from "../rbqm/library";
import { formulaSources } from "../semantic/plan";
import { METRIC_REGISTRY } from "../semantic/registry";
import { formatMetricValue } from "./format";

function metric(id: string): MetricDefinition {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`the registry has no metric ${id}`);
  return found;
}

function kriName(id: string): string {
  return KRI_LIBRARY.find((kri) => kri.id === id)?.name ?? id;
}

function qtlName(id: string): string {
  return QTL_LIBRARY.find((qtl) => qtl.id === id)?.name ?? id;
}

/** Where a KRI turns amber and red, for example `Amber at 7 or more, red at 10 or more`. */
function thresholds(kri: (typeof KRI_LIBRARY)[number]): string {
  const m = metric(kri.metricId);
  const side = kri.direction === "high" ? "or more" : "or less";
  return `Amber at ${formatMetricValue(m, kri.amber)} ${side}, red at ${formatMetricValue(m, kri.red)} ${side}.`;
}

/**
 * Assessments already made, per warehouse and study. A warehouse is never
 * changed once built, and drilling from a study to its countries and sites
 * asks for the same study's assessment each time, so it is made once.
 */
const assessed = new WeakMap<Warehouse, Map<string, StudyRiskAssessment>>();

function assessment(warehouse: Warehouse, studyId: string) {
  let studies = assessed.get(warehouse);
  if (studies === undefined) {
    studies = new Map();
    assessed.set(warehouse, studies);
  }
  let found = studies.get(studyId);
  if (found === undefined) {
    found = assessStudyRisk(warehouse, studyId);
    studies.set(studyId, found);
  }
  return found;
}

/** Whether a signal belongs in scope: study-level ones always, site ones at a site in scope. */
function inScope(source: RiskSignalSource, sites: ReadonlySet<string>) {
  return source.kind === "qtl" || sites.has(source.siteId);
}

/**
 * The Risk tab for a study, narrowed to some of its sites.
 *
 * @param warehouse - The warehouse the dashboard reads.
 * @param studyId - The study drilled into.
 * @param scopeSites - The study's sites in scope, each with its country
 *   code: all of them at the study level, a country's or one site's below
 *   it.
 * @returns The tab's content.
 */
export function operationsRisk(
  warehouse: Warehouse,
  studyId: string,
  scopeSites: ReadonlyMap<string, string>
): OperationsRisk {
  const study = assessment(warehouse, studyId);
  const shown = new Set(
    study.kris.map((k) => k.siteId).filter((s) => scopeSites.has(s))
  );
  const sites = [...shown].map((id) => ({
    id,
    scope: { study: studyId, country: scopeSites.get(id)!, site: id },
  }));

  const kris: OperationsKri[] = KRI_LIBRARY.map((kri) => {
    const m = metric(kri.metricId);
    const minimum = metric(kri.minimum.metricId);
    return {
      id: kri.id,
      name: kri.name,
      metricId: kri.metricId,
      thresholds: thresholds(kri),
      reason: kri.reason,
      minimum: `${kri.minimum.value} ${minimum.name.toLowerCase()}`,
      cells: study.kris
        .filter((a) => a.kriId === kri.id && shown.has(a.siteId))
        .map((a) => ({
          siteId: a.siteId,
          status: a.status,
          text: formatMetricValue(m, a.value),
        })),
    };
  });

  const qtls: OperationsQtl[] = study.qtls.map((qtl) => {
    const definition = QTL_LIBRARY.find((q) => q.id === qtl.qtlId)!;
    const m = metric(definition.metricId);
    return {
      id: qtl.qtlId,
      name: definition.name,
      status: qtl.status,
      value: formatMetricValue(m, qtl.value),
      secondaryLimit: formatMetricValue(m, qtl.secondaryLimit),
      limit: formatMetricValue(m, qtl.limit),
      rationale: definition.rationale,
      response: definition.response,
    };
  });

  const factors: OperationsRiskFactor[] = study.plan.factors.map((factor) => ({
    id: factor.id,
    name: factor.name,
    risk: factor.risk,
    kris: factor.kriIds.map(kriName),
    qtls: factor.qtlIds.map(qtlName),
    gap: factor.gap,
  }));

  const { csm } = study;
  const raised = new Set(
    study.log
      .filter((entry) => entry.source !== null && inScope(entry.source, shown))
      .map((entry) => entry.signalId)
  );

  return {
    studyId,
    planVersion: study.plan.version,
    planEffectiveOn: study.plan.effectiveOn,
    sites,
    factors,
    kris,
    qtls,
    csm: {
      fdr: csm.fdr,
      tests: CSM_TESTS,
      sites: csm.sites.filter((s) => shown.has(s)),
      results: csm.results.filter((r) => shown.has(r.siteId)),
      excluded: csm.excluded.filter(
        (e) => e.siteId === null || shown.has(e.siteId)
      ),
    },
    log: study.log.filter((entry) => raised.has(entry.signalId)),
  };
}

/**
 * The gold tables the Risk tab reads: those of every KRI, KRI minimum and
 * QTL metric, and those central monitoring tests read directly.
 */
export function operationsRiskTables(): string[] {
  const metrics = [
    ...KRI_LIBRARY.flatMap((kri) => [kri.metricId, kri.minimum.metricId]),
    ...QTL_LIBRARY.map((qtl) => qtl.metricId),
  ];
  const tables = new Set<string>();
  for (const id of metrics) {
    for (const source of formulaSources(metric(id).formula)) {
      tables.add(source.table);
    }
  }
  for (const test of CSM_TESTS) {
    for (const column of test.reads) {
      tables.add(column.split(".").slice(0, 2).join("."));
    }
  }
  return [...tables].sort();
}

/**
 * Clinical Data Platform: public API (ADR 0066).
 *
 * One synthetic sponsor portfolio, modelled in bronze, silver and gold
 * layers, governed as data products and served through one semantic layer.
 * The engine is pure TypeScript with no DOM, React or Worker dependency; a
 * Web Worker imports it directly. Internals under `internal/` are private.
 */
export * from "./types";
export * from "./presets";
export {
  checkLayerFlow,
  checkRegulatoryWording,
  findClinicalClaims,
} from "./internal/policy";
export { generatePortfolio } from "./internal/portfolio/generate";
export { siteStaffFeed } from "./internal/portfolio/staff";
export {
  WAREHOUSE_SCHEMA,
  WAREHOUSE_SCHEMA_VERSION,
} from "./internal/warehouse/schema";
export {
  buildWarehouse,
  type WarehouseOptions,
} from "./internal/warehouse/build";
export { buildScd2Versions } from "./internal/warehouse/scd2";
export { checkWarehouse } from "./internal/warehouse/check";
export { emitDdl } from "./internal/warehouse/ddl";
export { exportWarehouse } from "./internal/warehouse/export";
export {
  renderWarehouseErd,
  renderWarehouseReference,
} from "./internal/warehouse/erd";
export { warehouseLineage } from "./internal/warehouse/lineage";
export {
  LINEAGE_STAGES,
  MEASURES_DATASET,
  METRICS_DATASET,
  REPORTS_DATASET,
  platformLineage,
} from "./internal/lineage/graph";
export {
  checkLineage,
  contractChangeImpact,
  lineageImpact,
  lineageUpstream,
} from "./internal/lineage/impact";
export {
  OPENLINEAGE_PRODUCER,
  toOpenLineageEvents,
} from "./internal/lineage/openlineage";
export { METRIC_GAPS, METRIC_REGISTRY } from "./internal/semantic/registry";
export { METRIC_DIMENSIONS } from "./internal/semantic/dimensions";
export { evaluateMetric } from "./internal/semantic/evaluate";
export { toSql } from "./internal/semantic/sql";
export { toMetricFlowYaml } from "./internal/semantic/metricflow";
export { toTmdl } from "./internal/semantic/tmdl";
export { describeMetricFormula } from "./internal/semantic/describe";
export {
  checkMetricChange,
  checkMetricRegistry,
  checkReportMetrics,
  metricRelease,
} from "./internal/semantic/check";
export { REPORT_PACK } from "./internal/reporting/pack";
export { checkReportSpec } from "./internal/reporting/check";
export { buildReport } from "./internal/reporting/build";
export {
  EXPLORATION_AUDIENCE,
  EXPLORATION_OWNER,
  EXPLORATION_PURPOSE,
  EXPLORATION_REFRESH_SLA_HOURS,
  EXPLORATION_VERSION,
  EXPLORER_MAX_BARS,
  EXPLORER_MAX_DIMENSIONS,
  EXPLORER_VISUALS,
  checkExploration,
  explorationChoices,
  explorationSpec,
  explorerMetrics,
  normalizeExploration,
  runExploration,
  startExploration,
  suggestVisual,
} from "./internal/explore/model";
export {
  EXPLORATION_HASH_MAX_LENGTH,
  decodeExploration,
  encodeExploration,
} from "./internal/explore/hash";
export { explorationCsv, promotionSteps } from "./internal/explore/output";
export {
  operationsDashboard,
  operationsReportSpecs,
} from "./internal/reporting/operations";
export {
  NO_METRIC_ROWS,
  NO_METRIC_VALUE,
  formatMetricValue,
} from "./internal/reporting/format";
export {
  reportCatalog,
  reportTelemetrySlug,
  searchReportCatalog,
  type ReportCatalogOptions,
} from "./internal/reporting/catalog";
export { workbenchSchema } from "./internal/workbench/schema";
export {
  WORKBENCH_DIALECTS,
  workbenchQueries,
} from "./internal/workbench/queries";
export {
  WORKBENCH_ENGINE_SETTINGS,
  checkWorkbenchSql,
} from "./internal/workbench/guard";
export {
  dataContracts,
  dataProducts,
} from "./internal/governance/contracts/derive";
export {
  checkDataContract,
  checkDataContracts,
  checkDataProducts,
  contractData,
} from "./internal/governance/contracts/check";
export {
  checkContractChange,
  contractChangeLevel,
  contractDifferences,
} from "./internal/governance/contracts/evolution";
export {
  ODCS_API_VERSION,
  toOdcs,
  toOdcsYaml,
} from "./internal/governance/contracts/odcs";
export {
  DATA_QUALITY_RULES,
  assessDataQuality,
  breakDataQualityRule,
} from "./internal/quality/assess";
export { DQ_SCENARIOS, applyDqScenario } from "./internal/quality/faults";
export {
  DQ_ISSUE_LOG,
  appendDqIssueEvent,
  dataQualityTrend,
  dqIssues,
  withOpenDqIssues,
} from "./internal/quality/issues";
export {
  scoreVendors,
  sensitivity,
  cashFlow,
  tornado,
  planRoadmap,
  decisionMemo,
} from "./internal/strategy/engine";
export {
  fitRecruitmentPrior,
  posteriorRate,
  recruitmentLogLikelihood,
  type SiteExposure,
} from "./internal/forecast/fit";
export { simulateEnrollmentCompletion } from "./internal/forecast/simulate";
export {
  FORECAST_DEFAULT_RUNS,
  FORECAST_DEFAULT_SEED,
  forecastEnrollment,
} from "./internal/forecast/enrollment";
export {
  CSM_TESTS,
  KRI_LIBRARY,
  QTL_LIBRARY,
  RISK_SIGNAL_ACTIONS,
  qualityPlan,
} from "./internal/rbqm/library";
export {
  CSM_DEFAULT_FDR,
  CSM_MIN_SITES,
  CSM_MIN_SITE_VISITS,
  centralMonitoring,
} from "./internal/rbqm/csm";
export {
  AUTOMATED_MONITORING,
  appendRiskSignal,
  checkRiskSignalLog,
  raiseRiskSignals,
  riskSignalStates,
  type RaisedSignal,
  type RiskSignalLogInput,
} from "./internal/rbqm/signals";
export { assessStudyRisk } from "./internal/rbqm/assess";
export {
  benjaminiHochberg,
  fCdf,
  invertMatrix,
  logGamma,
  poissonCdf,
  regularizedBeta,
  regularizedGammaP,
} from "./internal/rbqm/stats";

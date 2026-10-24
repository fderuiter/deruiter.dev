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
export {
  scoreVendors,
  sensitivity,
  cashFlow,
  tornado,
  planRoadmap,
  decisionMemo,
} from "./internal/strategy/engine";

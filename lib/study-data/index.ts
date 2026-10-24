/**
 * Study Data Pipeline: public API (ADR 0065).
 *
 * A deterministic, metadata-driven pipeline that takes one USDM study
 * definition through seeded synthetic data, SDTM, conformance, ADaM,
 * Define-XML and ARS-linked outputs. The engine is pure TypeScript with no
 * DOM, React or Worker dependency; a Web Worker imports it directly. Internals
 * under `internal/` are private.
 */
export * from "./types";
export * from "./presets";
export { runPipeline } from "./internal/engine";
export { deriveAdamDatasets } from "./internal/adam/derive-adam";
export type { AdamDerivation } from "./internal/adam/derive-adam";
export { runConformance } from "./internal/conformance/run-conformance";
export {
  CONFORMANCE_RULES,
  CONFORMANCE_RULES_VERSION,
  CDISC_CORE_URL,
} from "./internal/conformance/rules";
export type { ConformanceRule, RuleIssue } from "./internal/conformance/rules";
export type { ConformanceOutcome } from "./internal/conformance/run-conformance";
export {
  readStudyDefinition,
  StudyDefinitionError,
} from "./internal/usdm/read-study-definition";
export {
  itemGroupOid,
  itemOid,
  metaDataVersionOid,
  studyOid,
} from "./internal/export/oids";
export { exportColumns } from "./internal/export/columns";
export type { ExportColumn, StorageKind } from "./internal/export/columns";
export {
  toDatasetJson,
  writeDatasetJson,
  DATASET_JSON_ORIGINATOR,
  EXPORT_SOURCE_SYSTEM,
} from "./internal/export/dataset-json";
export type {
  DatasetJson,
  DatasetJsonColumn,
  DatasetJsonDataType,
  DatasetJsonOptions,
} from "./internal/export/dataset-json";
export { writeCsv } from "./internal/export/csv";
export {
  encodeIbmFloat,
  SAS_MISSING_NUMERIC,
} from "./internal/export/ibm-float";
export {
  writeXpt,
  XPT_LABEL_PREFIX,
  XPT_MAX_LABEL_BYTES,
  XPT_MAX_NAME_LENGTH,
  XPT_MAX_TEXT_BYTES,
  XPT_RECORD_LENGTH,
} from "./internal/export/xpt";
export type { XptResult } from "./internal/export/xpt";
export {
  buildStudyDataPackage,
  zipStudyDataPackage,
  sha256Hex,
  ADAM_PACKAGE_DIR,
  SDTM_PACKAGE_DIR,
  PACKAGE_FIXED_TIMESTAMP,
  PACKAGE_FORMAT_VERSION,
  PACKAGE_MANIFEST_PATH,
  PACKAGE_README_PATH,
  PACKAGE_TIMESTAMP_PATH,
} from "./internal/export/package";
export type {
  PackageFile,
  PackageManifest,
  PackageOptions,
  StudyDataPackage,
} from "./internal/export/package";
export {
  descriptiveStatistics,
  formatDecimal,
  formatPercent,
  inferDecimalPlaces,
  statisticDecimals,
  MAX_RAW_DECIMALS,
  STATISTIC_PRECISION,
} from "./internal/tlf/stats";
export type { StatisticKind } from "./internal/tlf/stats";
export {
  adamRowId,
  indexAdamRows,
  resolveResultRows,
} from "./internal/tlf/row-ids";
export { selectAdamRows } from "./internal/tlf/where";
export { escapeHtml, writeTableHtml } from "./internal/tlf/html";
export { escapeRtf, writeTableRtf } from "./internal/tlf/rtf";
export {
  buildTlfOutputs,
  writeArsJson,
  writeTlfFiles,
  ARS_REPORTING_EVENT_PATH,
  TLF_OUTPUT_DIR,
} from "./internal/tlf/outputs";

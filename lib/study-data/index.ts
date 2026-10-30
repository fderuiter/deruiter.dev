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
export { MESSY_DATA_SCENARIOS } from "./internal/synth/scenarios";
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
  prepareStudyHandoff,
  HANDOFF_GENERATED_DOMAINS,
} from "./internal/usdm/handoff";
export type {
  HandoffActivity,
  HandoffAssumption,
  HandoffReport,
  HandoffSkipReason,
  HandoffSkippedConcept,
  HandoffTest,
  StudyHandoff,
} from "./internal/usdm/handoff";
export {
  codeListOid,
  commentOid,
  defineFileOid,
  itemGroupOid,
  itemOid,
  leafId,
  metaDataVersionOid,
  methodOid,
  standardOid,
  studyOid,
  valueItemOid,
  valueListOid,
  whereClauseOid,
} from "./internal/export/oids";
export {
  buildDefine,
  DEFINE_XML_VERSION,
} from "./internal/define/build-define";
export {
  checkDefineParity,
  DEFINE_PARITY_RULES,
} from "./internal/define/parity";
export { writeDefineXml } from "./internal/define/write-define-xml";
export { renderDefineHtml } from "./internal/define/render-define-html";
export type {
  DefineCodeList,
  DefineCodeListTerm,
  DefineComment,
  DefineDataType,
  DefineDocument,
  DefineItem,
  DefineItemGroup,
  DefineItemRef,
  DefineLayer,
  DefineLeaf,
  DefineMethod,
  DefineOptions,
  DefineOrigin,
  DefineStandard,
  DefineValueList,
  DefineValuesOutsideCodelist,
  DefineWhereClause,
} from "./internal/define/model";
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
  ADAM_DEFINE_PATH,
  ADAM_PACKAGE_DIR,
  ADRG_PATH,
  CSDRG_PATH,
  SDTM_DEFINE_PATH,
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
export { buildReviewerGuides } from "./internal/guides/reviewer-guides";
export type {
  ReviewerGuide,
  ReviewerGuideAnalysis,
  ReviewerGuideDataset,
  ReviewerGuideDerivation,
  ReviewerGuideFlowStep,
  ReviewerGuideIssue,
  ReviewerGuideKind,
  ReviewerGuideOutput,
  ReviewerGuides,
} from "./internal/guides/reviewer-guides";
export {
  renderReviewerGuideHtml,
  writeReviewerGuideDocument,
} from "./internal/guides/render-reviewer-guide";
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
  rowSetRowIds,
} from "./internal/tlf/row-ids";
export {
  checkReportingEvent,
  REPORTING_EVENT_RULES,
} from "./internal/tlf/check-reporting-event";
export { selectAdamRows } from "./internal/tlf/where";
export { escapeHtml, writeTableHtml } from "./internal/tlf/html";
export { escapeRtf, writeTableRtf } from "./internal/tlf/rtf";
export {
  buildTlfOutputs,
  writeArsJson,
  writeArsLineageJson,
  writeTlfFiles,
  ARS_REPORTING_EVENT_PATH,
  ARS_RESULT_LINEAGE_PATH,
  TLF_OUTPUT_DIR,
} from "./internal/tlf/outputs";
export {
  chiSquareSurvival,
  kaplanMeierEstimate,
  logRankTest,
  KM_CONFIDENCE_LEVEL,
  NORMAL_QUANTILE_975,
} from "./internal/tlf/km";
export {
  compareOnComponent,
  normalQuantile,
  winStatistics,
  WIN_RATIO_DEFAULT_ALPHA,
} from "./internal/tlf/win-ratio";
export { formatPValue } from "./internal/tlf/km-evaluate";
export { writeKmFigureHtml, writeKmFigureSvg } from "./internal/tlf/km-svg";
export {
  createLineageIndex,
  DEFAULT_LINEAGE_LIMIT,
} from "./internal/lineage/trace";
export type { LineageIndex } from "./internal/lineage/trace";
export type {
  LineageDisplayCell,
  LineageLevel,
  LineageOrigin,
  LineageRecord,
  LineageRelation,
  LineageResult,
  LineageScheduleEntry,
  LineageStep,
  LineageTrace,
  LineageTraceOptions,
  LineageVisit,
} from "./internal/lineage/model";
export {
  conformanceLayers,
  coreRuleStates,
  RULE_STATES,
} from "./internal/core/layers";
export type {
  LayerEvidence,
  RuleLayer,
  RuleState,
} from "./internal/core/layers";
export {
  CORE_EXAMPLES_SHOWN,
  coreViewReport,
  loadRecordedCoreFindings,
  recordedCoreView,
} from "./internal/core/recorded";
export type {
  CoreFinding,
  CoreFindingExample,
  CoreView,
  CoreViewReport,
  RecordedCrfPreset,
  RecordedDefaultView,
  RecordedExplanation,
  RecordedFindings,
  RecordedLines,
  RecordedLock,
  RecordedRule,
  RecordedScenarioView,
  RecordedTwin,
} from "./internal/core/recorded";

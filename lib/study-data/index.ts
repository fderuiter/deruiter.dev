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

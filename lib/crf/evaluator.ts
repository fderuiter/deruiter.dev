/**
 * Focused public entry point for pure CRF expression evaluation and linting.
 * Keeps `lib/services/crf-evaluator` and `lib/services/index.ts` free of
 * file-ingestion and `isomorphic-dompurify` dependencies on read-only routes.
 */
export {
  evaluateFormula,
  parseAndEvaluateFormula,
  type FormulaEvaluationError,
  type FormulaEvaluationErrorCode,
  type FormulaEvaluationResult,
} from "./internal/expression-evaluator";
export { lintFormula, type FormulaLintResult } from "./internal/formula-linter";
export { lintForm, type DiagnosticItem } from "./internal/form-linter";
